# Phase 02 — Checkout Payment Experience & Order Placement

## Current checkout architecture

The frontend is static HTML, CSS, and Vanilla JavaScript. `frontend/checkout.html` loads shared `frontend/js/api.js`, `frontend/js/cart.js`, the page module `frontend/js/checkout.js`, and shared navigation from `frontend/js/app.js`. Checkout is a single page. The cart module stores only `{ productId, quantity }` in localStorage. The checkout page currently loads current products, renders a client-side summary, validates shipping fields, and calls `createOrder(items, shipping)` from the API module.

The current checkout has three Phase 02 compatibility issues: it removes or clamps stale cart items during loading, it displays an unsupported 8% tax, and it has no payment method or simulated payment-information flow. Phase 02 corrects those behaviors without changing the backend contract or the cart storage format.

## Backend contract used

The authoritative Phase 01 contract is `docs/order-lifecycle-phase-01.md` and the implemented endpoint is:

```http
POST /api/orders
```

Authentication uses the existing HttpOnly JWT cookie. The request body remains:

```json
{
  "items": [
    { "productId": 1, "quantity": 2 }
  ],
  "shipping": {
    "name": "Customer Name",
    "email": "customer@example.com",
    "phone": "+1 555 123 4567",
    "addressLine1": "123 Main Street",
    "addressLine2": "Apartment 2",
    "city": "City",
    "state": "State",
    "postalCode": "12345",
    "country": "United States"
  },
  "payment": {
    "method": "CASH_ON_DELIVERY",
    "provider": null
  }
}
```

`items` and `shipping` remain the existing fields. `payment` is the Phase 01 extension. The backend validates and persists only these payment fields:

```text
payment_method
payment_status
payment_provider
```

Supported values are:

```text
method:
  CASH_ON_DELIVERY
  CARD
  MOBILE_BANKING

provider:
  CARD -> VISA | MASTERCARD
  MOBILE_BANKING -> BKASH | NAGAD
  CASH_ON_DELIVERY -> null
```

The successful response is `{ success: true, message, data: { order, items } }`. The order contains `id`, `totalAmount`, `status`, `createdAt`, `estimatedDeliveryFrom`, `estimatedDeliveryTo`, `paymentMethod`, `paymentStatus`, `paymentProvider`, and historical order-item data. The backend remains authoritative for product availability, price, stock, total, delivery window, and payment status.

## Payment UI decisions

### Cash on Delivery

Selecting Cash on Delivery requires no dialog or payment credential. The payment summary displays the method and explanatory text. The backend defaults omitted payment selection to this method, but the checkout sends it explicitly.

### Card

Selecting Card opens an accessible simulated dialog. It may temporarily collect cardholder name, card number, expiry, and CVV for UI validation. It never sends those values to the backend, cart storage, URLs, logs, or order data. Confirmation stores only the safe provider (`VISA` or `MASTERCARD`) and last four digits in in-memory page state for the payment summary. The temporary input values are cleared when the dialog closes.

### Mobile Banking

Selecting Mobile Banking reveals the backend-supported providers bKash and Nagad. Choosing one opens an accessible simulated dialog for a mobile number and optional transaction reference. It never requests a PIN, OTP, password, or secret. Only the safe provider is sent to the backend. Temporary input values are cleared when the dialog closes.

The backend does not support Rocket in Phase 01, so the frontend does not offer it.

## Checkout state transitions

```text
LOADING
  -> EMPTY_CART
  -> AUTH_REQUIRED
  -> READY

READY
  -> PAYMENT_METHOD_SELECTED
  -> SIMULATED_PAYMENT_DIALOG_OPEN
  -> PAYMENT_CONFIRMED
  -> SUBMITTING
  -> SUCCESS
  -> ERROR

SUBMITTING
  -> SUCCESS
  -> ERROR
  -> READY
```

