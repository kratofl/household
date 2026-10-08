using Household.Api.Platform;

namespace Household.Api.Features.Identity;

/// <summary>
/// Login through an external OpenID Connect provider such as Pocket ID. Read once at startup from
/// <c>HOUSEHOLD_OIDC_*</c>; off unless <c>HOUSEHOLD_OIDC_ENABLED=true</c>. Password login stays available either way.
/// </summary>
public sealed record OidcSettings(bool Enabled, string Issuer, string ClientId, string ClientSecret, string Name)
{
    public static readonly OidcSettings Disabled = new OidcSettings(false, "", "", "", "");

    /// <summary>Fails startup when OIDC is switched on but incomplete, instead of failing on the first login.</summary>
    public static OidcSettings FromEnvironment()
    {
        if (!HouseholdConfiguration.Boolean("HOUSEHOLD_OIDC_ENABLED")) return Disabled;
        string issuer = HouseholdConfiguration.String("HOUSEHOLD_OIDC_ISSUER").TrimEnd('/');
        string clientId = HouseholdConfiguration.String("HOUSEHOLD_OIDC_CLIENT_ID");
        string clientSecret = HouseholdConfiguration.String("HOUSEHOLD_OIDC_CLIENT_SECRET");
        if (!Uri.TryCreate(issuer, UriKind.Absolute, out Uri? _) || clientId.Length == 0 || clientSecret.Length == 0)
            throw new InvalidOperationException(
                "HOUSEHOLD_OIDC_ENABLED=true requires HOUSEHOLD_OIDC_ISSUER (absolute URL), HOUSEHOLD_OIDC_CLIENT_ID and HOUSEHOLD_OIDC_CLIENT_SECRET.");
        return new OidcSettings(true, issuer, clientId, clientSecret, HouseholdConfiguration.String("HOUSEHOLD_OIDC_NAME", "SSO"));
    }
}
