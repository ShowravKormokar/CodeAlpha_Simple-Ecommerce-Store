const express = require("express");
const orderController = require("../controllers/order.controller");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();

// All order routes require authentication.
router.post("/", authMiddleware, orderController.createOrder);
router.get("/", authMiddleware, orderController.getOrders);
router.get("/:id", authMiddleware, orderController.getOrderById);

module.exports = router;