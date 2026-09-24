require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const healthRoutes = require("./routes/health.routes");
const productRoutes = require("./routes/product.routes");
const authRoutes = require("./routes/auth.routes");
const orderRoutes = require("./routes/order.routes");
const errorMiddleware = require("./middleware/error.middleware");
const pool = require("./config/database");

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false,
    frameAncestors: false,
    hsts: false,
    referrerPolicy: { policy: "no-referrer" },
  })
);

function buildCorsOrigins() {
  const configured = (process.env.CORS_ORIGIN || "http://localhost:5500")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const extra = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
  ];

  return Array.from(new Set([...configured, ...extra]));
}

app.use(
  cors({
    origin: buildCorsOrigins(),
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.use("/api", healthRoutes);
app.use("/api/products", productRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);

app.use(errorMiddleware);

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

  const PORT = process.env.PORT || 5000;

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

module.exports = { app, startServer };
