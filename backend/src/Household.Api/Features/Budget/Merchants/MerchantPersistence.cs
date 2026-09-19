using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Household.Api.Features.Budget;

public sealed partial class BudgetDbContext
{
    public DbSet<MerchantRow> Merchants => this.Set<MerchantRow>();

    private static void ConfigureMerchants(ModelBuilder model)
    {
        EntityTypeBuilder<MerchantRow> merchant = model.Entity<MerchantRow>();
        merchant.ToTable("merchants");
        merchant.HasKey(row => row.Id);
        merchant.Property(row => row.Id).HasColumnName("id");
        merchant.Property(row => row.OwnerUserId).HasColumnName("owner_user_id");
        merchant.Property(row => row.Name).HasColumnName("name");
        merchant.Property(row => row.LogoKey).HasColumnName("logo_key");
        merchant.Property(row => row.Color).HasColumnName("color");
        merchant.Property(row => row.Archived).HasColumnName("archived");
        merchant.HasIndex(row => new { row.OwnerUserId, row.Name }).IsUnique();
    }
}

// The catalog is seeded here rather than at startup so every install gets it the same way,
// development and production alike, and a later release extends or corrects it with another
// additive migration. Logo files live in the repository under the logo key, so adding a logo
// later is a file and needs no migration at all.
//
// owner_user_id carries no foreign key on purpose: Budget owns its schema and does not depend
// on Identity's tables, the same as every other owner_user_id in this feature.
[DbContext(typeof(BudgetDbContext))]
[Migration("202609180001_BudgetMerchants")]
public sealed class BudgetMerchantsMigration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE IF NOT EXISTS budget.merchants (
            id uuid PRIMARY KEY,
            owner_user_id uuid,
            name varchar(120) NOT NULL CHECK (length(trim(name)) > 0),
            logo_key varchar(64),
            color char(7) CHECK (color ~ '^#[0-9A-F]{6}$'),
            archived boolean NOT NULL DEFAULT false);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_merchants_owner_name
            ON budget.merchants(owner_user_id, lower(name)) NULLS NOT DISTINCT;

        INSERT INTO budget.merchants (id, owner_user_id, name, logo_key, color)
        SELECT seed.id::uuid, NULL, seed.name, seed.logo_key, NULLIF(seed.color, '')
        FROM (VALUES
            ('019c2e00-0000-7000-8000-000000000001', 'REWE', 'rewe', '#CC071E'),
            ('019c2e00-0000-7000-8000-000000000002', 'EDEKA', 'edeka', '#1B66B3'),
            ('019c2e00-0000-7000-8000-000000000003', 'ALDI SÜD', 'aldisued', '#00005F'),
            ('019c2e00-0000-7000-8000-000000000042', 'ALDI Nord', 'aldinord', '#2490D7'),
            ('019c2e00-0000-7000-8000-000000000004', 'Lidl', 'lidl', '#0050AA'),
            ('019c2e00-0000-7000-8000-000000000005', 'Kaufland', 'kaufland', '#E10915'),
            ('019c2e00-0000-7000-8000-000000000006', 'Penny', 'penny', '#CD1414'),
            ('019c2e00-0000-7000-8000-000000000007', 'Netto', 'netto', '#FFE500'),
            ('019c2e00-0000-7000-8000-000000000008', 'Norma', 'norma', ''),
            ('019c2e00-0000-7000-8000-000000000009', 'Alnatura', 'alnatura', '#B6CD35'),
            ('019c2e00-0000-7000-8000-00000000000a', 'Bio Company', 'biocompany', ''),
            ('019c2e00-0000-7000-8000-00000000000b', 'dm', 'dm', '#002878'),
            ('019c2e00-0000-7000-8000-00000000000c', 'Rossmann', 'rossmann', '#C3002D'),
            ('019c2e00-0000-7000-8000-00000000000d', 'Müller', 'mueller', '#F46519'),
            ('019c2e00-0000-7000-8000-00000000000e', 'Douglas', 'douglas', ''),
            ('019c2e00-0000-7000-8000-00000000000f', 'Amazon', 'amazon', '#FF9900'),
            ('019c2e00-0000-7000-8000-000000000010', 'eBay', 'ebay', '#E53238'),
            ('019c2e00-0000-7000-8000-000000000011', 'Otto', 'otto', '#D4021D'),
            ('019c2e00-0000-7000-8000-000000000012', 'Zalando', 'zalando', '#FF6900'),
            ('019c2e00-0000-7000-8000-000000000013', 'About You', 'aboutyou', ''),
            ('019c2e00-0000-7000-8000-000000000014', 'MediaMarkt', 'mediamarkt', '#DF0000'),
            ('019c2e00-0000-7000-8000-000000000015', 'Saturn', 'saturn', '#EB680B'),
            ('019c2e00-0000-7000-8000-000000000016', 'Conrad', 'conrad', '#4281FF'),
            ('019c2e00-0000-7000-8000-000000000017', 'Cyberport', 'cyberport', ''),
            ('019c2e00-0000-7000-8000-000000000018', 'IKEA', 'ikea', '#0058A3'),
            ('019c2e00-0000-7000-8000-000000000019', 'OBI', 'obi', ''),
            ('019c2e00-0000-7000-8000-00000000001a', 'Bauhaus', 'bauhaus', '#CC0000'),
            ('019c2e00-0000-7000-8000-00000000001b', 'Hornbach', 'hornbach', '#F79E1C'),
            ('019c2e00-0000-7000-8000-00000000001c', 'toom', 'toom', '#C90C0F'),
            ('019c2e00-0000-7000-8000-00000000001d', 'Action', 'action', ''),
            ('019c2e00-0000-7000-8000-00000000001e', 'TEDi', 'tedi', ''),
            ('019c2e00-0000-7000-8000-00000000001f', 'H&M', 'hm', '#E50010'),
            ('019c2e00-0000-7000-8000-000000000020', 'C&A', 'ca', ''),
            ('019c2e00-0000-7000-8000-000000000021', 'Deichmann', 'deichmann', '#008E54'),
            ('019c2e00-0000-7000-8000-000000000022', 'KiK', 'kik', '#82BC23'),
            ('019c2e00-0000-7000-8000-000000000023', 'Snipes', 'snipes', '#494B52'),
            ('019c2e00-0000-7000-8000-000000000024', 'Aral', 'aral', '#0063CB'),
            ('019c2e00-0000-7000-8000-000000000025', 'Shell', 'shell', '#FFD500'),
            ('019c2e00-0000-7000-8000-000000000026', 'Esso', 'esso', ''),
            ('019c2e00-0000-7000-8000-000000000027', 'TotalEnergies', 'total', ''),
            ('019c2e00-0000-7000-8000-000000000028', 'JET', 'jet', '#FBBA00'),
            ('019c2e00-0000-7000-8000-000000000029', 'Lieferando', 'lieferando', '#FF8000'),
            ('019c2e00-0000-7000-8000-00000000002a', 'McDonald''s', 'mcdonalds', '#FBC817'),
            ('019c2e00-0000-7000-8000-00000000002b', 'Burger King', 'burgerking', '#D62300'),
            ('019c2e00-0000-7000-8000-00000000002c', 'Subway', 'subway', ''),
            ('019c2e00-0000-7000-8000-00000000002d', 'Starbucks', 'starbucks', '#006241'),
            ('019c2e00-0000-7000-8000-00000000002e', 'Netflix', 'netflix', '#E50914'),
            ('019c2e00-0000-7000-8000-00000000002f', 'Spotify', 'spotify', '#1ED760'),
            ('019c2e00-0000-7000-8000-000000000030', 'Disney+', 'disneyplus', ''),
            ('019c2e00-0000-7000-8000-000000000031', 'Steam', 'steam', '#000000'),
            ('019c2e00-0000-7000-8000-000000000032', 'Apple', 'apple', '#000000'),
            ('019c2e00-0000-7000-8000-000000000033', 'Google', 'google', '#4285F4'),
            ('019c2e00-0000-7000-8000-000000000034', 'Microsoft', 'microsoft', ''),
            ('019c2e00-0000-7000-8000-000000000035', 'Telekom', 'telekom', '#E20074'),
            ('019c2e00-0000-7000-8000-000000000036', 'Vodafone', 'vodafone', '#E60000'),
            ('019c2e00-0000-7000-8000-000000000037', 'o2', 'o2', '#0050FF'),
            ('019c2e00-0000-7000-8000-000000000038', '1&1', '1und1', '#003D8F'),
            ('019c2e00-0000-7000-8000-000000000039', 'Deutsche Bahn', 'bahn', '#F01414'),
            ('019c2e00-0000-7000-8000-00000000003a', 'FlixBus', 'flixbus', '#97D700'),
            ('019c2e00-0000-7000-8000-00000000003b', 'DHL', 'dhl', '#FFCC00'),
            ('019c2e00-0000-7000-8000-00000000003c', 'Hermes', 'hermes', '#0091CD'),
            ('019c2e00-0000-7000-8000-00000000003d', 'DocMorris', 'docmorris', '#00463D'),
            ('019c2e00-0000-7000-8000-00000000003e', 'Shop Apotheke', 'shopapotheke', '#ED0334'),
            ('019c2e00-0000-7000-8000-00000000003f', 'Fressnapf', 'fressnapf', ''),
            ('019c2e00-0000-7000-8000-000000000040', 'Thalia', 'thalia', ''),
            ('019c2e00-0000-7000-8000-000000000041', 'Decathlon', 'decathlon', '#0082C3')
        ) AS seed(id, name, logo_key, color)
        ON CONFLICT DO NOTHING;
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DROP TABLE IF EXISTS budget.merchants;
        """);
}
