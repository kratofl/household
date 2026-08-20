# Entwurf 4 — „Banking-App": Paradigmen-Transfer aus Consumer-Banking/Budgeting

> Design-Dokument (kein Code). Ziel: Redesign der Web-UI (Next.js, shadcn/ui, Tailwind, Recharts, de/en) nach dem Vorbild moderner Banking-/Budget-Apps (N26, YNAB, Copilot Money, Ivy Wallet) — als Desktop-Web-App gedacht, mobile-first gebaut.

---

## 1. Leitidee

Die App verhält sich wie das persönliche Girokonto des Haushalts, nicht wie ein Verwaltungswerkzeug. Alles organisiert sich um **eine Zahl** — „Noch verfügbar" — und um die Frage, wie sich diese Zahl über den Monat hin entwickelt. Geld liegt nie abstrakt herum, sondern immer in einem **Topf** (Kategorie, Puffer, Sparziel, Investment, Ordinary), und jeder Topf zeigt seinen Füllstand wie ein Umschlag im Envelope-Budgeting. Was passiert und passieren wird, erzählt **eine einzige chronologische Timeline**, in der gebuchte und erwartete Bewegungen gemischt fließen — Erwartetes erscheint „geisterhaft". Ansichten sind zum **Lesen** da; jedes Erfassen, Bearbeiten und Bestätigen findet in Sheets und Dialogen **über** der Ansicht statt, nie inline. Layouts sind mobile-first einspaltig und falten auf Desktop zu maximal zwei Spalten auf.

---

## 2. Informationsarchitektur

### 2.1 Navigationsbaum (Sidebar, echte verschachtelte Navigation)

Neue shadcn-Komponente `sidebar` (einzuplanen). Budget-Unteransichten sind **verschachtelte Sidebar-Einträge**, keine Button-Reihen oder Content-Tabs. Die „Aktive Module"-Karte entfällt ersatzlos. Account-/Admin-Einstellungen existieren **nur** im Header (Avatar-Dropdown), nicht zusätzlich in der Sidebar.

```
┌─ Sidebar ────────────────────────────────┐
│ 🏠 Dashboard                             │   (App-weite Startseite; solange Budget
│                                          │    das einzige Modul ist: Redirect auf
│ 💶 Budget                                │    Budget → Start)
│    ├─ Start                              │   ← ehem. „Übersicht"
│    ├─ Aktivität                          │   ← ehem. „Transaktionen" (+ Timeline)
│    ├─ Töpfe                              │   ← ehem. „Kategorien", „Sparen &
│    │                                     │      Investieren", „Wunschliste"
│    ├─ Planung                            │
│    │   ├─ Daueraufträge & Abos           │
│    │   └─ Einkommen                      │
│    ├─ Berichte                           │
│    └─ Einstellungen                      │   (Periode, Limits, Regeln, CSV-Profile)
└──────────────────────────────────────────┘
Header (rechts): Perioden-Umschalter · Avatar-Dropdown (Account, Admin, Sprache, Logout)
```

**Responsive-Verhalten (behebt Problem 11):**
- `≥ lg` (1024px, nicht erst xl): Sidebar fest sichtbar, einklappbar auf Icon-Rail.
- `< lg`: Sidebar als Off-Canvas-Sheet (Hamburger im Header).
- `< md`: zusätzlich **Bottom-Tab-Bar** mit 5 Zielen: Start · Aktivität · ➕ (zentraler Erfassen-Button) · Töpfe · Mehr (öffnet Sheet mit Planung/Berichte/Einstellungen). Das ist der Banking-App-Kern auf Mobile.

### 2.2 Screen-Liste

