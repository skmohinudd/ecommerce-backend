const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const orderRoutes = require("./routes/orderRoutes");
const productRoutes = require("./routes/productRoutes");
const { logInfo, logError } = require("./logger");

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",")
      : ["http://localhost:3000", "http://localhost:3001"],
  })
);

app.use(express.json());

app.use((req, res, next) => {
  const startTime = Date.now();

  logInfo("Incoming HTTP request", {
    http_method: req.method,
    http_route: req.originalUrl,
  });

  res.on("finish", () => {
    logInfo("HTTP request completed", {
      http_method: req.method,
      http_route: req.originalUrl,
      http_status_code: res.statusCode,
      duration_ms: Date.now() - startTime,
    });
  });

  next();
});

app.use("/api/orders", orderRoutes);
app.use("/api/products", productRoutes);

app.get("/", (req, res) => {
  logInfo("Health route called", {
    http_method: req.method,
    http_route: req.originalUrl,
  });

  res.send("Backend is running 🚀");
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    logInfo("MongoDB connected successfully");

    const port = process.env.PORT || 5000;

    app.listen(port, () => {
      logInfo("Server started successfully", {
        port,
      });
    });
  })
  .catch((err) => {
    logError("MongoDB connection failed", err);
    process.exit(1);
  });