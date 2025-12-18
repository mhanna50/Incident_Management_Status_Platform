import os

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.django import DjangoInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

_INSTRUMENTED = False


def setup_tracing():
    global _INSTRUMENTED
    if _INSTRUMENTED:
        return

    service_name = os.getenv("OTEL_SERVICE_NAME", "incident-platform")
    resource = Resource(attributes={"service.name": service_name})
    provider = TracerProvider(resource=resource)

    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    if endpoint:
        exporter = OTLPSpanExporter(endpoint=endpoint, insecure=endpoint.startswith("http://"))
        provider.add_span_processor(BatchSpanProcessor(exporter))

    trace.set_tracer_provider(provider)
    DjangoInstrumentor().instrument()
    _INSTRUMENTED = True


setup_tracing()
