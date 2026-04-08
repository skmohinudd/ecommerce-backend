const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const orderRoutes = require("./routes/orderRoutes");
const productRoutes = require("./routes/productRoutes");
const {
  logInfo,
  logWarn,
  logError,
  generateRequestId,
  getRequestLogFields,
  sanitizeHeaders,
  getResponseClass,
  maskMongoUri,
} = require("./logger");

const app = express();
app.set("trust proxy", true);

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((item) => item.trim())
  : ["http://localhost:3000", "http://localhost:3001"];

app.use(
  cors({
    origin: allowedOrigins,
  })
);

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  req.requestId = req.headers["x-request-id"] || generateRequestId();
  req.correlationId = req.headers["x-correlation-id"] || req.requestId;

  res.setHeader("x-request-id", req.requestId);
  res.setHeader("x-correlation-id", req.correlationId);

  next();
});

app.use((req, res, next) => {
  const startTime = Date.now();

  logInfo(
    "Incoming HTTP request",
    getRequestLogFields(req, {
      event: "http_request_started",
      query_params: req.query,
      content_length: req.headers["content-length"] || null,
      headers: sanitizeHeaders(req.headers),
    })
  );

  res.on("finish", () => {
    const duration = Date.now() - startTime;

    logInfo(
      "HTTP request completed",
      getRequestLogFields(req, {
        event: "http_request_completed",
        http_status_code: res.statusCode,
        response_class: getResponseClass(res.statusCode),
        duration_ms: duration,
        slow_request: duration > 1000,
        response_content_length: res.getHeader("content-length") || null,
      })
    );
  });

  next();
});

app.use("/api/orders", orderRoutes);
app.use("/api/products", productRoutes);

app.get("/", (req, res) => {
  logInfo(
    "Health route called",
    getRequestLogFields(req, {
      event: "health_check_requested",
    })
  );

  res.send("Backend is running 🚀");
});

app.use((req, res) => {
  logWarn(
    "Requested route not found",
    getRequestLogFields(req, {
      event: "route_not_found",
    })
  );

  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  logError(
    "Unhandled application error",
    err,
    getRequestLogFields(req, {
      event: "unhandled_error",
    })
  );

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({ error: "Internal server error" });
});

mongoose.connection.on("connected", () => {
  logInfo("MongoDB connection event received", {
    event: "mongodb_connected",
  });
});

mongoose.connection.on("error", (err) => {
  logError("MongoDB connection error event received", err, {
    event: "mongodb_connection_error",
  });
});

mongoose.connection.on("disconnected", () => {
  logWarn("MongoDB disconnected", {
    event: "mongodb_disconnected",
  });
});

const mongoUri = process.env.MONGO_URI;
const port = process.env.PORT || 5000;

logInfo("Application boot configuration", {
  event: "application_boot_config",
  port,
  node_env: process.env.NODE_ENV || "development",
  cors_origins: allowedOrigins,
  mongo_uri_masked: maskMongoUri(mongoUri),
  products_api_url:
    process.env.PRODUCTS_API_URL || "https://api.escuelajs.co/api/v1/products",
});

mongoose
  .connect(mongoUri)
  .then(() => {
    const server = app.listen(port, () => {
      logInfo("Server started successfully", {
        event: "server_started",
        port,
        node_env: process.env.NODE_ENV || "development",
      });
    });

    const gracefulShutdown = async (signal) => {
      try {
        logWarn("Shutdown signal received", {
          event: "shutdown_signal_received",
          signal,
        });

        server.close(async () => {
          try {
            logInfo("HTTP server closed", {
              event: "http_server_closed",
            });

            await mongoose.connection.close();

            logInfo("Graceful shutdown completed", {
              event: "graceful_shutdown_completed",
            });

            process.exit(0);
          } catch (err) {
            logError("Graceful shutdown failed while closing MongoDB", err, {
              event: "graceful_shutdown_failed",
            });
            process.exit(1);
          }
        });
      } catch (err) {
        logError("Graceful shutdown failed", err, {
          event: "graceful_shutdown_failed",
        });
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  })
  .catch((err) => {
    logError("MongoDB connection failed during startup", err, {
      event: "mongodb_startup_connection_failed",
      mongo_uri_masked: maskMongoUri(mongoUri),
    });
    process.exit(1);
  });