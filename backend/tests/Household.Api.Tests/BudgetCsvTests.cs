using Household.Api.Features.Budget;

namespace Household.Api.Tests;

public sealed class BudgetCsvTests
{
    [Fact]
    public void Parses_quoted_fields_delimiters_and_line_endings()
    {
        var rows = BudgetCsv.Parse("a,b,c\r\n\"1,5\",\"say \"\"hi\"\"\",x\nlast,,\n");

        Assert.Equal(3, rows.Count);
        Assert.Equal(["a", "b", "c"], rows[0]);
        Assert.Equal(["1,5", "say \"hi\"", "x"], rows[1]);
        Assert.Equal(["last", "", ""], rows[2]);
    }

    [Fact]
    public void Detects_semicolon_delimited_files_from_the_header()
    {
        var rows = BudgetCsv.Parse("Datum;Betrag;Text\n15.07.2026;-45,90;Einkauf\n");

        Assert.Equal(["Datum", "Betrag", "Text"], rows[0]);
        Assert.Equal(["15.07.2026", "-45,90", "Einkauf"], rows[1]);
    }

    [Fact]
    public void Write_then_parse_round_trips_special_characters()
    {
        List<IReadOnlyList<string>> rows = [["id", "text"], ["1", "a,b \"quoted\"\nnew line"]];

        Assert.Equal(rows, BudgetCsv.Parse(BudgetCsv.Write(rows)));
    }

    [Theory]
    [InlineData("2.500,00", ",", 250_000)]
    [InlineData("-45,90", ",", -4_590)]
    [InlineData("45.9", ".", 4_590)]
    [InlineData("1,234.56", ".", 123_456)]
    [InlineData("12", ",", 1_200)]
    [InlineData("0,05", ",", 5)]
    public void Amounts_parse_exactly_into_minor_units(string value, string separator, long expected)
    {
        Assert.Equal(expected, BudgetCsv.ParseAmountCents(value, separator));
    }

    [Theory]
    [InlineData("", ",")]
    [InlineData("abc", ",")]
    [InlineData("1,234", ",")]
    [InlineData("1.2.3", ".")]
    public void Unparseable_amounts_return_null_instead_of_guessing(string value, string separator)
    {
        Assert.Null(BudgetCsv.ParseAmountCents(value, separator));
    }

    [Fact]
    public void Dates_parse_only_with_the_explicit_format()
    {
        Assert.Equal(new DateOnly(2026, 7, 15), BudgetCsv.ParseDate("15.07.2026", "dd.MM.yyyy"));
        Assert.Null(BudgetCsv.ParseDate("15.07.2026", "yyyy-MM-dd"));
        Assert.Null(BudgetCsv.ParseDate("32.07.2026", "dd.MM.yyyy"));
    }

    [Fact]
    public void Detection_prefers_the_separator_and_format_matching_the_samples()
    {
        Assert.Equal(",", BudgetCsv.DetectDecimalSeparator(["2.500,00", "12,50"]));
        Assert.Equal(".", BudgetCsv.DetectDecimalSeparator(["2,500.00"]));
        Assert.Equal("dd.MM.yyyy", BudgetCsv.DetectDateFormat(["15.07.2026", "01.01.2026"]));
        Assert.Equal("yyyy-MM-dd", BudgetCsv.DetectDateFormat(["2026-07-15"]));
    }
}
