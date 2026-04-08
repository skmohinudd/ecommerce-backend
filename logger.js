const pino = require("pino");
const crypto = require("crypto");

const SERVICE_NAME =
  process.env.SERVICE_NAME ||
  "ecommerce-backend";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service_name: SERVICE_NAME,
    environment: process.env.NODE_ENV || "development",
    service_version: process.env.APP_VERSION || "unknown",
    pod_name: process.env.POD_NAME || null,
    namespace: process.env.POD_NAMESPACE || null,
    node_name: process.env.NODE_NAME || null,
  },
});

function generateRequestId() {
  return crypto.randomUUID();
}

function sanitizeHeaders(headers = {}) {
  const cloned = { ...headers };
  delete cloned.authorization;
  delete cloned.cookie;
  delete cloned["set-cookie"];
  return cloned;
}

function getRequestLogFields(req = {}, extra = {}) {
  return {
    request_id: req.requestId || null,
    correlation_id: req.correlationId || null,
    http_method: req.method || null,
    http_route: req.route?.path || req.originalUrl || req.url || null,
    http_path: req.path || null,
    client_ip: req.ip || req.headers?.["x-forwarded-for"] || null,
    user_agent: req.headers?.["user-agent"] || null,
    ...extra,
  };
}

function getResponseClass(statusCode) {
  if (statusCode >= 500) return "server_error";
  if (statusCode >= 400) return "client_error";
  if (statusCode >= 300) return "redirect";
  if (statusCode >= 200) return "success";
  return "unknown";
}

function summarizeCart(items = []) {
  if (!Array.isArray(items)) {
    return {
      item_count: 0,
      total_quantity: 0,
      unique_item_count: 0,
      total_amount: 0,
      item_names: [],
      price_min: 0,
      price_max: 0,
    };
  }

  const validItems = items.map((item) => ({
    name: item?.name || item?.title || "unknown",
    price: Number(item?.price || 0),
    quantity: Number(item?.quantity || item?.qty || 1),
  }));

  const prices = validItems
    .map((item) => item.price)
    .filter((price) => !Number.isNaN(price));

  return {
    item_count: validItems.length,
    total_quantity: validItems.reduce(
      (sum, item) => sum + (Number.isNaN(item.quantity) ? 0 : item.quantity),
      0
    ),
    unique_item_count: new Set(validItems.map((item) => item.name)).size,
    total_amount: validItems.reduce(
      (sum, item) =>
        sum +
        (Number.isNaN(item.price) ? 0 : item.price) *
          (Number.isNaN(item.quantity) ? 0 : item.quantity),
      0
    ),
    item_names: validItems.slice(0, 10).map((item) => item.name),
    price_min: prices.length ? Math.min(...prices) : 0,
    price_max: prices.length ? Math.max(...prices) : 0,
  };
}

function maskMongoUri(uri = "") {
  if (!uri || typeof uri !== "string") return null;

  try {
    return uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@");
  } catch (err) {
    return "invalid_mongo_uri";
  }
}

function logInfo(message, extra = {}) {
  logger.info(extra, message);
}

function logWarn(message, extra = {}) {
  logger.warn(extra, message);
}

function logError(message, error = null, extra = {}) {
  logger.error(
    {
      error_name: error?.name || null,
      error_message: error?.message || null,
      error_stack: error?.stack || null,
      ...extra,
    },
    message
  );
}

module.exports = {
  logger,
  generateRequestId,
  getRequestLogFields,
  sanitizeHeaders,
  getResponseClass,
  summarizeCart,
  maskMongoUri,
  logInfo,
  logWarn,
  logError,
};