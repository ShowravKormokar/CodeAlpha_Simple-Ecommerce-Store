# Phase 03 — Order History, Order Details, Cancellation & Lifecycle UI

## Current order-history architecture

`frontend/orders.html` is a static page that loads `css/style.css`, `css/orders.css`, `js/api.js`, `js/orders.js`, and the shared navigation module `js/app.js`. It renders one of four mutually exclusive states through inline `style.display` toggles: `#loading`, `#error-state`, `#empty-state`, and `#orders-list`. Navigation, authentication state, and cart count come from `app.js`; order data comes only from `api.js`.

`frontend/js/orders.js` calls `getOrders()`, which returns `{ authenticated, data: { orders } }`. The current renderer reads only `id`, `status`, `createdAt`, and `totalAmount`. The backend already returns placement, lifecycle, payment, and delivery fields, but the history card ignores them. `showError(message)` also rebuilds the error container with `innerHTML` and re-creates the retry button, which orphans the module-level retry binding. Phase 03 removes those `innerHTML` sinks and keeps the original static state markup and retry button intact.

## Current order-details architecture

`frontend/order-details.html` loads the same shared styles plus `css/rating.css`, and renders `#loading`, `#error-state`, `#not-found-state`, `#invalid-state`, or `#order-details`. The page reads the order ID with `new URLSearchParams(window.location.search).get("id")` and preserves the existing `order-details.html?id=<orderId>` convention.

`frontend/js/order-details.js` already renders the order header, placement date, authoritative `totalAmount`, historical shipping snapshot, historical order-item unit price and subtotal, and the existing rating control. Rating is only interactive when the order status is `completed`, which matches the current backend behavior and must be preserved. The page has no timeline, delivery window, payment information, cancellation information, or cancellation action.

The existing state branch logic also reads `result.status` and `result.success` from `getOrderById()`, which never returns those properties on the success path, so those branches are unreachable. Phase 03 removes the dead branches and relies on the actual return contract.

## Backend response contract

All order routes are mounted at `/api` and require the HttpOnly `access_token` JWT cookie. The frontend never sends a customer ID.

```http
GET /api/orders
```

```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": 1,
        "userId": 4,
        "totalAmount": 39.98,
        "status": "confirmed",
        "createdAt": "2026-09-26T10:00:00.000Z",
        "updatedAt": "2026-09-26T10:00:00.000Z",
        "estimatedDeliveryFrom": "2026-10-05",
        "estimatedDeliveryTo": "2026-10-14",
        "cancelledAt": null,
        "cancelledByUserId": null,
        "cancellationReason": null,
        "paymentMethod": "CASH_ON_DELIVERY",
        "paymentStatus": "PENDING",
        "paymentProvider": null,
        "shippingName": "Customer Name",
        "shippingEmail": "customer@example.com",
        "shippingPhone": "+1 555 123 4567",
        "shippingAddressLine1": "123 Main Street",
        "shippingAddressLine2": null,
        "shippingCity": "City",
        "shippingState": "State",
        "shippingPostalCode": "12345",
        "shippingCountry": "United States"
      }
    ]
  }
}
```

The list response contains order-level data only. It does not contain order items.

```http
GET /api/orders/:id
```

```json
{
  "success": true,
  "data": {
    "order": {
      "...": "all order-level fields",
      "items": [
        {
          "id": 10,
          "productId": 1,
          "productName": "Wireless Mouse",
          "quantity": 2,
          "unitPrice": 19.99,
          "subtotal": 39.98,
          "rating": null,
          "ratedAt": null
        }
      ]
    }
  }
}
```

A missing or not-owned order returns HTTP 404 with `{ success: false, message: "Order not found" }`. The frontend cannot distinguish the two cases and must not try.

```http
POST /api/orders/:id/cancel
Content-Type: application/json

{ "reason": "Changed my mind" }
```

Success is HTTP 200:

