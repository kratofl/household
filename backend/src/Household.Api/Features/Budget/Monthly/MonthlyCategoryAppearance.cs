using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Household.Api.Features.Budget;

internal static class MonthlyCategoryAppearance
{
    internal static readonly string[] Colors = ["brand", "green", "blue", "purple", "yellow"];
    private static readonly string[] Icons = ["tag", "cart", "home", "car", "fuel", "food", "shirt", "movie", "bottle", "laptop", "gift", "heart", "baby", "paw", "plane"];

    internal static bool Valid(string? color, string? icon) =>
        (color is null || Colors.Contains(color)) && (icon is null || Icons.Contains(icon));
}

[DbContext(typeof(BudgetDbContext))]
[Migration("202610100001_MonthlyCategoryAppearance")]
public sealed class MonthlyCategoryAppearanceMigration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        ALTER TABLE budget.monthly_categories
            ADD COLUMN color text NOT NULL DEFAULT 'brand',
            ADD COLUMN icon text NOT NULL DEFAULT 'tag';
        WITH colors AS (
            SELECT id, (row_number() OVER (PARTITION BY owner_user_id ORDER BY id) - 1) % 5 AS n
            FROM budget.monthly_categories
        )
        UPDATE budget.monthly_categories AS category
        SET color = (ARRAY['brand', 'green', 'blue', 'purple', 'yellow'])[colors.n::integer + 1]
        FROM colors WHERE category.id = colors.id;
        -- Existing categories keep the glyph the web client used to guess from their name.
        UPDATE budget.monthly_categories SET icon = CASE
            WHEN name ~* 'tank|benzin|sprit|diesel' THEN 'fuel'
            WHEN name ~* 'lebensmittel|einkauf|supermarkt|rewe|edeka|aldi|lidl' THEN 'cart'
            WHEN name ~* 'essen|restaurant|café|cafe|bäcker|lieferando' THEN 'food'
            WHEN name ~* 'kleid|mode|schuh' THEN 'shirt'
            WHEN name ~* 'freizeit|kino|hobby|sport|spiel' THEN 'movie'
            WHEN name ~* 'haushalt|wohn|möbel|baumarkt' THEN 'home'
            WHEN name ~* 'drogerie|pflege|apotheke' THEN 'bottle'
            WHEN name ~* 'auto|kfz|werkstatt|parken' THEN 'car'
            WHEN name ~* 'elektro|technik|computer|handy' THEN 'laptop'
            WHEN name ~* 'geschenk' THEN 'gift'
            WHEN name ~* 'gesund|arzt|medi' THEN 'heart'
            WHEN name ~* 'kind|baby|schule' THEN 'baby'
            WHEN name ~* 'tier|hund|katze' THEN 'paw'
            WHEN name ~* 'reise|urlaub|flug|hotel' THEN 'plane'
            ELSE 'tag' END;
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        ALTER TABLE budget.monthly_categories DROP COLUMN color, DROP COLUMN icon;
        """);
}
