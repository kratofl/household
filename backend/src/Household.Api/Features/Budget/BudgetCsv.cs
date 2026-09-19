using System.Globalization;
using System.Text;

namespace Household.Api.Features.Budget;

// Minimal RFC 4180 CSV support for the documented Budget export/import format:
// comma or semicolon delimited, double-quote escaping, first row is the header.
public static class BudgetCsv
{
    public static IReadOnlyList<IReadOnlyList<string>> Parse(string content)
    {
        string text = content.Replace("\r\n", "\n").Replace('\r', '\n');
        char delimiter = DetectDelimiter(text);
        List<IReadOnlyList<string>> rows = new List<IReadOnlyList<string>>();
        List<string> row = new List<string>();
        StringBuilder field = new StringBuilder();
        bool quoted = false;
        for (int index = 0; index < text.Length; index++)
        {
            char character = text[index];
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
        StringBuilder builder = new StringBuilder();
        foreach (IReadOnlyList<string> row in rows)
        {
            for (int index = 0; index < row.Count; index++)
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
        string trimmed = value.Trim().Replace(" ", "").Replace(" ", "");
        if (trimmed.Length == 0) return null;
        string groupSeparator = decimalSeparator == "," ? "." : ",";
        trimmed = trimmed.Replace(groupSeparator, "");
        trimmed = trimmed.Replace(decimalSeparator, ".");
        string[] parts = trimmed.Split('.');
        if (parts.Length > 2) return null;
        bool negative = parts[0].StartsWith('-');
        string wholePart = negative ? parts[0][1..] : parts[0];
        if (wholePart.Length == 0) wholePart = "0";
        string fractionPart = parts.Length == 2 ? parts[1] : "";
        if (fractionPart.Length > 2 || !wholePart.All(char.IsAsciiDigit) || !fractionPart.All(char.IsAsciiDigit))
            return null;
        if (!long.TryParse(wholePart, NumberStyles.None, CultureInfo.InvariantCulture, out long whole)) return null;
        long fraction = fractionPart.Length == 0 ? 0 : long.Parse(fractionPart.PadRight(2, '0'), CultureInfo.InvariantCulture);
        long cents = checked(whole * 100 + fraction);
        return negative ? -cents : cents;
    }

    public static DateOnly? ParseDate(string value, string dateFormat) =>
        DateOnly.TryParseExact(value.Trim(), dateFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out DateOnly date)
            ? date
            : null;

    public static string DetectDecimalSeparator(IEnumerable<string> samples)
    {
        foreach (string sample in samples)
        {
            int lastComma = sample.LastIndexOf(',');
            int lastDot = sample.LastIndexOf('.');
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
        List<string> values = samples.Where(x => !string.IsNullOrWhiteSpace(x)).ToList();
        string best = "yyyy-MM-dd";
        int bestMatches = 0;
        foreach (string format in formats)
        {
            int matches = values.Count(value => ParseDate(value, format) is not null);
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
        string header = text.Split('\n', 2)[0];
        bool inQuotes = false;
        int commas = 0;
        int semicolons = 0;
        foreach (char character in header)
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