```json
{
  "success": true,
  "message": "Order cancelled successfully",
  "data": {
    "order": { "...": "updated order" },
    "already_cancelled": false
  }
}
```

The flag is `already_cancelled` in snake case; every other order field is camel case. An already cancelled order returns HTTP 200 with `"Order was already cancelled"` and `already_cancelled: true`.

Cancellation errors use the existing safe envelope:

| Status | Message |
| --- | --- |
| 400 | `Invalid order ID` |
| 400 | `Cancellation reason must be 500 characters or fewer` |
| 401 | `Authentication required` or `Invalid or expired token` |
| 404 | `Order not found` |
| 409 | `Order cannot be cancelled in its current status` |

## Lifecycle and status model

The implemented database and API statuses are lower case:

```text
pending
confirmed
processing
shipped
delivered
completed
cancelled
```

The central backend policy in `order-lifecycle.service.js` allows cancellation only for:

```text
pending
confirmed
processing
```

`shipped`, `delivered`, `completed`, and `cancelled` are not cancellable and return HTTP 409. The frontend mirrors this set only to decide whether to render the action; the backend remains the sole authority and the UI always handles a 409 by reloading the authoritative order.

The backend exposes no `confirmedAt`, `processingAt`, `shippedAt`, `deliveredAt`, or `completedAt` values. It exposes only `createdAt`, `updatedAt`, and `cancelledAt`. The timeline is therefore a state visualization, not a transition history. Only the placement date and, for a cancelled order, the cancellation date are rendered as dates.

## Timeline design

The timeline is derived from the single current status and never invents timestamps.

| Current status | Rendered steps |
| --- | --- |
| `pending` | Order Placed (current), Pending (current) |
| `confirmed` | Order Placed (complete), Confirmed (current) |
| `processing` | Order Placed, Confirmed, Processing (current) |
| `shipped` | Order Placed, Confirmed, Shipped (current) |
| `delivered` | Order Placed, Confirmed, Shipped, Delivered (current) |
| `completed` | Order Placed, Confirmed, Shipped, Delivered, Completed (current) |
| `cancelled` | Order Placed, Cancelled (current) |

Future steps are omitted rather than shown as pending, because the backend does not guarantee a future progression for an order that has not entered those states. A cancelled order never renders a delivery progression, so the UI cannot imply the order is still being fulfilled. `cancelled` is visually and textually distinct from every active state.

## Payment display rules

Only the safe Phase 01/Phase 02 metadata is rendered:

```text
paymentMethod   CASH_ON_DELIVERY | CARD | MOBILE_BANKING
paymentProvider VISA | MASTERCARD | BKASH | NAGAD | null
paymentStatus   PENDING | AUTHORIZED | PAID | FAILED | CANCELLED
```

Method and provider are mapped to customer-facing labels. `paymentStatus` is displayed exactly as returned. The frontend never renders, logs, or stores a card number, CVV, PIN, OTP, password, or banking credential, and never claims a refund or captured payment. When cancellation changes a `PENDING` payment to `CANCELLED`, the UI shows the returned status and no refund language.

## Delivery estimate behavior

`estimatedDeliveryFrom` and `estimatedDeliveryTo` are persisted backend date-only values in `YYYY-MM-DD` form. They are rendered as-is after UTC-safe parsing so the displayed calendar day does not shift by timezone. The frontend never recalculates a delivery date and never applies its own `+7` or `+14` working-day logic. Orders created before Phase 01 return `null` for both values; the delivery card is omitted in that case. A cancelled order labels the window as the original estimate and states that the order is no longer being delivered.

## UI states

Order history:

```text
LOADING
  -> AUTH_REQUIRED
  -> ERROR
  -> EMPTY
  -> ORDERS
```

Order details:

```text
LOADING
  -> INVALID_ID
  -> AUTH_REQUIRED
  -> NOT_FOUND
  -> ERROR
  -> DETAILS
```

