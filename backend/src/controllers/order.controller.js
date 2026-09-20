const orderService = require("../services/order.service");

// POST /api/orders
// Protected by auth middleware — req.userId comes from the verified JWT.
async function createOrder(req, res, next) {
  try {
    const userId = req.userId;
    const { items } = req.body || {};

    if (!items) {
      return res.status(400).json({
        success: false,
        message: "Cart items are required",
      });
    }

    const result = await orderService.createOrder(userId, items);

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: {
        order: result.order,
        items: result.items.map((item) => ({
          id: item.id,
          productId: item.product_id,
          quantity: item.quantity,
          unitPrice: item.unit_price,
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

module.exports = { createOrder };