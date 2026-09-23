const express = require("express");
const orderController = require("../controllers/order.controller");
const ratingController = require("../controllers/rating.controller");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();

// All order routes require authentication.
router.post("/", authMiddleware, orderController.createOrder);
router.get("/", authMiddleware, orderController.getOrders);
router.get("/:id", authMiddleware, orderController.getOrderById);

// Rating submission for a completed order item (one rating per item, immutable).
router.post(
  "/:orderId/items/:orderItemId/rating",
  authMiddleware,
  ratingController.submitRating
);

module.exports = router;