# Household Design System

Binding for every Household surface. Token values live in
`clients/web/src/app/globals.css` (Tailwind utilities such as `bg-surface`,
`text-callout`, `text-label-secondary`); tag and banner tints in
`clients/web/src/lib/tone.ts`. This file names the tokens and says where they go.

## Platforms

- **Web is the primary CI.** It looks like a calm web application: system font,
  calm neutrals, soft cards, small controls, frosted glass only on small floating
  chrome.
  Never use Material Design patterns (FABs with elevation, ripple, filled text
  fields, app bars with shadows).
- **Two sizes on web.** From `lg` (1024px) the desktop scale is dense: 28px
  controls, 36px rows, smaller type and radii. Below `lg` the phone scale keeps
  touch sizes: pill controls ≥ 44px and the larger type. Where a value below has
  two forms, the desktop one comes first and the phone one follows.
- **Native apps follow their platform** (see [Native clients](#native-clients)).
  Only the brand tokens (`brand-500`, status colours, content) carry across;
  component shapes are native.
- Every surface ships **light and dark**.

## Visual rules

- **Borders at rest, shadows for what floats.** Cards and list cards are
  `surface` on `bg` with a 1px `separator` border and `shadow-e1`, a faint lift
  that is `none` in dark, where the `surface`/`bg` contrast carries the depth.
  Inputs, buttons, tables and the sidebar are flat: no shadow, no gradients.
- **Elevation** has four steps. `shadow-e1` cards at rest · `shadow-e2` the
  toolbar once content has scrolled under it, and dragged items · `shadow-e3`
  menus, popovers, tooltips, toasts, notifications · `shadow-e4` dialogs, sheets
  and side panels. Shadows are outer only, never an inset highlight, in both
  themes. Every layer at e2 or above also has a 1px edge (`floating-border`; the
  toolbar keeps its `separator`), so it keeps an edge where shadows disappear.
- **Glass only on small floating chrome:** the toolbar band, context menus,
  select lists, popovers, toasts, notifications, the phone tab bar and the
  phone's floating controls. Glass = `glass-bg` (`surface-floating` at 85 %) +
  `backdrop-filter: blur(var(--glass-blur)) saturate(180%)` + `1px solid
  var(--floating-border)` + `shadow-e3`, no specular highlight. In the web client
  this is the `.glass` class.
- **Solid where it carries content:** chart tooltips, dragged items, dialogs,
  sheets and side panels (such as a tray of widgets to add) are
  `surface-floating` + `floating-border` (`.floating`), never glass: numbers,
  forms and lists do not sit on blur. Sheets and dialogs dim the page behind
  them; side panels do not.
- **The toolbar is one uniform frosted band** across the content area
  (`toolbar-bg`, `glass-blur`, `separator` underneath; `.toolbar-band`).
  Controls inside it sit on `toolbar-fill`, not on separate glass capsules.
- **Flat fallback:** with `prefers-reduced-transparency: reduce` or without
  `backdrop-filter` support, glass becomes solid `surface-floating` with its
  border and shadow, and the toolbar a solid `bg` band. With `forced-colors`,
  every floating layer is opaque `Canvas` with a `CanvasText` edge.
- **Buttons never glow.** No coloured or outer shadows on buttons – ever.

## Colour

- `brand-500` is the only brand colour: the primary button, the active sidebar
  icon, meters, the highlighted chart series and the menu highlight. Text on it is
  always `on-brand` (dark) – white on `brand-500` fails contrast (2.9:1).
- Brand as text uses `link` / `brand-700` (5.6:1 on `surface`), never
  `brand-500` on white.
- Status is dot + word, never colour alone: `green-500` Aktiv, `blue-500` Review,
  `yellow-500` Pausiert, `red-500` Risiko. Status text uses the -700 step
  (`success-text`, `danger-text` in dark).
- Tints (-100) are backgrounds for tags and inline banners. Tag text uses -700,
  banner text -900.
- Charts follow [Charts](#charts): one series in `brand-500`, context in grey.

**Scales** (`brand`, `green`, `red`, `yellow`, `blue`, `purple`; the same in both
themes):

| Step | Use |
| --- | --- |
| -100 | Tag, inline-banner and tint backgrounds. `brand-100`: selected chips, empty-state icon tiles, focus halo fill (sparingly in dark). `red-100`: also the destructive button. `purple-100`: the „Neu“ tag, avatar fill. |
| -300 | Graphics (chart series, illustrations). Never text on light surfaces; the dark-mode tints use -300 text (see Status). `yellow-300`: warning icon disc on `yellow-100`. |
| -500 | Status dots, icons, categorical chart series. Not for text on white (2.9:1). `red-500`: notification badge fill (white text), destructive dialog button. |
| -700 | Text on `surface` and on the -100 tint. |
| -900 | Text on -100 banners; ink on -500 icon discs. |

**Semantic** (themed):

| Token | Use |
| --- | --- |
| `bg` | Page background (web, iOS grouped screens). |
| `surface` | Cards, lists, tables, inputs. Sits on `bg`. |
| `surface-floating` | Menus, popovers, tooltips, dialogs and sheets; under glass at 85 %. White in light, one step lighter than `surface` in dark. |
| `sidebar-bg` | Web sidebar (`bg-sidebar`). |
| `fill` | Secondary button, selected table row, S icon button inside fields. |
| `fill-strong` | Active sidebar item, segmented-control track in content. |
| `separator` | Hairlines between rows, card borders, search-field border, sidebar edge, toolbar bottom edge. |
| `border` | Outlined-button borders. |
| `border-control` | The edge of inputs, selects, search fields, checkboxes and the off switch: ≥ 3:1 on `surface` and `bg`. |
| `floating-border` | The 1px edge of every layer at e2 or above, glass or solid (the toolbar keeps its `separator`). |
| `meter-track` | The unfilled part of a `brand-500` meter (a brand tint). |
| `chart-muted`, `chart-muted-strong` | Context series in charts: past or comparison values, and the one still running. |
| `label` | Primary text and icons on `bg`, `surface`, `fill`, `glass-bg`. |
| `label-secondary` | Secondary text (labels, metadata, column heads), ≥ 4.5:1 on `surface` and `bg`. The lightest allowed text colour. |
| `label-disabled` | Disabled text only – never readable content. |
| `on-brand` | Text and icons on `brand-500` fills. |
| `link` | Links and text buttons on `surface` and `bg`. |
| `success-text` / `danger-text` | Positive / negative deltas; `danger-text` also errors and destructive menu items (on `surface` and `glass-bg`). |
| `segment-selected` | The selected segment of a segmented control (text `label`, white in dark). |
| `focus-ring` | The focus ring; ≥ 3:1 on all surfaces (`brand-500` itself is too light on white). |
| `toolbar-bg`, `toolbar-fill` | The frosted toolbar band and the fill of controls inside it. |
| `glass-bg`, `glass-blur` | Glass fill (`surface-floating` at 85 %) and its blur (14px). |
| `shadow-e1` … `shadow-e4` | Elevation (see [Visual rules](#visual-rules)); e1 is `none` in dark. |

## Type

One family, `sans`: SF Pro on Apple devices, Figtree elsewhere. Every style has a
desktop size (from `lg`) and a phone size; the tokens switch at the breakpoint.

| Style | Desktop | Phone | Weight | Use |
| --- | --- | --- | --- | --- |
| `display` | 52/56 | 40/44 | bold | A page's one hero number. |
| `large-title` | 24/30 | 34/41 | bold | Login and stand-alone page titles. |
| `title-1` | 22/28 | 28/34 | bold | Section headings. |
| `kpi` | 22/28 | 32/38 | bold | Metric-strip values (on phones they use `title-2`). |
| `title-2` | 17/22 | 22/28 | bold | Page title in the web toolbar. |
| `title-3` | 15/20 | 20/25 | semibold | Dialog titles, large card titles. |
| `headline` | 14/20 | 17/22 | semibold | Card titles, list titles. |
| `body` | 13/18 | 15/21 | regular | Body copy. |
| `callout` | 13/18 | 14/20 | regular | Web default: tables, sidebar items, buttons, inputs. |
| `footnote` | 12/16 | 13/18 | regular | Help text, metadata, menu items, segmented labels. |
| `caption` | 11/14 | 12/16 | semibold | Column heads, field labels, tags, sidebar section headers. |

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
| `space-2xl` | 16px | Gap between cards; card padding. |
| `space-3xl` | 20px | Web content gutter (desktop and phone). |
| `space-4xl` | 24px | Gap between sections in cards. |
| `space-5xl` | 32px | Large section spacing. |
| `space-6xl` | 64px | Page padding of documentation pages. |

## Shape

| Token | Desktop | Phone | Use |
| --- | --- | --- | --- |
| `radius-xs` | 4px | 6px | Tags, checkboxes, the select's trigger box, `kbd` hints, chart bar tops. |
| `radius-sm` | 6px | 8px | Every desktop control: buttons S/M/L, inputs, selects, search fields, segments, sidebar items, menu items. |
| `radius-md` | 8px | 12px | Containers of controls (toolbar groups, segmented tracks), tooltips, banners. |
| `radius-lg` | 10px | 16px | Cards, list cards, context menus, popovers, notifications. |
| `radius-xl` | 14px | 18px | Dialogs and sheets. |
| `radius-pill` | 999px (`rounded-full`) | | XL buttons, chips, segmented controls in the toolbar, toasts, all phone controls. |

- Desktop controls in S/M/L use `radius-sm`; **XL controls are pill**.
- **Concentric corners:** a container around controls is the inner radius plus
  its padding (`radius-sm` items + 2px track = `radius-md`; + 4px menu padding =
  `radius-lg`).
- **Search fields** are `radius-sm` bordered fields on desktop and pills on phones.
- No squircles (`corner-shape`) until every supported browser ships them.
- Phones: all controls are pill from the start and larger (min 44px tall);
  phone controls may use glass.

## Layout

Web: a 224px sidebar (edge-to-edge, `sidebar-bg`) beside the content, with the
48px frosted toolbar on top (64px on phones, plus a row for the scope control). Content has a 20px gutter and a
16px gap between cards.

- **Everything belongs somewhere.** Page actions, the period or scope control
  and its caption live in the toolbar. Hints, notes and empty values live inside
  the card they explain. Nothing sits loose between cards.
- **Composed, not stacked.** Desktop content is a grid of columns (2fr + 1fr,
  or 1fr + 1fr), not a full-width stack of equal cards. Cards in a row share
  their height. Phones stack the same cards in reading order.
- **One answer first.** A page leads with the one thing the user opened it for:
  a hero metric on an overview, the table on a list page, the form on an edit
  page. At most one `display` number per page.
- **Lists are flat rows inside one card**, never cards inside cards.

**Page types**, by shape:

| Type | Shape |
| --- | --- |
| Overview | Row 1: hero card (hero metric over its chart, 2fr) beside the most time-critical list (1fr). Row 2: a full-width metric strip. Row 3: a secondary chart beside the most recent items. |
| List | A metric strip with the list's totals, one filter row that scopes both the chart and the table, an optional chart, then one table card; a narrow side column only for related summaries. |
| Plan | A breakdown chart of where the whole flows, then the parts as a metric strip, then the editable items. |
| Settings | One column, max 720px, grouped lists; no metrics. |

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

Desktop sizes: S 24px, 12px · M 28px, 13px · L 32px, 13px, all `radius-sm` ·
XL 36px, pill, 14px; semibold throughout. Phone buttons are always pill: S/M
44px (14px), L 48px (15px), XL 56px (17px).

- One primary button per view, never for a destructive action.
- Label is a verb or verb phrase; optional leading 16px line icon (gap `space-sm`).
- Loading: a spinner replaces the icon, the label reads „Speichert …“.
- Icon-only buttons get an `aria-label`.
- Never white text on `brand-500`; never a coloured or outer shadow.

### Toolbar

One uniform frosted band across the top of the content area. 48px (64px on
phones), full content width, 1px `separator` below; content scrolls underneath,
and once it has, the band lifts to `shadow-e2`.
Icon actions sit in a `toolbar-fill` group (`radius-md`, pill on phones) as 28px
borderless buttons with 16px icons.

- **Max three groups:** leading = page title (`title-2`, ≤ 15 characters, never
  the app name), then the page's scope control (a period stepper or segmented
  control) and its caption in `footnote` `label-secondary` · trailing =
  borderless icon actions (Filter, Teilen, Mitteilungen) in one group, the search
  field, then the page's primary action last.
- When the band runs out of room the caption truncates first, then the title;
  controls never shrink.
- Phones: the caption is hidden and the scope control moves to a second row of
  the band, full width; the band grows by that row.
- The primary action is the page's one Primär M button (verb + 16px icon). It
  is the only orange control in the toolbar; on phones it becomes a 44px icon
  button.
- Icons over text; a text-labelled action stands apart from the icon actions.
- No native date inputs in the toolbar: periods step with chevrons.
- Every toolbar action is also reachable from a menu.
- The sidebar collapse button lives in the sidebar, not here.
- Flat variant: solid `bg` band + `separator`, fills `fill-strong`.

### SegmentedControl

2–5 closely related options that change the current view (Woche / Monat /
Quartal). Lives in the toolbar's leading group, or in content as a filter row.

- Text-only nouns in `footnote`; equal-width segments (≥ 72px on desktop, flex
  on phones), 24px tall with `radius-sm`, 2px track padding (40px segments on a
  48px track on phones).
- Track: pill on `toolbar-fill` in the toolbar; in content a flat `fill-strong`
  track with `radius-md`, concentric with the `radius-sm` segments.
- Selected: `segment-selected` + `shadow-segment`, semibold.
- Renders as `radiogroup` with `radio` segments.
- Not for navigation (that is the sidebar / tab bar); never mixes icons and text,
  or actions and selections.

### PeriodStepper

The toolbar's scope control for time: `‹ Oktober 2026 ›`. Steps one period back
or forward; periods never use a date input.

- 28px, `surface`, 1px `border-control`, `radius-sm`; two 26px chevron buttons
  (16px icons in `label-secondary`, `fill` on hover) set off by `separator`
  hairlines, around a fixed-min-width label in `callout` semibold.
- Each chevron has an `aria-label` („Vorherige Periode“); a step that does not
  exist is disabled (`label-disabled`). The label is announced when it changes.
- Phones: a 44px pill across the toolbar's scope row, 44px chevrons.

### Select

The full field shows the value; only the trigger on the right is an S secondary
icon button with a chevron-down.

- Field: 28px, `surface`, 1px `border-control`, `radius-sm`, padding 0 3px 0 10px,
  value in `callout` (phones: 44px pill). Label above in `caption`, linked with
  `aria-labelledby`.
- Trigger: 20×20px, `fill`, `radius-xs`, 12px chevron-down in `label` (phones:
  28px circle).
- Options open in a context-menu-styled list.
- States: focus = 2px `focus-ring` · error = `red-500` border + `danger-text`
  message · disabled = `bg` fill, `label-disabled`.
- Never make the whole dropdown a button; never use an up/down double chevron.

### SearchField

Leading 14px magnifier, placeholder „Suchen“ in `label-secondary`, text
`callout`, an `aria-label`. Desktop: a 28px `surface` field with a 1px
`border-control` edge and `radius-sm`, optional keyboard hint (⌘K) as a bordered
`radius-xs` `kbd` on the right; in the toolbar it sits just before the primary
action. Phones: a 44px pill on `fill`.

### Switch

On/off for settings that apply immediately. 32×18px pill track, 14px white knob
(51×31px with a 27px knob on phones); on = `brand-500` track, off = `fill-strong`
with a 1px inner `border-control` edge. Label on the left in `callout`,
switch on the right. Renders `role="switch"` with `aria-checked`.

- Not for actions that need a Save button (use a checkbox).
- No text inside the track.

### Sidebar and SidebarItem

- Container: 224px (56px collapsed), edge-to-edge (full height, no floating or
  inset, no shadow), `sidebar-bg`, 1px `separator` on the right. The 48px top
  row holds the logo, the app name and, right-aligned, the collapse button.
- Item: 28px tall, padding 0 8px, `radius-sm`, gap `space-sm`, 16px line icon,
  label `callout` 500 (active 600). Optional trailing count (`label-secondary`)
  or badge (`red-500`, white).
- **Icons `label-secondary`, text `label`.** Only the active item's icon is
  `brand-500`; never colour the active row or its text orange.
- Active = `fill-strong` background + semibold + `brand-500` icon +
  `aria-current="page"`.
- Section headers `caption` in `label-secondary`. Top-level destinations
  (the dashboard, single-page areas) sit first, without a header; a header only
  heads a group of several items.
- Every section header is a button that folds its section. Its 12px chevron
  shows on hover and focus and stays, turned left, while the section is folded.
- A long section splits into groups of related items. A group is a parent row
  (16px icon, label, trailing 12px chevron) whose items hang beneath it,
  indented to 32px along a 1px `separator` line under the parent's icon. The
  parent row folds the group. The section's everyday items come first, ungrouped.
- Folding animates the height once (150ms ease-out; none under reduced motion).
  Folded items are inert, so Tab skips them. Folded state is kept per device,
  and the section and group holding the current page always open.
- Collapsed rail: section headers become a 16px gap and sections never fold.
  A parent row is an icon that opens its items as a menu to its right, and it
  takes the active look while one of its items is the current page.
- On phones the view menu shows the same groups, each under a `caption` label
  with a separator between them.
- Favourites use a 10px status-coloured dot instead of an icon.

### ContextMenu

Glass menu for actions on the current item (right-click, "…" buttons, select
option lists).

- At least 200px wide, 4px padding, `radius-lg`, `shadow-e3`.
- Items 26px, `radius-sm`, `footnote` 500 in `label`, 14px icons; shortcuts
  right-aligned in `label-secondary`.
- Highlighted item `brand-500` + `on-brand`.
- Destructive action last, after a `separator`, in `danger-text`.
- Opens upward when there is no room below.
- Mobile: 48px items, radius 24px, pill highlights.
- Flat variant: solid `surface-floating`.

### Notification

Glass alert card top-right, below the toolbar, for important time-bound
information.

- 360px, padding 14px, radius 20px.
- App tile 36px (`brand-500`, radius 10px) or a status icon disc; title 14px
  semibold; time right in `label-secondary`; body `footnote`.
- Optional two actions (primary dark `label` fill + secondary `fill`) and dismiss.
- Persistent page-level states use a flat inline banner instead (-100 tint +
  -900 text, `radius-md`).
- Flat variant: solid `surface-floating`.

### Toast

Short-lived confirmation as a glass pill at the bottom centre of the content
area.

- Pill, padding 10px 18px 10px 12px.
- 22px status disc (success: `green-500` with a `green-900` check), one line in
  13px semibold (14px on phones), optional undo button (`fill`, pill, 28px).
- Auto-dismiss after ~4 s; `role="status"`.
- Flat variant: a solid inverse pill (light: `label` background with white text;
  dark: a light pill with `label` text).

### StatusBadge

- **Dots:** 8px + the word (see [Colour](#colour)).
- **Tags:** 1px 6px padding (3px 10px on phones), `radius-xs`, `caption`; -100 background, -700
  text: Erledigt green, In Arbeit blue, Wartet yellow, Blockiert red, Neu purple.
  Mobile risk chip: pill.
- **Counter badge:** `red-500` pill, white 12px bold, min 20px. Neutral counts are
  `label-secondary` text without a pill.
- Dark: keep the -500 dots; tags use the -500 at 20 % with -300 text (`clients/web/src/lib/tone.ts`).

### Metrics

A metric is a label, a number, and a supporting line or a meter. A page has two
kinds: one hero metric and metric strips.

- **Hero metric:** the page's one lead number. Label `callout` 500 in
  `label-secondary`, value `display`, one supporting line in `body`
  `label-secondary` with the key figure in `label` semibold. A status chip
  (warning tint) may sit top-right. Its chart follows directly under it in the
  same card.
- **Metric strip:** every other metric. Several metrics side by side are one
  card, cells divided by `separator` hairlines, never a row of separate cards.
  Each cell: an optional 26px icon tile + label `callout` 500 in `label`, value
  `kpi`, an optional `footnote` line in `label-secondary`, then an optional meter. Up to five cells on desktop; phones
  wrap to two columns with values at `title-2` size, and an odd last cell spans
  both. A strip may carry a card header.
- A negative value is `danger-text`, in the hero and in the strip.
- Meter: 6px pill, value `brand-500` on `meter-track`. An optional 1px `label`
  tick marks where the value should be by now.
- Never invent sample numbers in production; never colour the whole card.

### Charts

- **One series in colour.** The series the chart is about is `brand-500`;
  context (past periods, comparisons) is `chart-muted`, the still-running value
  `chart-muted-strong`. Categorical charts that must tell categories apart use
  the -500 scales (`blue`, `purple`, `green`, `yellow`), never more than five.
- **Over budget** is `danger-text`-coloured with an icon and a label, and never
  shares a chart with `brand-500`: the two are too close to tell apart.
- Lines 2px with round joins; a 10 % area fill under a single line at most.
  Bars ≤ 24px wide with `radius-xs` tops, square at a `separator` baseline.
- Grid: solid `separator` hairlines, 3–5 of them. Dashed lines only for a plan,
  budget or target reference, in `label-secondary`, labelled at its end. A
  reference that differs between columns is a short dash over each column, never
  a slope between them.
- Label selectively: the current value, the maximum, the reference. Text is
  `label` or `label-secondary`, never the series colour. Everything else is in
  a solid tooltip (`surface-floating`, `shadow-e3`, `radius-md`), value first,
  beside the hovered point so it never covers it.
- The tooltip follows the keyboard too: the plot is one tab stop, ←/→ move
  between points, Home/End jump to the ends, Esc hides it.
- Every chart has a text or table equivalent for screen readers.

### Sheets and dialogs

Solid `surface-floating` panels with `floating-border`, `shadow-e4` and
`radius-xl`, over the page dimmed to 30 % black (50 % in dark). A sheet slides
in from the right, inset 8px from the window edges; on phones it fills the
screen. Never glass.

A side panel that stays open beside the page while you work on it (a tray of
items to drag in) is the same solid surface at `shadow-e4`, with `radius-lg` and
no dimming.

### Tables and lists

Column heads `caption` in `label-secondary`, rows 36px (48px on phones),
`separator` hairlines, selected row = `fill` with `radius-md`. Card headers are
40px (48px on phones): `headline` title, an optional `link` text action on the
right. A list may end in a summary footer row on `fill` in `footnote`. Rows are
flat inside their one card; a card never contains another card.

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
  on Apple platforms, Fluent icons on Windows).

## Accessibility

- Text meets 4.5:1 on its grounds in both themes; control edges
  (`border-control`) meet 3:1.
- Focus: 2px solid `focus-ring`, offset 2px, on every focusable control.
- Touch targets ≥ 44px on mobile.
- Status is never colour-only.
- Floating layers keep a border and turn opaque under `forced-colors`.

## Native clients

- **iOS** (Apple HIG): large titles 30–34px (`large-title`); list rows 16px;
  cards `radius-xl`; chart bars may be capsules. The tab bar is navigation only,
  with search as a separate trailing tab; actions go into the top-right glass
  group or a bottom toolbar. Back button = round chevron without text. A filled
  icon only for the selected tab. Switch 51×31px.
- **macOS** (HIG, macOS 27 “Golden Gate” styling): cards `radius-lg`; toolbar
  60px with a 36px search field; the sidebar collapse button sits next to the
  window buttons.
- **Windows** (Fluent): Segoe UI Variable, Mica, 4/8px radii, NavigationView,
  CommandBar. Search sits in the title bar (Fluent style, not pill); a dropdown
  („Dieser Monat ▾“) replaces the segmented control.
- **Android**, when built, follows its platform.
