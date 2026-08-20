# Entwurf 3: Aufgaben- und Flow-Orientierung — das Inbox-Paradigma

Redesign der Web-UI (Next.js, shadcn/ui, Tailwind, Recharts, de/en) entlang der
wiederkehrenden Jobs des Haushalts statt entlang der Datenarten.
Reines Designdokument — keine Implementierung.

---

## 1. Leitidee

Die App organisiert sich nicht mehr danach, **was für Daten** es gibt
(Transaktionen, Pläne, Sparen …), sondern danach, **was der Haushalt regelmäßig
tut**: Ausgaben erfassen (ständig, in Sekunden), Offenes abarbeiten (täglich bis
wöchentlich), den Monat verstehen (wöchentlich), Strukturen pflegen (selten).
Herzstück ist eine zentrale **Inbox**: Alles, was eine Entscheidung des Nutzers
braucht — fällige Plan-Occurrences, Import-Klärfälle, Erinnerungen, der
Periodenabschluss — landet dort als Item mit Badge-Zähler und wird wie
E-Mail-Triage per Tastatur abgearbeitet. Wer die Inbox leer hält, hat den
Haushalt „im Griff“; alle anderen Ansichten sind entweder reine Lese-Ansichten
oder bewusst tief versteckte Stammdatenpflege. Die Erfassung einer Ausgabe ist
kein Screen, sondern ein überall verfügbares Overlay mit einem einzigen
Pflichtfeld.

---

## 2. Informationsarchitektur

### 2.1 Navigationsbaum (Sidebar, echte verschachtelte Navigation)

```
┌────────────────────────────┐
│  Haushalt                  │
│                            │
│  [ + Erfassen        (N) ] │   ← globaler Primär-Button, immer sichtbar
│                            │
│  ● Heute                   │   Job: Orientierung + Absprung
│  ● Inbox            (7)    │   Job: Offenes abarbeiten  ← HERZSTÜCK
│  ▾ Monat                   │   Job: Verstehen (nur lesen)
│     · Überblick            │
│     · Buchungen            │
│     · Analysen             │
│  ▾ Ziele                   │   Job: Planen/Verfolgen (überwiegend lesen)
│     · Sparen               │
│     · Investieren          │
│     · Wunschliste          │
│  ▸ Strukturen              │   Job: Pflegen (selten, eingeklappt)
│     · Pläne & Abos         │
│     · Kategorien           │
│     · Regeln & Automatik   │
│     · Import               │
│     · Einstellungen        │
│  ──────────────────        │
│  ⚙ Account                 │   nur hier, nicht zusätzlich im Header
└────────────────────────────┘
```

- **Budget-Subnavigation liegt vollständig in der Sidebar** (verschachtelte
  Gruppen mit Ein-/Ausklappen; shadcn `sidebar` wird ergänzt). Keine
  Button-Reihen oder Content-Tabs als Navigation.
- **„Strukturen“ ist standardmäßig eingeklappt** — bewusste Entscheidung:
  Stammdaten dürfen zwei Klicks kosten.
- Keine „Aktive Module“-Karte. Weitere Module würden als eigene Gruppen
  unterhalb von „Haushalt“ erscheinen.
- Jede Route hat eine **echte H1 + Breadcrumb** („Strukturen / Pläne & Abos“)
  statt der generischen „Vorschau“-Card (behebt Problem 1).

### 2.2 Was zusammengelegt / entfernt / umbenannt wird

| Maßnahme | Details |
|---|---|
| **Zusammengelegt** | Übersicht + Berichte → **Monat** (Überblick = kuratierte Zahlen, Analysen = Drilldowns mit Charts). Transaktionsliste + Timeline (Ist + erwartet) → **Monat / Buchungen**. Plan-Occurrences + Import-Klärfälle + Erinnerungen + Periodenabschluss → **Inbox**. Sparen + Investieren + Wunschliste → **Ziele**. |
| **Entfernt** | Eigener „Transaktionen“-Erfassungsscreen (ersetzt durch globales Erfassen-Overlay). Occurrence-Kachelhalde unter „Planung“ (geht in die Inbox). „Vorschau“-Container. Debug-JSON (Audit wird echte Tabelle im Detail-Sheet). |
| **Umbenannt** | „Planung“ → „Pläne & Abos“ (nur noch Stammdaten der Serien). „Einstellungen“ (Budget) → „Strukturen / Einstellungen“. „Berichte“ → „Analysen“. |

