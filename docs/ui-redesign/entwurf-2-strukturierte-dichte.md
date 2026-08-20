# UI-Redesign Entwurf 2: Strukturierte Datendichte

**Paradigma:** Power-Tool (Linear / modernes Buchhaltungs- und Trading-Werkzeug).
**Status:** Designdokument, keine Implementierung.
**Stack-Annahmen:** Next.js, shadcn/ui, Tailwind, Recharts, de/en-i18n. Neu einzuplanende shadcn-Komponenten: `dialog`, `table`, `select`, `tooltip`, `popover`, `sonner` (Toast), `accordion`, `progress`, `date-picker`, `command`, `sidebar`.

---

## 1. Leitidee

**Keine Zahl steht allein.** Jede Kennzahl bekommt genau drei Dinge: einen Vergleich (Vorperiode, Ziel oder Trend), eine Form (Tabelle, Sparkline, Progressbar oder Badge) und einen Platz in der Hierarchie (pro Region genau eine Primärzahl, alles andere sekundär und grau). Die Datenmenge sinkt nicht — sie wird strukturiert: tabellarische Daten werden Tabellen mit Sortierung und Zeilenaktionen, Meta-Strings werden ausgerichtete Key-Value-Paare und Badges, Zahlkacheln werden zu einer einzigen KPI-Leiste mit Sparklines verdichtet. Aktionen passieren dort, wo ihr Auslöser ist (Zeilenmenü → Dialog), nie am anderen Ende der Seite. Das Ergebnis ist ein Werkzeug, das man nach einer Woche blind bedient — nicht eine Broschüre, die man beim ersten Besuch versteht.

---

## 2. Informationsarchitektur

### 2.1 Navigationsbaum (Sidebar, shadcn `sidebar` mit Collapsible-Gruppen)

```
┌──────────────────────────────┐
│ ⌂ Haushalt          [⌘K]     │  ← App-Wortmarke + Command-Palette-Trigger
├──────────────────────────────┤
│ ▸ Start                      │  ← Dashboard, umbenannt (Modul-übergreifend)
│                              │
│ BUDGET                       │  ← Gruppenlabel, Modul aufgeklappt wenn aktiv
│ ▸ Übersicht                  │
│ ▸ Transaktionen              │  ← inkl. CSV-Import (als Wizard-Dialog hier)
│ ▸ Planung                    │  ← Einkommenspläne + Daueraufträge + Occurrences
│ ▸ Sparen & Ziele             │  ← Sparen + Investieren + Wunschliste zusammengelegt
│ ▸ Berichte                   │
│ ▸ Kategorien                 │
│ ▸ Einstellungen              │  ← Budget-Einstellungen (Perioden, Puffer-Regeln)
│                              │
│ (künftige Module …)          │
├──────────────────────────────┤
│ ◉ Luca A.            ▾       │  ← Sidebar-Footer: Avatar-Menü mit Account,
└──────────────────────────────┘     Admin, Sprache, Abmelden — NICHT zusätzlich im Header
```

**Änderungen gegenüber heute:**

| Heute | Neu | Begründung |
|---|---|---|
| „Dashboard" | **Start** | Modul-übergreifende Startseite; „Dashboard" kollidiert begrifflich mit Budget-Übersicht. |
| 8 Budget-Unteransichten als Pill-Reihe/Content-Tabs | **Echte verschachtelte Sidebar-Navigation** (Repo-Regel) | Persistente Orientierung, aktiver Zustand sichtbar, kein horizontales Scrollen. |
| „Sparen & Investieren" + „Wunschliste" (2 Ansichten) | **„Sparen & Ziele"** (1 Ansicht, 3 Tabs: Ziele / Investments / Wunschliste) | Wunschliste ist Vorstufe von Sparzielen (Promote-Flow); Investments sind Events derselben Vermögenslogik. Ein Lebenszyklus, eine Seite. |
| CSV-Import als eigener Bereich in Transaktionen | **Import-Wizard-Dialog** aus Transaktionen heraus | Import ist eine Aktion, keine Ansicht. |
| „Aktive Module"-Karte im Haupt-UI | **entfällt** (Repo-Regel) | Modulverwaltung gehört in Admin. |
| Account/Admin doppelt (Header + Sidebar) | **nur Sidebar-Footer** (Avatar-Menü) | Repo-Regel; Header bleibt frei für Kontext (Periodenwahl, Breadcrumb). |
| Generischer Card-Titel „Vorschau" auf jeder Seite | **entfällt**; jede Seite hat eigenen `<h1>` + eigenes Layout | Problem 1 behoben; Seitentitel = Sidebar-Eintrag = `<title>`. |

