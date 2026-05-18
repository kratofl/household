CREATE TABLE IF NOT EXISTS identity.modules (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    key varchar(255) NOT NULL UNIQUE,
    name varchar(255) NOT NULL,
    description varchar(1024) NOT NULL DEFAULT '',
    enabled boolean NOT NULL DEFAULT true,
    active boolean NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO identity.modules (key, name, description, enabled, active)
VALUES
    ('budget', 'Budget', 'Track expenses, categories, limits, accounts, and savings plans.', true, true),
    ('shopping', 'Shopping List', 'Plan and share shopping lists.', false, false),
    ('recipes', 'Recipes', 'Manage household recipes.', false, false),
    ('meal_plan', 'Meal Plan', 'Plan meals across the household calendar.', false, false),
    ('calendar', 'Calendar', 'Coordinate household events and schedules.', false, false),
    ('waste_schedule', 'Waste Schedule', 'Track waste collection dates.', false, false)
ON CONFLICT (key) DO NOTHING;
