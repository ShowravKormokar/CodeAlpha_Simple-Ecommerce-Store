const healthService = require("../services/health.service");

const getHealth = async (req, res, next) => {
  try {
    const result = await healthService.checkHealth();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { getHealth };