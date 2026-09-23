// Rating controller — handles POST /api/orders/:orderId/items/:orderItemId/rating

const ratingService = require("../services/rating.service");

// POST /api/orders/:orderId/items/:orderItemId/rating
// Protected by auth middleware — req.userId comes from the verified JWT.
async function submitRating(req, res, next) {
  const { orderId, orderItemId } = req.params;
  const { rating } = req.body || {};
  const userId = req.userId;

  try {
    const result = await ratingService.submitRating(
      userId,
      orderId,
      orderItemId,
      rating
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (
      error.status === 400 ||
      error.status === 404 ||
      error.status === 409
    ) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
}

module.exports = { submitRating };