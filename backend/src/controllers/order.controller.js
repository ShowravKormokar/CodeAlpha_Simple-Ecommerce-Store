const orderService = require("../services/order.service");

// POST /api/orders
// Protected by auth middleware — req.userId comes from the verified JWT.
async function createOrder(req, res, next) {
  try {
    const userId = req.userId;
    const { items, shipping, payment } = req.body || {};

    if (!items) {
      return res.status(400).json({
        success: false,
        message: "Cart items are required",
      });
    }

    const result = await orderService.createOrder(userId, items, shipping, payment);

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: {
        order: result.order,
        items: result.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
        })),
      },
    });
  } catch (error) {
    if (error.status === 400 || error.status === 404 || error.status === 409) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
}

async function cancelOrder(req, res, next) {
  try {
    const result = await orderService.cancelOrder(
      req.params.id,
      req.userId,
      req.body?.reason
    );

    res.status(200).json({
      success: true,
      message: result.alreadyCancelled
        ? "Order was already cancelled"
        : "Order cancelled successfully",
      data: {
        order: result.order,
        already_cancelled: result.alreadyCancelled,
      },
    });
  } catch (error) {
    if (error.status === 400 || error.status === 404 || error.status === 409) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
}

// GET /api/orders
async function getOrders(req, res, next) {
  try {
    const userId = req.userId;
    const orders = await orderService.getOrdersByUser(userId);

    res.status(200).json({
      success: true,
      data: { orders },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/orders/:id
async function getOrderById(req, res, next) {
  const orderId = Number(req.params.id);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid order ID",
    });
  }

  try {
    const userId = req.userId;
    const order = await orderService.getOrderByIdAndUser(orderId, userId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      data: { order },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { createOrder, cancelOrder, getOrders, getOrderById };