| # | Screen | Zweck |
|---|--------|-------|
| S1 | **Start** | Konto-Header (Hero „Noch verfügbar" + Monatsfortschritt), Töpfe-Streifen, Timeline-Ausschnitt „Demnächst", Monatsverlaufs-Chart |
| S2 | **Aktivität** | Vollständige chronologische Timeline (Ist + erwartet), Filterleiste, Detail-Sheet je Eintrag, CSV-Import als Wizard |
| S3 | **Töpfe** | Alle Umschläge: Kategorien, Puffer, Ordinary, Sparziele (inkl. Wunschliste), Investments — je mit Füllstand |
| S4 | **Planung › Daueraufträge & Abos** | Serien-Tabelle + „Posteingang" anstehender Occurrences |
| S5 | **Planung › Einkommen** | Einkommenspläne + Varianzregeln, gleiche Muster wie S4 |
| S6 | **Berichte** | Berichts-Galerie → je Bericht: KPI-Zeile + Chart + sortierbare Tabelle mit Drilldown |
| S7 | **Einstellungen (Budget)** | Periode öffnen/schließen (inkl. Defizit-Deckung als Dialog-Flow), Ausgabenlimit, Puffer-Regeln, Erinnerungen, CSV-Mapping-Profile |

Jeder Screen rendert unter einem **eigenen Seitentitel** (h1 + Untertitel + kontextuelle Primäraktion rechts). Die generische „Vorschau"-Card entfällt (behebt Problem 1); der Dokumenttitel (`<title>`) folgt der Ansicht.

### 2.3 Mapping: alte Ansicht → neuer Ort

| Alt (8 Unteransichten) | Neu |
|---|---|
| Übersicht | **S1 Start** (11 Kacheln → Hero + 3 Sekundärwerte + Töpfe-Streifen, s. §3.1) |
| Transaktionen | **S2 Aktivität** (Erfassen/Aktionen via Sheet/Dialog) |
| Planung | **S4/S5 Planung** (zwei Sidebar-Kinder statt einer Karten-Halde) |
| Sparen & Investieren | **S3 Töpfe**, Sektionen „Sparziele" und „Investments" |
| Wunschliste | **S3 Töpfe**, Untersektion in „Sparziele" (Items dort zu Zielen promoten) |
| Kategorien | **S3 Töpfe**, Sektion „Kategorien"; Pflege via Sheet, Massenpflege via Tabelle (s. §3.2) |
| Berichte | **S6 Berichte** |
| Einstellungen | **S7 Einstellungen**; Puffer-Detail-Kacheln der alten Übersicht → Puffer-Topf-Detail-Sheet in S3 |
| CSV-Import (Teil v. Transaktionen) | **S2 Aktivität** → Aktion „Importieren" (Wizard-Dialog, s. §5.3) |

**Entfernt:** „Vorschau"-Card, „Aktive Module"-Karte, doppelte Settings-Einstiege, Debug-JSON (Audit-History wird formatierte Versions-Timeline im Detail-Sheet, behebt Problem 7), „·"-verkettete Meta-Strings (→ Badges + Sekundärzeile, behebt Problem 6).

---

## 3. Screen-Entwürfe

Legende Wireframes: `▓` = gefüllter Fortschritt, `░` = leer, `◌` = „Ghost"/erwartet, `●` = Farb-/Icon-Punkt der Kategorie, `[ ]` = Button, `⋮` = Zeilenmenü.

### 3.1 S1 — Start (Konto-Header + Timeline)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Start                                    ‹ Februar 2026 ›  [＋ Neu ▾]│
├──────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │  NOCH VERFÜGBAR                                                  │ │
│ │  1.284,50 €                                   von 2.100,00 € Limit│ │
│ │  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░  39 % verbraucht                   │ │
│ │  ────────────────▲───────────                                    │ │
│ │            Heute (Tag 18/28 · 64 %) — du liegst unter Plan ✓     │ │
│ │                                                                  │ │
│ │  Einkommen 3.450 €   ·   Reserviert 980 €   ·   Puffer 370/500 € │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ Deine Töpfe                                            [Alle ansehen]│
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  →      │
│ │● Lebens-│ │● Mobili-│ │🛡 Puffer│ │◎ Urlaub │ │📈 ETF   │         │
│ │  mittel │ │  tät    │ │ 370/500 │ │ 1.2k/3k │ │ 12.4k € │         │
│ │ ▓▓▓▓░ 82%│ │ ▓▓░░░ 41%│ │ ▓▓▓▓░   │ │ ▓▓░░░   │ │ ▲ +3,1 %│        │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘         │
│                                                                      │
│ ┌ Demnächst ─────────────────────────┐ ┌ Monatsverlauf ────────────┐ │
│ │ MORGEN                             │ │   €                       │ │
│ │ ◌ Miete            −950,00 €  [✓] │ │ 2100┤▔▔▔▔▔▔ Limit         │ │
│ │ ◌ Gehalt Luca    +3.450,00 €  [✓] │ │     │      ╭─── Ist       │ │
│ │ FR 20.02.                          │ │     │   ╭──╯ ┈┈┈ Prognose │ │
│ │ ◌ Netflix           −12,99 €  [✓] │ │    0└──┬──┬──┬──┬──       │ │
│ │            [Ganze Timeline öffnen] │ │      1  7  14 21 28       │ │
│ └────────────────────────────────────┘ └───────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

**Erklärung.** Der Konto-Header ersetzt die 11 identischen Währungs-Kacheln (behebt Problem 2): eine Hero-Zahl in Display-Größe (`text-5xl`, Tabular-Ziffern), darunter der Monats-Fortschrittsbalken mit **Heute-Marker** — der Vergleich „Budget-Verbrauch vs. Monatsfortschritt" ist die zentrale Zielrahmung („du liegst unter Plan"). Einkommen/Reserviert/Puffer werden zu drei kompakten Sekundärwerten in einer Zeile; die 6 Puffer-Detail-Kacheln wandern ins Puffer-Detail-Sheet (Klick auf den Puffer-Wert oder den Puffer-Topf). Der Töpfe-Streifen ist horizontal scrollbar (mobile) bzw. zeigt 5–6 Karten (Desktop). „Demnächst" ist ein 7-Tage-Ausschnitt der Timeline mit Ghost-Einträgen und Inline-Bestätigen-Kurzaktion `[✓]` (öffnet den Bestätigen-Dialog). Das Chart (Recharts, Area) zeigt kumulierte Ist-Ausgaben, gestrichelte Prognose aus erwarteten Occurrences und die Limit-Linie. Desktop: 2 Spalten unten; Mobile: alles einspaltig gestapelt, Chart zuletzt.

