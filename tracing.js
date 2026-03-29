const { NodeSDK } = require("@opentelemetry/sdk-node");
const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-http");

const traceExporter = new OTLPTraceExporter({
  url: "http://otel-collector-opentelemetry-collector.observability.svc.cluster.local:4318/v1/traces",
});

const sdk = new NodeSDK({
  serviceName: "ecommerce-backend",
  traceExporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

process.on("SIGTERM", async () => {
  try {
    await sdk.shutdown();
    console.log("OpenTelemetry shut down successfully");
  } catch (error) {
    console.error("Error shutting down OpenTelemetry", error);
  } finally {
    process.exit(0);
  }
});