### 2.3 Mapping: alte Ansicht → neuer Ort

| Alt (8 Unteransichten + global) | Neu |
|---|---|
| Übersicht | Monat / Überblick |
| Transaktionen (Liste) | Monat / Buchungen (Tabelle mit Ist + erwartet) |
| Transaktionen (Formular) | Globales Erfassen-Overlay (`N`) |
| Transaktionen (stornieren/erstatten/korrigieren) | Dialog direkt an der Zeile in Buchungen |
| Planung (Plan-Karten, Anlage, Varianzregeln) | Strukturen / Pläne & Abos |
| Planung (fällige Occurrences bestätigen/zuordnen) | **Inbox** |
| Sparen & Investieren | Ziele / Sparen bzw. Investieren |
| Wunschliste (inkl. „zu Sparziel promoten“) | Ziele / Wunschliste |
| Kategorien | Strukturen / Kategorien |
| Berichte (8 Listen-Cards) | Monat / Analysen (Chart-Drilldowns) |
| Einstellungen (Limit, Puffer-Regel, Periode) | Strukturen / Einstellungen |
| Periodenabschluss (inkl. Defizit-Deckung) | **Inbox-Item** am Monatsende + Button in Monat/Überblick |
| CSV-Import (Mapping-Formular) | Strukturen / Import (Wizard); Klärfälle → **Inbox** |
| Erinnerungen | **Inbox** (fällig) + Verwaltung an Plan/Ziel selbst |
| Audit-History (JSON-Dump) | „Verlauf“-Tab im Detail-Sheet, als Tabelle |
| Account/Admin | Sidebar-Fußbereich (einfach, nicht doppelt) |

### 2.4 Screen-Liste

1. **Heute** (Start)
2. **Inbox** (Review-Queue, Kernstück)
3. **Erfassen** (Overlay: Dialog ≥ md, Bottom-Sheet mobil)
4. **Monat / Überblick**, **Monat / Buchungen**, **Monat / Analysen**
5. **Ziele / Sparen · Investieren · Wunschliste**
6. **Strukturen / Pläne & Abos · Kategorien · Regeln & Automatik · Import · Einstellungen**
7. Querschnitt: **Detail-Sheet** (rechts) für Plan/Buchung/Ziel mit Tabs
   „Details · Verlauf · Erinnerungen“.

---

## 3. Screen-Entwürfe

### 3.1 Heute (Start)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Heute · Mittwoch, 6. August 2026                     [ + Erfassen N ]│
├──────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────┐  ┌────────────────────────────────┐ │
│ │ Verfügbar diesen Monat       │  │ Inbox                    (7)   │ │
│ │        1.243,50 €            │  │ ────────────────────────────── │ │
│ │ ▓▓▓▓▓▓▓▓▓▓░░░░░░  62 % Limit │  │ ⏰ Miete fällig · 950 €        │ │
│ │ noch 12 Tage · Ø 41 €/Tag ok │  │ ❓ Import: 3 mögliche Dubletten│ │
│ └──────────────────────────────┘  │ 🔔 GEZ überweisen              │ │
│ ┌──────────────────────────────┐  │            [ Inbox öffnen → ]  │ │
│ │ Demnächst erwartet           │  └────────────────────────────────┘ │
│ │ 08.08.  Spotify      −9,99 € │  ┌────────────────────────────────┐ │
│ │ 15.08.  Gehalt    +3.200 €   │  │ Zuletzt erfasst                │ │
│ │ 20.08.  Strom      −85 €     │  │ Heute  Rewe  Lebensm.  −23,41 €│ │
│ └──────────────────────────────┘  │ Gestern Tanken Mobilität −62 € │ │
│                                   └────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

