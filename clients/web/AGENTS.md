<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Household Web UI Rules

- Use shadcn/ui primitives from `src/components/ui` and shared local wrappers for buttons, inputs, selects, alerts, cards, tabs, navigation, and forms. Do not rebuild common controls directly inside pages or feature views.
- Put reusable UI patterns in shared component files before using them in multiple feature pages.
- Dashboard subnavigation belongs in the sidebar as proper nested dashboard navigation. Do not add slice subnavigation as loose page-level button rows or content tabs unless explicitly requested.
- Do not render an "Active slices" section/card/list in the main UI. Active modules decide visibility and navigation only.
- Do not duplicate Account and Admin Settings as competing controls in both header and sidebar. Keep a single clear navigation model.
- Use a readable primary app font. Avoid decorative serif/display fonts as the global UI font.
- Account and Admin Settings must use the same dashboard/settings visual language as the rest of the app; avoid temporary-looking card piles.