### 3.2 S3 — Töpfe (Kategorien + Puffer + Sparziele + Investments)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Töpfe                     [Suchen…]  [＋ Topf anlegen ▾]  [⊞ Tabelle] │
├──────────────────────────────────────────────────────────────────────┤
│ AUSGABEN-KATEGORIEN (im Limit)                     980 € reserviert  │
│ ┌───────────────────────────────┐ ┌───────────────────────────────┐  │
│ │ ● Lebensmittel            ⋮  │ │ ● Mobilität                ⋮  │  │
│ │ 328 € von 400 €               │ │ 82 € von 200 €                │  │
│ │ ▓▓▓▓▓▓▓▓░░ 82 %  ⚠ knapp     │ │ ▓▓▓▓░░░░░░ 41 %               │  │
│ └───────────────────────────────┘ └───────────────────────────────┘  │
│ ┌───────────────────────────────┐ ┌───────────────────────────────┐  │
│ │ ● Freizeit                ⋮  │ │ ● Restaurants              ⋮  │  │
│ │ 245 € von 220 €               │ │ 96 € von 150 €                │  │
│ │ ▓▓▓▓▓▓▓▓▓▓ +25 € über Limit ✖│ │ ▓▓▓▓▓▓░░░░ 64 %               │  │
│ └───────────────────────────────┘ └───────────────────────────────┘  │
│ AUSSERHALB DES LIMITS ────────────────────────────────── (Accordion) │
│                                                                      │
│ PUFFER & FREIER TOPF                                                 │
│ ┌───────────────────────────────┐ ┌───────────────────────────────┐  │
│ │ 🛡 Puffer  (geschützt)     ⋮  │ │ ◇ Ordinary (frei)          ⋮  │  │
│ │ 370 € von 500 € Ziel          │ │ 214,50 €                      │  │
│ │ ▓▓▓▓▓▓▓░░░  Fehlbetrag 130 € │ │ frei verfügbar                │  │
│ └───────────────────────────────┘ └───────────────────────────────┘  │
│                                                                      │
│ SPARZIELE                                    [＋ Ziel] [♡ Wunschliste]│
│ ┌───────────────────────────────┐ ┌───────────────────────────────┐  │
│ │ ◎ Urlaub Japan             ⋮  │ │ ◎ Notgroschen  ✔ ERREICHT  ⋮  │  │
│ │ 1.200 € von 3.000 €           │ │ 5.000 € von 5.000 €           │  │
│ │ ▓▓▓▓░░░░░░ 40 % · bis Aug 26 │ │ ▓▓▓▓▓▓▓▓▓▓ 100 %  🎉          │  │
│ │ Rate nötig: 300 €/Monat ✓     │ │ [Kauf abschließen]            │  │
│ └───────────────────────────────┘ └───────────────────────────────┘  │
│ ♡ Wunschliste (3) — „Kamera 890 €" [Zu Sparziel machen] … (Accordion)│
│                                                                      │
│ INVESTMENTS                                        [＋ Event erfassen]│
│ ┌───────────────────────────────┐ ┌───────────────────────────────┐  │
│ │ 📈 ETF-Depot               ⋮  │ │ 📈 Krypto                  ⋮  │  │
│ │ 12.400 €  ▲ +3,1 % seit Jan   │ │ 830 €  ▼ −6,2 % seit Jan      │  │
│ │ eingezahlt 11.200 € ▁▂▃▅▆     │ │ eingezahlt 900 €  ▆▅▃▂▃       │  │
│ └───────────────────────────────┘ └───────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