### 2.2 Persistenter Seitenkopf (alle Budget-Screens)

Statt der Einheits-Card bekommt jede Seite einen schlanken Kopf:

```
Budget / Transaktionen                          ‹ Juli 2026 ▾ ›   [Aktion]
─────────────────────────────────────────────────────────────────────────
```

- **Breadcrumb + Seitentitel** links (Titel = h1, groß; Breadcrumb klein, grau).
- **Perioden-Umschalter** (Popover mit Monatsgrid + „geschlossen"-Badge) rechts — global für alle Budget-Ansichten, Zustand in URL (`?period=2026-07`).
- **Eine Primäraktion** pro Seite als Button rechts (z. B. „Transaktion erfassen"). Sekundäraktionen im `…`-Menü daneben.

### 2.3 Screen-Liste

| # | Screen | Kern-Form | Primäraktion |
|---|---|---|---|
| S1 | Start | KPI-Leiste + Aufgaben-Tabelle + Mini-Timeline | „Transaktion erfassen" |
| S2 | Budget / Übersicht | Verfügbar-Hero + Puffer-Tabelle + Timeline-Chart | „Periode schließen" (nur Monatsende) |
| S3 | Budget / Transaktionen | Sortierbare Ledger-Tabelle + Erfassen-Sheet | „Erfassen" |
| S4 | Budget / Planung | Plan-Tabelle + Occurrence-Tabelle (Master-Detail) | „Neuer Plan" (Wizard) |
| S5 | Budget / Sparen & Ziele | Tabs: Ziel-Tabelle m. Progress / Investment-Events / Wunschliste | „Beitrag buchen" |
| S6 | Budget / Berichte | Berichtswahl links, Chart + Drilldown-Tabelle rechts | „Export CSV" |
| S7 | Budget / Kategorien | Editierbare Tabelle (explizites Speichern) | „Neue Kategorie" |
| S8 | Budget / Einstellungen | Formular-Sektionen (Accordion) | „Speichern" |
| D1 | Dialoge | Korrigieren, Stornieren, Erstatten, Occurrence-Aktionen, Periode schließen, Import-Wizard, Promote-zu-Sparziel | — |

---

## 3. Screen-Entwürfe

Legende Wireframes: `▁▃▅▇` Sparkline, `━━░░` Progressbar, `[·]` Badge, `⋮` Zeilenmenü, `▾` Sortier-/Select-Indikator.

### 3.1 S1 — Start (Dashboard)

```
┌ Sidebar ┐ ┌────────────────────────────────────────────────────────────────────┐
│         │ │ Start                                    ‹ Juli 2026 ▾ ›  [Erfassen]│
│ ▸ Start │ ├────────────────────────────────────────────────────────────────────┤
│ BUDGET  │ │ VERFÜGBAR            AUSGABEN (LIMIT)         PUFFER GESAMT        │
│ Übers.  │ │ 1.284,50 €           862 € / 1.400 €          4.310 € / 5.000 €    │
│ Trans.  │ │ ▁▂▃▅▄▆▇  +6 % z. Vm. ━━━━━━━░░░ 62 %          ━━━━━━━━░░ 86 %     │
│ Planung │ ├────────────────────────────────────────────────────────────────────┤
│ Sparen  │ │ Steht an (5)                                        [Alle → Planung]│
│ Berichte│ │ ┌────────────┬──────────────────┬──────────┬───────────┬────┐      │
│ Kateg.  │ │ │ Fällig ▾   │ Posten           │ Betrag   │ Status    │    │      │
│ Einst.  │ │ │ 08.08.     │ Miete            │ −950,00 €│ [auto]    │ ⋮  │      │
│         │ │ │ 09.08.     │ Gehalt L.        │ +3.200 € │ [erwartet]│ ⋮  │      │
│ ◉ Luca ▾│ │ │ 12.08.     │ Strom (Abo)      │  −84,00 €│ [bestät.?]│ ⋮  │      │
└─────────┘ │ └────────────┴──────────────────┴──────────┴───────────┴────┘      │
            │ ┌───────────────────────────────┐ ┌──────────────────────────┐     │
            │ │ Saldo-Verlauf (Ist + erwartet)│ │ Sparziele                │     │
            │ │      ▄▄▄                      │ │ Urlaub    ━━━━━░░ 71 %   │     │
            │ │ ▂▃▄▅▆▇▇▇┄┄┄┄┄┄ (gestrichelt   │ │ Laptop    ━━░░░░ 34 %    │     │
            │ │           = erwartet)         │ │ Notgroschen ━━━━━━ 100 % │     │
            │ └───────────────────────────────┘ └──────────────────────────┘     │
            └────────────────────────────────────────────────────────────────────┘
```

**Hierarchie:** Genau eine Primärzahl — „Verfügbar" (28 px, tabular-nums). Die zwei Nachbar-KPIs sind bewusst kleiner (20 px) und tragen je eine andere Form (Sparkline vs. zwei Progressbars) — keine zwei benachbarten Elemente mit gleicher Gewichtung. **Interaktion:** „Steht an" ist eine echte Tabelle der nächsten Occurrences/Erinnerungen; `⋮` öffnet direkt Bestätigen/Zuordnen-Dialoge (Problem 4). Alles klickt in die jeweilige Detailansicht durch.

### 3.2 S2 — Budget / Übersicht

Ersetzt die 11 Einheits-Kacheln (Problem 2) durch: **1 Hero-Zahl + 1 Flussleiste + 1 Puffer-Tabelle + 1 Chart.**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Budget / Übersicht                     ‹ Juli 2026 ▾ ›  [Periode schließen]│
├────────────────────────────────────────────────────────────────────────────┤
│ VERFÜGBAR JETZT                                                            │
│ 1.284,50 €   ▲ +72,10 € seit gestern        [Periode offen] [Übertrag 120 €]│
│                                                                            │
│ Einkommen 3.450 € ─▶ Reserviert 1.020 € ─▶ Puffer 690 € ─▶ Verfügbar 1.284 €│
│ ███████████████████▒▒▒▒▒▒▒▒▒▒▒▒▓▓▓▓▓▓▓░░░░░░░░   (gestapelte Flussleiste)  │
├──────────────────────────────────────┬─────────────────────────────────────┤
│ Puffer (6)                    [+ Neu]│ Ausgaben im Limit                   │
│ ┌─────────┬───────┬────────┬───────┐ │ 862 € / 1.400 €   ━━━━━━░░░░ 62 %  │
│ │ Puffer ▾│ Regel │ Stand  │ Fehlt │ │                                     │
│ │ Auto 🔒 │ 50 €/M│━━━━░ 80%│ 200 €│ │ Timeline (Ist ▇ + erwartet ┄)      │
│ │ Urlaub  │ 10 %  │━━░░ 45%│ 610 €│ │  ▁▂▄▅▇▇┄┄┄┄╌ Limit ────────        │
│ │ Medizin🔒│ fix  │━━━━━100%│  ✓  │ │  1.  5.  10.  15.  20.  25.  31.   │
│ └─────────┴───────┴────────┴───────┘ │                                     │
│   Σ Ziel 5.000 € · Ist 4.310 €       │ [Tage ▾] [nur gebucht ☐]           │
└──────────────────────────────────────┴─────────────────────────────────────┘
```

**Hierarchie:** „Verfügbar jetzt" ist die einzige Hero-Zahl; die frühere Kachel-Kette Einkommen→Reserviert→Puffer→Verfügbar wird eine **Flussleiste** (gestapelter horizontaler Balken mit Beschriftung), die die Rechnung sichtbar macht statt vier gleiche Kacheln zu zeigen. Die 6 Puffer-Detail-Kacheln werden eine **sortierbare Tabelle** mit Progress-Spalte, 🔒-Badge für „geschützt" und Summenzeile. **Interaktion:** Puffer-Zeile → Popover mit Historie-Sparkline + „Regel bearbeiten"-Dialog. „Periode schließen" öffnet einen Dialog mit Defizit-Deckungs-Vorschau (welcher Puffer deckt was), nie eine neue Seite.

### 3.3 S3 — Budget / Transaktionen (inkl. Erfassen)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Budget / Transaktionen                  ‹ Juli 2026 ▾ ›  [Import ▾][Erfassen]│
├────────────────────────────────────────────────────────────────────────────┤
│ [Suche…        ] [Kategorie ▾] [Typ ▾] [Status ▾] [Zeitraum ▾]   3 Filter ⨯ │
├────────────────────────────────────────────────────────────────────────────┤
│ ┌──────┬──────────────────┬─────────────┬────────────┬──────────┬───┐      │
│ │Datum▾│ Beschreibung     │ Kategorie   │ Status     │  Betrag ▾│   │      │
│ ├──────┼──────────────────┼─────────────┼────────────┼──────────┼───┤      │
│ │ 31.07│ REWE             │ ●Lebensm.   │ [gebucht]  │  −54,20 €│ ⋮ │      │
│ │ 30.07│ Gehalt Luca      │ ●Einkommen  │ [gebucht]  │+3.200,00€│ ⋮ │      │
│ │ 30.07│ Amazon  ⑂2 Splits│ ●Haushalt   │ [korrigiert]│ −89,90 €│ ⋮ │      │
│ │ 29.07│ Strom (Abo #12)  │ ●Wohnen     │ [erwartet] │  −84,00 €│ ⋮ │      │
│ │ 28.07│ Apotheke         │ ●Gesundheit │ [erstattet]│   −0,00 €│ ⋮ │      │
│ └──────┴──────────────────┴─────────────┴────────────┴──────────┴───┘      │
│ 142 Einträge · Σ Einnahmen +3.450 € · Σ Ausgaben −2.165 €    ‹ 1 2 3 … ›   │
└────────────────────────────────────────────────────────────────────────────┘
  ⋮-Menü einer Zeile:            Erfassen (Sheet, rechts, 480 px):
  ┌───────────────┐              ┌─ Transaktion erfassen ────────── ⨯ ┐
  │ Details        │             │ (Ausgabe|Einnahme)  ← Segment      │
  │ Korrigieren…   │             │ Betrag*   [      54,20 €]  GROSS   │
  │ Erstatten…     │             │ Datum*    [31.07.2026 ▾]           │
  │ Stornieren…    │             │ Kategorie*[● Lebensmittel ▾]       │
  │ Audit-Verlauf  │             │ Beschreibung [REWE           ]     │
  └───────────────┘              │ ▸ Splits (0)            Accordion  │
                                 │ ▸ Details (Händler, Notiz, außerh. │
                                 │   Limit)                Accordion  │
                                 │        [Abbrechen] [Speichern ⏎]   │
                                 └────────────────────────────────────┘
```

**Hierarchie:** Betrag rechtsbündig, tabular-nums, Einnahmen grün, Ausgaben Standardfarbe (nicht rot — rot ist für Probleme reserviert, s. §4.3). Erwartete Einträge (Timeline vereinheitlicht Ist + erwartet) sind **kursiv + gedimmt + Badge [erwartet]**. Splits als ⑂-Badge, expandierbar per Klick (Indent-Zeilen). Summenzeile im Footer beantwortet „wo stehe ich" ohne Kacheln. **Interaktionen:** Aktionen Korrigieren/Stornieren/Erstatten aus dem Zeilenmenü als **Dialog mit Vorher/Nachher-Diff** (Problem 4). Audit-Verlauf = formatierter Dialog (Tabelle: Zeitpunkt, Feld, alt→neu, Akteur) statt `JSON.stringify` (Problem 7). Das 8–10-Control-Formular wird ein **Sheet mit 4 Pflichtfeldern sichtbar** und zwei Accordions für Splits/Details (Problem 3); ⏎ speichert, Toast bestätigt, Sheet bleibt optional offen („Speichern + weitere"). **Import** startet den 3-Schritt-Wizard-Dialog: 1) Datei, 2) Mapping als **Vorschau-Tabelle** (Spaltenkopf = Select über der echten Datenspalte, statt 9 Selects am Stück), 3) Prüfen mit Fehler-Badges pro Zeile.

