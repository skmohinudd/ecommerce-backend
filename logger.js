const pino = require("pino");
const crypto = require("crypto");
const { context, trace } = require("@opentelemetry/api");

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || process.env.SERVICE_NAME || "ecommerce-backend";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service_name: SERVICE_NAME,
    environment: process.env.NODE_ENV || "development",
  },
});

function getTraceFields() {
  const activeSpan = trace.getSpan(context.active());

  if (!activeSpan) {
    return {
      trace_id: null,
      span_id: null,
      trace_flags: null,
    };
  }

  const spanContext = activeSpan.spanContext();

  return {
    trace_id: spanContext.traceId,
    span_id: spanContext.spanId,
    trace_flags: spanContext.traceFlags.toString(16).padStart(2, "0"),
  };
}

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

function logInfo(message, extra = {}) {
  logger.info(
    {
      ...getTraceFields(),
      ...extra,
    },
    message
  );
}

function logWarn(message, extra = {}) {
  logger.warn(
    {
      ...getTraceFields(),
      ...extra,
    },
    message
  );
}

function logError(message, error = null, extra = {}) {
  logger.error(
    {
      ...getTraceFields(),
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
  getTraceFields,
  getRequestLogFields,
  sanitizeHeaders,
  logInfo,
  logWarn,
  logError,
};
