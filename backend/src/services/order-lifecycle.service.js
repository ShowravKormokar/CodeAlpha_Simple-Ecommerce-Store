const ORDER_STATUSES = Object.freeze([
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
]);

const CANCELLABLE_ORDER_STATUSES = new Set([
  "pending",
  "confirmed",
  "processing",
]);

const ORDER_TRANSITIONS = Object.freeze({
  pending: new Set(["confirmed", "cancelled"]),
  confirmed: new Set(["processing", "cancelled"]),
  processing: new Set(["shipped", "cancelled"]),
  shipped: new Set(["delivered"]),
  delivered: new Set(["completed"]),
  completed: new Set(),
  cancelled: new Set(),
});

const PAYMENT_METHODS = Object.freeze({
  CASH_ON_DELIVERY: null,
  CARD: ["VISA", "MASTERCARD"],
  MOBILE_BANKING: ["BKASH", "NAGAD"],
});

function createValidationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function isCancellableStatus(status) {
  return CANCELLABLE_ORDER_STATUSES.has(status);
}

function canTransitionOrderStatus(fromStatus, toStatus) {
  return ORDER_TRANSITIONS[fromStatus]?.has(toStatus) || false;
}

function normalizePayment(payment = {}) {
  if (payment === null || typeof payment !== "object" || Array.isArray(payment)) {
    throw createValidationError("Invalid payment selection");
  }

  const method = payment.method === undefined || payment.method === null
    ? "CASH_ON_DELIVERY"
    : String(payment.method).trim().toUpperCase();
  const provider = payment.provider === undefined || payment.provider === null || payment.provider === ""
    ? null
    : String(payment.provider).trim().toUpperCase();

  if (!Object.prototype.hasOwnProperty.call(PAYMENT_METHODS, method)) {
    throw createValidationError("Invalid payment method");
  }

  const allowedProviders = PAYMENT_METHODS[method];
  if (allowedProviders === null) {
    if (provider !== null) {
      throw createValidationError("Invalid payment provider for payment method");
    }
  } else if (!allowedProviders.includes(provider)) {
    throw createValidationError("Invalid payment provider for payment method");
  }

  return {
    method,
    status: "PENDING",
    provider,
  };
}

function addWorkingDays(date, workingDays) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error("A valid order date is required");
  }

  if (!Number.isInteger(workingDays) || workingDays < 0) {
    throw new Error("Working days must be a non-negative integer");
  }

  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  let added = 0;

  while (added < workingDays) {
    result.setUTCDate(result.getUTCDate() + 1);
    const day = result.getUTCDay();
    if (day !== 0 && day !== 6) added += 1;
  }

  return result.toISOString().slice(0, 10);
}

function calculateDeliveryWindow(placedAt) {
  return {
    from: addWorkingDays(placedAt, 7),
    to: addWorkingDays(placedAt, 14),
  };
}

module.exports = {
  ORDER_STATUSES,
  CANCELLABLE_ORDER_STATUSES,
  ORDER_TRANSITIONS,
  PAYMENT_METHODS,
  isCancellableStatus,
  canTransitionOrderStatus,
  normalizePayment,
  addWorkingDays,
  calculateDeliveryWindow,
};
