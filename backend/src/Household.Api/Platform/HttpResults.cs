namespace Household.Api.Platform;

public static class HttpResults
{
    public static IResult Problem(int status, string title, string detail) =>
        Results.Problem(detail: detail, statusCode: status, title: title, type: "about:blank");
}
