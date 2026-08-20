# UI-Redesign Entwurf 1: Radikale Reduktion

Status: Entwurf (Design-Dokument, keine Implementierung)
Geltungsbereich: Web-UI (Next.js, shadcn/ui, Tailwind, Recharts, de/en i18n)
Datum: 2026-08-06

---

## 1. Leitidee

**Jeder Screen beantwortet genau eine Frage, mit genau einer dominanten Information.** Die App organisiert sich nicht mehr um Datenobjekte („hier sind alle Puffer-Kacheln"), sondern um die Entscheidung, die eine Person in diesem Moment treffen will („Darf ich das noch ausgeben?"). Alles, was diese eine Frage nicht beantwortet, ist erreichbar, aber unsichtbar: hinter Akkordeons, Drilldowns, Sheets und Dialogen. Kennzahlen sind auf maximal drei pro Screen begrenzt, Formulare starten mit maximal drei Feldern, und jede Aktion passiert dort, wo sie ausgelöst wird — nie am anderen Ende der Seite. Wer mehr wissen will, klickt einmal; wer nichts wissen will, sieht fast nichts.

**Begriffskonvention für dieses Dokument:** „Sichtbare Zahl" meint eine Kennzahl (KPI). Beträge in Listen-/Tabellenzeilen sind Daten, keine Kennzahlen — sie zählen nicht gegen das 3-Zahlen-Budget, wohl aber jede Summe, jeder Saldo, jedes Ziel im Kopf- oder Kachelbereich.

---

## 2. Informationsarchitektur

### 2.1 Navigationsbaum (Sidebar, shadcn `sidebar` — neu hinzuzufügen)

```
┌──────────────────────────────┐
│  ⌂ Start                     │   ← ehemals „Dashboard"
│                              │
│  BUDGET                      │   ← echte verschachtelte Sektion in der Sidebar
│  ├─ Übersicht                │
│  ├─ Transaktionen            │   ← enthält Timeline + Erfassen + CSV-Import (Aktion)
│  ├─ Planung                  │   ← Einkommenspläne + Daueraufträge/Abos + Occurrences
│  ├─ Sparen                   │   ← fusioniert: Sparen & Investieren + Wunschliste
│  ├─ Berichte                 │   ← 1 Screen, 7 Berichte per Umschalter (statt 8 Cards)
│  └─ Einstellungen            │   ← fusioniert: Budget-Einstellungen + Kategorien
│                              │
│  ──────────────────────────  │
│  (Avatar) Luca            ▾  │   ← Sidebar-Footer: Account/Admin NUR hier
└──────────────────────────────┘       (Dropdown: Konto, Admin, Sprache, Abmelden)
```

**Zusammengelegt / entfernt / umbenannt:**

