# Webix Design System

## Platform strategy

- **Web is the primary CI.** It follows an Apple look (macOS / Apple web apps): system font, calm neutrals, flat content, Liquid Glass only on floating chrome. Never use Material Design patterns (FABs with elevation, ripple, filled text fields, app bars with shadows).
- **Native apps follow their platform.** iOS and macOS follow Apple's HIG (macOS 27 “Golden Gate” styling), Windows follows Fluent (Segoe UI Variable, Mica, 4/8px radii, NavigationView, CommandBar). Android, when built, follows its platform too. Only the brand tokens (`brand-500`, status colours, content) carry across; component shapes are native.
- Every surface ships **light and dark** (`light` / `dark` themes).

## Visual foundations

### Flat first, glass on chrome

- Content is flat: cards (`surface` on `bg`), lists, tables, inputs, buttons, sidebar – `shadow-none`, no gradients.
- **Liquid Glass only on:** context menus, the toolbar, alerts/notifications, toasts (plus popovers and dialogs). Glass = `glass-bg` (55 % opacity) + `backdrop-filter: blur(var(--glass-blur)) saturate(180%)` + `1px solid var(--glass-border)` + `shadow-glass` (inner specular `glass-highlight`).
- The **toolbar is one uniform frosted band** across the content area (`toolbar-bg`, `toolbar-blur`, `separator` underneath). Controls inside it sit on subtle fills (rgba black 5 %), not on separate glass capsules.
- **Flat fallback:** with `prefers-reduced-transparency: reduce` or no `backdrop-filter` support, glass becomes `surface` + `1px solid var(--border)`, no blur, no shadow. The flat variant is a complete, supported option.
- **Buttons never glow.** No coloured or outer shadows on buttons – ever.

### Colour

- `brand-500` is the only brand colour. Use it for the primary button, active icons, progress, the highlighted chart bar and the menu highlight. Text on it is always `on-brand` (dark) – white on orange fails contrast.
- Brand as text uses `link` / `brand-700` (never `brand-500` on white).
- Neutrals: page `bg`, cards `surface`, secondary fills `fill`, active sidebar item `fill-strong`, hairlines `separator`, control borders `border`. Text `label`, secondary `label-secondary`.
- Status: dot + word, never colour alone – `green-500` Aktiv, `blue-500` Review, `yellow-500` Pausiert, `red-500` Risiko. Status text uses the -700 step (`success-text`, `danger-text` in dark).
- Tints (-100) are backgrounds for tags and inline banners; text on them uses -900.
- Charts: series in `brand-500` at `track-tint` alpha, the highlighted value in full `brand-500`; team series in `blue-500`, `purple-500`, `green-500`, `yellow-500`.

### Type

- One family: `sans` (SF Pro on Apple devices, Figtree elsewhere).
- Web: page title `title-2` in the toolbar, card titles `headline`, tables/sidebar/buttons `callout`, labels/column heads `caption`, metadata `footnote`. KPI numbers 32px bold.
- iOS: large titles 30–34px (`large-title`), list rows 16px.

### Shape

- Desktop controls in S/M/L use `radius-sm` / `radius-md`; **XL controls become `radius-pill`**.
- **Search fields are always `radius-pill`** when they stand alone.
- Cards: `radius-xl` (web, iOS), `radius-lg` (macOS). Chips, toasts, toolbar groups and segmented controls in the toolbar: `radius-pill`.
- Chart bars: `radius-xs` on top only, square at the baseline, with a `separator` baseline. (iOS may use capsule bars.)
- Mobile: all controls are pill from the start and larger (min 44px tall); mobile controls may use glass.

### Spacing & layout

- Component internals: `space-xs`–`space-xl`. Layout: `space-2xl` between cards, `space-3xl` card padding, `space-4xl` content gutter.
- Web layout: 256px sidebar (edge-to-edge, `sidebar-bg`) + content with the frosted toolbar on top (64px), KPI row, charts, list.