The payment method is required before order submission. Card and mobile-banking simulated dialogs are optional UX confirmations, but payment method/provider state must be valid before Place Order. A repeated Place Order click is ignored while submitting.

## Review and totals

The page shows the current cart products, quantity, current backend-loaded price, shipping information, and selected safe payment metadata. It does not calculate tax, shipping fees, discounts, or service fees because the backend contract has none. The displayed subtotal is only a UX estimate. The backend-created `order.totalAmount` is the authoritative total and is not independently recalculated by the frontend.

The page does not silently remove products or clamp quantities. If a product is unavailable or stock has changed, the backend order response is mapped to a useful message, the cart remains intact, and the customer can return to the cart to review it.

## Submission and error handling

On submission, the checkout validates shipping, payment method, and simulated payment state; disables the CTA; and sends only:

```json
{
  "items": [{ "productId": 1, "quantity": 2 }],
  "shipping": {},
  "payment": {
    "method": "CARD",
    "provider": "VISA"
  }
}
```

A successful response clears the cart and redirects to:

```text
order-details.html?id=<orderId>
```

Failures keep the cart and show user-facing states for authentication, validation, unavailable products, stock conflicts, rejected payment metadata, and generic server failure. Raw backend details, SQL errors, and payment credentials are not displayed or logged.

## Security

Card numbers, CVV, mobile banking credentials, PINs, OTPs, passwords, and banking secrets are intentionally excluded from the request, localStorage, sessionStorage, URL parameters, cart data, and logs. The page keeps simulated values in local JavaScript variables only long enough to validate and display a safe summary, then clears them when a dialog closes.

No real gateway, authorization, capture, refund, webhook, or payment callback is implemented. Card and mobile banking are simulated UI flows only. `paymentStatus` remains whatever the backend returns; the frontend never changes it to `PAID`.

## Accessibility and responsive behavior

Payment options use native radio controls with visible selected states. Dialogs use `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, Escape-to-close, focus restoration, and focus placement on the first meaningful input. Error messages are associated with controls and live regions announce submission errors. Existing checkout grid, form controls, typography, colors, and buttons remain the basis of the design. Payment cards, dialogs, summary content, and actions stack without horizontal overflow on small screens.

## Testing strategy

Validation covers:

- JavaScript syntax and HTML parsing
- payment method/provider selection
- simulated card and mobile-banking validation
- safe summary rendering
- request payload shape
- duplicate-submit prevention
- cart preservation on failure
- cart clearing only after confirmed success
- redirect using the returned order ID
- no sensitive payment fields in the API payload
- existing backend regression tests

## Implemented

- Checkout payment method selector for Cash on Delivery, Card, and Mobile Banking.
- Simulated card dialog with temporary UI-only fields and safe summary.
- Simulated bKash/Nagad dialog with temporary UI-only fields and safe summary.
- Accessible dialog focus, Escape handling, and validation.
- Payment metadata request integration with the existing API client.
- Shipping validation and backend error mapping.
- Duplicate-submission protection and recoverable submission states.
- Order summary correction to remove unsupported tax and stale-cart mutation.
- Responsive payment and dialog styling.

## Backend Contract Used

The checkout uses the actual `POST /api/orders` endpoint and exact Phase 01 payment shape. It does not define a new backend DTO or a real payment payload.

## Known Limitations

No real payment gateway is integrated. Card and mobile-banking flows are simulated. No actual payment is processed, authorized, captured, or refunded.

# Phase 03 Handoff

Phase 03 will use the order response and existing order endpoints to implement customer-facing order history and order details improvements:

- order timeline and status presentation
- original placement date
- backend-provided estimated delivery window
- cancellation action for backend-cancellable statuses
- cancellation confirmation and optional reason
- cancelled state
- payment method/provider/status presentation
- delivery status
- responsive order details UI

Phase 03 must use `GET /api/orders`, `GET /api/orders/:id`, and `POST /api/orders/:id/cancel`; it must not infer cancellation permission in the frontend or delete orders.
