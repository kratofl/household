package budget

import "testing"

func TestNormalizeCategoryBehaviorAcceptsKnownValues(t *testing.T) {
	tests := map[string]string{
		"":                      CategoryBehaviorInclude,
		CategoryBehaviorInclude: CategoryBehaviorInclude,
		CategoryBehaviorExclude: CategoryBehaviorExclude,
		" include_in_limit ":    CategoryBehaviorInclude,
		" exclude_from_limit ":  CategoryBehaviorExclude,
	}

	for input, want := range tests {
		got, err := normalizeCategoryBehavior(input)
		if err != nil {
			t.Fatalf("normalizeCategoryBehavior(%q) returned error: %v", input, err)
		}
		if got != want {
			t.Fatalf("normalizeCategoryBehavior(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestNormalizeCategoryBehaviorRejectsUnknownValue(t *testing.T) {
	if _, err := normalizeCategoryBehavior("shared_limit"); err == nil {
		t.Fatal("normalizeCategoryBehavior accepted an unknown behavior")
	}
}

func TestNormalizeHexColorFallsBackWhenEmpty(t *testing.T) {
	got, err := normalizeHexColor("")
	if err != nil {
		t.Fatalf("normalizeHexColor returned error: %v", err)
	}
	if got != "#64748b" {
		t.Fatalf("normalizeHexColor empty = %q, want fallback", got)
	}
}

func TestNormalizeHexColorRejectsInvalidColor(t *testing.T) {
	if _, err := normalizeHexColor("red"); err == nil {
		t.Fatal("normalizeHexColor accepted an invalid color")
	}
}
