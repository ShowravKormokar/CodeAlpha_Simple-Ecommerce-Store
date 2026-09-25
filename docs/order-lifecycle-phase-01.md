# Phase 01 — Order Lifecycle, Customer Cancellation, and Transaction-Safe Rollback

## 1. Current architecture

The application is an Express and raw `pg` backend. Order requests are mounted at `/api/orders` in `src/routes/order.routes.js`, protected by the JWT cookie middleware, and delegated to `src/controllers/order.controller.js`. The service layer in `src/services/order.service.js` owns item normalization, authoritative product price lookup, stock validation, order creation, order history, and order detail queries. There is no ORM or separate order repository abstraction.

Order placement is already a single PostgreSQL transaction. It begins a transaction, locks requested product rows with `SELECT ... FOR UPDATE`, validates products and stock, calculates prices from `products.price`, inserts the order and order items, deducts stock, and commits. Any failure rolls back the transaction and releases the client.

The existing order schema has `orders.status` constrained to the lower-case values `pending`, `confirmed`, `completed`, and `cancelled`. New orders are created directly as `confirmed`; no administrative status transition endpoint exists. Order items preserve quantity, unit price, and subtotal, and order reads already enforce ownership through `orders.user_id`.

Authentication middleware verifies the JWT cookie and places the authenticated subject in `req.userId`. The cancellation endpoint will use that value exclusively; it will not accept a customer ID from the request body, query, or route.

## 2. Lifecycle and state machine

The existing lower-case status convention is retained. The lifecycle is extended with the intermediate operational states needed to represent the eventual fulfillment flow, while cancellation remains available only before shipment.

```text
PENDING
  -> CONFIRMED
  -> CANCELLED

CONFIRMED
  -> PROCESSING
  -> CANCELLED

PROCESSING
  -> SHIPPED
  -> CANCELLED

SHIPPED
  -> DELIVERED

DELIVERED
  -> COMPLETED

CANCELLED
  terminal

COMPLETED
  terminal
```

The database stores the same lower-case values: `pending`, `confirmed`, `processing`, `shipped`, `delivered`, `completed`, and `cancelled`. Order creation remains `confirmed` to preserve current behavior. Phase 01 does not expose an arbitrary customer status mutation route; the fulfillment transitions are a documented central policy for future system/admin operations.

`pending`, `confirmed`, and `processing` are cancellable. `shipped`, `delivered`, `completed`, and `cancelled` are not cancellable. The backend is authoritative. The frontend must not decide whether cancellation is allowed.

## 3. Cancellation rules

`POST /api/orders/:id/cancel` requires authentication and accepts an optional JSON `reason` of at most 500 trimmed characters. The authenticated user must own the order. The service locks the order row before inspecting its current status, so repeated and concurrent requests serialize. A request for an already cancelled order returns the updated order with an `already_cancelled` flag and does not restore stock again. Missing or non-owned orders return the existing safe 404 response. Non-cancellable orders return HTTP 409. Invalid reasons return HTTP 400.

Cancellation never deletes an order or order item. Historical item quantities, unit prices, subtotals, product IDs, and order totals remain unchanged.

## 4. Inventory rollback strategy

There is no inventory movement ledger in the current project. Phase 01 does not introduce a new ledger subsystem. The existing `products.stock_quantity` column remains the source of truth.

For each eligible order, the cancellation transaction locks the order, reads its order-item quantities, locks all referenced product rows in deterministic ID order, and increments each product by the recorded order-item quantity. It never derives restoration quantity from current product state. The order status and cancellation metadata are updated in the same transaction as the stock updates.

This is safe against cancellation races because the order row is locked first. A second cancellation waits for the first transaction, then observes `cancelled` and skips restoration. Product row locks serialize restoration with order placement stock updates.

## 5. Transaction boundaries

Cancellation is one transaction:

```text
BEGIN
  lock order by id and authenticated user
  if absent -> ROLLBACK
  if already cancelled -> COMMIT unchanged and return idempotent result
  validate cancellable status
  read order-item product IDs and quantities
  lock product rows in ID order
  increment product stock using recorded item quantities
  update order status to cancelled
  set cancellation timestamps, actor, and optional reason
  update pending payment status to cancelled
COMMIT
```

Any lock, update, or commit failure rolls back the order and inventory changes together. PostgreSQL's default read-committed isolation plus row locks is sufficient because the mutable order state is locked and every stock change is in the same transaction.

Order creation remains one transaction and additionally persists the delivery window and payment foundation before committing. A failure at any step rolls back the order header, order items, and stock deductions.

## 6. Idempotency and timestamps

Cancellation is state-idempotent rather than request-idempotent: the order lock and terminal `cancelled` state ensure that stock restoration happens at most once even when requests are repeated or concurrent. The initial cancellation response identifies whether this request performed the transition.

`created_at` remains the original placement timestamp and is never overwritten. New orders persist `cancelled_at`, `cancelled_by_user_id`, and `cancellation_reason` only when cancellation succeeds. Fulfillment timestamps are not added because no system status mutation workflow exists in this phase.

## 7. Delivery estimate

New orders persist a date window rather than a single fabricated delivery date:

- `estimated_delivery_from`: the 7th working day after the placement date
- `estimated_delivery_to`: the 14th working day after the placement date

