const errorMiddleware = (err, req, res, next) => {
  const status = err.status || 500;

  // Log full details server-side only.
  if (process.env.NODE_ENV !== "production") {
    console.error(err.stack || err);
  } else {
    console.error(`[error] ${status}: ${err.message || "Internal server error"}`);
  }

  // Never expose internal details (stack traces, DB errors, secrets) to clients.
  const message =
    status >= 500 ? "Internal server error" : err.message || "Internal server error";

  res.status(status).json({
    success: false,
    message,
  });
};

module.exports = errorMiddleware;