### 3.4 S4 — Budget / Planung (Pläne + Occurrences)

Master-Detail statt Karten-Halde (Problem 5): oben Plan-Tabelle, unten Occurrences des ausgewählten Plans (oder aller).

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Budget / Planung                          ‹ Juli 2026 ▾ ›      [Neuer Plan]│
├────────────────────────────────────────────────────────────────────────────┤
│ (Alle 12 | Einkommen 3 | Daueraufträge 7 | Abos 2)       [aktiv ▾] [Suche ]│
│ ┌──────────────────┬─────────┬──────────┬──────────────────────┬────┬───┐  │
│ │ Plan ▾           │ Kadenz  │ Betrag ▾ │ Status               │ 🔔 │   │  │
│ ├──────────────────┼─────────┼──────────┼──────────────────────┼────┼───┤  │
│ │ Gehalt Luca      │ monatl. │ +3.200 € │ [aktiv][auto] v3     │ ●  │ ⋮ │  │
│ │▌Miete            │ monatl. │  −950 €  │ [aktiv][auto]        │ ●  │ ⋮ │  │ ← ausgewählt
│ │ Fitness          │ monatl. │   −45 €  │ [pausiert bis 09/26] │ ○  │ ⋮ │  │
│ │ GEZ              │ viertelj│   −55 €  │ [gestoppt 01.01.26]  │ ○  │ ⋮ │  │
│ └──────────────────┴─────────┴──────────┴──────────────────────┴────┴───┘  │
├────────────────────────────────────────────────────────────────────────────┤
│ Occurrences: Miete                          [offen ▾]  [nur diese Periode ☑]│
│ ┌────────┬───────────┬──────────┬───────────────┬────────────────────┬───┐ │
│ │ Fällig▾│ Erwartet  │ Ist      │ Varianz       │ Status             │   │ │
│ ├────────┼───────────┼──────────┼───────────────┼────────────────────┼───┤ │
│ │ 01.07. │  −950,00 €│ −950,00 €│      —        │ [gebucht]          │ ⋮ │ │
│ │ 01.08. │  −950,00 €│ −965,00 €│ +15 € → Puffer│ [zu bestätigen]    │ ⋮ │ │
│ │ 01.09. │  −950,00 €│     —    │      —        │ [erwartet]         │ ⋮ │ │
│ └────────┴───────────┴──────────┴───────────────┴────────────────────┴───┘ │
│   ⋮: Bestätigen… · Zuordnen… · Überspringen… · Betrag anpassen…            │
└────────────────────────────────────────────────────────────────────────────┘
```

**Hierarchie:** Der frühere Meta-String `monthly · stopped 2026-01-01 · automatic · 3 versions` (Problem 6) wird zerlegt: Kadenz = eigene Spalte (lokalisiert), Status = Badge mit Datum, Auto-Posting = Badge, Versionen = dezentes `v3` mit Tooltip → Versions-Popover (Tabelle: Version, gültig ab, Betrag). Die 4 Buttons + 2 Switches pro Karte verschwinden ins `⋮`-Menü (Bearbeiten/Pausieren/Stoppen/Duplizieren) plus 🔔-Switch als einzige Inline-Steuerung (Erinnerung an/aus — häufigster Toggle). Die bis zu 18 Occurrence-Kacheln werden eine **Tabelle mit Varianz-Spalte**, die die Varianzregel sichtbar macht („+15 € → Puffer"). **Interaktionen:** Alle Occurrence-Aktionen als Dialog am Auslöser (Problem 4). **„Neuer Plan"** = 3-Schritt-Wizard-Dialog statt 12-Control-Flachformular (Problem 3): ① Was & Wieviel (Typ, Name, Betrag, Kategorie), ② Rhythmus (Kadenz, Start/Ende, Auto-Posting), ③ Abweichungen (Varianzregel → Puffer/Ordinary, Erinnerungen) — Schritt 3 mit sinnvollen Defaults überspringbar. Einkommensplan nutzt denselben Wizard mit Varianzregel-Schritt.

### 3.5 S6 — Budget / Berichte

Statt 8 fast identischer Listen-Cards (Problem 5): **eine** Berichts-Seite mit Berichtswahl links, Chart + Drilldown-Tabelle rechts.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Budget / Berichte                       [Mai–Jul 2026 ▾]        [Export CSV]│
├──────────────┬─────────────────────────────────────────────────────────────┤
│ BERICHT      │ Ausgaben nach Kategorie              Vergleich: [Vormonat ▾] │
│ ▸ Perioden-  │ ┌─────────────────────────────────────────────┐             │
│   vergleich  │ │ Lebensmittel ████████████ 412 €  ▲ +8 %     │  horizontale│
│ ▸ Kategorien │ │ Wohnen       ████████ 1.034 €     ▬ ±0 %    │  Balken,    │
│ ● Händler    │ │ Mobilität    █████ 240 €          ▼ −12 %   │  sortiert   │
│ ▸ Plan v. Ist│ │ Freizeit     ███ 155 €            ▲ +31 %   │             │
│ ▸ Einkommen  │ └─────────────────────────────────────────────┘             │
│ ▸ Puffer     │ ┌─────────┬────────┬────────┬────────┬────────┐             │
│ ▸ Sparziele  │ │ Kateg. ▾│ Mai    │ Juni   │ Juli ▾ │ Δ Vm.  │ ← Drilldown-│
│ ▸ Investm.   │ ├─────────┼────────┼────────┼────────┼────────┤   Tabelle   │
│              │ │ Lebensm.│ 385 €  │ 380 €  │ 412 €  │ [+8 %] │             │
│              │ │ Wohnen  │ 1.034 €│ 1.034 €│ 1.034 €│ [±0 %] │             │
│              │ │ …       │        │        │        │        │             │
│              │ └─────────┴────────┴────────┴────────┴────────┘             │
│              │ Zeile klicken → gefilterte Transaktionsliste (S3)           │
└──────────────┴─────────────────────────────────────────────────────────────┘
```