Heute beantwortet drei Fragen in einem Blick: *Wie viel darf ich noch
ausgeben?* (eine einzige Hero-Zahl mit Progress-Bar und Tages-Pace statt elf
Kacheln), *Was steht an?* (Inbox-Teaser mit den 3 dringendsten Items) und
*Was kommt auf mich zu?* (nächste erwartete Timeline-Einträge). „Zuletzt
erfasst“ gibt sofortiges Vertrauen nach einer Schnellerfassung. Kein
Bearbeiten auf diesem Screen — alles verlinkt in Inbox bzw. Monat.

### 3.2 Inbox / Review-Queue (Kernstück)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Inbox                     [Alle (7)] [Pläne (3)] [Import (3)] [Erinn.]│
├──────────────────────────────────────────────────────────────────────┤
│ ▸ FÄLLIGE PLÄNE ──────────────────────────────────────────────────── │
│ ▌⏰ Miete August                             950,00 € · fällig 01.08.│ ← Fokus
│ ▌   Dauerauftrag „Miete“ · Kategorie Wohnen                          │
│ ▌   [E Bestätigen] [Z Zuordnen…] [X Überspringen] [S Später] [↵ Mehr]│
│ ├──────────────────────────────────────────────────────────────────  │
│ │ ⚠ Strom: Abbuchung 96,10 € weicht +11 € vom Plan ab (Regel: Puffer)│
│ │ ⏰ Spotify August                              9,99 € · fällig 08. │
│ ▸ IMPORT KLÄREN ───────────────────────────────────────────────────  │
│ │ ❓ „REWE SAGT DANKE“ 23,41 € — Dublette von Eintrag vom 04.08.?    │
│ │ ❓ 2 Zeilen ohne Kategorie-Zuordnung                               │
│ ▸ SONSTIGES ───────────────────────────────────────────────────────  │
│ │ 🔔 Erinnerung: GEZ überweisen (bis 10.08.)                         │
│ │ 📅 Juli abschließen — Defizit 34,50 € decken                       │
├──────────────────────────────────────────────────────────────────────┤
│ J/K bewegen · E bestätigen · Z zuordnen · X überspringen · S später  │
│ ↵ Detail · U rückgängig                        [ Alle Fälligen best.]│
└──────────────────────────────────────────────────────────────────────┘
```

Eine einzige, nach Dringlichkeit gruppierte Liste; Tabs filtern nach Quelle.
Genau **ein Item hat Fokus** (Balken links); dessen Aktionen stehen direkt im
Item — nicht mehr am Panel-Ende (behebt Problem 4). Jede Aktion entfernt das
Item sofort mit Slide-out-Animation und zeigt einen **Toast mit Undo**;
der Fokus springt zum nächsten Item. „Zuordnen“ (`Z`) öffnet eine
Command-Palette (Kategorie-/Konto-Suche per Tippen, Enter bestätigt) — kein
Mega-Formular. `↵` öffnet das Detail-Sheet rechts (Splits, Betrag korrigieren,
Verlauf). Leere Inbox zeigt einen ruhigen „Alles erledigt ✓“-Zustand mit dem
Datum der letzten Leerung. Sammelaktion „Alle Fälligen bestätigen“ nur für
Items ohne Konflikt.

### 3.3 Erfassen (Overlay)

```
        ┌───────────────────────────────────────┐
        │ Ausgabe erfassen                   ✕  │
        │ ┌───────────────────────────────────┐ │
        │ │            23,41 €               ▏│ │  ← Autofokus, numerisch
        │ └───────────────────────────────────┘ │
        │ ┌───────────────────────────────────┐ │
        │ │ Rewe                              │ │  ← Händler, Autocomplete
        │ └───────────────────────────────────┘ │
        │ Vorschlag: [🛒 Lebensmittel]  Heute   │  ← 1 Klick / Tab+↵
        │                                       │
        │ ▸ Mehr (Datum · Einnahme · Split · …) │  ← zugeklappt
        │                                       │
        │ [ Speichern ↵ ]   [ Speichern + neu ] │
        └───────────────────────────────────────┘
