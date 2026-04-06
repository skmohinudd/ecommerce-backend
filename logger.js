const pino = require("pino");
const { context, trace } = require("@opentelemetry/api");

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service_name: "ecommerce-backend"
  }
});

function getTraceFields() {
  const activeSpan = trace.getSpan(context.active());

  if (!activeSpan) {
    return {
      trace_id: null,
      span_id: null
    };
  }

  const spanContext = activeSpan.spanContext();

    return {
    trace_id: spanContext.traceId,
    span_id: spanContext.spanId,
    trace_flags: spanContext.traceFlags.toString(16).padStart(2, "0")
  };
}

function logInfo(message, extra = {}) {
  logger.info(
    {
      ...getTraceFields(),
      ...extra
    },
    message
  );
}

function logError(message, error = null, extra = {}) {
  logger.error(
    {
      ...getTraceFields(),
      error_message: error?.message || null,
      error_stack: error?.stack || null,
      ...extra
    },
    message
  );
}

module.exports = {
  logger,
  getTraceFields,
  logInfo,
  logError
};