| Vorher (8 Budget-Unteransichten) | Nachher (6 Einträge) | Begründung |
|---|---|---|
| Übersicht | Übersicht | bleibt, wird radikal entkernt (11 Kacheln → 1 Zahl + 1 Chart) |
| Transaktionen | Transaktionen | bleibt; CSV-Import wird Aktion („Importieren…") statt eigener Ansicht |
| Planung | Planung | bleibt; Occurrences werden zum „Posteingang" im selben Screen |
| Sparen & Investieren | **Sparen** | umbenannt; Investments als zweiter Tab im Screen |
| Wunschliste | → in **Sparen** | Wunschliste ist Vorstufe von Sparzielen (ADR 0010) — gehört inhaltlich dazu |
| Kategorien | → in **Einstellungen** | Kategorien sind Konfiguration, keine tägliche Ansicht |
| Berichte | Berichte | bleibt; 8 Listen-Cards → 1 Bericht-Umschalter mit Chart + Drilldown |
| Einstellungen | Einstellungen | bleibt; nimmt Kategorien als Abschnitt auf |

**Weitere IA-Regeln (Repo-Regeln umgesetzt):**
- Budget-Subnavigation liegt als eingerückte, verschachtelte Gruppe in der Sidebar. Keine Button-Reihen, keine Content-Tabs als Ersatznavigation.
- Keine „Aktive Module"-Karte im Haupt-UI. Solange nur Budget aktiv ist, ist die Budget-Sektion einfach da; weitere Module erscheinen als weitere Sidebar-Sektionen.
- Account/Admin ausschließlich im Sidebar-Footer (Avatar-Dropdown). Der Header enthält: Seitentitel (dynamisch, Problem 1 behoben), Perioden-Umschalter, sonst nichts.
- Jede Route rendert ihren eigenen Seitenkopf (`<h1>` = Ansichtsname + Kontext, z. B. „Transaktionen · August 2026"). Die generische „Vorschau"-Card entfällt ersatzlos.

**Responsive (Problem 11):**
- ≥ `lg` (1024px): Sidebar permanent, per Toggle auf Icon-Breite kollabierbar (shadcn `sidebar` collapsible="icon").
- < `lg`: Sidebar als Off-Canvas-`sheet` (Hamburger links im Header). Der Pill-Scroller entfällt ersatzlos.
- Mobil zusätzlich: schwebender „+"-Button (Ausgabe erfassen) unten rechts — die häufigste Aktion braucht nie die Navigation.

### 2.2 Screen-Liste mit Leitfrage und dominanter Information

| Screen | Leitfrage | Dominante Information | Sichtbare Kennzahlen (max. 3) |
|---|---|---|---|
| Start | Wie viel darf ich noch ausgeben? | Betrag „Verfügbar" | Verfügbar · Tagesbudget · Resttage |
| Budget-Übersicht | Komme ich damit bis zum Periodenende? | Ausgabenverlauf (Burn-down-Chart) | Verfügbar · Ausgegeben · Limit |
| Transaktionen | Was ist passiert — und was kommt noch? | Timeline (Ist + erwartet) | Ausgegeben (Periode) |
| Planung | Was muss ich bestätigen oder zuordnen? | Posteingang fälliger Occurrences | Anzahl offen · Summe offen |
| Sparen | Bin ich mit meinen Zielen auf Kurs? | Fortschritt des nächsten fälligen Ziels | Gespart gesamt · Ziel-Fortschritt |
| Berichte | Wohin ist mein Geld geflossen? | Genau ein Chart (gewählter Bericht) | max. 1 Summe über dem Chart |
| Einstellungen | — (Konfiguration) | Abschnittsliste | 0 |

---

## 3. Screen-Entwürfe

### 3.1 Start

Leitfrage: **„Wie viel darf ich noch ausgeben?"**

```
┌──────────┬────────────────────────────────────────────────────────────┐
│ SIDEBAR  │  Start                                    [‹ August 2026 ›]│
│          │                                                            │
│ ⌂ Start ●│                                                            │
│ BUDGET   │                    Verfügbar                               │
│  Übersicht                                                            │
│  Transak…│                 487,20 €                                   │
│  Planung │        ████████████████████░░░░░░░░  (Progress zum Limit)  │
│  Sparen  │                                                            │
│  Berichte│        23,20 € pro Tag · noch 21 Tage                      │
│  Einstell│                                                            │
│          │        [ + Ausgabe erfassen ]     [ Einnahme ]             │
│          │                                                            │
│          │  ── bei Handlungsbedarf, sonst unsichtbar ───────────────  │
│          │  ⚠ 3 offene Posten in der Planung            [Ansehen →]   │
│ ──────── │                                                            │
│ (L) Luca▾│                                                            │
└──────────┴────────────────────────────────────────────────────────────┘
```

**Hierarchie:** Eine riesige Zahl (Verfügbar = Ordinary-Verfügbarkeit der laufenden Periode, tabellarische Ziffern, ~64px), darunter ein `progress`-Balken (verbraucht vs. Limit) als einzige grafische Einordnung, darunter eine Zeile Sekundärkennzahlen (Tagesbudget, Resttage — Resttage zählt als dritte Kennzahl). Farbe kodiert Zustand: neutral → warnend (Tagesbudget unter Schwelle) → negativ (Verfügbar < 0).

**Interaktionen:**
- Klick/Tap auf die Zahl → navigiert zur Budget-Übersicht (Antwort auf „warum?").
- „+ Ausgabe erfassen" öffnet den Erfassen-Dialog (3.3) — von überall identisch.
- Die Handlungsbedarf-Zeile erscheint **nur**, wenn es offene Occurrences oder fällige Erinnerungen gibt (aggregiert zu einer Zeile mit Zähler, kein Kachel-Grid). Klick → Planung.
- Kein Modul-Grid, keine „Aktive Module"-Karte, keine Chart-Vorschau.

### 3.2 Budget-Übersicht

Leitfrage: **„Komme ich damit bis zum Periodenende?"**

```
┌──────────┬────────────────────────────────────────────────────────────┐
│ SIDEBAR  │  Übersicht · August 2026                  [‹ August 2026 ›]│
│          │                                                            │
│          │   Verfügbar        Ausgegeben       Limit                  │
│          │   487,20 €         912,80 €         1.400,00 €             │
│          │                                                            │
│          │  ┌──────────────────────────────────────────────────────┐  │
│          │  │  Ausgabenverlauf (Burn-down)                         │  │
│          │  │  Limit ─────────────────────────────────────────     │  │
│          │  │        ╲ ideal                                       │  │
│          │  │         ╲.....                                       │  │
│          │  │    Ist ━━━━━━━╲╲....                                 │  │
│          │  │                ━━╲  ┊heute   (erwartet: gestrichelt) │  │
│          │  │                    ╲┊----____                        │  │
│          │  │  0 ────────────────────────────────────── 31.08.     │  │
│          │  └──────────────────────────────────────────────────────┘  │
│          │                                                            │
│          │  ▸ Woraus setzt sich „Verfügbar" zusammen?                 │
│          │  ▸ Puffer                                                  │
│          │  ▸ Periode abschließen                                     │
└──────────┴────────────────────────────────────────────────────────────┘
```

**Hierarchie:** Genau drei Kennzahlen als schlanke Zeile (Verfügbar dominant, größer gesetzt), darunter **ein** Chart: Burn-down der Periode mit Ideallinie, Ist-Linie und gestricheltem Erwartungsverlauf (aus der Timeline: geplante Occurrences bis Periodenende). Das Chart beantwortet die Leitfrage visuell — schneidet die Erwartungslinie die Nulllinie vor Monatsende, wird der Bereich eingefärbt.

**Die 11 Kacheln von heute:** ersatzlos aus der Sichtebene entfernt. Stattdessen drei `accordion`-Zeilen:
1. **„Woraus setzt sich Verfügbar zusammen?"** → aufgeklappt eine Wasserfall-Liste (Text, keine Kacheln): Einkommen → − Reserviert (Pläne) → − Puffer-Zuführung → − Sparraten → + Übertrag = Verfügbar. Jede Zeile mit Betrag und Drilldown-Link (z. B. „Reserviert" → Planung).
2. **„Puffer"** → aufgeklappt Ziel/Ist als ein `progress`-Balken + Fehlbetrag + Badge „geschützt"; Regel (fix/prozentual) als Badge mit `tooltip`. Die 6 Puffer-Detail-Kacheln werden eine kompakte Definitionsliste. Link „Puffer-Einstellungen" → Einstellungen.
3. **„Periode abschließen"** → nur in der laufenden/vergangenen offenen Periode; aufgeklappt Zusammenfassung + Button, der den Abschluss-Dialog öffnet (inkl. Defizit-Deckung als geführte Wahl, siehe 4).

**Interaktionen:** Perioden-Umschalter im Header (Chevrons + `popover` mit Monatsliste); Chart-Hover zeigt Tages-`tooltip`; Klick auf einen Tag im Chart → Transaktionen, vorgefiltert auf diesen Tag.

### 3.3 Transaktionen (inkl. Erfassen)

Leitfrage: **„Was ist passiert — und was kommt noch?"**

```
┌──────────┬────────────────────────────────────────────────────────────┐
│ SIDEBAR  │  Transaktionen · August 2026        Ausgegeben: 912,80 €   │
│          │                                                            │
│          │  [🔍 Suchen…        ] [Kategorie ▾] [Typ ▾] [Filter +]     │
│          │                             [ + Erfassen ]  [ ⋯ ]          │
│          │  ── KOMMEND ──────────────────────────────────────────     │
│          │  12.08.  Miete            Wohnen      erwartet   −950,00 € │
│          │  15.08.  Gehalt           Einkommen   erwartet  +3.200,00 €│
│          │  ── HEUTE, 6. AUGUST ─────────────────────────────────     │
│          │  ● REWE            Lebensmittel              −54,30 €  [⋯] │
│          │  ● Spotify         Abos · ⟳ Plan             −10,99 €  [⋯] │
│          │  ── GESTERN ──────────────────────────────────────────     │
│          │  ● Tankstelle Aral Mobilität · 2 Splits      −68,00 €  [⋯] │
│          │  ● dm              Drogerie   [storniert]    −12,45 €  [⋯] │
│          │                       …                                    │
│          │                 [ Mehr laden ]                             │
└──────────┴────────────────────────────────────────────────────────────┘
```

**Hierarchie:** Eine Kennzahl im Kopf (Ausgegeben in der Periode). Darunter die vereinheitlichte Timeline (ADR 0052): erwartete Posten oben unter „Kommend" (gedimmt, gestrichelter Punkt), Ist-Einträge chronologisch mit Datums-Trenngruppen. Jede Zeile: Kategorie-Icon in Kategoriefarbe, Händler/Beschreibung, Kategorie-`badge`, Zustands-Badges (storniert/erstattet/korrigiert — lokalisierte Labels, nie rohe Enums), Betrag rechtsbündig, Kebab-Menü.

**Zeilen-Aktionen (Problem 4 behoben):** `dropdown-menu` am `[⋯]` der Zeile:
- „Details" → `sheet` rechts: alle Felder, Splits als Mini-`table`, Verlauf/Audit als lesbare Ereignisliste („Korrigiert am 03.08. von 54,30 € auf 45,30 €") — **kein JSON.stringify** (Problem 7).
- „Korrigieren" → `dialog` mit den 3 Kernfeldern vorbefüllt.
- „Erstatten" → `dialog` (Betrag, Datum).
- „Stornieren" → Bestätigungs-`dialog` (destruktiv, roter Button), danach Toast mit „Rückgängig"-Hinweis (Storno bleibt sichtbar, ADR 0030).
- Erwartete Zeilen: „Bestätigen" / „Zuordnen" direkt im Kebab (gleiche Dialoge wie in der Planung, 3.4).

**Erfassen-Dialog** (ersetzt das 8–10-Control-Formular, Problem 3):

```
┌─ Ausgabe erfassen ────────────────────────────┐
│  Betrag *        [        54,30 € ]           │
│  Kategorie *     [ Lebensmittel        ▾ ]    │  ← command-Combobox,
│  Datum *         [ heute, 06.08.2026   ▾ ]    │    Vorschlag via Händler
│                                               │
│  ▸ Erweitert                                  │
│    (Händler, Notiz, Splits, Konto,            │
│     Budget-Wirkung, außerhalb Limit,          │
│     Einnahme statt Ausgabe)                   │
│                                               │
│                 [ Abbrechen ]  [ Speichern ]  │
└───────────────────────────────────────────────┘
```

Drei Felder initial; Datum vorbelegt mit heute (also faktisch: 1 Pflichteingabe + 1 Auswahl). Umschalter Ausgabe/Einnahme steckt unter „Erweitert" — Einnahmen sind selten und kommen meist aus Plänen; alternativ der zweite Button auf Start. Splits öffnen innerhalb des Akkordeons eine dynamische Zeilenliste. Nach Speichern: `sonner`-Toast „Ausgabe gespeichert · Verfügbar jetzt 432,90 €" mit „Rückgängig".

**CSV-Import:** hinter `[⋯]` im Kopf („Importieren…", „Exportieren…"). Import = `sheet` (breit) als 3-Schritt-Assistent: (1) Datei wählen, (2) Zuordnung — initial nur **Datum, Betrag, Beschreibung**; die übrigen 6 Mapping-Selects unter „▸ Weitere Spalten zuordnen", (3) Vorschau als echte `table` mit Fehler-Badges pro Zeile → „N Zeilen importieren". Behebt Problem 3 (9 Selects) und Problem 8 (Vorschau als Tabelle).

### 3.4 Planung (Pläne + Occurrences)

Leitfrage: **„Was muss ich bestätigen oder zuordnen?"**

```
┌──────────┬────────────────────────────────────────────────────────────┐
│ SIDEBAR  │  Planung · August 2026                                     │
│          │                                                            │
│          │  3 offene Posten · 981,98 €                                │
│          │                                                            │
│          │  ── POSTEINGANG ──────────────────────────────────────     │
│          │  ┌──────────────────────────────────────────────────────┐  │
│          │  │ ⟳ Miete · fällig 01.08. (überfällig)      −950,00 €  │  │
│          │  │              [ Bestätigen ]  [ Zuordnen ]  [⋯]       │  │
│          │  ├──────────────────────────────────────────────────────┤  │
│          │  │ ⟳ Spotify · fällig 05.08.                  −10,99 €  │  │
│          │  │              [ Bestätigen ]  [ Zuordnen ]  [⋯]       │  │
│          │  ├──────────────────────────────────────────────────────┤  │
│          │  │ ⟳ Fitness · fällig 07.08.                  −20,99 €  │  │
│          │  │              [ Bestätigen ]  [ Zuordnen ]  [⋯]       │  │
│          │  └──────────────────────────────────────────────────────┘  │
│          │        Posteingang leer? → „Alles erledigt ✓"              │
│          │                                                            │
│          │  ▸ Alle Pläne (12)                       [ + Neuer Plan ]  │
│          │  ▸ Einkommenspläne (2)                                     │
│          │  ▸ Beendete & pausierte Pläne (4)                          │
└──────────┴────────────────────────────────────────────────────────────┘
```

**Hierarchie:** Zwei Kennzahlen (Anzahl offen, Summe offen). Dominant ist der **Posteingang**: nur fällige/überfällige/anstehende Occurrences, die eine Entscheidung brauchen — sortiert nach Fälligkeit, überfällig zuerst und farblich markiert. Die bis zu 18 Occurrence-Kacheln von heute reduzieren sich auf genau diese Entscheidungsliste; automatisch gepostete und weit zukünftige Occurrences erscheinen hier nicht (die leben in der Transaktions-Timeline unter „Kommend").

**Occurrence-Aktionen (Problem 4 behoben):** Primäraktionen als Buttons in der Zeile, Rest im Kebab:
- „Bestätigen" → `dialog`, vorbefüllt Betrag/Datum; bei Abweichung zeigt der Dialog die Varianz-Konsequenz als einen Satz („+120 € gehen laut Regel in den Puffer") mit Override-`select` (ADR 0018/0019).
- „Zuordnen" → `dialog` mit `command`-Suche über unzugeordnete Ist-Transaktionen.
- Kebab: „Diesmal überspringen", „Plan pausieren", „Plan bearbeiten", „Plan öffnen".

**Plan-Bestand:** hinter drei Akkordeons als echte `table` (Problem 8) statt 2-spaltiger Karten-Halde:

```
▾ Alle Pläne (12)
┌────────────────┬───────────┬──────────┬────────────┬──────┐
│ Name           │ Kadenz    │ Betrag   │ Status     │      │
├────────────────┼───────────┼──────────┼────────────┼──────┤
│ Miete          │ monatlich │ 950,00 € │ ● aktiv    │ [⋯]  │
│ Spotify        │ monatlich │  10,99 € │ ● aktiv    │ [⋯]  │
│ GEZ            │ ¼-jährlich│  55,08 € │ ⏸ pausiert │ [⋯]  │
└────────────────┴───────────┴──────────┴────────────┴──────┘
```

Kein „monthly · stopped 2026-01-01 · automatic · 3 versions"-String mehr (Problem 6): Kadenz ist eine lokalisierte Spalte, Status ein farbiges `badge`, Auto-Posting ein Icon mit `tooltip`, Versionen stehen nur im Detail-Sheet („Verlauf": Versionsliste mit Gültig-ab-Datum).