Cancellation:

```text
CANCELLABLE
  -> CONFIRMATION_DIALOG_OPEN
  -> SUBMITTING
  -> CANCELLED | AUTH_REQUIRED | CONFLICT | NOT_FOUND | ERROR
```

## Cancellation UX

The Cancel Order action appears only for `pending`, `confirmed`, and `processing`. It opens an accessible confirmation dialog that states the order number, explains that cancellation is final and that inventory rollback is handled by the store, and never promises a refund. The reason field is optional, limited to the backend's 500-character maximum, shows a live character counter, and is validated in the UI before submission.

On confirmation the frontend disables the destructive button, shows a loading state, sends only the order ID and the optional reason, and waits for the backend response. The UI is rendered from the returned `data.order`. It never applies a local status mutation, never deletes the order, and never performs inventory rollback. A 409 refreshes the order from `GET /api/orders/:id` so the timeline, status, actions, and payment information match the backend. Duplicate submission is prevented while a request is in flight, and cancellation is never retried automatically.

## Accessibility requirements

- Semantic headings, `section` landmarks, and `ol`/`li` for the timeline.
- Status is communicated with text and an icon, not color alone.
- Status badges use the existing `status-*` palette; payment status adds distinct badges.
- The dialog uses `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and `aria-describedby`, receives focus on its first control, traps Tab, closes on Escape, and restores focus to the trigger.
- The dialog is keyboard-operable and the destructive action is never the default focus target.
- A dedicated `role="status"` live region announces loading, cancellation success, and cancellation failure.
- Field errors use `aria-invalid` and `aria-describedby`.
- Visible focus states use the existing `focus-visible` accent outline.

## Responsive behavior

The history card, timeline, information panels, item list, action row, and cancellation dialog stack on tablet and mobile without horizontal overflow. Date-only values are parsed and formatted without widening layouts, and long shipping values wrap. Dialog actions become full width on small screens. Shared navigation and cart count continue to come from `app.js`.

## Testing checklist

- Order history: authenticated customer with orders, empty cart, cancelled order visibility, loading, error, retry, sorting, and details navigation.
- Order details: valid order, missing ID, malformed ID, 404, 401, server error, every lifecycle status, historical item prices, and rating preservation.
- Timeline: every implemented status, cancelled ordering, and absence of invented timestamps.
- Delivery: date-only parsing without timezone shift, missing window, and cancelled messaging.
- Payment: COD, card provider, mobile provider, every payment status, and no sensitive fields.
- Cancellation: eligible order, non-eligible order, optional reason, 500-character limit, duplicate-submit prevention, success, 409 refresh, 404, 401, and already-cancelled idempotency.
- Security: no sensitive payment data in the DOM, URL, storage, network payload, or console output.
- Responsive: desktop, tablet, and mobile for both pages and the dialog.
- Accessibility: keyboard-only navigation, Tab trap, Escape close, focus restoration, live region announcements, and non-color status cues.

## Implemented

- Order history cards now show order ID, placement date, status, total, payment method, payment status, delivery window, and cancellation state.
- Order history error handling keeps the original static markup, so the retry button binding stays valid.
- Order details now render a lifecycle timeline, delivery information, payment information, historical items, authoritative total, shipping snapshot, and cancellation information.
- A `cancelOrder(orderId, reason)` API function uses the implemented Phase 01 endpoint.
- An accessible cancellation dialog with optional reason, character counter, focus management, and loading state.
- Cancellation success renders the backend-returned order; 409 and 404 refresh or report the authoritative state.
- Responsive styles and non-color status cues for all new sections.

## Backend Contract Used

- `GET /api/orders` — order history.
- `GET /api/orders/:id` — order detail, item history, and post-cancellation refresh.
- `POST /api/orders/:id/cancel` — cancellation with an optional `reason` of at most 500 characters.
- Statuses: `pending`, `confirmed`, `processing`, `shipped`, `delivered`, `completed`, `cancelled`.
- Cancellable statuses: `pending`, `confirmed`, `processing`.
- Payment: `paymentMethod`, `paymentProvider`, `paymentStatus`.
- Delivery: `estimatedDeliveryFrom`, `estimatedDeliveryTo` as persisted date-only values.
- Ownership: determined exclusively by the JWT cookie; 404 for missing or not-owned orders.

## Known Limitations

- The backend exposes no per-status transition timestamps, so the timeline cannot show when each state was reached.
- The backend does not expose a lifecycle history array; only the current status is authoritative.
- `productName` in the detail response is joined from the current product row rather than a frozen name snapshot, so a renamed product shows its current name. Historical price, quantity, and subtotal are stored on the order item and are rendered as stored.
- Payment processing is simulated. There is no gateway, capture, refund, or settlement state, so the UI never claims that a refund occurred.
- The order list endpoint returns no items, so the history page intentionally does not show item counts or product thumbnails.
- Order-history pagination is not implemented by the backend; the page renders the full returned list.
- There is no frontend test runner or browser automation in the repository, so validation relies on syntax, HTML, contract, security, and backend regression checks.

## Verification Results

Static and contract checks:

- `node --check` passes for `frontend/js/orders.js`, `frontend/js/order-details.js`, and `frontend/js/api.js`.
- `frontend/orders.html` and `frontend/order-details.html` both parse with balanced tags.
- `frontend/css/orders.css` braces balance to depth 0 with no premature close.
- `git diff --check` reports no whitespace errors.
- DOM and ARIA contract check passes for both pages.
- Security scan of the Phase 03 scripts confirms no `innerHTML`, `outerHTML`, `insertAdjacentHTML`, or `document.write`, no sensitive payment field access, no `localStorage`/`sessionStorage`/`document.cookie` use, no `userId` usage, and no local delivery-date recalculation.

Behavioral check: a temporary DOM harness executed both page scripts against fixture API responses and asserted 104 behaviors, all passing. It covers history rendering, ID, placement date, total, payment method, payment status, delivery window, cancelled visibility, cancellation date, card provider, live-region announcement, details header, status, timeline, payment, shipping, historical unit price, historical subtotal, authoritative total, and the empty, unauthenticated, error, and retry states on both pages; missing, malformed, and non-positive order IDs are rejected without a request; cancellation covers success, already-cancelled idempotency, 401, 404, 400, 409, 500, and network failure; the 500-character reason limit is enforced before any request; duplicate submit sends one request; and rating is interactive only for completed orders, read-only once rated, and explained as locked for every other status.

Two defects were found and fixed by this harness: payment status labels rendered as `PENDING` instead of `Pending`, and the history delivery window rendered as `Oct – Oct` because the date formatter dropped the year and day. Delivery ranges now collapse a repeated year, producing `October 5 – 14, 2026`.

A third defect was found in the Phase 02 checkout page during validation: `form.elements.namedItem("paymentMethod")` returns a `RadioNodeList` for the three payment-method radios, so the optional-chained `addEventListener` call threw `TypeError: ... is not a function` and broke page initialization. `frontend/js/checkout.js` now resolves form controls through a `getFieldElements` helper and binds the change handler to each radio, and reads selected values through `getSelectedValue`.

Backend regression:

- `npx jest --runInBand` in `backend` passes all 6 suites and 98 tests, confirming Phase 03 did not regress the order contract.
- The default parallel `npm test` run can fail order and lifecycle tests with `fk_orders_user` violations. This is a pre-existing fixture race in `backend/tests/setup.js`: the shared `test@example.com` user is created and deleted by the global `beforeAll`/`afterAll` in every test file, so one worker's `afterAll` can remove the user while another suite is still inserting orders. It is unrelated to Phase 03, which modifies no backend file, and it is documented here rather than fixed in this phase.

