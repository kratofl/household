---
name: design-system-sync
description: Keep docs/design-system/DESIGN.md, globals.css and the web components in agreement. Use when a web UI change alters a design-system rule — a token value, size, density, radius, depth/shadow, type style, or a component convention — rather than just applying the existing rules.
---

# Design system sync

`docs/design-system/DESIGN.md` is the single source of truth for how the web UI looks;
`clients/web/src/app/globals.css` holds its token values. A change that alters a rule
lands in all three places at once — doc, tokens, components — so the next change starts
from rules that describe the real UI.

The developer asking for a different look is the sign-off for changing the rule. A
one-off deviation nobody asked to become a rule is a question for the developer, not a
silent exception.

## Steps

1. **Name the rules.** Before editing, list every DESIGN.md rule the change touches
   (section and line: a token row, a component's sizes, a visual rule). Done when each
   visual property you will change maps to a named rule, or to "new rule".
2. **Classify.** The change either *applies* the rules (fixing a component to match them:
   no doc change, stop here) or *alters* them (new value, new token, new or retired
   convention: continue).
3. **Rewrite the rule.** Edit DESIGN.md where the rule lives so it states only the new
   behaviour — replace the old text, never append a second account. Keep tokens named,
   not raw values, in prose. If a rule is retired, delete it and every reference to it.
4. **Change the tokens.** Update `globals.css` for any value that has a token. A new
   value that is not a token yet becomes one, named in DESIGN.md beside its use.
5. **Sweep the components.** `rg` for the old class, value, and token across
   `clients/web/src` and update every use: shadcn primitives in `src/components/ui`,
   shared pieces in `src/components/app`, then feature pages. Done when the search for
   the old value returns only intentional uses you can name.
6. **Check the platform split.** DESIGN.md separates desktop web from mobile (larger,
   pill, ≥ 44px touch targets) and from native clients. Say which of those the altered
   rule covers, and leave the others' rules intact.

## Done

DESIGN.md, `globals.css` and the components agree: no DESIGN.md line describes the old
behaviour, and no component still carries it. `npm run lint` passes. In the hand-back,
list each rule you altered as old → new.
