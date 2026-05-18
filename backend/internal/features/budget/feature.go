package budget

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"household/backend/internal/features/identity"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Feature struct {
	db *gorm.DB
}

func NewFeature(db *gorm.DB) *Feature {
	return &Feature{db: db}
}

func (f *Feature) RegisterRoutes(r chi.Router) {
	r.Route("/budget", func(r chi.Router) {
		r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		})
		r.Get("/summary", f.summary)
		r.Patch("/periods/current", f.updateCurrentPeriod)
		r.Post("/categories", f.createCategory)
		r.Patch("/categories/{categoryID}", f.updateCategory)
		r.Get("/planned-expenses", f.listPlannedExpenses)
		r.Post("/planned-expenses", f.createPlannedExpense)
		r.Patch("/planned-expenses/{plannedExpenseID}", f.updatePlannedExpense)
		r.Post("/planned-expenses/apply-current", f.applyCurrentPlannedExpenses)
		r.Post("/transactions", f.createTransaction)
	})
}

var hexColorPattern = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

type createTransactionRequest struct {
	AccountID      string `json:"accountId"`
	CategoryID     string `json:"categoryId"`
	OccurredOn     string `json:"occurredOn"`
	Description    string `json:"description"`
	AmountCents    int64  `json:"amountCents"`
	IncludeInLimit *bool  `json:"includeInLimit"`
}

type updateCurrentPeriodRequest struct {
	SpendingLimitCents      int64 `json:"spendingLimitCents"`
	OverspendCarryoverCents int64 `json:"overspendCarryoverCents"`
}

type categoryRequest struct {
	Name     string `json:"name"`
	Color    string `json:"color"`
	Behavior string `json:"behavior"`
}

type plannedExpenseRequest struct {
	AccountID      string `json:"accountId"`
	CategoryID     string `json:"categoryId"`
	Name           string `json:"name"`
	Kind           string `json:"kind"`
	Cadence        string `json:"cadence"`
	AmountCents    int64  `json:"amountCents"`
	DueDay         int    `json:"dueDay"`
	DueMonth       *int   `json:"dueMonth"`
	IncludeInLimit *bool  `json:"includeInLimit"`
	Active         *bool  `json:"active"`
}

type applyPlannedExpensesResponse struct {
	Applied int `json:"applied"`
	Skipped int `json:"skipped"`
}

func (f *Feature) summary(w http.ResponseWriter, r *http.Request) {
	user, ok := f.requireUser(w, r)
	if !ok {
		return
	}
	summary, err := f.summaryForUser(user.ID, time.Now())
	if err != nil {
		writeProblem(w, http.StatusInternalServerError, "Database error", "Could not build budget summary")
		return
	}
	writeJSON(w, http.StatusOK, summary)
}

func (f *Feature) updateCurrentPeriod(w http.ResponseWriter, r *http.Request) {
	user, ok := f.requireUser(w, r)
	if !ok {
		return
	}
	var req updateCurrentPeriodRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.SpendingLimitCents < 0 || req.OverspendCarryoverCents < 0 {
		writeProblem(w, http.StatusUnprocessableEntity, "Validation failed", "Limit and carryover must not be negative")
		return
	}
	var period Period
	err := f.db.Transaction(func(tx *gorm.DB) error {
		currentPeriod, _, _, err := f.ensureDefaults(tx, user.ID, time.Now())
		if err != nil {
			return err
		}
		if err := tx.Model(&Period{}).
			Where("id = ? AND owner_user_id = ?", currentPeriod.ID, user.ID).
			Updates(map[string]any{
				"spending_limit_cents":      req.SpendingLimitCents,
				"overspend_carryover_cents": req.OverspendCarryoverCents,
			}).Error; err != nil {
			return err
		}
		return tx.Where("id = ? AND owner_user_id = ?", currentPeriod.ID, user.ID).First(&period).Error
	})
	if err != nil {
		writeProblem(w, http.StatusInternalServerError, "Database error", "Could not update current budget period")
		return
	}
	writeJSON(w, http.StatusOK, period)
}