## Components (rules)

- **Buttons:** Primär (`brand-500` + `on-brand`), Sekundär (`fill`), Umrandet (`surface` + `border`), Text (`link`), Löschen (`red-100` + `red-700`). Sizes S 28px / M 40px / L 48px / XL 56px pill. One primary button per view. No glow.
- **Toolbar (HIG):** max three groups – leading (page title), center (segmented control for view options), trailing (icon actions + search last). Prefer borderless symbols; a text-labelled action stays separated. Every toolbar action also exists in a menu.
- **Segmented control:** closely related view options only (Woche/Monat/Quartal), text-only, equal-width segments, selected = `segment-selected` + `shadow-segment`. Not for navigation.
- **Select / dropdown:** full field (`surface`, `border`, `radius-md`) with the value on the left; the trigger on the right is an **S secondary icon button** (28px, `fill`, `radius-sm`) with a chevron-down.
- **Search field:** pill, `fill` background (in the toolbar: 5 % black), magnifier left.
- **Sidebar (web/macOS):** collapse button in the sidebar's top row (right). Items 36px, `radius-md`/10px; active = `fill-strong` background + semibold text; **icons always `brand-500`, text always `label`** (active and inactive). Section headers `caption` in `label-secondary`.
- **Context menu:** glass, 6px padding, 28–30px items, highlighted item `brand-500` + `on-brand`, destructive last in `danger-text`, shortcuts right in `label-secondary`.
- **Notification / alert:** glass card top-right, app tile + `headline` title + `footnote` body.
- **Toast:** glass pill at bottom centre, status icon + one line (+ optional undo).
- **Tables / lists:** column heads `caption` `label-secondary`, rows 48–50px, `separator` hairlines, selected row = `fill` with `radius-md`.
- **Mobile (iOS):** tab bar is navigation only (no actions) with a separate trailing search tab; actions go into the top-right glass group or a bottom toolbar; back button = round chevron without text.

## Content

- UI language German, informal (du): „Lege dein erstes Projekt an“, „Prüfe den Umfang“.
- Short labels, nouns for segments („Woche“, „Monat“), verbs for actions („Exportieren“, „Neues Projekt“). No emoji.

## Iconography

- Line icons on a 24px grid, 1.8px stroke (2px at 16px), round caps and joins, `currentColor`. Filled variant only for the selected iOS tab.
- No brand icon set yet – use a consistent stroke set (e.g. SF Symbols on Apple platforms, Fluent icons on Windows) and keep sidebar icons in `brand-500`.

## Accessibility

- Text meets 4.5:1 on its grounds in both themes; `label-secondary` is the lightest allowed text colour.
- Focus: 2px solid `focus-ring` offset 2px on every focusable control.
- Touch targets ≥ 44px on mobile; status is never colour-only.

---

# Components

## Button

Flat action button in five variants and four sizes; the primary button is `brand-500` with `on-brand` text and never glows.

**Variants:** Primär `brand-500`/`on-brand` · Sekundär `fill`/`label` · Umrandet `surface` + 1px `border` · Text transparent/`link` · Löschen `red-100`/`red-700` · Deaktiviert `fill`/`label-disabled`.

**Sizes (desktop):** S 28px, `radius-sm`, 12px semibold · M 40px, `radius-md`, 14px semibold · L 48px, `radius-md`, 15px · XL 56px, `radius-pill`, 17px. Mobile buttons are always pill and ≥ 44px.

**Consumer provides:** label (verb or verb phrase, German, e.g. „Neues Projekt“), optional leading 16px line icon (gap `space-sm`), `disabled`, loading state (spinner replaces icon, label „Speichert …“).

**Do:** one primary per view · icon-only buttons get an `aria-label` · 2px `focus-ring`.
**Don't:** coloured or outer shadows (no glow) · white text on `brand-500` · a primary button for destructive actions.

## SearchField

