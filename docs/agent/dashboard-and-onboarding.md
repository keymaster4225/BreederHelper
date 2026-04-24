# Dashboard and Onboarding Rules

Use this when changing the home dashboard, alert behavior, onboarding, or first-run experience.

## Dashboard and First-Run Rules

- Dashboard alerts are derived from existing data. Do not add schema just to support dashboard cards.
- Alert generation should remain a pure function with explicit thresholds.
- Home screen should use bulk queries instead of per-mare N+1 fetches.
- Dashboard is collapsible and defaults to collapsed on app open.
- Alert navigation behavior is fixed:
  - due date alerts -> mare detail
  - pregnancy check alerts -> pregnancy check form
  - ovulation, heat, and stale log alerts -> daily log form
- The onboarding carousel is the primary first-run explanatory surface.
- After onboarding, an empty dashboard should stay minimal and action-focused rather than repeating onboarding copy.
- A populated dashboard should not add an extra top hero or `Daily board` section unless the user explicitly wants it.
- When animals already exist, dashboard loading should not block on async onboarding storage reads.
