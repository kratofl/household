package identity

import (
	"errors"
	"fmt"
	"strings"

	"household/backend/internal/platform/config"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func SeedDemoUser(db *gorm.DB, seed config.ConfigSeed) error {
	if !seed.DemoUser {
		return nil
	}
	if strings.TrimSpace(seed.DemoUserName) == "" || strings.TrimSpace(seed.DemoUserEmail) == "" || seed.DemoUserPassword == "" {
		return fmt.Errorf("demo user seed requires name, email and password")
	}

	var existing User
	err := db.Where("name = ?", strings.ToLower(seed.DemoUserName)).First(&existing).Error
	if err == nil {
		updates := map[string]any{
			"email":  strings.ToLower(seed.DemoUserEmail),
			"role":   RoleAdmin,
			"status": StatusActive,
		}
		return db.Model(&existing).Updates(updates).Error
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(seed.DemoUserPassword), 14)
	if err != nil {
		return fmt.Errorf("hash demo user password: %w", err)
	}

	return db.Create(&User{
		Name:         strings.ToLower(seed.DemoUserName),
		Email:        strings.ToLower(seed.DemoUserEmail),
		PasswordHash: string(passwordHash),
		Role:         RoleAdmin,
		Status:       StatusActive,
	}).Error
}
