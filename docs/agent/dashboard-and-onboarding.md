# Dashboard and Onboarding Rules

Use this when changing the home dashboard, task behavior, onboarding, or first-run experience.

## Dashboard and First-Run Rules

- Dashboard cards are persisted open tasks from the `tasks` table. Do not reintroduce inferred dashboard alerts for active dashboard behavior.
- Retained dashboard alert utilities are deprecated rollback/reference code only.
- Home screen should use bulk queries instead of per-mare N+1 fetches.
- Dashboard is collapsible and defaults to collapsed on app open.
- Task navigation behavior is fixed:
  - future or custom tasks -> task form
  - due or overdue daily-check tasks -> daily log form
  - due or overdue medication tasks -> medication form
  - due or overdue breeding tasks -> breeding record form
  - due or overdue pregnancy-check tasks -> pregnancy check form
- Successful workflow saves should complete the launching task when a `taskId` route param is present.
- The onboarding carousel is the primary first-run explanatory surface.
- After onboarding, an empty dashboard should stay minimal and action-focused rather than repeating onboarding copy.
- A populated dashboard should not add an extra top hero or `Daily board` section unless the user explicitly wants it.
- When animals already exist, dashboard loading should not block on async onboarding storage reads.