**Erklärung.** Vier Topf-Familien, visuell unterscheidbar: **Kategorien** tragen ihren Farbpunkt + Icon und einen Verbrauchs-Balken (füllt sich = Geld ausgegeben); **Puffer/Ordinary** haben neutrale Schutz-Optik (Schild, gedeckte Fläche), Balken füllt sich = Geld angespart (umgekehrte Semantik, farblich klar getrennt, s. §4); **Sparziele** sind Ring-/Balkenfortschritt Richtung Zielbetrag mit Zieldatum bzw. Rate-Check; **Investments** zeigen Wert, Performance-Delta und Mini-Sparkline statt Füllstand. Klick auf einen Topf → **Detail-Sheet**: Verlauf (Mini-Chart), letzte Bewegungen (gefilterte Timeline), Aktionen (Kategorie bearbeiten, Beitrag erfassen, Ziel anpassen, Wunschlisten-Item promoten, Investment-Event). Der Umschalter `[⊞ Tabelle]` rendert Kategorien als **echte Tabelle** (Name, Farbe, Icon, Limit, im/außer Limit, Verbrauch) für Massenpflege — mit **explizitem Speichern pro Zeile bzw. „Änderungen speichern"-Leiste**, kein Speichern bei Tastendruck mehr (behebt Problem 8). Desktop max. 2 Karten-Spalten, Mobile 1.

### 3.3 S2 — Aktivität (Timeline mit Detail-Sheet)

```
┌──────────────────────────────────────────────────────────────────┬───────────────────┐
│ Aktivität                    [＋ Erfassen] [⤓ Importieren]        │ ◀ DETAIL-SHEET    │
├──────────────────────────────────────────────────────────────────┤                   │
│ [Zeitraum: Feb 26 ▾] [Topf ▾] [Typ ▾] [Nur erwartet ○] [Suche…] │ REWE Markt        │
├──────────────────────────────────────────────────────────────────┤ −42,17 €          │
│ FR 20.02. — ERWARTET                                             │ ● Lebensmittel    │
│ ◌ Netflix · Abo              ● Freizeit          −12,99 €   [✓] │ Mi 18.02. · 14:32 │
│ ◌ Rundfunkbeitrag · Auto-Post ● Wohnen           −18,36 €       │ ✔ Gebucht         │
│ MORGEN, DO 19.02. — ERWARTET                                     │ ─────────────     │
│ ◌ Gehalt Luca · Einkommensplan  ↑ Einkommen   +3.450,00 €   [✓] │ Splits            │
│ ◌ Miete · Dauerauftrag       ● Wohnen           −950,00 €   [✓] │ ● Lebensm. 36,17 €│
│ ── HEUTE ──────────────────────────────────────────────────────  │ ● Drogerie  6,00 €│
│ HEUTE, MI 18.02.                                                 │ ─────────────     │
│ ● REWE Markt  (2 Splits)     ● Lebensmittel      −42,17 €    ⋮  │ [✎ Korrigieren]   │
│ ● Tankstelle Aral            ● Mobilität         −58,40 €    ⋮  │ [↩ Erstatten]     │
│ DI 17.02.                                                        │ [✖ Stornieren]    │
│ ● DB Ticket ⟲ erstattet      ● Mobilität         +23,90 €    ⋮  │ ─────────────     │
│ ● Apotheke                   ● Gesundheit         −9,95 €    ⋮  │ Verlauf           │
│                    [Frühere laden]                               │ • erfasst 18.02.  │
│                                                                  │ • Split geänd. …  │
└──────────────────────────────────────────────────────────────────┴───────────────────┘
```