Working days are Monday through Friday; Saturday and Sunday are skipped. The calculation is reusable, uses the persisted placement date, and is stored once during order creation. Existing orders receive `NULL` estimates because historical values cannot be inferred safely. Reads never recalculate or change these dates.

The calculation uses date-only UTC arithmetic to avoid daylight-saving and server-local-time differences. No public-holiday calendar is introduced.

## 8. Payment-method foundation

Orders persist only safe selection metadata:

- `payment_method`: `CASH_ON_DELIVERY`, `CARD`, or `MOBILE_BANKING`
- `payment_status`: `PENDING` for new orders and `CANCELLED` when a pending order is cancelled
- `payment_provider`: `VISA`/`MASTERCARD` for card, `BKASH`/`NAGAD` for mobile banking, and `NULL` for cash on delivery

Existing orders use `NULL` payment method and `PENDING` payment status because their historical payment selection is unknown. New requests may provide `payment: { method, provider }`; omitted payment defaults to `CASH_ON_DELIVERY` for compatibility with the current checkout client. Backend validation rejects unsupported methods, unsupported providers, and invalid method/provider combinations.

No card number, CVV, PIN, OTP, banking password, payment token, or other authentication secret is stored or returned. This phase only validates and persists the selected safe metadata; it does not call a gateway or claim that a card/mobile payment was authorized, captured, or refunded.

## 9. Database changes and migration strategy

Migration `005_order_lifecycle.sql` is additive and idempotent. It adds the delivery window, cancellation, and payment columns, then replaces the existing status check with the lifecycle value set. It does not drop tables, truncate data, delete orders, or modify order items. Existing rows receive nullable delivery/payment-method/cancellation values and a non-paid `PENDING` payment status. A named foreign key links `cancelled_by_user_id` to `users.id` with restrictive deletion behavior.

The canonical `backend/database/schema.sql` is updated with the same columns, status constraint, foreign key, and indexes needed for order ownership/history lookups. Migration files are applied by the existing migration runner in lexical order.

## 10. API contract

### Create order

```http
POST /api/orders
```

Existing requests remain valid with `{ items, shipping }`. The optional extension is:

```json
{
  "items": [{ "productId": 1, "quantity": 2 }],
  "shipping": {},
  "payment": { "method": "CARD", "provider": "VISA" }
}
```

The response continues to use the existing `{ success, message, data: { order, items } }` envelope and adds lifecycle/payment fields to `order`. The created order includes `createdAt`, `estimatedDeliveryFrom`, `estimatedDeliveryTo`, `paymentMethod`, `paymentStatus`, and `paymentProvider`.

### Get orders

```http
GET /api/orders
```

All existing customer-owned orders remain visible, including cancelled orders. Each history item exposes the lifecycle, delivery, payment, and cancellation metadata needed by the future Order History UI.

### Get order

```http
GET /api/orders/:id
```

The existing ownership behavior remains: another customer's order is not found. The detail response adds the same lifecycle/payment/cancellation fields while preserving historical item values.

### Cancel order

```http
POST /api/orders/:id/cancel
Content-Type: application/json

{ "reason": "Changed my mind" }
```

Success is HTTP 200 with `{ success: true, message, data: { order, already_cancelled } }`. Errors use the existing safe envelope: 400 invalid reason, 401 unauthenticated, 404 missing/not-owned, and 409 non-cancellable status.

## 11. Authorization and security

All order routes remain behind `authMiddleware`. The JWT subject is the only accepted customer identity. The service filters the locked cancellation lookup by both order ID and `req.userId`, preventing cross-customer access without revealing whether another user's order exists. No sensitive payment data is accepted, persisted, or returned.

## 12. Test strategy

Tests will cover:

- existing order creation, authoritative prices, invalid items, insufficient stock, and rollback compatibility;
- working-day windows for Monday/Friday and month/year boundaries;
- payment method/provider validation and safe persistence;
- order creation persistence of the estimate and payment metadata;
- successful cancellation and exact stock restoration for one and multiple products;
- ownership denial, non-cancellable states, and reason length validation;
- repeated and concurrent cancellation restoring stock once;
- forced failure after stock modification, verifying order status, metadata, and stock all roll back;
- order history/detail visibility of cancelled orders and metadata;
- authentication, safe errors, and no sensitive payment fields.

Existing Jest and Supertest conventions remain in use. Database tests will use isolated test users/orders and restore stock in cleanup.

## 13. Phase 02 handoff

Phase 02 Checkout Payment Experience consumes `POST /api/orders` with the existing `items` and `shipping` fields plus optional `payment.method` and `payment.provider`. It may offer `CASH_ON_DELIVERY`, `CARD`, and `MOBILE_BANKING`; the frontend must use the backend's supported provider combinations. No frontend payment credentials may be persisted or sent as order fields. The creation response exposes persisted delivery and payment metadata.

## 14. Phase 03 handoff

Phase 03 Order History / Order Details consumes `GET /api/orders`, `GET /api/orders/:id`, and `POST /api/orders/:id/cancel`. It can display original `createdAt`, `estimatedDeliveryFrom`, `estimatedDeliveryTo`, `status`, `paymentMethod`, `paymentStatus`, `paymentProvider`, `cancelledAt`, `cancellationReason`, and the idempotent cancellation response. The frontend must still rely on backend 409 responses for non-cancellable states and must not delete or mutate orders directly.