func (f *Feature) createCategory(w http.ResponseWriter, r *http.Request) {
	user, ok := f.requireUser(w, r)
	if !ok {
		return
	}
	var req categoryRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	category, err := categoryFromRequest(user.ID, req)
	if err != nil {
		writeProblem(w, http.StatusUnprocessableEntity, "Validation failed", err.Error())
		return
	}
	if err := f.db.Create(&category).Error; err != nil {
		writeProblem(w, http.StatusBadRequest, "Invalid category", "Category could not be created")
		return
	}
	writeJSON(w, http.StatusCreated, category)
}

func (f *Feature) updateCategory(w http.ResponseWriter, r *http.Request) {
	user, ok := f.requireUser(w, r)
	if !ok {
		return
	}
	categoryID, err := parseOwnedID(chi.URLParam(r, "categoryID"), "category")
	if err != nil {
		writeProblem(w, http.StatusBadRequest, "Invalid category", err.Error())
		return
	}
	var req categoryRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	category, err := categoryFromRequest(user.ID, req)
	if err != nil {
		writeProblem(w, http.StatusUnprocessableEntity, "Validation failed", err.Error())
		return
	}
	result := f.db.Model(&Category{}).
		Where("id = ? AND owner_user_id = ?", categoryID, user.ID).
		Updates(map[string]any{
			"name":     category.Name,
			"color":    category.Color,
			"behavior": category.Behavior,
		})
	if result.Error != nil {
		writeProblem(w, http.StatusBadRequest, "Invalid category", "Category could not be updated")
		return
	}
	if result.RowsAffected == 0 {
		writeProblem(w, http.StatusNotFound, "Not found", "Category was not found")
		return
	}
	if err := f.db.Where("id = ? AND owner_user_id = ?", categoryID, user.ID).First(&category).Error; err != nil {
		writeProblem(w, http.StatusInternalServerError, "Database error", "Could not load category")
		return
	}
	writeJSON(w, http.StatusOK, category)
}

func (f *Feature) listPlannedExpenses(w http.ResponseWriter, r *http.Request) {
	user, ok := f.requireUser(w, r)
	if !ok {
		return
	}
	planned, err := f.plannedExpensesForUser(user.ID)
	if err != nil {
		writeProblem(w, http.StatusInternalServerError, "Database error", "Could not list planned expenses")
		return
	}
	writeJSON(w, http.StatusOK, planned)
}

func (f *Feature) createPlannedExpense(w http.ResponseWriter, r *http.Request) {
	user, ok := f.requireUser(w, r)
	if !ok {
		return
	}
	var req plannedExpenseRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	planned, err := f.plannedExpenseFromRequest(user.ID, req)
	if err != nil {
		writeProblem(w, http.StatusUnprocessableEntity, "Validation failed", err.Error())
		return
	}
	if err := f.db.Create(&planned).Error; err != nil {
		writeProblem(w, http.StatusBadRequest, "Invalid planned expense", "Planned expense could not be created")
		return
	}
	writeJSON(w, http.StatusCreated, planned)
}

func (f *Feature) updatePlannedExpense(w http.ResponseWriter, r *http.Request) {
	user, ok := f.requireUser(w, r)
	if !ok {
		return
	}
	plannedExpenseID, err := parseOwnedID(chi.URLParam(r, "plannedExpenseID"), "planned expense")
	if err != nil {
		writeProblem(w, http.StatusBadRequest, "Invalid planned expense", err.Error())
		return
	}
	var req plannedExpenseRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	planned, err := f.plannedExpenseFromRequest(user.ID, req)
	if err != nil {
		writeProblem(w, http.StatusUnprocessableEntity, "Validation failed", err.Error())
		return
	}
	result := f.db.Model(&PlannedExpense{}).
		Where("id = ? AND owner_user_id = ?", plannedExpenseID, user.ID).
		Updates(map[string]any{
			"account_id":       planned.AccountID,
			"category_id":      planned.CategoryID,
			"name":             planned.Name,
			"kind":             planned.Kind,
			"cadence":          planned.Cadence,
			"amount_cents":     planned.AmountCents,
			"due_day":          planned.DueDay,
			"due_month":        planned.DueMonth,
			"include_in_limit": planned.IncludeInLimit,
			"active":           planned.Active,
		})
	if result.Error != nil {
		writeProblem(w, http.StatusBadRequest, "Invalid planned expense", "Planned expense could not be updated")
		return
	}
	if result.RowsAffected == 0 {
		writeProblem(w, http.StatusNotFound, "Not found", "Planned expense was not found")
		return
	}
	if err := f.db.Where("id = ? AND owner_user_id = ?", plannedExpenseID, user.ID).First(&planned).Error; err != nil {
		writeProblem(w, http.StatusInternalServerError, "Database error", "Could not load planned expense")
		return
	}
	writeJSON(w, http.StatusOK, planned)
}

