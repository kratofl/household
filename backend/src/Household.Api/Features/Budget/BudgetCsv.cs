using System.Globalization;
using System.Text;

namespace Household.Api.Features.Budget;

// Minimal RFC 4180 CSV support for the documented Budget export/import format:
// comma or semicolon delimited, double-quote escaping, first row is the header.
public static class BudgetCsv
{
    public static IReadOnlyList<IReadOnlyList<string>> Parse(string content)
    {
        var text = content.Replace("\r\n", "\n").Replace('\r', '\n');
        var delimiter = DetectDelimiter(text);
        var rows = new List<IReadOnlyList<string>>();
        var row = new List<string>();
        var field = new StringBuilder();
        var quoted = false;
        for (var index = 0; index < text.Length; index++)
        {
            var character = text[index];
            if (quoted)
            {
                if (character == '"' && index + 1 < text.Length && text[index + 1] == '"')
                {
                    field.Append('"');
                    index++;
                }
                else if (character == '"')
                {
                    quoted = false;
                }
                else
                {
                    field.Append(character);
                }
                continue;
            }
            if (character == '"' && field.Length == 0)
            {
                quoted = true;
            }
            else if (character == delimiter)
            {
                row.Add(field.ToString());
                field.Clear();
            }
            else if (character == '\n')
            {
                row.Add(field.ToString());
                field.Clear();
                if (row.Count > 1 || row[0].Length > 0) rows.Add(row);
                row = [];
            }
            else
            {
                field.Append(character);
            }
        }
        if (field.Length > 0 || row.Count > 0)
        {
            row.Add(field.ToString());
            if (row.Count > 1 || row[0].Length > 0) rows.Add(row);
        }
        return rows;
    }

    public static string Write(IEnumerable<IReadOnlyList<string>> rows)
    {
        var builder = new StringBuilder();
        foreach (var row in rows)
        {
            for (var index = 0; index < row.Count; index++)
            {
                if (index > 0) builder.Append(',');
                builder.Append(Escape(row[index]));
            }
            builder.Append("\r\n");
        }
        return builder.ToString();
    }

    // Exact-money parsing without binary floating point. The decimal separator is
    // explicit ("," or "."); the other separator is treated as a grouping character.
    public static long? ParseAmountCents(string value, string decimalSeparator)
    {
        var trimmed = value.Trim().Replace(" ", "").Replace(" ", "");
        if (trimmed.Length == 0) return null;
        var groupSeparator = decimalSeparator == "," ? "." : ",";
        trimmed = trimmed.Replace(groupSeparator, "");
        trimmed = trimmed.Replace(decimalSeparator, ".");
        var parts = trimmed.Split('.');
        if (parts.Length > 2) return null;
        var negative = parts[0].StartsWith('-');
        var wholePart = negative ? parts[0][1..] : parts[0];
        if (wholePart.Length == 0) wholePart = "0";
        var fractionPart = parts.Length == 2 ? parts[1] : "";
        if (fractionPart.Length > 2 || !wholePart.All(char.IsAsciiDigit) || !fractionPart.All(char.IsAsciiDigit))
            return null;
        if (!long.TryParse(wholePart, NumberStyles.None, CultureInfo.InvariantCulture, out var whole)) return null;
        var fraction = fractionPart.Length == 0 ? 0 : long.Parse(fractionPart.PadRight(2, '0'), CultureInfo.InvariantCulture);
        var cents = checked(whole * 100 + fraction);
        return negative ? -cents : cents;
    }

    public static DateOnly? ParseDate(string value, string dateFormat) =>
        DateOnly.TryParseExact(value.Trim(), dateFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
            ? date
            : null;

    public static string DetectDecimalSeparator(IEnumerable<string> samples)
    {
        foreach (var sample in samples)
        {
            var lastComma = sample.LastIndexOf(',');
            var lastDot = sample.LastIndexOf('.');
            if (lastComma < 0 && lastDot < 0) continue;
            return lastComma > lastDot ? "," : ".";
        }
        return ".";
    }

    // Picks the format parsing the most samples; unparseable rows are flagged during
    // mapping instead of blocking detection. Earlier formats win ties.
    public static string DetectDateFormat(IEnumerable<string> samples)
    {
        string[] formats = ["yyyy-MM-dd", "dd.MM.yyyy", "MM/dd/yyyy", "dd/MM/yyyy"];
        var values = samples.Where(x => !string.IsNullOrWhiteSpace(x)).ToList();
        var best = "yyyy-MM-dd";
        var bestMatches = 0;
        foreach (var format in formats)
        {
            var matches = values.Count(value => ParseDate(value, format) is not null);
            if (matches > bestMatches)
            {
                best = format;
                bestMatches = matches;
            }
        }
        return best;
    }

    private static char DetectDelimiter(string text)
    {
        var header = text.Split('\n', 2)[0];
        var inQuotes = false;
        var commas = 0;
        var semicolons = 0;
        foreach (var character in header)
        {
            if (character == '"') inQuotes = !inQuotes;
            else if (!inQuotes && character == ',') commas++;
            else if (!inQuotes && character == ';') semicolons++;
        }
        return semicolons > commas ? ';' : ',';
    }

    private static string Escape(string value) =>
        value.Contains(',') || value.Contains('"') || value.Contains('\n') || value.Contains('\r')
            ? $"\"{value.Replace("\"", "\"\"")}\""
            : value;
}
