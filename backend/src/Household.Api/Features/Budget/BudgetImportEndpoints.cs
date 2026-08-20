using System.Text.Json;
using Household.Api.Features.Identity;
using Household.Api.Platform;
using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Budget;

// Staged CSV import (ADR 0054): upload creates a review session, mapping produces a
// normalized preview with stable validation-error codes and duplicate warnings, and
// only an explicit commit writes ledger entries — atomically and idempotently.
public static class BudgetImportEndpoints
{
    private const int MaxContentLength = 1_000_000;
    private const int MaxRows = 2_000;

    public static RouteGroupBuilder MapBudgetImportEndpoints(this RouteGroupBuilder budget)
    {
        budget.MapPost("/import/sessions", CreateSession);
        budget.MapGet("/import/sessions/{sessionId:guid}", GetSession);
        budget.MapPut("/import/sessions/{sessionId:guid}/mapping", ApplyMapping);
        budget.MapPost("/import/sessions/{sessionId:guid}/commit", Commit);
        return budget;
    }

    private static async Task<IResult> CreateSession(
        ImportSessionRequest request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, TimeProvider timeProvider, CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var content = request.Content ?? "";
        if (content.Length == 0) return Invalid("CSV content is required");
        if (content.Length > MaxContentLength) return Invalid("CSV content exceeds the supported size");
        var parsed = BudgetCsv.Parse(content);
        if (parsed.Count < 2) return Invalid("CSV needs a header row and at least one data row");
        if (parsed.Count - 1 > MaxRows) return Invalid($"CSV exceeds the supported {MaxRows} data rows");
        var header = parsed[0].Select(x => x.Trim()).ToList();
        var session = new BudgetImportSession
        {
            OwnerUserId = user.Id,
            FileName = (request.FileName ?? "").Trim(),
            HeaderJson = JsonSerializer.Serialize(header),
            RowCount = parsed.Count - 1,
            CreatedAt = Now(timeProvider),
        };
        database.ImportSessions.Add(session);
        await database.SaveChangesAsync(cancellationToken);
        for (var index = 1; index < parsed.Count; index++)
            database.ImportRows.Add(new BudgetImportRow
            {
                OwnerUserId = user.Id,
                SessionId = session.Id,
                RowNumber = index,
                RawJson = JsonSerializer.Serialize(parsed[index]),
            });
        await database.SaveChangesAsync(cancellationToken);
        var rows = parsed.Skip(1).ToList();
        var suggested = SuggestMapping(header, rows);
        return Results.Created($"/api/v1/budget/import/sessions/{session.Id}", new
        {
            session = Summary(session),
            header,
            suggestedMapping = suggested,
            preview = rows.Take(20),
        });
    }