Stand-alone search input that is always pill-shaped (`radius-pill`) with a leading magnifier.

**Spec:** 40px tall (36px in macOS toolbars), `fill` background (inside the frosted toolbar: rgba(0,0,0,0.05)), padding `space-xl`, placeholder „Suchen“ in `label-secondary`, text `callout`.

**Placement:** trailing end of the toolbar (last item) on web and macOS; on Windows in the title bar (Fluent style, not pill); on iOS as a separate trailing search tab.

**Consumer provides:** placeholder, value, `aria-label`, optional keyboard hint (⌘K) as a pill `kbd` on the right.

**Don't:** square or medium-rounded search fields in the web CI.

## Select

Dropdown field: the full field shows the value, and only the trigger on the right is an S secondary icon button with a chevron-down.

**Spec:** field 40px, `surface`, 1px `border`, `radius-md`, padding 0 5px 0 `space-lg`, value in `callout`. Trigger: 28×28px, `fill`, `radius-sm`, 12px chevron-down in `label`. Label above in `caption`/13px semibold.

**States:** focus = 2px `focus-ring` · error = `red-500` border + `danger-text` message · disabled = `bg` fill, `label-disabled`.

**Consumer provides:** label, value, options (opens a context menu styled list), `aria-labelledby`.

**Don't:** make the whole dropdown a button · use an up/down double chevron.

## SegmentedControl

Choice between 2–5 closely related options that change the current view (e.g. Woche / Monat / Quartal).

**Spec:** pill track (`radius-pill`, in the toolbar rgba(0,0,0,0.05), in content `fill-strong`), 4px padding, equal-width segments (≈84–88px desktop, flex on mobile), 32px tall (48px track on mobile), text-only nouns in `footnote`. Selected: `segment-selected` + `shadow-segment`, semibold.

**Placement:** centre group of the toolbar (web, macOS). Windows uses a dropdown instead („Dieser Monat ▾“).

**Consumer provides:** options, selected value, `aria-label`; renders as `radiogroup` with `radio` segments.

**Don't:** mix icons and text · use for app navigation (that is the sidebar / tab bar) · mix actions and selections in one control.

## Switch

On/off toggle for settings that apply immediately.

**Spec:** 44×26px pill track, 22px white knob; on = `brand-500` track, off = `fill-strong`. Label on the left in `callout`, switch on the right. Mobile: 51×31px.

**Consumer provides:** label, checked state, change handler; renders `role="switch"` with `aria-checked`.

**Don't:** use for actions that need a Save button (use a checkbox) · put text inside the track.

## SidebarItem

Navigation row in the web/macOS sidebar: icon always `brand-500`, text always `label`, the active row on a light-grey fill.

**Spec:** 36px tall, padding 0 10px, radius 10px, gap `space-md`, 18px line icon in `brand-500`, label `callout` 500 (active 600). Active = `fill-strong` background + `aria-current="page"`. Optional trailing count (`label-secondary`) or badge (`red-500`, white). Section headers `caption` in `label-secondary`. Favourites use a 10px status-coloured dot instead of an icon.

**Sidebar container:** 256px, edge-to-edge (full height, no floating/inset, no shadow), `sidebar-bg`, 1px `separator` on the right. The collapse button sits in the sidebar's top row, right-aligned (macOS: next to the window buttons).

**Consumer provides:** icon, label, href, active state, optional count/badge.

**Don't:** colour the active row orange · grey out icons of inactive rows.

## Toolbar

One uniform frosted band across the top of the content area, grouped per Apple HIG into leading, centre and trailing.

**Spec:** 64px (macOS 60px), full content width, `toolbar-bg` + `backdrop-filter: blur(var(--toolbar-blur)) saturate(180%)`, 1px `separator` below; content scrolls underneath. Controls inside sit on rgba(0,0,0,0.05) pill fills (dark: rgba(255,255,255,0.08)).