**Hierarchie:** Jeder Bericht = Chart (Antwort auf einen Blick) **über** Tabelle (die Belege, sortierbar). Δ-Spalten als Badge mit Richtungspfeil und Vorzeichen. „Plan vs. Ist" als gruppierter Balkenchart mit Abweichungs-Tabelle; „Puffer" als Ziel/Ist-Bullet-Chart; „Sparziele" als Progress-Tabelle mit Prognose-Datum. **Interaktion:** Berichtswahl ist Sekundärnavigation innerhalb der Seite (Liste links, auf Mobil ein Select) — kein Sidebar-Eintrag pro Bericht. Jede Tabellenzeile drillt in die gefilterte Quellansicht (URL-Parameter), Charts sind hover-tooltipped (`tooltip`), Zeitraum + Vergleichsbasis sind seitenweite Filter in URL.

### 3.6 Weitere Screens (Kurzform)

- **S5 Sparen & Ziele:** Tabs Ziele/Investments/Wunschliste. Ziele = Tabelle (Ziel, Zieldatum bzw. Rate, ━━░ Fortschritt, Prognose „erreicht ~ Nov 26", ⋮: Beitrag/Kauf/Bearbeiten). Investments = Event-Tabelle (Datum, Typ-Badge Eröffnung/Beitrag/Bewertung/Entnahme, Betrag, Wertentwicklung-Sparkline pro Position). Wunschliste = Tabelle mit Preis, Priorität-Badge, ⋮ → „Zu Sparziel machen…"-Dialog (vorbefülltes Zielformular).
- **S7 Kategorien:** Tabelle (●Farbe, Icon, Name, [im Limit]/[außerhalb]-Badge, # Buchungen, Σ Periode). **Kein Speichern pro Tastendruck** (Problem 8): Zeile → Bearbeiten-Dialog mit explizitem Speichern; Inline nur Drag-Sortierung.
- **S8 Budget-Einstellungen:** Accordion-Sektionen (Periode & Limit, Übertrag, Standard-Puffer-Regeln, Erinnerungen), je Sektion eigener Speichern-Button mit Dirty-State-Indikator.

---

## 4. Visuelle Grammatik

### 4.1 Typografische Skala

| Rolle | Größe/Gewicht | Farbe | Verwendung |
|---|---|---|---|
| Hero-Zahl | 28 px / semibold / `tabular-nums` | Vordergrund | Max. 1 pro Screen („Verfügbar") |
| KPI-Zahl | 20 px / medium / `tabular-nums` | Vordergrund | KPI-Leiste, max. 3 nebeneinander |
| h1 Seitentitel | 20 px / semibold | Vordergrund | Seitenkopf |
| Tabellen-Zelle | 14 px / regular; Beträge `tabular-nums` rechtsbündig | Vordergrund | Standard-Datenebene |
| Sekundär/Meta | 12–13 px / regular | `muted-foreground` | Vergleichswerte, Zeitstempel, Zähler |
| Badge/Label | 11–12 px / medium, ggf. Kapitälchen | semantisch | Status, Delta |

Grundschrift bleibt die lesbare System-/Repo-Standardschrift (Repo-Regel), keine Verkleinerung unter 12 px. **Regel:** Pro visueller Region genau eine Primärzahl; Vergleichswert immer direkt daneben/darunter, eine Stufe kleiner, grau — nie zwei gleich große Zahlen nebeneinander mit unterschiedlicher Wichtigkeit.

### 4.2 Formwahl — wann was

| Form | Wann | Beispiele |
|---|---|---|
| **Tabelle** | ≥ 4 gleichartige Datensätze mit ≥ 3 Attributen; alles Sortier-/Filterbare | Ledger, Occurrences, Puffer, Kategorien, Berichte-Drilldown, Audit, Import-Vorschau |
| **KPI + Sparkline/Progress** | 1–3 Kennzahlen mit Trend oder Ziel; nie ohne Vergleich | Verfügbar, Limit-Auslastung, Puffer-Füllstand |
| **Chart (Recharts)** | Verlauf, Verteilung, Vergleich über Zeit | Timeline, Kategorien-Balken, Plan vs. Ist |
| **Badge** | Endlicher Zustand oder Delta | Status, Kadenz-Zusatz, [+8 %], [auto], 🔒 |
| **Key-Value-Block** (Label grau links, Wert rechts, ausgerichtet) | Detail-Ansichten in Dialog/Popover | Transaktions-Details, Plan-Version |
| **Karte** | Nur noch als Layout-Container für eine Region (Chart-Panel, Tabellen-Panel) — nie als Datensatz-Repräsentation | — |

**Verboten:** „·"-verkettete Meta-Strings (→ Spalten/Badges/Key-Value), rohe Enum-Werte (→ lokalisierte Badge-Labels via i18n-Map), `JSON.stringify` in der UI (→ Audit-Tabelle), Kachel-Wiederholung > 3 gleicher Kacheln (→ Tabelle).

### 4.3 Farbsystem (Semantik strikt getrennt von Dekor)

| Token | Bedeutung | Einsatz |
|---|---|---|
| `positive` (grün) | Einnahme, Ziel erreicht, unter Limit | Betrag +, Progress 100 %, [▼ −12 %] bei Ausgaben |
| `negative` (rot) | **nur Probleme**: Limit überschritten, Defizit, Fehlbetrag geschützter Puffer, gescheiterter Import | Alert, Badge, Limit-Balken > 100 % |
| `warning` (amber) | Annäherung: Limit ≥ 85 %, Occurrence überfällig, Puffer-Fehlbetrag | Badge, Progressbar-Segment |
| `muted` + kursiv + ┄ gestrichelt | **erwartet / geplant** (vs. gebucht = voll gesättigt, durchgezogen) | Timeline-Chart, [erwartet]-Zeilen, Prognose-Segmente |
| Kategorie-Farben | reine Identifikation, nie Bewertung | ●-Punkte, Chart-Serien |

Normale Ausgaben sind **nicht rot** — sonst ist die halbe Tabelle „alarmiert" und echte Probleme gehen unter. Delta-Farben sind kontextsensitiv: mehr Ausgaben = warning/negativ, mehr Einkommen/Sparen = positiv. Alle Semantikfarben zusätzlich durch Form kodiert (Pfeil, Strichelung, Icon) — nicht nur Farbe (Barrierefreiheit, Dark-Mode-Stabilität).

---

## 5. Interaktionsmuster (einheitlich, appweit)

### 5.1 Aktionen

- **Ort:** Immer am Auslöser. Zeilen: `⋮`-Dropdown. Seite: 1 Primär-Button + `…`-Menü im Kopf.
- **Ausführung:** Destruktiv/zustandsändernd (Stornieren, Stoppen, Periode schließen) → **Dialog** mit Konsequenz-Vorschau („Storniert Buchung, Verfügbar +54,20 €") und benanntem Bestätigungs-Button („Stornieren", nie „OK"). Erfassend/editierend mit > 4 Feldern → **Sheet** rechts. ≤ 4 Felder oder Kontextinfo → **Popover**. Mehrstufig (Plan anlegen, Import, Periode schließen mit Defizit-Deckung) → **Wizard-Dialog** mit Schrittanzeige.
- Kein geteiltes Inline-Formular am Panel-Ende mehr (Problem 4 vollständig behoben).

### 5.2 Filter & Sortierung (ein Modell überall — Problem 9)

- Filterleiste unter dem Seitenkopf: Suche (300 ms Debounce) + Select-Filter (sofort wirksam, kein Apply-Button) + aktive-Filter-Zähler mit „⨯ zurücksetzen".
- **Gesamter Filter-/Sortier-/Perioden-Zustand in der URL** → Links teilbar, Back-Button korrekt, kein Reload-Verlust bei Tab-Wechsel, Berichte-Drilldown = einfacher Link.
- Sortierung ausschließlich über Tabellen-Spaltenköpfe (Klick: asc → desc → aus, ▾-Indikator), Standard-Sortierung pro Tabelle dokumentiert (Ledger: Datum desc).

### 5.3 Feedback (Problem 10)

- **Toast (sonner), unten rechts:** Erfolg jeder Mutation, mit Kontext („Miete für August bestätigt") und wo möglich **Undo** (Stornieren, Löschen, Bestätigen — 8 s Fenster).
- **Inline-Fehler:** Feldvalidierung am Feld (Zod-Messages, lokalisiert), Submit-Fehler als Alert **im** Dialog/Sheet, nicht am Seitenanfang.
- **Seiten-Alert nur noch für Seitenzustand:** Periode geschlossen (Banner mit „Wieder öffnen"), Backend nicht erreichbar.
- Laden: Skeleton in Tabellenform (Zeilen-Skeletons), keine Spinner-Vollflächen; optimistische Updates bei Toggles (🔔).

### 5.4 Formulare (Problem 3 & 8)

- **Progressive Offenlegung:** Pflichtfelder sichtbar (max. 5), Optionales in Accordions („Splits", „Details"), Komplexes in Wizard-Schritten. Kein Formular zeigt > 6 Controls gleichzeitig.
- **Explizites Speichern** überall (Kategorien-Editor eingeschlossen); Dirty-State-Guard bei Navigation („Ungespeicherte Änderungen verwerfen?"-Dialog). Ausnahme: binäre Toggles (Switch) speichern sofort + Toast.
- Tastatur als First-Class: ⏎ speichert, Esc schließt (mit Dirty-Guard), `⌘K`-Command-Palette (Navigation + „Transaktion erfassen" + Periodensprung), `/` fokussiert Tabellen-Suche.

### 5.5 Responsive (Problem 11)

- Sidebar (shadcn `sidebar`): ≥ 1024 px voll; 768–1023 px auf Icon-Rail kollabiert (Tooltips); < 768 px als Sheet über Hamburger — Budget-Unterpunkte bleiben derselbe Baum, nie eine Pill-Reihe.
- Tabellen mobil: unwichtige Spalten fallen weg (Priorität pro Spalte definiert), Zeile → aufklappbare Key-Value-Details; Beträge und Status bleiben immer sichtbar. Sheets werden mobil zu Vollbild-Dialogen.

---

## 6. Trade-offs (ehrlich)

1. **Einstiegshürde steigt.** Tabellen mit `⋮`-Menüs, Wizard-Schritten und `⌘K` sind für Power-User nach einer Woche schneller, für Gelegenheitsnutzer (Partner*in, die nur „was darf ich noch ausgeben?" wissen will) am ersten Tag einschüchternder als große Kacheln. Milderung: Start-Screen hält genau eine Hero-Zahl und eine Aufgabenliste — die Casual-Frage ist ohne Tabellenkontakt beantwortet.
2. **Aktionen sind einen Klick weiter weg.** Was heute als 4 sichtbare Buttons auf der Plan-Karte liegt, steckt neu im `⋮`-Menü. Häufige Einzelaktionen (Occurrence bestätigen) kosten +1 Klick; dafür skaliert das Muster auf 12 Aktionen ohne Layoutkollaps. Milderung: die je häufigste Aktion zusätzlich als Inline-Button in der Statusspalte ([Bestätigen]).
3. **Mehr Implementierungsmasse.** 11 neue shadcn-Komponenten, URL-State-Management, responsive Spaltenprioritäten und der Formen-Katalog (Bullet-Chart, Flussleiste, Sparklines) sind deutlich mehr Arbeit als Kachel-Recycling — und Tabellen erzwingen saubere Datenverträge (Sortier-/Filterparameter serverseitig), was Backend-Anpassungen nach sich ziehen kann.
4. **Dichte kostet Luft.** Das Layout wirkt „ernster" und textlastiger; auf kleinen Screens bleibt trotz Spaltenprioritäten die Tabellen-UX zweitklassig gegenüber nativen Karten-Layouts. Wer die App primär am Handy nutzt, verliert gegenüber einem Mobile-First-Entwurf.
5. **Semantische Farbdisziplin nimmt Farbe weg.** Da Rot für Probleme reserviert ist, wirken normale Ausgabenlisten monochromer als gewohnt — der Gewinn (echte Alarme fallen auf) zeigt sich erst im Alltag, nicht im Screenshot.
