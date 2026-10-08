using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Trace;

namespace Household.Api.Platform;

/// <summary>
/// Sends traces, metrics and logs over OTLP once <c>OTEL_EXPORTER_OTLP_ENDPOINT</c> is set; without
/// it nothing is collected. Service name, protocol and headers come from the standard OTEL_*
/// variables, which the SDK reads itself.
/// </summary>
public static class Telemetry
{
    /// <summary>ActivitySource and Meter name Npgsql reports database commands under.</summary>
    private const string Npgsql = "Npgsql";

    public static void AddHouseholdTelemetry(this WebApplicationBuilder builder)
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT"))) return;

        builder.Services.AddOpenTelemetry()
            .WithTracing(tracing => tracing
                // Compose probes /healthz every few seconds; those traces would bury the real ones.
                .AddAspNetCoreInstrumentation(options => options.Filter = context => context.Request.Path != "/healthz")
                .AddHttpClientInstrumentation()
                .AddSource(Npgsql)
                .AddOtlpExporter())
            .WithMetrics(metrics => metrics
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddMeter("System.Runtime", Npgsql)
                .AddOtlpExporter());
        builder.Logging.AddOpenTelemetry(logging =>
        {
            logging.IncludeFormattedMessage = true;
            logging.AddOtlpExporter();
        });
        // ASP.NET Core logs every request at Information; the request traces already carry that.
        builder.Logging.AddFilter<OpenTelemetryLoggerProvider>("Microsoft.AspNetCore", LogLevel.Warning);
        // The exporters send over HttpClient, which logs every request; every 15 s per signal is noise.
        builder.Logging.AddFilter("System.Net.Http.HttpClient.Otlp", LogLevel.Warning);
    }
}
