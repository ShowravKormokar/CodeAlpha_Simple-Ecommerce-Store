const pool = require("../config/database");

const checkHealth = async () => {
  try {
    const result = await pool.query("SELECT NOW()");

    return {
      success: true,
      message: "API is healthy",
      database: "connected",
    };
  } catch (error) {
    return {
      success: false,
      message: "API is healthy but database is unreachable",
      database: "disconnected",
    };
  }
};

module.exports = { checkHealth };