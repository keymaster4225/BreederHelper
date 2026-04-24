# Domain and UX Decisions

Use this before changing persisted data behavior, date logic, breeding workflows, foaling/foal behavior, or established UI decisions.

## Data and Domain Invariants

- Local date storage is always canonical `YYYY-MM-DD`.
- UI may display alternate date formats, but persisted values stay canonical.
- Date arithmetic that affects breeding timelines must stay UTC-safe to avoid DST off-by-one errors.
- Foreign key behavior is intentionally restrictive (`ON DELETE RESTRICT`) to preserve relational integrity.
- Migration state is tracked in `schema_migrations`.
- Schema changes must ship with migration, repository, and type updates together.

## Current UX and Domain Decisions

Preserve these unless the user explicitly asks to change them:

- Stallion form does not show `registration #` in the UI.
- Mare DOB displays as `MM-DD-YYYY` in forms, while storage remains `YYYY-MM-DD`.
- Daily log `None` options for teasing and edema are labeled `N/A`.
- Daily log wizard ovary step uses `Follicle Size` numeric entry for both left and right ovaries (same input type on both sides).
- Follicle size validation allows `0-100` with up to one decimal place.
- Edit affordances use the pencil icon through `IconButton`.
- Frozen AI supports optional `Straw Volume (mL)`.
- `Straw Volume (mL)` is limited to an optional 2-digit integer (`0-99`).
- Foaling outcome options are `Live Foal`, `Stillbirth`, and `Aborted`. Do not reintroduce `Unknown`.
- Home screen `Pregnant` badge is derived from the latest positive pregnancy check and is not stored.
- Mare detail has five swipeable tabs plus a calendar button in the header card that opens `MareCalendarScreen`.
- Empty tab states on mare detail are text-only; the top `PrimaryButton` in each tab is the add action.
- Pregnancy check cards show days post-ovulation when an ovulation log exists on or before the check date, and estimated due date only for positive results.
- `findMostRecentOvulationDate` should keep scanning for the latest ovulation on or before the target date.
- Breeding method display formatting lives in `src/utils/outcomeDisplay.ts`.
- Foal records are linked 1:1 to foaling records via `foaling_record_id` uniqueness.
- Foal name is optional; unnamed foals display as `Unnamed foal`.
- Live foal cards navigate to the foal form; non-live-foal cards do not.
- The pencil icon on foaling cards edits the foaling record, not the foal.
- Foal milestones are stored as JSON text in `milestones` and validated by `parseFoalMilestones`.
- `placentaPassed` is a mare event and is not part of foal milestones.
- Foal sex initializes from `FoalingRecord.foalSex` on create and does not back-sync on edit.
- Milestone `recordedAt` timestamps are set on first check and preserved on later edits.
- Deleting a foaling record is proactively blocked when a foal exists.
- Changing a foaling outcome away from `liveFoal` is blocked when a foal record exists.
- Display helpers for foal color, foal sex, and milestone labels live in utilities rather than UI components.