Zeilen-Kebab: Bearbeiten (Sheet), Pausieren/Fortsetzen (Dialog mit Wirkungssatz, ADR 0027), Stoppen (Bestätigungs-Dialog; Stoppen statt Löschen, ADR 0028), Verlauf (Sheet).

**Plan anlegen/bearbeiten** (ersetzt das 12-Control-Formular): `sheet` rechts, initial 3 Felder — **Name, Betrag, Kadenz** (Kadenz-`select` mit „Benutzerdefiniert…", das erst dann Intervall/Wochentage einblendet, ADR 0024/0025). Unter „▸ Erweitert": Kategorie, Start-/Enddatum, Auto-Posting, Varianzregel (ein `select` „Abweichung geht an: Puffer / Frei verfügbar" + Schwellenfeld — statt 5-Control-Streifen), Erinnerungen (ein Switch + Tage-Feld). Beim Bearbeiten einer laufenden Serie fragt der Speichern-Schritt den Geltungsbereich ab: „Nur künftige Fälligkeiten / ab Datum …" (Dialog, ADR 0026). Einkommensplan nutzt dasselbe Sheet-Muster (3 Felder: Quelle, Betrag, Kadenz; Varianzregel unter Erweitert) — statt 9 + 5 Controls.

### 3.5 Berichte

Leitfrage: **„Wohin ist mein Geld geflossen?"**

```
┌──────────┬────────────────────────────────────────────────────────────┐
│ SIDEBAR  │  Berichte                                                  │
│          │                                                            │
│          │  [ Kategorien ▾ ]        [ Zeitraum: letzte 6 Monate ▾ ]   │
│          │    ├ Kategorien                                            │
│          │    ├ Händler            Ausgaben nach Kategorie · 5.480 €  │
│          │    ├ Periodenvergleich  ┌───────────────────────────────┐  │
│          │    ├ Plan vs. Ist       │ Wohnen        ████████████ 2.850│ │
│          │    ├ Einkommen          │ Lebensmittel  █████▌      1.240│ │
│          │    ├ Puffer             │ Mobilität     ███▏          710│ │
│          │    ├ Sparziele          │ Abos          █▊            390│ │
│          │    └ Investments        │ Sonstiges     █▍            290│ │
│          │                         └───────────────────────────────┘  │
│          │                          (horizontale Balken, sortiert,    │
│          │                           Kategoriefarben)                 │
│          │                                                            │
│          │   Klick auf Balken → Drilldown-Sheet:                      │
│          │   Transaktions-Tabelle der Kategorie im Zeitraum           │
└──────────┴────────────────────────────────────────────────────────────┘
```

**Hierarchie:** Genau **ein Bericht sichtbar**, gewählt über einen `select` links (die 8 Cards von heute werden 8 Einträge dieses Umschalters; „Kategorie-Ausgaben" und „Händler-Ausgaben" teilen sich einen Chart-Typ). Eine Summenzeile (die einzige Kennzahl), darunter **ein** Recharts-Chart, passend zum Bericht:

| Bericht | Chartform | Drilldown (Klick auf Element) |
|---|---|---|
| Kategorien / Händler | horizontale Balken, sortiert abst. | Sheet: Transaktions-Tabelle |
| Periodenvergleich | gruppierte Säulen (Einnahmen/Ausgaben je Monat) | Klick auf Monat → Übersicht dieser Periode |
| Plan vs. Ist | Abweichungsbalken je Plan (± um Nulllinie) | Sheet: Occurrences des Plans |
| Einkommen | Säulen je Monat, gestapelt nach Quelle | Sheet: Einkommens-Buchungen |
| Puffer | Linien: Ziel vs. Ist über Zeit | Sheet: Zuführungen/Entnahmen |
| Sparziele | Fortschrittsbalken je Ziel | → Sparen, Ziel geöffnet |
| Investments | Linie: Bewertungsverlauf, Marker für Events | Sheet: Event-Tabelle |

**Interaktionen:** Zeitraum-`select` (Presets + „Benutzerdefiniert" mit `date-picker`) gilt berichtsübergreifend und liegt in der URL. Jeder Drilldown zeigt tabellarische Daten als echte `table` mit sortierbaren Spalten und „Als CSV exportieren". Keine Listen-Cards mehr; Zahlenkolonnen existieren nur noch eine Ebene tiefer.

### 3.6 Kurzform der übrigen Screens

- **Sparen** — Leitfrage „Bin ich auf Kurs?": Kennzahlen „Gespart gesamt" + Fortschritt des nächsten fälligen Ziels; darunter Zielliste als schlanke Zeilen (Name, `progress`, Ziel-Badge „bis 12/2026" oder „150 €/Monat"). Zustände „voll finanziert" vs. „abgeschlossen" als unterschiedliche Badges (ADR 0046). Verpasste Beiträge erzeugen eine Replanning-Zeile mit Aktion (ADR 0049). Tabs im Screen: „Ziele" / „Investments" / „Wunschliste". Beitrag erfassen = Dialog (Betrag, Datum, Ziel-Zuordnung; Mehrfach-Allokation unter „Erweitert", ADR 0012). Wunschlisten-Item: Kebab → „Zu Sparziel machen" (Dialog, ADR 0010). Investment-Events (Eröffnung/Beitrag/Bewertung/Entnahme) als Timeline im Detail-Sheet, Erfassung per Dialog mit Event-Typ-`select` zuerst, danach nur die 2–3 passenden Felder.
- **Einstellungen** — vertikale Abschnitte (Accordion oder Ankerliste): Periode (Startag, Limit, Übertrag), Puffer (Regel, Ziel, Schutz), Kategorien, Basiswährung (gesperrt-Badge sobald Daten existieren, ADR 0021), Erinnerungs-Standards. **Kategorien als `table`** (Farbe, Icon, Name, im Limit ja/nein, Status), Bearbeiten per Dialog mit explizitem Speichern — **kein Speichern pro Tastendruck** mehr (Problem 8). Archivieren statt Löschen (ADR 0031/0032).

---

## 4. Progressive-Disclosure-Modell

Vier Ebenen, konsistent über alle Screens:

```
Ebene 0  IMMER SICHTBAR      1 Leitantwort + max. 3 Kennzahlen + 1 Primäraktion
Ebene 1  EIN KLICK, IM FLUSS Accordion / Chart-Hover-Tooltip / „Mehr laden"
Ebene 2  EIN KLICK, KONTEXT  Sheet (Details, Drilldown, lange Formulare)
                             Dialog (kurze Aktionen, Bestätigungen)
Ebene 3  IM FORMULAR         „▸ Erweitert"-Accordion innerhalb Sheet/Dialog
```

**Was ist wo versteckt (vollständige Zuordnung):**

| Inhalt (heute sichtbar) | Neu erreichbar über |
|---|---|
| 5 Übersichts-Kacheln (Einkommen/Puffer/Reserviert/Verfügbar/Verbleibend) | Übersicht → Accordion „Woraus setzt sich Verfügbar zusammen?" (Wasserfall-Liste) |
| 6 Puffer-Detail-Kacheln | Übersicht → Accordion „Puffer" |
| Perioden-Abschluss inkl. Defizit-Deckung | Übersicht → Accordion → Button → geführter Dialog (Schritt 1 Zusammenfassung, Schritt 2 Deckungsquelle wählen, ADR 0065: keine ungedeckten Defizite) |
| Transaktions-Details, Splits, Audit-Verlauf | Timeline-Zeile → Kebab „Details" → Sheet (Audit als lesbare Ereignisliste, nie JSON) |
| Korrigieren / Stornieren / Erstatten | Zeilen-Kebab → Dialog am auslösenden Element |
| Occurrence: Überspringen / Pausieren / Stoppen / Bearbeiten | Posteingang-Zeile: 2 Primärbuttons + Kebab → Dialoge |
| Plan-Versionen, Meta („3 versions") | Plan-Kebab „Verlauf" → Sheet mit Versions-Tabelle |
| Formularfelder jenseits der Top 3 | „▸ Erweitert" im jeweiligen Sheet/Dialog |
| CSV-Mapping (6 von 9 Selects) | Import-Assistent Schritt 2 → „▸ Weitere Spalten zuordnen" |
| Berichts-Rohdaten | Chart-Element-Klick → Drilldown-Sheet mit Tabelle |
| Kategorien, Puffer-Regel, Basiswährung | Einstellungen (raus aus dem Alltagspfad) |
| Wunschliste, Investments | Tabs innerhalb „Sparen" |
| Erwartete/auto-gepostete Occurrences | Timeline-Sektion „Kommend" (gedimmt) |

**Werkzeugwahl-Regel:** `dialog` für Aktionen mit ≤ 4 Feldern oder Bestätigungen; `sheet` (rechts, 480–640px) für Details, lange Formulare, Drilldowns und den Import-Assistenten; `accordion` für Zusatzinformationen am selben Ort; `tooltip`/`popover` für Begriffserklärungen (z. B. „geschützt", „Puffer-Regel"). Sheets sind URL-adressierbar (`?detail=<id>`), damit Deep-Links und Zurück-Navigation funktionieren.

**Neu einzuplanende shadcn-Komponenten:** `dialog`, `table`, `select`, `tooltip`, `popover`, `sonner`, `accordion`, `progress`, `date-picker` (Calendar + Popover), `command`, `sidebar`.

---

## 5. Interaktionsmuster

**Aktionen — ein Modell überall:**
1. Jede handelbare Zeile hat rechts ein Kebab-`dropdown-menu`; maximal 2 Primäraktionen dürfen zusätzlich als Buttons in der Zeile stehen (nur im Planungs-Posteingang genutzt).
2. Aktion öffnet Dialog/Sheet **am auslösenden Element** — nie ein Inline-Formular am Panel-Ende (Problem 4).
3. Destruktive/tragweite Aktionen (Stornieren, Stoppen, Periode schließen) bekommen einen Bestätigungs-Dialog, der die Konsequenz in genau einem Satz erklärt („Die Serie endet; vergangene Buchungen bleiben erhalten.").
4. Rohe Enum-/Systemwerte erscheinen nirgends: alles über i18n-Label + `badge`-Variante (aktiv=grün, pausiert=grau, gestoppt=ausgegraut, storniert=durchgestrichen-rot, überfällig=amber).

**Filter — ein Modell überall (Problem 9):**
- Suchfeld: 300 ms Debounce, sofortige Ergebnisse. Selects/Datums-Presets: sofortiges Anwenden. **Keine Apply-Buttons, kein Reload bei Tab-Wechsel.**
- Filterzustand vollständig in URL-Query-Params (teilbar, Back-Button-fest, überlebt Sprachwechsel).
- Aktive Filter als entfernbare Chips unter der Filterleiste + „Zurücksetzen".
- Mehr als 2 Filterdimensionen → hinter `[Filter +]`-Popover, nicht als Select-Reihe.

**Feedback (Problem 10):**
- Erfolg: `sonner`-Toast unten rechts, mit Folgewirkung („Verfügbar jetzt 432,90 €") und wo möglich „Rückgängig" (nutzt die Storno-/Korrektur-Semantik des Ledgers).
- Validierungsfehler: inline am Feld (rot + Text), Dialog bleibt offen.
- Blockierende Fehler (Backend unerreichbar, Ladefehler): `alert` im Inhaltsbereich — der einzige verbleibende Einsatz von Seiten-Alerts.
- Laden: `skeleton` in der Zielform (Zahl-Skeleton, Chart-Skeleton, 5 Tabellenzeilen); nie Spinner-only, nie Layout-Sprung.

**Formulare:**
- Initial max. 3 Felder; Pflichtfelder zuerst; Rest unter „▸ Erweitert" (`accordion`), dessen Auf/Zu-Zustand pro Formular gemerkt wird — Power-User sehen ihre Felder beim nächsten Mal sofort wieder.
- Explizites Speichern, immer. Kein Autosave, kein Speichern pro Tastendruck (Problem 8). Dirty-Guard beim Schließen („Änderungen verwerfen?").
- Sinnvolle Defaults: Datum=heute, Kategorie=Händler-Vorschlag (ADR 0035), Kadenz=monatlich, Varianzregel=sicherer Default (ADR 0015/0018).
- Beträge in einem lokalisierten Betragsfeld (de: `1.234,56`), tabellarische Ziffern in allen Zahl-Darstellungen.

**Typografie & Farbe:** Lesbare Standard-Schrift (System-/Geist-Sans, Fließtext ≥ 14px, Kennzahlen 24–64px). Deutsche Texte mit echten Umlauten und ß. Farbe ist Bedeutung, nicht Dekoration: Kategoriefarben nur an Kategorie-Icons/Chart-Balken; Ampellogik nur an der Leitkennzahl und an Status-Badges.

---

## 6. Trade-offs (ehrlich)

1. **Power-User klicken mehr.** Die 11-Kacheln-Übersicht zeigte alles simultan; jetzt liegen Puffer-Details und Zusammensetzung je einen Accordion-Klick tief, Plan-Details ein Sheet tief. Wer täglich alle Zahlen quer vergleichen will, verliert den Ein-Blick-Überblick. Milderung: Accordion-Zustände werden pro Nutzer persistiert — einmal aufgeklappt bleibt aufgeklappt.
2. **Berichte: kein Nebeneinander mehr.** 8 Cards erlaubten (theoretisch) simultanes Scannen; der Umschalter erzwingt sequenzielles Betrachten. Vergleiche zwischen zwei Berichten erfordern Hin- und Herschalten.
3. **Formular-Erfassung mit vielen Details wird langsamer.** Wer bei jeder Transaktion Händler, Notiz, Splits und Konto pflegt, muss jedes Mal „Erweitert" öffnen (gemildert durch gemerkten Auf-Zustand, aber der Erstkontakt ist ein Extra-Klick). Dasselbe gilt für Varianzregeln beim Plananlegen.
4. **Batch-Arbeit im Posteingang fehlt.** „Alle 5 Occurrences bestätigen" gibt es bewusst nicht (jede Bestätigung kann Varianz-Entscheidungen tragen); wer 15 Posten nach dem Urlaub abarbeitet, bestätigt 15 Dialoge.
5. **Dialog-/Sheet-Dichte auf Mobile.** Viele Interaktionen leben in Overlays; auf kleinen Screens bedeutet das mehr Vollbild-Wechsel statt Scrollen. Dafür entfällt der Pill-Scroller und die Kern-Workflows bleiben mobil vollständig (ADR 0061).
6. **Mehr Komponenten, mehr Systempflege:** 11 neue shadcn-Komponenten (inkl. Sidebar-Umbau) sind ein realer Implementierungs- und Wartungsaufwand, bevor der erste Screen profitiert.

Der Kern-Trade ist gewollt: **Die App optimiert auf die 90 %-Frage („Wie viel darf ich noch ausgeben?") und verlangt dafür von den 10 %-Analyse-Momenten einen Klick mehr.**