**Erklärung.** **Eine** Timeline für Ist + erwartet: Erwartete Einträge stehen chronologisch **oberhalb** der Heute-Linie (Zukunft oben, Vergangenheit unten — wie Banking-Apps mit „anstehende Buchungen"), gerendert als Ghost (gestrichelte Kontur, 60 % Opazität, kursiver Betrag, `◌`-Marker). Jeder Ghost trägt die Kurzaktion `[✓ Bestätigen]`; weitere Occurrence-Aktionen (Zuordnen, Überspringen, Bearbeiten) im `⋮`-Menü — jede öffnet einen **Dialog am Auslöser**, nie ein Formular am Panel-Ende (behebt Problem 4). Gebuchte Zeile → **Detail-Sheet** rechts (Desktop) / von unten (Mobile) mit Splits, formatierter Versions-/Audit-Timeline (statt JSON, Problem 7) und den Aktionen Korrigieren (Sheet mit vorausgefülltem Formular, erzeugt neue Version), Erstatten (Dialog: Betrag voll/teilweise), Stornieren (Bestätigungs-Dialog, destruktiv-rot). Filterleiste folgt **einem** Modell (§5.4). Tages-Gruppierung mit Sticky-Headern; Beträge rechtsbündig tabular; Einnahmen grün mit `+`.

### 3.4 S4 — Planung › Daueraufträge & Abos

```
┌──────────────────────────────────────────────────────────────────────┐
│ Daueraufträge & Abos                          [＋ Dauerauftrag]       │
├──────────────────────────────────────────────────────────────────────┤
│ ┌ Posteingang: 3 zu bestätigen ─────────────────────────────────────┐│
│ │ ◌ Miete       −950,00 €   fällig morgen     [✓ Bestätigen] [⋮]    ││
│ │ ◌ Strom       −86,00 €    fällig 21.02.     [✓ Bestätigen] [⋮]    ││
│ │ ◌ Spotify     −10,99 €    überfällig 2 Tg ⚠ [✓ Bestätigen] [⋮]    ││
│ └───────────────────────────────────────────────────────────────────┘│
│                                                                      │
│ [Aktiv 12] [Pausiert 2] [Gestoppt 3]                    [Suche…]     │
│ ┌────────────────────────────────────────────────────────────────┐   │
│ │ Name          Topf           Betrag    Kadenz     Nächste   ⚙ │   │
│ ├────────────────────────────────────────────────────────────────┤   │
│ │ Miete         ● Wohnen      −950,00 €  monatlich  19.02.    ⋮ │   │
│ │ Netflix 🔔    ● Freizeit     −12,99 €  monatlich  20.02.    ⋮ │   │
│ │ Strom ~       ● Wohnen      ~−86,00 €  monatlich  21.02.    ⋮ │   │
│ │ KFZ-Vers.     ● Mobilität  −312,00 €   jährlich   01.07.    ⋮ │   │
│ └────────────────────────────────────────────────────────────────┘   │
│   ⋮ = Bearbeiten · Pausieren · Stoppen · Versionen ansehen ·         │
│       Erinnerung an/aus · Occurrences anzeigen                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Erklärung.** Die 2-spaltige Karten-Halde (4 Buttons + 2 Switches + Meta-String je Karte, darunter 18 Occurrence-Kacheln) wird ersetzt (behebt Problem 5): oben ein **Posteingang** nur mit dem, was Aufmerksamkeit braucht (fällige/überfällige Occurrences, Inbox-Zero-Gefühl: leer = „Alles erledigt ✓" mit Häkchen-Illustration). Darunter eine **Tabelle** der Serien; Status als Filter-Pills, nicht als Karten-Sektionen. Meta-Informationen werden Spalten und Badges: `~` = Varianzregel aktiv (Tooltip: „Abweichung → Puffer"), `🔔` = Erinnerung aktiv, Versionen zählt das Detail-Sheet, nicht die Zeile (behebt Problem 6). Zeilenklick → **Serien-Detail-Sheet**: Stammdaten, Versions-Timeline, kommende Occurrences, Aktionen. Alle Aktionen als Dialog (Pausieren/Stoppen mit Datumswahl + Konsequenz-Text) oder Sheet (Bearbeiten = neue Version, Diff-Hinweis). **Anlage als 3-Schritt-Sheet** statt 12 Controls flach (§5.3). S5 (Einkommen) folgt exakt demselben Muster; die Varianzregel ist dort Schritt 3 des Anlage-Flows statt eines 5-Control-Streifens.

### 3.5 S6 — Berichte

```
┌──────────────────────────────────────────────────────────────────────┐
│ Berichte                                    [Zeitraum: Jan–Jun 26 ▾] │
├──────────────────────────────────────────────────────────────────────┤
│ [Ausgaben] [Perioden] [Plan vs. Ist] [Einkommen] [Puffer] [Sparen]   │
│ [Investments] [Händler]                                              │
├──────────────────────────────────────────────────────────────────────┤
│ AUSGABEN NACH KATEGORIE                                              │
│ ┌ Gesamt 2.412 € ┐┌ Ø/Monat 402 € ┐┌ Top: Lebensmittel ┐┌ ▲ +4 % ┐   │
│ ├──────────────────────────────────────────────────────────────────┤ │
│ │  Lebensmittel ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 812 €                               │ │
│ │  Wohnen       ▓▓▓▓▓▓▓▓▓ 590 €          (horizontale Balken,      │ │
│ │  Mobilität    ▓▓▓▓▓▓ 412 €              Kategoriefarben,          │ │
│ │  Freizeit     ▓▓▓▓ 305 €                Klick = Drilldown)        │ │
│ ├──────────────────────────────────────────────────────────────────┤ │
│ │ Kategorie ↕      Jan      Feb      Trend        Anteil            │ │
│ │ ● Lebensmittel   395 €    417 €    ▁▃▂▅▆        34 %              │ │
│ │ ● Wohnen         295 €    295 €    ▅▅▅▅▅        24 %              │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│ Drilldown: Klick auf Balken/Zeile → Sheet mit gefilterter Timeline   │
└──────────────────────────────────────────────────────────────────────┘
```

**Erklärung.** Die 8 fast identischen Listen-Cards werden **ein** Berichts-Screen mit Berichtswahl (Pills = Inhalts-Umschalter innerhalb des Screens, keine Navigation) und pro Bericht demselben Aufbau: KPI-Zeile (max. 4 Kacheln mit Delta-Badges) → **Chart zuerst** (Recharts: horizontale Balken für Kategorien/Händler, Linien für Periodenvergleich/Einkommen, gruppierte Balken für Plan vs. Ist, Fortschritts-Balken für Puffer/Sparziele, Area für Investments) → **sortierbare Tabelle** (behebt Problem 8) → **Drilldown** per Klick in ein Sheet mit der passend vorgefilterten Timeline (behebt „kein Drilldown", Problem 5b).

---

## 4. Emotionales Design

### 4.1 Farbsemantik

| Bedeutung | Verwendung | Ton (Tailwind-Anker) |
|---|---|---|
| **Verfügbar / im Plan / Einnahme** | Hero-Zahl im grünen Bereich, `+`-Beträge, „unter Plan ✓" | `emerald-600` (Light) / `emerald-400` (Dark) |
| **Achtung / knapp (≥ 80 % Limit)** | Kategorie-Balken, Chips, überfällige Occurrences | `amber-600/500` |
| **Über Limit / Defizit / destruktiv** | Balken-Überlauf, Stornieren, Perioden-Defizit | `red-600/500` |
| **Erwartet / Ghost** | Timeline-Ghosts, Prognose-Linie | `muted-foreground` bei 60 % Opazität, gestrichelt |
| **Geschützt (Puffer)** | Schild-Icon, dezenter Blauton, nie rot | `sky-600` |
| **Sparziele** | Fortschritt Richtung Ziel | `violet-600` (bewusst getrennt von Ausgaben-Grün) |
| **Investments** | Performance ▲/▼ | Delta grün/rot, Fläche neutral `slate` |
| **Kategoriefarben** | Nutzergewählt, ausschließlich als Punkt/Balken-Akzent | aus fester, kontrastgeprüfter Palette |

Regel: **Statusfarbe schlägt Kategoriefarbe** auf Balken (eine Kategorie über Limit wird rot, egal welche Eigenfarbe sie hat); Kategoriefarbe bleibt am `●`-Punkt erhalten. Semantik funktioniert nie über Farbe allein — immer Farbe + Icon/Text (✓ ⚠ ✖ 🛡 ◌) für Farbfehlsicht.

### 4.2 Fortschritt & Zielerreichung

- **Monatsbalken (Hero):** Doppel-Kodierung — Füllung = verbrauchtes Budget, Marker = heutiger Tag. Ist Füllung < Marker: grüner Balken + „du liegst unter Plan ✓". Füllung > Marker: Amber + „schneller als der Monat". Über 100 %: roter Überlauf-Abschnitt rechts vom Balkenende.
- **Kategorien:** Balken in Kategoriefarbe bis 79 %, Amber ab 80 %, Rot + Überlauf-Segment über Limit; Label wechselt von „82 %" zu „+25 € über Limit".
- **Sparziele:** Fortschrittsbalken + Restbetrag + Restzeit; die App rechnet die nötige Monatsrate vor („Rate nötig: 300 €/Monat ✓" grün, wenn geplante Beiträge reichen, sonst Amber mit Vorschlag).
- **Zielerreichung feiern — seriös:** Beim Erreichen (Sparziel 100 %, Puffer voll, Periode ohne Defizit geschlossen) einmalig: Balken animiert die letzten Prozent zu Voll-Grün/Violett, Badge „✔ Erreicht" mit sanfter Scale-Animation, Toast „Ziel ‚Notgroschen' erreicht — 5.000 € gespart." Kein Konfetti-Dauerfeuer, keine Emoji-Flut; ein einzelnes 🎉 im Toast ist das Maximum. Erreichte Ziele bleiben als „Erfolge" mit Datum im Sparziel-Bereich sichtbar (Rückblick statt Kitsch).
- **Perioden-Abschluss:** eigener geführter Dialog-Flow (§5.2) endet mit einer ruhigen Zusammenfassungs-Card „Februar geschlossen · Übertrag +214,50 € →" in Grün, bzw. Defizit-Deckung in klaren Schritten ohne Alarm-Rot auf der ganzen Seite.

### 4.3 Zustände: erwartet vs. gebucht (und weitere)

| Zustand | Visuelle Sprache |
|---|---|
| Erwartet (`◌`) | gestrichelte Kontur, 60 % Opazität, kursiver Betrag, Badge „erwartet", Kurzaktion ✓ |
| Gebucht (`●`) | volle Deckkraft, fester Kategoriepunkt |
| Auto-Posting | Ghost mit Badge „bucht automatisch" + Blitz-Icon; nach Buchung normaler Eintrag mit Auto-Badge |
| Storniert | durchgestrichener Betrag, gedimmt, Badge „storniert" |
| Erstattet | Original behält Badge „erstattet ⟲", Erstattung als eigener grüner Eintrag, verlinkt |
| Korrigiert | aktueller Stand normal; Versions-Historie im Sheet („3 Versionen" als Badge → Timeline) |
| Überfällig | Amber-Punkt + „überfällig n Tage" statt roher Datums-Enum |
| Pausiert/Gestoppt | Badge `⏸ pausiert` / `■ gestoppt seit 01.01.26` — nie als „·"-String |

---

## 5. Interaktionsmuster

### 5.1 Grundregel: Lesen in der Ansicht, Handeln darüber

- **Sheet** (rechts auf Desktop, von unten auf Mobile): alles mit Formular oder viel Inhalt — Erfassen, Bearbeiten/Korrigieren, Topf-Details, Serien-Details, Drilldowns.
- **Dialog** (zentriert, klein): Entscheidungen und Bestätigungen — Stornieren, Stoppen, Pausieren, Occurrence bestätigen/zuordnen, Periode schließen, Import-Abschluss. Destruktive Dialoge benennen die Konsequenz im Klartext und haben rote Primäraktion.
- **Kurzaktionen** (`[✓]`, `⋮`-Menü) sitzen **am Element**, das sie betreffen; das `⋮`-Dropdown ersetzt Button-Batterien auf Karten.
- Sheets schließen mit unbestätigten Änderungen erst nach Rückfrage („Änderungen verwerfen?").

### 5.2 Feedback

- **Toasts (sonner, neu einzuplanen)** für jedes Aktions-Ergebnis: kurz, konkret, mit Betrag/Name („Miete bestätigt · −950,00 € gebucht"), wo möglich mit **Rückgängig**-Aktion (7 s). Behebt Problem 10.
- **Seiten-Alerts nur noch** für persistente Systemzustände (Backend nicht erreichbar, Periode ungeschlossen überfällig), nie für Aktions-Feedback.
- **Optimistic UI** bei Bestätigen/Zuordnen (Ghost wird sofort fest, rollt bei Fehler mit Fehler-Toast zurück); Skeletons beim Erstladen, niemals Layout-Sprünge.
- Fehler-Toasts nennen die Ursache und bieten „Erneut versuchen".

### 5.3 Formulare: mehrstufige kompakte Flows (behebt Problem 3)

Regel: **max. 5–6 Controls sichtbar pro Schritt**; Optionales hinter Accordion „Mehr Optionen"; smarte Defaults; Zusammenfassung vor dem Speichern bei ≥ 3 Schritten. Alle Flows in Sheets mit Schritt-Indikator (`● ● ○`).

- **Transaktion erfassen (1 Schritt + Optionen):** Betrag (groß, Ziffernblock-artig fokussiert) → Typ-Toggle Ausgabe/Einnahme → Topf (Command-Palette-Select mit Suche und Farb-Punkten) → Datum (Default heute) → Beschreibung. Accordion: Splits (Zeilen dynamisch hinzufügen), Händler, außer Limit.
- **Dauerauftrag (3 Schritte statt 12 flach):** ① Grundlagen (Name, Betrag, Topf, Richtung) → ② Zeitplan (Kadenz, Start, Ende optional, Auto-Posting an/aus, Erinnerung) → ③ Varianzregel (nur wenn „Betrag schwankt" aktiviert: Abweichung → Puffer oder Ordinary) → Zusammenfassung.
- **Einkommensplan (3 Schritte):** ① Quelle & Betrag → ② Rhythmus & Zeitraum → ③ Varianzregel; identisches Muster wie Daueraufträge — ein gelerntes Modell für beides.
- **CSV-Import (Wizard-Dialog, 4 Schritte statt 9 Selects auf einmal):** ① Datei + Profil wählen (gespeicherte Mappings) → ② Mapping: Vorschau-**Tabelle** der ersten 5 Zeilen, darüber pro Zielfeld ein Select — nur Pflichtfelder (Datum, Betrag, Beschreibung) zuerst, weitere zuschaltbar; erkannte Spalten vorbelegt → ③ Prüfen: vollständige Vorschau-Tabelle mit Fehler-/Duplikat-Markierung, Zeilen abwählbar → ④ Ergebnis-Toast + Sprung in die Aktivität, importierte Einträge kurz hervorgehoben. Mapping als Profil speicherbar.
- **Periode schließen (geführter Dialog):** ① Zusammenfassung (Rest je Topf) → ② unbestätigte Occurrences klären (Liste mit Kurzaktionen) → ③ Übertrag bzw. Defizit-Deckung (Quelle wählen: Puffer/Ordinary, mit Live-Vorschau der Folgen) → ④ Abschluss-Card.

### 5.4 Ein Filter-Modell für alles (behebt Problem 9)

Überall identisch: Filter-Controls (Selects/Pills/Datum) wirken **sofort** beim Ändern; Freitext-Suche debounced 300 ms; **kein Apply-Button, kein Reload bei Tab-Wechsel**. Aktive Filter erscheinen als entfernbare Chips unter der Leiste; „Zurücksetzen" ganz rechts. Filterzustand liegt in der URL (teil- und zurück-navigierbar). Der Perioden-/Zeitraum-Kontext sitzt global im Header und gilt für Start, Töpfe und Aktivität gemeinsam.

### 5.5 Neue shadcn-Komponenten (einzuplanen)

`sidebar`, `dialog`, `sheet` (vorhanden), `table`, `select`, `command` (Topf-Auswahl, globale ⌘K-Suche), `popover` + `date-picker`, `progress`, `tooltip`, `accordion`, `sonner` (Toasts). Typografie: lesbare Standard-Schrift (z. B. Inter/Geist, 16 px Basis), Beträge in `tabular-nums`; deutsche Texte mit echten Umlauten/ß („Töpfe", „Daueraufträge", „ß" in „regelmäßig").

---

## 6. Trade-offs (ehrlich)

1. **Mehr Klicks für Power-User.** Sheet/Dialog-Zwang statt Inline-Editing macht Massenpflege langsamer: 15 Kategorien nacheinander anpassen heißt 15× Sheet öffnen — dafür gibt es den Tabellen-Modus in Töpfen als Ventil, aber z. B. Serien-Massenänderungen bleiben Einzelaktionen. Das ist der Preis für Fokus und Fehlersicherheit.
2. **Verdichtung versteckt Detailtiefe.** Die Hero-Zahl und der Töpfe-Streifen sind eine Interpretation der Domäne; wer die alten 11 Kacheln als „alles auf einen Blick" schätzte, muss jetzt für Puffer-Details ein Sheet öffnen. Falsches Vertrauen in eine falsch berechnete Hero-Zahl wäre teurer als früher — die Zahl braucht ein Tooltip mit Rechenweg („Einkommen − Reserviert − Ausgaben = …").
3. **Eine Timeline für Ist + erwartet** ist konzeptionell stark, aber beim Abgleich mit Kontoauszügen unschärfer als eine reine Buchungsliste; der Filter „Nur gebucht" muss prominent bleiben. Zukunft-oben-Sortierung ist ungewohnt und braucht die deutliche Heute-Linie.
4. **Mehrstufige Formulare** verlangsamen Routinier:innen, die alle 12 Felder blind ausfüllen konnten; Schritt-Navigation muss per Tastatur (Enter = weiter) flüssig sein, sonst frustriert sie.
5. **Töpfe-Screen wird lang** (4 Familien auf einer Seite). Auf Mobile viel Scroll; Anker-Navigation/Sektions-Sprungleiste ist Pflicht, sonst wäre eine Aufspaltung doch wieder nötig.
6. **Mehr Komponenten, mehr Pflege.** 10+ neue shadcn-Komponenten, Toast-System, Command-Palette und ein konsistentes Filter-URL-Schema erhöhen Implementierungs- und Wartungsaufwand deutlich gegenüber dem Status quo — bewusste Investition in ein tragfähiges Muster-Set statt weiterer Ad-hoc-Cards.
7. **Emotionales Design altert.** Zielerreichungs-Momente wirken beim 30. Mal weniger; Animationen respektieren `prefers-reduced-motion` und feiern nur echte Meilensteine (Ziel erreicht, Periode geschlossen), nicht jede Buchung.