    private static async Task<IResult> GetSession(
        Guid sessionId, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var session = await database.ImportSessions.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == sessionId && x.OwnerUserId == user.Id, cancellationToken);
        if (session is null) return NotFound();
        var rows = await LoadRows(database, user.Id, sessionId, cancellationToken);
        return Results.Ok(new
        {
            session = Summary(session),
            header = JsonSerializer.Deserialize<List<string>>(session.HeaderJson) ?? [],
            mapping = session.MappingJson.Length > 0
                ? JsonSerializer.Deserialize<ImportMappingRequest>(session.MappingJson)
                : null,
            rows = rows.Select(RowView),
        });
    }

    private static async Task<IResult> ApplyMapping(
        Guid sessionId, ImportMappingRequest request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var session = await database.ImportSessions
            .SingleOrDefaultAsync(x => x.Id == sessionId && x.OwnerUserId == user.Id, cancellationToken);
        if (session is null) return NotFound();
        if (session.Status != "staged") return Conflict("The import session was already committed");
        var header = JsonSerializer.Deserialize<List<string>>(session.HeaderJson) ?? [];
        if (request.DateColumn < 0 || request.DateColumn >= header.Count)
            return Invalid("A valid date column is required");
        if (request.AmountColumn < 0 || request.AmountColumn >= header.Count)
            return Invalid("A valid amount column is required");
        var optionalColumns = new[]
        {
            request.DescriptionColumn, request.KindColumn, request.CategoryColumn, request.MerchantColumn,
        };
        if (optionalColumns.Any(column => column.HasValue && (column.Value < 0 || column.Value >= header.Count)))
            return Invalid("A mapped column is outside the CSV header");
        if (request.DecimalSeparator is not ("." or ","))
            return Invalid("Decimal separator must be '.' or ','");
        string[] supportedFormats = ["yyyy-MM-dd", "dd.MM.yyyy", "MM/dd/yyyy", "dd/MM/yyyy"];
        if (!supportedFormats.Contains(request.DateFormat ?? "yyyy-MM-dd"))
            return Invalid("Date format is not supported");
        var defaultKind = string.IsNullOrWhiteSpace(request.DefaultKind) ? BudgetValues.Expense : request.DefaultKind;
        if (defaultKind is not (BudgetValues.Expense or BudgetValues.Income))
            return Invalid("Default kind must be income or expense");

        var rows = await LoadRows(database, user.Id, sessionId, cancellationToken, track: true);
        var normalized = new List<BudgetImportRow>();
        foreach (var row in rows)
        {
            var values = JsonSerializer.Deserialize<List<string>>(row.RawJson) ?? [];
            string Value(int? column) => column.HasValue && column.Value < values.Count ? values[column.Value].Trim() : "";
            row.ValidationError = "";
            row.DuplicateWarning = false;
            row.OccurredOn = BudgetCsv.ParseDate(Value(request.DateColumn), request.DateFormat ?? "yyyy-MM-dd");
            var amountCents = BudgetCsv.ParseAmountCents(Value(request.AmountColumn), request.DecimalSeparator);
            row.Merchant = Value(request.MerchantColumn);
            row.CategoryName = Value(request.CategoryColumn);
            row.Description = Value(request.DescriptionColumn);
            if (row.Description.Length == 0) row.Description = row.Merchant;
            var kindValue = Value(request.KindColumn).ToLowerInvariant();
            row.Kind = request.KindColumn.HasValue && kindValue.Length > 0
                ? kindValue switch
                {
                    BudgetValues.Income or "einnahme" => BudgetValues.Income,
                    BudgetValues.Expense or "ausgabe" => BudgetValues.Expense,
                    _ => "",
                }
                : amountCents < 0 ? BudgetValues.Expense : defaultKind;
            if (row.OccurredOn is null) row.ValidationError = "invalid_date";
            else if (amountCents is null or 0) row.ValidationError = "invalid_amount";
            else if (row.Kind.Length == 0) row.ValidationError = "unsupported_kind";
            else if (row.Description.Length == 0) row.ValidationError = "missing_description";
            row.AmountCents = Math.Abs(amountCents ?? 0);
            normalized.Add(row);
        }

        var from = normalized.Where(x => x.OccurredOn.HasValue).Select(x => x.OccurredOn!.Value).DefaultIfEmpty().Min();
        var through = normalized.Where(x => x.OccurredOn.HasValue).Select(x => x.OccurredOn!.Value).DefaultIfEmpty().Max();
        var existing = await database.LedgerEntries.AsNoTracking()
            .Where(x => x.OwnerUserId == user.Id && x.OccurredOn >= from && x.OccurredOn <= through)
            .Select(x => new { x.Id, x.Kind, x.OccurredOn, x.AmountCents, x.Description, x.MerchantNormalized })
            .ToListAsync(cancellationToken);
        var voided = (await database.LedgerActions.AsNoTracking()
            .Where(x => x.OwnerUserId == user.Id && x.Kind == BudgetValues.Void)
            .Select(x => x.LedgerEntryId).ToListAsync(cancellationToken)).ToHashSet();
        var superseded = (await database.LedgerEntries.AsNoTracking()
            .Where(x => x.OwnerUserId == user.Id && x.CorrectsEntryId.HasValue)
            .Select(x => x.CorrectsEntryId!.Value).ToListAsync(cancellationToken)).ToHashSet();
        var existingKeys = existing
            .Where(x => !voided.Contains(x.Id) && !superseded.Contains(x.Id))
            .Select(x => DuplicateKey(x.Kind, x.OccurredOn, x.AmountCents, x.Description, x.MerchantNormalized))
            .ToHashSet();
        var seenKeys = new HashSet<string>();
        foreach (var row in normalized.Where(x => x.ValidationError.Length == 0))
        {
            var key = DuplicateKey(
                row.Kind, row.OccurredOn!.Value, row.AmountCents, row.Description,
                MerchantPresentation.From(row.Merchant).Normalized);
            row.DuplicateWarning = existingKeys.Contains(key) || !seenKeys.Add(key);
        }

        session.MappingJson = JsonSerializer.Serialize(request);
        await database.SaveChangesAsync(cancellationToken);
        return Results.Ok(new
        {
            session = Summary(session),
            rows = normalized.Select(RowView),
            validRows = normalized.Count(x => x.ValidationError.Length == 0),
            invalidRows = normalized.Count(x => x.ValidationError.Length > 0),
            duplicateRows = normalized.Count(x => x.DuplicateWarning),
        });
    }

    private static async Task<IResult> Commit(
        Guid sessionId, ImportCommitRequest? request, HttpContext context, IIdentityAccess identity,
        BudgetDbContext database, BudgetService budgetService, TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var user = await identity.CurrentUserAsync(context, cancellationToken);
        if (user is null) return Unauthorized();
        var session = await database.ImportSessions.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == sessionId && x.OwnerUserId == user.Id, cancellationToken);
        if (session is null) return NotFound();
        if (session.Status == "committed")
            return Results.Ok(await CommitResult(database, user.Id, session.Id, cancellationToken));
        if (session.MappingJson.Length == 0) return Invalid("Apply a column mapping before committing");
        var includeDuplicates = request?.IncludeDuplicates == true;

        var rows = await LoadRows(database, user.Id, sessionId, cancellationToken, track: true);
        var importable = rows.Where(x =>
            x.ValidationError.Length == 0 && (includeDuplicates || !x.DuplicateWarning)).ToList();

        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var claimed = await database.Database.ExecuteSqlInterpolatedAsync($"""
            UPDATE budget.import_sessions SET status = 'committed',
                committed_at = CURRENT_TIMESTAMP, committed_entries = {importable.Count}
            WHERE id = {sessionId} AND owner_user_id = {user.Id} AND status = 'staged';
            """, cancellationToken);
        if (claimed == 0)
        {
            await transaction.RollbackAsync(cancellationToken);
            return Results.Ok(await CommitResult(database, user.Id, session.Id, cancellationToken));
        }

        var periods = new List<BudgetPeriod>();
        if (importable.Count > 0)
        {
            var (firstPeriod, _, _) = await budgetService.EnsureDefaultsAsync(
                user.Id, importable[0].OccurredOn!.Value, cancellationToken);
            periods.Add(firstPeriod);
        }
        var categories = (await database.Categories
                .Where(x => x.OwnerUserId == user.Id && x.ArchivedAt == null).ToListAsync(cancellationToken))
            .GroupBy(x => x.Name.ToLowerInvariant()).ToDictionary(x => x.Key, x => x.First());
        var versions = await database.CategoryVersions.Where(x => x.OwnerUserId == user.Id)
            .OrderByDescending(x => x.EffectiveFrom).ToListAsync(cancellationToken);
        var latestVersions = versions.GroupBy(x => x.CategoryId).ToDictionary(x => x.Key, x => x.First());
        foreach (var row in importable)
        {
            var occurredOn = row.OccurredOn!.Value;
            var period = periods.FirstOrDefault(x => x.StartDate <= occurredOn && x.EndDate >= occurredOn);
            if (period is null)
            {
                (period, _, _) = await budgetService.EnsureDefaultsAsync(user.Id, occurredOn, cancellationToken);
                periods.Add(period);
            }
            BudgetCategory? category = null;
            if (row.Kind == BudgetValues.Expense && row.CategoryName.Length > 0)
            {
                if (!categories.TryGetValue(row.CategoryName.ToLowerInvariant(), out category))
                {
                    category = new BudgetCategory
                    {
                        OwnerUserId = user.Id, Name = row.CategoryName, Color = "#64748b",
                        Icon = "tag", Behavior = BudgetValues.IncludeInLimit,
                    };
                    database.Categories.Add(category);
                    await database.SaveChangesAsync(cancellationToken);
                    var version = new BudgetCategoryVersion
                    {
                        OwnerUserId = user.Id, CategoryId = category.Id, Name = category.Name,
                        Color = category.Color, Icon = category.Icon, Behavior = category.Behavior,
                        Archived = false, EffectiveFrom = Now(timeProvider),
                    };
                    database.CategoryVersions.Add(version);
                    await database.SaveChangesAsync(cancellationToken);
                    categories[row.CategoryName.ToLowerInvariant()] = category;
                    latestVersions[category.Id] = version;
                }
            }
            var merchant = MerchantPresentation.From(row.Merchant);
            var entry = new BudgetLedgerEntry
            {
                OwnerUserId = user.Id,
                PeriodId = period.Id,
                CategoryId = category?.Id,
                Kind = row.Kind,
                OccurredOn = occurredOn,
                Description = row.Description,
                AmountCents = row.AmountCents,
                OrdinaryImpactCents = row.Kind == BudgetValues.Income ? row.AmountCents : -row.AmountCents,
                Source = "import",
                SourceRecordId = row.Id,
                MerchantRaw = merchant.Raw,
                MerchantNormalized = merchant.Normalized,
                MerchantBrandKey = merchant.BrandKey,
            };
            database.LedgerEntries.Add(entry);
            await database.SaveChangesAsync(cancellationToken);
            if (row.Kind == BudgetValues.Expense)
            {
                var version = category is null ? null : latestVersions.GetValueOrDefault(category.Id);
                database.LedgerSplits.Add(new BudgetLedgerSplit
                {
                    OwnerUserId = user.Id,
                    LedgerEntryId = entry.Id,
                    CategoryId = category?.Id,
                    CategoryVersionId = version?.Id,
                    CategoryNameSnapshot = version?.Name ?? category?.Name ?? "Uncategorized",
                    CategoryColorSnapshot = version?.Color ?? category?.Color ?? "#64748b",
                    CategoryIconSnapshot = version?.Icon ?? category?.Icon ?? "tag",
                    AmountCents = row.AmountCents,
                    OrdinaryImpactCents = -row.AmountCents,
                });
                await database.SaveChangesAsync(cancellationToken);
            }
            row.LedgerEntryId = entry.Id;
        }
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(await CommitResult(database, user.Id, session.Id, cancellationToken));
    }

    private static async Task<object> CommitResult(
        BudgetDbContext database, Guid ownerId, Guid sessionId, CancellationToken cancellationToken)
    {
        var session = await database.ImportSessions.AsNoTracking()
            .SingleAsync(x => x.Id == sessionId && x.OwnerUserId == ownerId, cancellationToken);
        var rows = await LoadRows(database, ownerId, sessionId, cancellationToken);
        return new
        {
            session = Summary(session),
            importedRows = rows.Count(x => x.LedgerEntryId.HasValue),
            skippedInvalidRows = rows.Count(x => x.ValidationError.Length > 0),
            skippedDuplicateRows = rows.Count(x =>
                x.ValidationError.Length == 0 && x.DuplicateWarning && !x.LedgerEntryId.HasValue),
            rows = rows.Select(RowView),
        };
    }

    private static ImportMappingRequest SuggestMapping(IReadOnlyList<string> header, IReadOnlyList<IReadOnlyList<string>> rows)
    {
        int? Find(params string[] names)
        {
            for (var index = 0; index < header.Count; index++)
                if (names.Contains(header[index].ToLowerInvariant())) return index;
            return null;
        }
        var dateColumn = Find("occurredon", "date", "datum", "buchungstag") ?? 0;
        var amountColumn = Find("amount", "betrag", "umsatz") ?? (header.Count > 1 ? 1 : 0);
        string[] DateSamples() => rows.Take(50)
            .Select(row => dateColumn < row.Count ? row[dateColumn] : "").ToArray();
        string[] AmountSamples() => rows.Take(50)
            .Select(row => amountColumn < row.Count ? row[amountColumn] : "").ToArray();
        return new ImportMappingRequest(
            dateColumn,
            amountColumn,
            Find("description", "beschreibung", "verwendungszweck", "text"),
            Find("kind", "typ", "art"),
            Find("category", "kategorie"),
            Find("merchant", "haendler", "händler", "empfaenger", "empfänger"),
            BudgetCsv.DetectDateFormat(DateSamples()),
            BudgetCsv.DetectDecimalSeparator(AmountSamples()),
            BudgetValues.Expense);
    }

    private static Task<List<BudgetImportRow>> LoadRows(
        BudgetDbContext database, Guid ownerId, Guid sessionId, CancellationToken cancellationToken,
        bool track = false)
    {
        var query = track ? database.ImportRows : database.ImportRows.AsNoTracking();
        return query.Where(x => x.OwnerUserId == ownerId && x.SessionId == sessionId)
            .OrderBy(x => x.RowNumber).ToListAsync(cancellationToken);
    }

    private static string DuplicateKey(
        string kind, DateOnly occurredOn, long amountCents, string description, string merchantNormalized) =>
        merchantNormalized.Length > 0
            ? $"{kind}|{occurredOn:yyyy-MM-dd}|{amountCents}|m|{merchantNormalized}"
            : $"{kind}|{occurredOn:yyyy-MM-dd}|{amountCents}|d|{description.ToLowerInvariant()}";

    private static object Summary(BudgetImportSession session) => new
    {
        id = session.Id,
        fileName = session.FileName,
        status = session.Status,
        rowCount = session.RowCount,
        committedEntries = session.CommittedEntries,
        createdAt = session.CreatedAt,
        committedAt = session.CommittedAt,
    };

    private static object RowView(BudgetImportRow row) => new
    {
        id = row.Id,
        rowNumber = row.RowNumber,
        raw = JsonSerializer.Deserialize<List<string>>(row.RawJson) ?? [],
        kind = row.Kind,
        occurredOn = row.OccurredOn,
        description = row.Description,
        amountCents = row.AmountCents,
        categoryName = row.CategoryName,
        merchant = row.Merchant,
        validationError = row.ValidationError,
        duplicateWarning = row.DuplicateWarning,
        ledgerEntryId = row.LedgerEntryId,
    };

    private static DateTime Now(TimeProvider timeProvider) =>
        DateTime.SpecifyKind(timeProvider.GetUtcNow().UtcDateTime, DateTimeKind.Unspecified);

    private static IResult NotFound() => HttpResults.Problem(404, "Not found", "Import session was not found");
    private static IResult Conflict(string detail) => HttpResults.Problem(409, "Conflict", detail);
    private static IResult Invalid(string detail) => HttpResults.Problem(422, "Validation failed", detail);
    private static IResult Unauthorized() => HttpResults.Problem(401, "Unauthorized", "Invalid bearer token");
}

public sealed record ImportSessionRequest(string? FileName, string? Content);
public sealed record ImportMappingRequest(
    int DateColumn, int AmountColumn, int? DescriptionColumn, int? KindColumn,
    int? CategoryColumn, int? MerchantColumn, string? DateFormat, string DecimalSeparator,
    string? DefaultKind);
public sealed record ImportCommitRequest(bool? IncludeDuplicates);