func (f *Feature) applyCurrentPlannedExpenses(w http.ResponseWriter, r *http.Request) {
	user, ok := f.requireUser(w, r)
	if !ok {
		return
	}
	var response applyPlannedExpensesResponse
	err := f.db.Transaction(func(tx *gorm.DB) error {
		period, _, _, err := f.ensureDefaults(tx, user.ID, time.Now())
		if err != nil {
			return err
		}
		var plannedExpenses []PlannedExpense
		if err := tx.Where("owner_user_id = ? AND active = true", user.ID).Order("due_day ASC, name ASC").Find(&plannedExpenses).Error; err != nil {
			return err
		}
		for _, planned := range plannedExpenses {
			occurredOn, applies := plannedOccurrenceDate(period, planned)
			if !applies {
				response.Skipped++
				continue
			}
			var existing PlannedExpenseApplication
			err := tx.Where("planned_expense_id = ? AND period_id = ?", planned.ID, period.ID).First(&existing).Error
			if err == nil {
				response.Skipped++
				continue
			}
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}

			transaction := Transaction{
				OwnerUserID:      user.ID,
				PeriodID:         period.ID,
				AccountID:        planned.AccountID,
				CategoryID:       planned.CategoryID,
				PlannedExpenseID: &planned.ID,
				OccurredOn:       occurredOn,
				Description:      planned.Name,
				AmountCents:      planned.AmountCents,
				IncludeInLimit:   planned.IncludeInLimit,
			}
			if err := tx.Create(&transaction).Error; err != nil {
				return err
			}
			application := PlannedExpenseApplication{
				OwnerUserID:      user.ID,
				PlannedExpenseID: planned.ID,
				PeriodID:         period.ID,
				TransactionID:    transaction.ID,
			}
			if err := tx.Create(&application).Error; err != nil {
				return err
			}
			if err := tx.Model(&Account{}).
				Where("id = ? AND owner_user_id = ?", planned.AccountID, user.ID).
				Update("balance_cents", gorm.Expr("balance_cents - ?", planned.AmountCents)).Error; err != nil {
				return err
			}
			response.Applied++
		}
		return nil
	})
	if err != nil {
		writeProblem(w, http.StatusInternalServerError, "Database error", "Could not apply planned expenses")
		return
	}
	writeJSON(w, http.StatusOK, response)
}