```

Dialog auf Desktop, Bottom-Sheet auf Mobil (Daumenzone, großes Nummernfeld).
Zwei sichtbare Felder, alles andere hat Defaults oder liegt hinter „Mehr“
(behebt Problem 3 für die Erfassung). Details in Abschnitt 4.

### 3.4 Monat / Überblick

```
┌──────────────────────────────────────────────────────────────────────┐
│ Monat · August 2026            [◂ Juli] [August ▾] [Vergleich: Juli] │
├──────────────────────────────────────────────────────────────────────┤
│ ┌ Verfügbar ────────┐ ┌ Ausgegeben ───────┐ ┌ Puffer ──────────────┐ │
│ │  1.243,50 €       │ │  2.056,50 €       │ │  480 / 600 € (80 %)  │ │
│ │  ↑ +180 € vs Juli │ │  ▓▓▓▓▓▓░░ 62 %    │ │  ▓▓▓▓▓▓▓░ geschützt  │ │
│ └───────────────────┘ └───── vom Limit ───┘ └── ▸ Details ─────────┘ │
│ ┌ Verlauf: Saldo im Monat (Ist ── / erwartet ┄┄) ──────────────────┐ │
│ │   €                                        ┄┄┄┄┄╮                │ │
│ │   ╰──╮  ╭────╮                        ┄┄┄┄╯     ╰┄┄ Limit ────── │ │
│ │      ╰──╯    ╰───────╮   ╭──────┄┄┄┄╯                            │ │
│ │  1.....7.......14....╰───╯..21...........31                      │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│ ┌ Top-Kategorien ───────────────┐ ┌ Plan vs. Ist ───────────────────┐│
│ │ Wohnen      ▓▓▓▓▓▓▓▓  950 €   │ │ Fixkosten   erwartet ▓▓▓▓ ist ▓▓││
│ │ Lebensmittel▓▓▓▓  412 € ↑12 % │ │ Einkommen   erwartet ▓▓▓▓ ist ▓ ││
│ │ Mobilität   ▓▓  180 €         │ │        → Analysen für Drilldown ││
│ └───────────────────────────────┘ └─────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```

Statt 11 gleichförmiger Kacheln: **3 Hero-Stats mit Trendpfeil, Zielrahmung
(Progress) und Farbe** (grün/gelb/rot nach Pace bzw. Pufferdeckung); die 6
Puffer-Detailwerte wandern in ein Popover/Accordion hinter „Details“ (behebt
Problem 2). Darunter der Saldo-Verlauf mit erwarteter Fortschreibung
(Timeline-Daten) gegen die Limit-Linie. „Buchungen“ ist eine sortier- und
filterbare Tabelle (Ist + erwartet, Zeilenaktionen als Dropdown → Dialog);
„Analysen“ ersetzt die 8 Listen-Cards durch je einen Chart mit
Drilldown-Tabelle (Periodenvergleich, Kategorien, Händler, Plan vs. Ist,
Einkommen, Puffer, Sparziele, Investments — als Sidebar-lose Sektionen mit
Sprungmarken).

### 3.5 Strukturen / Pläne & Abos

```
┌──────────────────────────────────────────────────────────────────────┐
│ Strukturen / Pläne & Abos                        [ + Neuer Plan ]    │
│ [Alle ▾] [Aktiv ▾]  Suche: [__________]                              │
├──────────────────────────────────────────────────────────────────────┤
│ Name        Art          Kadenz     Betrag    Nächste   Status       │
│ ────────────────────────────────────────────────────────────────────│
│ Miete       Dauerauftrag  monatlich  950,00 €  01.09.   ●aktiv    ⋯ │
│ Gehalt      Einkommen     monatlich 3.200,00 € 15.08.   ●aktiv    ⋯ │
│ Spotify     Abo           monatlich    9,99 €  08.08.   ●aktiv    ⋯ │
│ Fitness     Abo           monatlich   29,90 €  —        ◌pausiert ⋯ │
│ Zeitung     Dauerauftrag  monatlich   12,00 €  —        ■gestoppt ⋯ │
│                              ⋯ = [Bearbeiten][Pausieren][Stoppen][…] │
├──────────────────────────────────────────────────────────────────────┤
│ Detail-Sheet (bei Zeilenklick, von rechts):                          │
│ ┌ Miete ──────────────────────────────────────────────┐             │
│ │ [Details] [Varianzregel] [Erinnerungen] [Verlauf]    │             │
│ │ Status ●aktiv · seit 01.03.2024 · [automatisch]      │  ← Badges   │
│ │ Verlauf: Tabelle der 3 Versionen (Datum, Änderung)   │             │
│ └──────────────────────────────────────────────────────┘             │
└──────────────────────────────────────────────────────────────────────┘
```

Die Karten-Halde (2 Spalten × 4 Buttons × Switches) wird eine **Tabelle**
mit Status-Badges und einem Aktionen-Dropdown pro Zeile; jede Aktion öffnet
einen kleinen Dialog am Auslöser (behebt Probleme 4–6). Meta-Strings
(„monthly · stopped 2026-01-01 · automatic · 3 versions“) werden zu
Spalten + Badges mit Tooltip; Versionen/Audit sind eine Tabelle im
„Verlauf“-Tab des Sheets (behebt Problem 7). **Plan-Anlage als 3-Schritt-
Wizard im Dialog**: (1) Was & wie viel (Name, Art, Betrag, Kategorie),
(2) Wann (Kadenz, Start, Ende — mit Klartext-Vorschau „ab 01.09. jeden
Monat“), (3) Automatik (Auto-Posting, Varianzregel → Puffer/Ordinary,
Erinnerungen) — nie mehr als 5 Controls gleichzeitig. Einkommensplan nutzt
denselben Wizard; die Varianzregel ist Schritt 3 statt Formular-Streifen.
**Kategorien**: Tabelle mit Farbe/Icon/„im Limit“-Badge, Bearbeitung als
Zeilen-Dialog mit explizitem Speichern (kein Save-per-Keystroke, behebt
Problem 8). **Import**: Wizard (Datei → Mapping mit automatischen
Vorschlägen, nur unklare Spalten fordern Auswahl → Vorschau als Tabelle →
Ergebnis); Dubletten/Unzugeordnetes wird zu Inbox-Items.

---

## 4. Der Erfassen-Flow im Detail (< 5 Sekunden)

**Aufruf (0. Sekunde):** Überall per `N` (Desktop), Klick auf den permanent
sichtbaren Sidebar-Button, oder mobil über den mittigen **„+“ in der
Bottom-Navigation**. Öffnet als Dialog (Desktop) / Bottom-Sheet (mobil) über
der aktuellen Ansicht — kein Navigationswechsel, kein Kontextverlust.

**Happy Path (Ziel: 3 Interaktionen):**

1. **Betrag tippen** — Feld hat Autofokus, `inputmode=decimal`,
   Komma-tolerant („23,41“ und „23.41“).
2. **Händler tippen (optional)** — Autocomplete aus der Historie ab dem
   2. Zeichen; die Auswahl eines bekannten Händlers setzt die Kategorie
   automatisch (häufigste Kategorie dieses Händlers) und zeigt sie als
   angeheftetes Badge unter dem Feld: „Vorschlag: 🛒 Lebensmittel“.
3. **Enter = Speichern.**

**Defaults (unsichtbar, aber änderbar):** Datum = heute, Richtung = Ausgabe,
Topf = Ordinary, Kategorie = Händler-Vorschlag, sonst letzte verwendete.
Wird ohne Kategorie gespeichert, ist das **kein Fehler**: Der Eintrag landet
als „Zuordnen“-Item in der Inbox — Erfassen und Einordnen sind entkoppelt
(Capture now, triage later).

**Feedback:** Toast unten rechts „−23,41 € Rewe · Lebensmittel gespeichert“
mit **[Rückgängig]** und **[Details]** (öffnet das Detail-Sheet zum
Nachschärfen). „Speichern + neu“ (`Strg+Enter`) leert das Formular für
Serienerfassung nach dem Einkaufstag.

**Ausnahme-Pfade hinter „Mehr“ (Progressive Disclosure, standardmäßig zu):**
Datum ändern (Date-Picker, Schnellwahl „gestern/vorgestern“), Einnahme statt
Ausgabe (Segment-Toggle), Notiz, außerhalb des Limits. **Split** ist bewusst
der tiefste Pfad: Button „Aufteilen“ unter „Mehr“ verwandelt die Betragszeile
in 2+ Zeilen (Kategorie + Teilbetrag, Restbetrag wird live vorgerechnet).
Wer splitten will, hat nie < 5 s erwartet — der Schnellpfad bleibt davon
unberührt. Stornieren/Erstatten/Korrigieren sind **keine** Erfassen-Fälle,
sondern Zeilenaktionen in Monat/Buchungen (Dialog mit Vorher/Nachher-Zeile).

---

## 5. Interaktionsmuster

### 5.1 Inbox-Semantik

**Es erzeugt ein Item:**

| Quelle | Item-Typ | Standard-Aktion |
|---|---|---|
| Plan-Occurrence fällig/überfällig | „Fällig“ | Bestätigen |
| Auto-Posting mit Varianz außerhalb der Regel | „Abweichung“ | Buchen mit Ziel (Puffer/Ordinary) wählen |
| CSV-Import: mögliche Dublette | „Klären“ | Zusammenführen / getrennt behalten |
| CSV-Import: Zeile ohne Kategorie | „Zuordnen“ | Kategorie wählen |
| Schnellerfassung ohne Kategorie | „Zuordnen“ | Kategorie wählen |
| Erinnerung fällig | „Erinnerung“ | Erledigt / Später |
| Periodenende erreicht | „Monat abschließen“ | Abschluss-Dialog (inkl. Defizit-Deckung) |
| Sparziel: Rate fällig / Zieldatum gefährdet | „Sparziel“ | Beitrag buchen / Ziel anpassen |

**Es räumt ab:** die jeweilige Aktion (bestätigen, zuordnen, überspringen,
zusammenführen, erledigen, abschließen), „Später“ (Snooze: morgen / nächste
Woche / Wunschdatum — Item verschwindet und kommt datiert wieder) oder das
Lösen an der Quelle (Plan stoppen entfernt dessen offene Occurrences).
Items sind **idempotente Verweise auf Domänenzustand**, keine eigene
To-do-Liste: Wird die Ursache anderswo behoben, verschwindet das Item von
selbst. Badge-Zähler = Anzahl nicht gesnoozter Items, in Sidebar und
Browser-Titel („(7) Haushalt“).

### 5.2 Tastaturkürzel

| Kürzel | Wirkung |
|---|---|
| `N` | Erfassen-Overlay (global) |
| `G` dann `H`/`I`/`M`/`Z`/`S` | Gehe zu Heute / Inbox / Monat / Ziele / Strukturen |
| `J` / `K` bzw. `↓`/`↑` | Inbox: nächstes / vorheriges Item |
| `E` | Item bestätigen/erledigen |
| `Z` | Zuordnen (öffnet Command-Palette Kategorie/Ziel) |
| `X` | Überspringen (Occurrence auslassen) |
| `S` | Später (Snooze-Menü) |
| `↵` / `Esc` | Detail-Sheet öffnen / schließen |
| `U` | Letzte Inbox-Aktion rückgängig |
| `⌘/Strg K` | Command-Palette global (Navigation, „Neue Ausgabe“, Suche) |

Kürzel werden in einem `?`-Overlay dokumentiert und in der Inbox als
Fußzeile permanent angezeigt (lernbar durch Sichtbarkeit).

### 5.3 Feedback

- **Toasts (sonner)** für jede Mutation: kurz, mit Undo wo möglich
  (Erfassen, Inbox-Aktionen, Kategorie-Speichern). Ersetzt die
  Seiten-Alerts oben (behebt Problem 10). Alerts bleiben nur für
  persistente Zustände (z. B. „Backend nicht erreichbar“).
- **Optimistic UI** in der Inbox: Item verschwindet sofort, Toast bestätigt;
  bei Serverfehler kehrt es mit Fehler-Badge zurück.
- **Skeletons** für Erst-Ladezustände, keine Spinner-Cards.

### 5.4 Formulare & Filter (einheitliche Regeln)

1. **Kleine Aktionen = Dialog am Auslöser** (stornieren, erstatten,
   korrigieren, pausieren, stoppen, Occurrence bearbeiten): max. 4 Controls,
   Titel benennt Objekt („‚Spotify‘ pausieren“), destruktive Aktionen mit
   rotem Primär-Button und Konsequenz-Satz.
2. **Anlage komplexer Objekte = Wizard im Dialog** (Plan, Einkommensplan,
   Sparziel, Import): max. 5 Controls pro Schritt, Klartext-Zusammenfassung
   vor dem Speichern.
3. **Stammdaten-Bearbeitung = explizites Speichern** (Button + `⌘S`),
   nie Save-per-Keystroke; ungespeicherte Änderungen markiert der Dialog.
4. **Filter überall gleich (behebt Problem 9):** Auswahl-Filter (Select,
   Tabs, Zeitraum) wirken **sofort**; Freitextsuche debounced (300 ms);
   Filterzustand liegt in der URL (teilbar, Back-Button-fest); kein
   Apply-Button, kein Reload bei Tab-Wechsel.
5. **Metadaten**: Status als farbiges Badge, Kadenz/Automatik als Badge mit
   Tooltip, Datumsangaben lokalisiert („seit 1. Jan. 2026“), niemals rohe
   Enums oder „·“-Ketten (behebt Probleme 6–7).

### 5.5 Responsive

- Sidebar: einklappbar ab `lg` (Icons + Tooltip), als Sheet-Drawer unter
  `lg` (behebt Problem 11 — kein Pill-Scroller mehr).
- **Mobil: Bottom-Navigation mit 5 Slots** — Heute · Inbox(Badge) ·
  **[+]** · Monat · Mehr (Sheet mit Ziele/Strukturen/Account). Der
  „+“-Slot ist das Erfassen-Overlay: Der häufigste Job liegt unter dem
  Daumen.
- Tabellen werden mobil zu zweizeiligen Listenzeilen (primäre Spalten),
  Details im Sheet.

### 5.6 Neu einzuplanende shadcn-Komponenten

`dialog`, `sheet`-Erweiterung (Bottom-Sheet), `table`, `select`, `command`,
`sonner` (Toast), `tooltip`, `popover`, `accordion`, `progress`,
`date-picker`, `sidebar` (mit Collapsible-Gruppen und Badge-Slot).

---

## 6. Trade-offs (ehrlich)

1. **Auffindbarkeit von Stammdaten sinkt.** „Wo ändere ich meinen
   Dauerauftrag?“ ist neu zwei Ebenen tief (Strukturen / Pläne & Abos) und
   nicht mehr prominenter Top-Level-Punkt. Milderung: Command-Palette
   (`⌘K` → „Miete“ findet den Plan), Kontext-Links („Plan bearbeiten“ im
   Inbox-Item und im Detail-Sheet jeder Buchung). Trotzdem: Wer selten
   pflegt, sucht beim ersten Mal.
2. **Umgewöhnung vom Datenarten-Modell.** Nutzer, die „Transaktionen“ als
   Ort kennen, müssen lernen, dass Erfassen ein Overlay und die Liste unter
   „Monat“ ist. Die erste Woche fühlt sich die App „verschoben“ an;
   das Mapping in 2.3 sollte als kurze Release-Note in-App erscheinen.
3. **Die Inbox ist ein Single Point of Attention — und kann kippen.** Läuft
   sie voll (Urlaub, großer Import), wirkt das Badge wie eine Schuldenliste
   und erzeugt Druck statt Kontrolle. Gegenmittel sind Sammelaktionen,
   großzügiges Snoozen und strenge Item-Disziplin (nur echte
   Entscheidungen erzeugen Items, keine reinen Infos) — aber das Risiko
   „E-Mail-Postfach-Gefühl“ bleibt der größte Wette dieses Entwurfs.
4. **Mehr neue Bausteine als andere Entwürfe.** Command-Palette,
   Toast-Undo, Optimistic UI, Wizard-Dialoge und Bottom-Navigation sind
   zusätzlicher Implementierungs- und i18n-Aufwand gegenüber einem rein
   navigatorischen Umbau.
5. **Redundanz zwischen Heute und Monat.** Beide zeigen „Verfügbar“;
   das ist gewollt (Orientierung vs. Analyse), muss aber aus derselben
   Datenquelle gespeist werden, sonst untergräbt jede Abweichung das
   Vertrauen in die Hero-Zahl.
