using Household.Api.Platform;
using Microsoft.EntityFrameworkCore;

namespace Household.Api.Features.Identity;

public static class IdentitySeed
{
    public static async Task ApplyAsync(IServiceProvider services, CancellationToken cancellationToken = default)
    {
        if (!HouseholdConfiguration.Boolean("HOUSEHOLD_SEED_DEMO_USER")) return;
        var name = HouseholdConfiguration.String("HOUSEHOLD_SEED_DEMO_USER_NAME", "admin").Trim().ToLowerInvariant();
        var email = HouseholdConfiguration.String("HOUSEHOLD_SEED_DEMO_USER_EMAIL", "admin@household.local").Trim().ToLowerInvariant();
        var password = HouseholdConfiguration.String("HOUSEHOLD_SEED_DEMO_USER_PASSWORD");
        if (name.Length == 0 || email.Length == 0 || password.Length == 0)
            throw new InvalidOperationException("Demo user seed requires name, email and password.");

        var database = services.GetRequiredService<IdentityDbContext>();
        var user = await database.Users.SingleOrDefaultAsync(x => x.Name == name, cancellationToken);
        if (user is null)
        {
            database.Users.Add(new User
            {
                Name = name,
                Email = email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(password, 14),
                Role = Roles.Admin,
                Status = UserStatuses.Active,
            });
        }
        else
        {
            user.Email = email;
            user.Role = Roles.Admin;
            user.Status = UserStatuses.Active;
        }
        await database.SaveChangesAsync(cancellationToken);
    }
}
