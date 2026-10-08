# Household Design System

Binding for every Household surface. Token values live in
`clients/web/src/app/globals.css` (Tailwind utilities such as `bg-surface`,
`text-callout`, `text-label-secondary`); tag and banner tints in
`clients/web/src/lib/tone.ts`. This file names the tokens and says where they go.

## Platforms

- **Web is the primary CI.** It follows an Apple look (macOS / Apple web apps):
  system font, calm neutrals, flat content, Liquid Glass only on floating chrome.
  Never use Material Design patterns (FABs with elevation, ripple, filled text
  fields, app bars with shadows).
- **Native apps follow their platform** (see [Native clients](#native-clients)).
  Only the brand tokens (`brand-500`, status colours, content) carry across;
  component shapes are native.
- Every surface ships **light and dark**.

## Visual rules

- **Flat first.** Cards (`surface` on `bg`), lists, tables, inputs, buttons and
  the sidebar are flat: `shadow-none`, no gradients. Only glass elements get depth.
- **Glass only on chrome:** context menus, the toolbar, notifications/alerts,
  toasts, popovers, dialogs, the phone tab bar, and mobile controls. Glass =
  `glass-bg` (55 % opacity in both themes) +
  `backdrop-filter: blur(var(--glass-blur)) saturate(180%)` +
  `1px solid var(--glass-border)` + `shadow-glass` (inner specular edge
  `glass-highlight`). In the web client this is the `.glass` class.
- **The toolbar is one uniform frosted band** across the content area
  (`toolbar-bg`, `toolbar-blur`, `separator` underneath; `.toolbar-band`).
  Controls inside it sit on `toolbar-fill`, not on separate glass capsules.
- **Flat fallback:** with `prefers-reduced-transparency: reduce` or without
  `backdrop-filter` support, glass becomes `surface` + `1px solid var(--border)`,
  no blur, no shadow. The flat variant is a complete, supported option; each
  glass component below names its flat form.
- **Buttons never glow.** No coloured or outer shadows on buttons – ever.

## Colour

- `brand-500` is the only brand colour: the primary button, active icons,
  progress, the highlighted chart bar and the menu highlight. Text on it is
  always `on-brand` (dark) – white on `brand-500` fails contrast (2.9:1).
- Brand as text uses `link` / `brand-700` (5.6:1 on `surface`), never
  `brand-500` on white.
- Status is dot + word, never colour alone: `green-500` Aktiv, `blue-500` Review,
  `yellow-500` Pausiert, `red-500` Risiko. Status text uses the -700 step
  (`success-text`, `danger-text` in dark).
- Tints (-100) are backgrounds for tags and inline banners. Tag text uses -700,
  banner text -900.
- Charts: series in `brand-500` at `track-tint` alpha (higher in dark), the
  highlighted value in full `brand-500`; further series in `blue-500`,
  `purple-500`, `green-500`, `yellow-500`.

**Scales** (`brand`, `green`, `red`, `yellow`, `blue`, `purple`; the same in both
themes):

| Step | Use |
| --- | --- |
| -100 | Tag, inline-banner and tint backgrounds. `brand-100`: selected chips, empty-state icon tiles, focus halo fill (sparingly in dark). `red-100`: also the destructive button. `purple-100`: the „Neu“ tag, avatar fill. |
| -300 | Graphics (chart series, illustrations). Never text on light surfaces; the dark-mode tints use -300 text (see Status). `yellow-300`: warning icon disc on `yellow-100`. |
| -500 | Status dots, icons, chart series. Not for text on white (2.9:1). `red-500`: notification badge fill (white text), destructive dialog button. `blue-500`: utilisation meter. |
| -700 | Text on `surface` and on the -100 tint. |
| -900 | Text on -100 banners; ink on -500 icon discs. |

**Semantic** (themed):

| Token | Use |
| --- | --- |
| `bg` | Page background (web, iOS grouped screens). |
| `surface` | Cards, lists, tables, inputs. Sits on `bg`. |
| `sidebar-bg` | Web sidebar (`bg-sidebar`). |
| `fill` | Secondary button, meter/progress track, selected table row, S icon button inside fields. |
| `fill-strong` | Active sidebar item, segmented-control track in content. |
| `separator` | Hairlines between rows, sidebar edge, toolbar bottom edge. |
| `border` | Input and outlined-button borders; flat overlay borders. |
| `label` | Primary text and icons on `bg`, `surface`, `fill`, `glass-bg`. |
| `label-secondary` | Secondary text (labels, metadata, column heads), ≥ 4.5:1 on `surface` and `bg`. The lightest allowed text colour. |
| `label-disabled` | Disabled text only – never readable content. |
| `on-brand` | Text and icons on `brand-500` fills. |
| `link` | Links and text buttons on `surface` and `bg`. |
| `success-text` / `danger-text` | Positive / negative deltas; `danger-text` also errors and destructive menu items (on `surface` and `glass-bg`). |
| `segment-selected` | The selected segment of a segmented control (text `label`, white in dark). |
| `focus-ring` | The focus ring; ≥ 3:1 on all surfaces (`brand-500` itself is too light on white). |
| `toolbar-bg`, `toolbar-fill` | The frosted toolbar band and the fill of controls inside it. |
| `glass-bg`, `glass-border`, `glass-highlight` | Glass fill, its darkened outer edge, its inner 1px specular edge. |

## Type

One family, `sans`: SF Pro on Apple devices, Figtree elsewhere.

| Style | Size / line, weight | Use |
| --- | --- | --- |
| `large-title` | 34/41 bold | iOS page titles. |
| `title-1` | 28/34 bold | Section headings. |
| `kpi` | 32/38 bold | KPI numbers. |
| `title-2` | 22/28 bold | Page title in the web toolbar. |
| `title-3` | 20/25 semibold | Dialog titles, large card titles. |
| `headline` | 17/22 semibold | Card titles, list titles. |
| `body` | 15/21 | Body copy. |
| `callout` | 14/20 | Web default: tables, sidebar items, buttons, inputs. |
| `footnote` | 13/18 | Help text, metadata, menu items, segmented labels. |
| `caption` | 12/16 semibold | Column heads, field labels, tags, sidebar section headers. |

## Spacing

No CSS variables; use these values. Component internals use `xs`–`xl`, layout
`2xl` and up.

| Token | Value | Use |
| --- | --- | --- |
| `space-xs` | 6px | Icon-to-label gap in chips and status dots. |
| `space-sm` | 8px | Gap between buttons in a group, icon-to-label in buttons. |
| `space-md` | 10px | Sidebar item gap, menu item padding. |
| `space-lg` | 12px | Input horizontal padding, toolbar gaps. |
| `space-xl` | 14px | Search-field padding, list-row vertical padding. |
| `space-2xl` | 16px | Gap between cards; card padding on mobile. |
| `space-3xl` | 20px | Card padding on desktop; mobile screen gutter. |
| `space-4xl` | 24px | Web content gutter; gap between sections in cards. |
| `space-5xl` | 32px | Large section spacing. |
| `space-6xl` | 64px | Page padding of documentation pages. |

## Shape

| Token | Value | Use |
| --- | --- | --- |
| `radius-xs` | 6px | Tags, checkboxes, chart bar tops. |
| `radius-sm` | 8px | S buttons, icon buttons inside fields, menu items, tooltips. |
| `radius-md` | 12px | Desktop M/L buttons, inputs, selects, segmented tracks in content. |
| `radius-lg` | 16px | macOS cards, popovers. |
| `radius-xl` | 18px | Web and iOS cards, notifications, sidebar-free panels. |
| `radius-pill` | 999px (`rounded-full`) | XL buttons, search fields, chips, toolbar groups, segmented controls in the toolbar, toasts, all mobile controls. |

- Desktop controls in S/M/L use `radius-sm` / `radius-md`; **XL controls are pill**.
- **Search fields are always pill** when they stand alone.
- Chart bars: `radius-xs` on top only, square at the baseline, with a
  `separator` baseline.
- Mobile: all controls are pill from the start and larger (min 44px tall);
  mobile controls may use glass.

## Layout

Web: a 256px sidebar (edge-to-edge, `sidebar-bg`) beside the content, with the
64px frosted toolbar on top, then KPI row, charts, list.

## Components

### Button

| Variant | Colours |
| --- | --- |
| Primär | `brand-500` / `on-brand` |
| Sekundär | `fill` / `label` |
| Umrandet | `surface` + 1px `border` |
| Text | transparent / `link` |
| Löschen | `red-100` / `red-700` |
| Deaktiviert | `fill` / `label-disabled` |

Sizes: S 28px, `radius-sm`, 12px semibold · M 40px, `radius-md`, 14px semibold ·
L 48px, `radius-md`, 15px · XL 56px, pill, 17px. Mobile buttons are always pill
and ≥ 44px.

- One primary button per view, never for a destructive action.
- Label is a verb or verb phrase; optional leading 16px line icon (gap `space-sm`).
- Loading: a spinner replaces the icon, the label reads „Speichert …“.
- Icon-only buttons get an `aria-label`.
- Never white text on `brand-500`; never a coloured or outer shadow.

### Toolbar

One uniform frosted band across the top of the content area, grouped per Apple
HIG. 64px, full content width, 1px `separator` below; content scrolls underneath.
Controls inside sit on `toolbar-fill` pill fills.

- **Max three groups:** leading = page title (`title-2`, ≤ 15 characters, never
  the app name) · centre = segmented control for view options · trailing =
  borderless icon actions (Neu, Filter, Teilen, Mitteilungen) in one pill group,
  then the search field last.
- Icons over text; a text-labelled action stands apart from the icon actions.
- No tinted or orange controls in the toolbar.
- Every toolbar action is also reachable from a menu.
- The sidebar collapse button lives in the sidebar, not here.
- Flat variant: solid `bg` band + `separator`, fills `fill-strong`.

### SegmentedControl

2–5 closely related options that change the current view (Woche / Monat /
Quartal). Lives in the toolbar's centre group.

- Text-only nouns in `footnote`; equal-width segments (≈ 84–88px on desktop,
  flex on mobile), 32px tall, 4px track padding (48px track on mobile).
- Track: pill on `toolbar-fill` in the toolbar; in content a flat `fill-strong`
  track with `radius-md`.
- Selected: `segment-selected` + `shadow-segment`, semibold.
- Renders as `radiogroup` with `radio` segments.
- Not for navigation (that is the sidebar / tab bar); never mixes icons and text,
  or actions and selections.

### Select

The full field shows the value; only the trigger on the right is an S secondary
icon button with a chevron-down.

- Field: 40px, `surface`, 1px `border`, `radius-md`, padding 0 5px 0 `space-lg`,
  value in `callout`. Label above in `caption`/13px semibold, linked with
  `aria-labelledby`.
- Trigger: 28×28px, `fill`, `radius-sm`, 12px chevron-down in `label`.
- Options open in a context-menu-styled list.
- States: focus = 2px `focus-ring` · error = `red-500` border + `danger-text`
  message · disabled = `bg` fill, `label-disabled`.
- Never make the whole dropdown a button; never use an up/down double chevron.

### SearchField

Always pill, leading magnifier. 40px tall, `fill` background (`toolbar-fill`
inside the toolbar), padding `space-xl`, placeholder „Suchen“ in
`label-secondary`, text `callout`, an `aria-label`, optional keyboard hint (⌘K)
as a pill `kbd` on the right. On web it is the last item of the toolbar. Never
square or medium-rounded.

### Switch

On/off for settings that apply immediately. 44×26px pill track, 22px white knob;
on = `brand-500` track, off = `fill-strong`. Label on the left in `callout`,
switch on the right. Renders `role="switch"` with `aria-checked`.

- Not for actions that need a Save button (use a checkbox).
- No text inside the track.

### Sidebar and SidebarItem

- Container: 256px, edge-to-edge (full height, no floating or inset, no shadow),
  `sidebar-bg`, 1px `separator` on the right. The collapse button sits in the
  sidebar's top row, right-aligned.
- Item: 36px tall, padding 0 10px, radius 10px, gap `space-md`, 18px line icon,
  label `callout` 500 (active 600). Optional trailing count (`label-secondary`)
  or badge (`red-500`, white).
- **Icons always `brand-500`, text always `label`**, active and inactive. Never
  colour the active row orange; never grey out inactive icons.
- Active = `fill-strong` background + semibold + `aria-current="page"`.
- Section headers `caption` in `label-secondary`. Favourites use a 10px
  status-coloured dot instead of an icon.

### ContextMenu

Glass menu for actions on the current item (right-click, "…" buttons, select
option lists).

- 220–240px wide, 6px padding, radius 14px.
- Items 28–30px, `radius-sm`, `footnote` 500 in `label`; shortcuts right-aligned
  in `label-secondary`.
- Highlighted item `brand-500` + `on-brand`.
- Destructive action last, after a `separator`, in `danger-text`.
- Opens upward when there is no room below.
- Mobile: 48px items, radius 24px, pill highlights.
- Flat variant: `surface` + 1px `border`.

### Notification

Glass alert card top-right, below the toolbar, for important time-bound
information.

- 360px, padding 14px, radius 20px.
- App tile 36px (`brand-500`, radius 10px) or a status icon disc; title 14px
  semibold; time right in `label-secondary`; body `footnote`.
- Optional two actions (primary dark `label` fill + secondary `fill`) and dismiss.
- Persistent page-level states use a flat inline banner instead (-100 tint +
  -900 text, `radius-md`).
- Flat variant: `surface` + 1px `border`.

### Toast

Short-lived confirmation as a glass pill at the bottom centre of the content
area.

- Pill, padding 10px 18px 10px 12px.
- 22px status disc (success: `green-500` with a `green-900` check), one line in
  14px semibold, optional undo button (`fill`, pill, 28px).
- Auto-dismiss after ~4 s; `role="status"`.
- Flat variant: a solid inverse pill (light: `label` background with white text;
  dark: a light pill with `label` text).

### StatusBadge

- **Dots:** 8px + the word (see [Colour](#colour)).
- **Tags:** 3px 10px padding, `radius-xs`, `caption`; -100 background, -700
  text: Erledigt green, In Arbeit blue, Wartet yellow, Blockiert red, Neu purple.
  Mobile risk chip: pill.
- **Counter badge:** `red-500` pill, white 12px bold, min 20px. Neutral counts are
  `label-secondary` text without a pill.
- Dark: keep the -500 dots; tags use the -500 at 20 % with -300 text (`clients/web/src/lib/tone.ts`).

### KpiCard

Flat metric card: label, large number, and a delta line or a meter.

- `surface` on `bg`, `radius-xl`, padding 18px 20px, no shadow.
- Label 13px `label-secondary`; value `kpi` (mobile 28px); delta 12px semibold
  in `success-text` / `danger-text`.
- Meter: 6px pill, track `fill`, value `brand-500` (budget) or `blue-500`
  (utilisation).
- Four in a row on desktop (gap `space-2xl`), 2×2 on mobile.
- Never invent sample numbers in production; never colour the whole card.

### Tables and lists

Column heads `caption` in `label-secondary`, rows 48–50px, `separator`
hairlines, selected row = `fill` with `radius-md`.

## States

- An alert belongs to the view that raised it and clears on navigation.
- A route of an inactive module shows the inactive-module state, not the feature.
- With no active modules, the dashboard shows an empty state that points to
  Admin → Services.

## Content

- German copy is informal (du): „Lege dein erstes Projekt an“, „Prüfe den Umfang“.
- Short labels: nouns for segments („Woche“, „Monat“), verbs for actions
  („Exportieren“, „Neues Projekt“). No emoji.

## Iconography

- Line icons on a 24px grid, 1.8px stroke (2px at 16px), round caps and joins,
  `currentColor`. The web client uses Tabler icons.
- No brand icon set: use one consistent stroke set per platform (e.g. SF Symbols
  on Apple platforms, Fluent icons on Windows). Sidebar icons stay `brand-500`.

## Accessibility

- Text meets 4.5:1 on its grounds in both themes.
- Focus: 2px solid `focus-ring`, offset 2px, on every focusable control.
- Touch targets ≥ 44px on mobile.
- Status is never colour-only.

## Native clients

- **iOS** (Apple HIG): large titles 30–34px (`large-title`); list rows 16px;
  cards `radius-xl`; chart bars may be capsules. The tab bar is navigation only,
  with search as a separate trailing tab; actions go into the top-right glass
  group or a bottom toolbar. Back button = round chevron without text. A filled
  icon only for the selected tab. Switch 51×31px.
- **macOS** (HIG, macOS 27 “Golden Gate” styling): cards `radius-lg` (KpiCard
  adds a 1px `separator`); toolbar 60px with a 36px search field; the sidebar
  collapse button sits next to the window buttons.
- **Windows** (Fluent): Segoe UI Variable, Mica, 4/8px radii, NavigationView,
  CommandBar. Search sits in the title bar (Fluent style, not pill); a dropdown
  („Dieser Monat ▾“) replaces the segmented control.
- **Android**, when built, follows its platform.
