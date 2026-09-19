namespace Household.Api.Features.Budget;

/// A merchant the user spends money at. Rows without an owner are the catalog that
/// ships with the app and are the same for everyone; rows with an owner belong to
/// that user alone. A merchant never influences ledger or budget behaviour.
public sealed record MerchantRow
{
    public Guid Id { get; init; }

    /// Null marks a catalog merchant. Catalog rows are ours and users cannot edit them.
    public Guid? OwnerUserId { get; init; }
    public string Name { get; set; } = "";

    /// Names the logo file shipped in the repository. Null falls back to the monogram.
    public string? LogoKey { get; set; }

    /// The brand's own colour as #RRGGBB, for the tile behind the monogram. Null falls back
    /// to the hashed colour every category and merchant gets.
    public string? Color { get; set; }
    public bool Archived { get; set; }
}

/// What the client sees. `Catalog` tells it whether the row is editable.
public sealed record MerchantView(Guid Id, string Name, string? LogoKey, string? Color, bool Catalog, bool Archived);

/// `Global` publishes the merchant to every user and is reserved for admins. On an update it
/// is ignored: a merchant does not change sides once it exists.
public sealed record SaveMerchant(string Name, bool Global = false)
{
    public bool Archived { get; init; }
}