**Groups (max three):** leading = page title (`title-2`, ≤ 15 characters, never the app name) · centre = segmented control for view options · trailing = borderless icon actions (Neu, Filter, Teilen, Mitteilungen) in one pill group, then the search field last.

**Rules:** icons over text; a text-labelled action is separated from icon actions; no tinted/orange controls in the toolbar; every action is also reachable from a menu. The sidebar collapse button lives in the sidebar, not here.

**Flat variant:** solid `bg` band + `separator`, fills `fill-strong`.

## ContextMenu

Liquid Glass menu for actions on the current item (right-click, "…" buttons, select option lists).

**Spec:** 220–240px wide, 6px padding, radius 14px, `glass-bg` + blur `glass-blur` + 1px `glass-border` + `shadow-glass`. Items 28–30px, `radius-sm`, `footnote` 500 in `label`; highlighted item `brand-500` + `on-brand`; shortcut right-aligned. Destructive action last, after a `separator`, in `danger-text`. Mobile: 48px items, radius 24px, pill highlights.

**Consumer provides:** items (label, optional icon/shortcut, destructive flag), anchor position; opens upward when there is no room below.

**Flat variant:** `surface` + 1px `border`, no blur/shadow.

## Notification

Glass alert card that appears top-right (below the toolbar) for important, time-bound information.

**Spec:** 360px, padding 14px, radius 20px, glass (`glass-bg`, `glass-blur`, `glass-border`, `shadow-glass`). App tile 36px (`brand-500`, radius 10px) or a status icon disc, title 14px semibold, time right in `label-secondary`, body `footnote`. Optional two actions (primary dark/`label` fill + secondary `fill`).

**Inline alternative:** for persistent page-level states use a flat inline banner (-100 tint + -900 text, `radius-md`).

**Consumer provides:** title, body, time, icon/tile, optional actions, dismiss.

**Flat variant:** `surface` + 1px `border`.

## Toast

Short-lived confirmation as a glass pill at the bottom centre of the content area.

**Spec:** `radius-pill`, padding 10px 18px 10px 12px, glass (`glass-bg`, `glass-blur`, `glass-border`, `shadow-glass`). 22px status disc (success `green-500` with `green-900` check), one line in 14px semibold, optional undo button (`fill`, pill, 28px). Auto-dismiss after ~4 s; `role="status"`.

**Consumer provides:** message, status, optional action.

**Flat variant:** solid inverse pill (light: `label` background with white text; dark: `bg`-light pill with `label` text).

## StatusBadge

Project and task status as a coloured dot plus a word, or as a tinted tag; counters as red pills.

**Status dots (8px + label):** Aktiv `green-500` · Review `blue-500` · Pausiert `yellow-500` · Risiko `red-500`. Always with the word – colour alone never carries meaning.

**Tags:** 3px 10px padding, `radius-xs`, `caption`; background -100 tint, text -700 (Erledigt green, In Arbeit blue, Wartet yellow, Blockiert red, Neu purple). Mobile risk chip: pill.

**Counter badge:** `red-500` pill, white 12px bold, min 20px; neutral counts in `label-secondary` text without a pill.

**Consumer provides:** status key, label, optional count.

**Note:** in dark mode keep the -500 dots; tags use darker tints (e.g. rgba of the -500 at 20 %) with light text.

## KpiCard

Flat metric card: label, large number, and either a delta line or a meter.

**Spec:** `surface` on `bg`, `radius-xl` (macOS `radius-lg` + 1px `separator`), padding 18px 20px, no shadow. Label 13px `label-secondary`; value 32px bold, letter-spacing -0.03em (mobile 28px); delta 12px semibold in `success-text` / `danger-text`; meter 6px pill, track `fill`, value `brand-500` (budget) or `blue-500` (utilisation).

**Layout:** four in a row on desktop (gap `space-2xl`), 2×2 on mobile.

**Consumer provides:** label, value, unit, delta (with direction) or percentage.

**Don't:** invent sample numbers in production · colour the whole card.
