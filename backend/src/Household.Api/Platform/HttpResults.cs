namespace Household.Api.Platform;

public static class HttpResults
{
    /// <summary>
    /// Problem JSON. <paramref name="detail"/> is English prose for API readers; <paramref name="code"/>
    /// is a stable identifier the web client translates, sent as a <c>code</c> extension member.
    /// </summary>
    public static IResult Problem(int status, string title, string detail, string? code = null) =>
        Results.Problem(detail: detail, statusCode: status, title: title, type: "about:blank",
            extensions: code is null ? null : new Dictionary<string, object?> { ["code"] = code });
}