func (f *Feature) createTransaction(w http.ResponseWriter, r *http.Request) {
	user, ok := f.requireUser(w, r)
	if !ok {
		return
	}
	var req createTransactionRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if strings.TrimSpace(req.Description) == "" || req.AmountCents <= 0 {
		writeProblem(w, http.StatusUnprocessableEntity, "Validation failed", "Description and a positive amount are required")
		return
	}

	occurredOn := time.Now().UTC()
	if req.OccurredOn != "" {
		parsed, err := time.Parse("2006-01-02", req.OccurredOn)
		if err != nil {
			writeProblem(w, http.StatusBadRequest, "Invalid date", "Occurred date must use YYYY-MM-DD")
			return
		}
		occurredOn = parsed
	}
	includeInLimit := true
	if req.IncludeInLimit != nil {
		includeInLimit = *req.IncludeInLimit
	}

	var created Transaction
	if err := f.db.Transaction(func(tx *gorm.DB) error {
		period, _, _, err := f.ensureDefaults(tx, user.ID, occurredOn)
		if err != nil {
			return err
		}

		accountID, err := parseOwnedID(req.AccountID, "account")
		if err != nil {
			return err
		}
		var account Account
		if err := tx.Where("id = ? AND owner_user_id = ?", accountID, user.ID).First(&account).Error; err != nil {
			return err
		}

		var categoryID *uuid.UUID
		if req.CategoryID != "" {
			parsedCategoryID, err := parseOwnedID(req.CategoryID, "category")
			if err != nil {
				return err
			}
			var category Category
			if err := tx.Where("id = ? AND owner_user_id = ?", parsedCategoryID, user.ID).First(&category).Error; err != nil {
				return err
			}
			categoryID = &parsedCategoryID
			if category.Behavior == CategoryBehaviorExclude {
				includeInLimit = false
			}
		}

		created = Transaction{
			OwnerUserID:    user.ID,
			PeriodID:       period.ID,
			AccountID:      account.ID,
			CategoryID:     categoryID,
			OccurredOn:     occurredOn,
			Description:    strings.TrimSpace(req.Description),
			AmountCents:    req.AmountCents,
			IncludeInLimit: includeInLimit,
		}
		if err := tx.Create(&created).Error; err != nil {
			return err
		}
		return tx.Model(&Account{}).
			Where("id = ? AND owner_user_id = ?", account.ID, user.ID).
			Update("balance_cents", gorm.Expr("balance_cents - ?", req.AmountCents)).Error
	}); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeProblem(w, http.StatusNotFound, "Not found", "Budget account or category was not found")
			return
		}
		writeProblem(w, http.StatusBadRequest, "Invalid request", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (f *Feature) summaryForUser(userID uuid.UUID, now time.Time) (Summary, error) {
	var summary Summary
	err := f.db.Transaction(func(tx *gorm.DB) error {
		period, categories, accounts, err := f.ensureDefaults(tx, userID, now)
		if err != nil {
			return err
		}
		var transactions []Transaction
		if err := tx.Where("owner_user_id = ? AND period_id = ?", userID, period.ID).
			Order("occurred_on DESC, created_at DESC").
			Find(&transactions).Error; err != nil {
			return err
		}
		summary = BuildSummary(period, categories, transactions)
		summary.Accounts = accounts
		for _, account := range accounts {
			summary.AccountBalanceCents += account.BalanceCents
		}
		plannedExpenses, err := f.plannedExpenseSummaries(tx, userID, period.ID)
		if err != nil {
			return err
		}
		summary.PlannedExpenses = plannedExpenses
		return nil
	})
	return summary, err
}

func (f *Feature) plannedExpensesForUser(userID uuid.UUID) ([]PlannedExpense, error) {
	var planned []PlannedExpense
	err := f.db.Where("owner_user_id = ?", userID).Order("active DESC, due_day ASC, name ASC").Find(&planned).Error
	return planned, err
}

func (f *Feature) plannedExpenseSummaries(tx *gorm.DB, userID uuid.UUID, periodID uuid.UUID) ([]PlannedExpenseSummary, error) {
	var planned []PlannedExpense
	if err := tx.Where("owner_user_id = ?", userID).Order("active DESC, due_day ASC, name ASC").Find(&planned).Error; err != nil {
		return nil, err
	}
	var applications []PlannedExpenseApplication
	if err := tx.Where("owner_user_id = ? AND period_id = ?", userID, periodID).Find(&applications).Error; err != nil {
		return nil, err
	}
	applied := make(map[uuid.UUID]bool, len(applications))
	for _, application := range applications {
		applied[application.PlannedExpenseID] = true
	}
	summaries := make([]PlannedExpenseSummary, 0, len(planned))
	for _, item := range planned {
		summaries = append(summaries, PlannedExpenseSummary{
			PlannedExpense:         item,
			AppliedInCurrentPeriod: applied[item.ID],
		})
	}
	return summaries, nil
}

func (f *Feature) ensureDefaults(tx *gorm.DB, userID uuid.UUID, now time.Time) (Period, []Category, []Account, error) {
	start, end := currentMonthBounds(now)
	period := Period{
		OwnerUserID:        userID,
		Name:               start.Format("January 2006"),
		StartDate:          start,
		EndDate:            end,
		SpendingLimitCents: 240000,
	}
	if err := tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "owner_user_id"}, {Name: "start_date"}},
		DoNothing: true,
	}).Create(&period).Error; err != nil {
		return Period{}, nil, nil, err
	}
	if err := tx.Where("owner_user_id = ? AND start_date = ?", userID, start).First(&period).Error; err != nil {
		return Period{}, nil, nil, err
	}

	defaultCategories := []Category{
		{OwnerUserID: userID, Name: "Fixkosten", Color: "#2563eb", Behavior: CategoryBehaviorInclude},
		{OwnerUserID: userID, Name: "Lebensmittel", Color: "#16a34a", Behavior: CategoryBehaviorInclude},
		{OwnerUserID: userID, Name: "Flexibel", Color: "#f97316", Behavior: CategoryBehaviorInclude},
		{OwnerUserID: userID, Name: "Sparen", Color: "#7c3aed", Behavior: CategoryBehaviorInclude},
		{OwnerUserID: userID, Name: "Nicht speichern", Color: "#64748b", Behavior: CategoryBehaviorExclude, Protected: true},
	}
	for _, category := range defaultCategories {
		if err := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "owner_user_id"}, {Name: "name"}},
			DoNothing: true,
		}).Create(&category).Error; err != nil {
			return Period{}, nil, nil, err
		}
	}

	defaultAccount := Account{OwnerUserID: userID, Name: "Girokonto"}
	if err := tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "owner_user_id"}, {Name: "name"}},
		DoNothing: true,
	}).Create(&defaultAccount).Error; err != nil {
		return Period{}, nil, nil, err
	}

	var categories []Category
	if err := tx.Where("owner_user_id = ?", userID).Order("protected ASC, name ASC").Find(&categories).Error; err != nil {
		return Period{}, nil, nil, err
	}
	var accounts []Account
	if err := tx.Where("owner_user_id = ?", userID).Order("name ASC").Find(&accounts).Error; err != nil {
		return Period{}, nil, nil, err
	}
	return period, categories, accounts, nil
}

