# Monitoring with OpenTelemetry

The API can send traces, metrics, and logs over OTLP to a collector you already run, such as
Grafana Alloy or the OpenTelemetry Collector, with Prometheus, Loki, and Tempo behind it.
Household itself ships no collector for this; nothing is sent until you set an endpoint.

## Connect

Set the endpoint in `.env` and restart the stack:

```bash
# Collector published on the same server
OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4318
OTEL_SERVICE_NAME=household
```

The API container resolves `host.docker.internal` to the server, so a collector in another
Compose stack is reachable through its published port. A collector elsewhere in the network
works with its address instead. The default protocol is OTLP over HTTP (port 4318); for gRPC set
`OTEL_EXPORTER_OTLP_PROTOCOL=grpc` and use port 4317. See [configuration](../configuration.md#opentelemetry)
for all variables.

## What arrives

- **Traces:** every API request except health checks, with the SQL commands it ran and outgoing
  HTTP calls such as the OIDC provider.
- **Metrics:** request rate, status codes, and latency per route; database command duration and
  connection pool; .NET CPU, memory, garbage collection, and thread pool. Prometheus sees them
  with `job` set to `OTEL_SERVICE_NAME`.
- **Logs:** application logs with their trace and span ids, so Grafana can jump from a log line to
  its trace. Per-request logs from ASP.NET Core are left out; the traces cover them.

The web container sends no telemetry. Its logs, and the container logs of API and database, still
reach Loki if your collector reads Docker logs. Those stream under the Compose service name
(`household-api`), the OTLP logs under `OTEL_SERVICE_NAME` (`household`), so the two do not mix.

## Dashboards

`observability/grafana/dashboards/` in the release bundle (`deployments/` in the repository)
holds two dashboards. Import them in Grafana under **Dashboards → New → Import → Upload
dashboard JSON file** and choose your data sources when asked.

| File | Needs | Shows |
| --- | --- | --- |
| `household-api.json` | Prometheus, Loki, Tempo | Requests, errors, latency per route, database, .NET runtime, warnings and errors with their traces, failed and slow requests. |
| `household-containers.json` | Prometheus with cAdvisor, Loki with Docker logs | CPU, memory, network, and restarts per Household container, and their logs. |

The container dashboard selects containers by the Compose project label. Set **Compose project**
to the project name of your stack, `household` unless you changed it. cAdvisor has to keep
Docker labels, which it does by default.
