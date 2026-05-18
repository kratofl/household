DROP TABLE IF EXISTS budget.planned_expense_applications;
DROP TABLE IF EXISTS budget.planned_expenses;
ALTER TABLE budget.transactions DROP COLUMN IF EXISTS planned_expense_id;