func parseOwnedID(raw string, name string) (uuid.UUID, error) {
	if raw == "" {
		return uuid.Nil, errors.New(name + " id is required")
	}
	parsed, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, errors.New(name + " id is invalid")
	}
	return parsed, nil
}

func categoryFromRequest(userID uuid.UUID, req categoryRequest) (Category, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return Category{}, errors.New("category name is required")
	}
	color, err := normalizeHexColor(req.Color)
	if err != nil {
		return Category{}, err
	}
	behavior, err := normalizeCategoryBehavior(req.Behavior)
	if err != nil {
		return Category{}, err
	}
	return Category{
		OwnerUserID: userID,
		Name:        name,
		Color:       color,
		Behavior:    behavior,
	}, nil
}

func (f *Feature) plannedExpenseFromRequest(userID uuid.UUID, req plannedExpenseRequest) (PlannedExpense, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return PlannedExpense{}, errors.New("planned expense name is required")
	}
	if req.AmountCents <= 0 {
		return PlannedExpense{}, errors.New("planned expense amount must be positive")
	}
	dueDay := req.DueDay
	if dueDay == 0 {
		dueDay = 1
	}
	if dueDay < 1 || dueDay > 31 {
		return PlannedExpense{}, errors.New("planned expense due day must be between 1 and 31")
	}
	kind, err := normalizePlannedKind(req.Kind)
	if err != nil {
		return PlannedExpense{}, err
	}
	cadence, err := normalizeCadence(req.Cadence)
	if err != nil {
		return PlannedExpense{}, err
	}
	if cadence == CadenceYearly {
		if req.DueMonth == nil || *req.DueMonth < 1 || *req.DueMonth > 12 {
			return PlannedExpense{}, errors.New("yearly planned expenses require a due month between 1 and 12")
		}
	} else {
		req.DueMonth = nil
	}
	accountID, err := parseOwnedID(req.AccountID, "account")
	if err != nil {
		return PlannedExpense{}, err
	}
	if err := f.db.Where("id = ? AND owner_user_id = ?", accountID, userID).First(&Account{}).Error; err != nil {
		return PlannedExpense{}, errors.New("account was not found")
	}
	var categoryID *uuid.UUID
	if req.CategoryID != "" {
		parsedCategoryID, err := parseOwnedID(req.CategoryID, "category")
		if err != nil {
			return PlannedExpense{}, err
		}
		var category Category
		if err := f.db.Where("id = ? AND owner_user_id = ?", parsedCategoryID, userID).First(&category).Error; err != nil {
			return PlannedExpense{}, errors.New("category was not found")
		}
		categoryID = &parsedCategoryID
		if category.Behavior == CategoryBehaviorExclude {
			includeInLimit := false
			req.IncludeInLimit = &includeInLimit
		}
	}
	includeInLimit := true
	if req.IncludeInLimit != nil {
		includeInLimit = *req.IncludeInLimit
	}
	active := true
	if req.Active != nil {
		active = *req.Active
	}
	return PlannedExpense{
		OwnerUserID:    userID,
		AccountID:      accountID,
		CategoryID:     categoryID,
		Name:           name,
		Kind:           kind,
		Cadence:        cadence,
		AmountCents:    req.AmountCents,
		DueDay:         dueDay,
		DueMonth:       req.DueMonth,
		IncludeInLimit: includeInLimit,
		Active:         active,
	}, nil
}

