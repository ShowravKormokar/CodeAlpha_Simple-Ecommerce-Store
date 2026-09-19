require("dotenv").config();

const express = require("express");
const cors = require("cors");
const healthRoutes = require("./routes/health.routes");
const productRoutes = require("./routes/product.routes");
const errorMiddleware = require("./middleware/error.middleware");
const pool = require("./config/database");

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5500",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

app.use("/api", healthRoutes);
app.use("/api/products", productRoutes);

app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    const client = await pool.connect();
    await client.query("SELECT NOW()");
    console.log("Database connected successfully");
    client.release();
  } catch (error) {
    console.error("Database connection failed:", error.message);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use. Please free it or set a different PORT in .env.`);
    } else {
      console.error("Server error:", error.message);
    }
    process.exit(1);
  });
}

startServer();