func normalizeCategoryBehavior(raw string) (string, error) {
	behavior := strings.TrimSpace(raw)
	if behavior == "" {
		return CategoryBehaviorInclude, nil
	}
	switch behavior {
	case CategoryBehaviorInclude, CategoryBehaviorExclude:
		return behavior, nil
	default:
		return "", errors.New("category behavior is invalid")
	}
}

func normalizeHexColor(raw string) (string, error) {
	color := strings.TrimSpace(raw)
	if color == "" {
		return "#64748b", nil
	}
	if !hexColorPattern.MatchString(color) {
		return "", errors.New("category color must be a #RRGGBB value")
	}
	return color, nil
}

func (f *Feature) requireUser(w http.ResponseWriter, r *http.Request) (*identity.User, bool) {
	auth := r.Header.Get("Authorization")
	token, ok := strings.CutPrefix(auth, "Bearer ")
	if !ok || token == "" {
		writeProblem(w, http.StatusUnauthorized, "Unauthorized", "Missing bearer token")
		return nil, false
	}
	var session identity.Session
	err := f.db.Preload("User").
		Where("access_token_hash = ? AND revoked_at IS NULL", hashToken(token)).
		First(&session).Error
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			writeProblem(w, http.StatusInternalServerError, "Database error", "Could not read session")
			return nil, false
		}
		writeProblem(w, http.StatusUnauthorized, "Unauthorized", "Invalid bearer token")
		return nil, false
	}
	if time.Now().After(session.AccessExpiresAt) || session.User.Status != identity.StatusActive {
		writeProblem(w, http.StatusUnauthorized, "Unauthorized", "Bearer token expired")
		return nil, false
	}
	return &session.User, true
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any) bool {
	if err := json.NewDecoder(r.Body).Decode(target); err != nil {
		writeProblem(w, http.StatusBadRequest, "Invalid JSON", "Request body could not be decoded")
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func writeProblem(w http.ResponseWriter, status int, title string, detail string) {
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"type":   "about:blank",
		"title":  title,
		"status": status,
		"detail": detail,
	})
}
