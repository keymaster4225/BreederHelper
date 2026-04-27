# Adversarial Review: Breeding Record Timestamps Implementation Plan

**Reviewing:** `docs/plans/2026-04-26-breeding-record-timestamps-implementation-plan.md`
**Date:** 2026-04-26

**Verdict:** Architecturally sound and well-grounded in the existing codebase, but the plan ducks several decisions where the existing daily-log precedent and the breeding-record domain diverge. About 8 substantive issues need locking down before code is written, plus 4 test/coverage gaps and 2 sequencing concerns. The plan calls itself "ready for implementation" but it is not — at least three of the assumptions below will produce silent bugs if implemented as written.

---

## Substantive issues (must address before coding)

### 1. The CHECK constraint diverges from migration024's daily-log precedent — you'll silently lose canonicalization

The plan says (line 52): *"This work should extend the existing daily-log time conventions instead of creating a separate time format,"* then immediately invents a different CHECK constraint shape:

```
time IS NULL OR time GLOB '[0-2][0-9]:[0-5][0-9]'
plus an hour guard so 24:00 through 29:59 are rejected
```

But daily_logs (`migrations/index.ts:1019-1027`) uses:

```sql
CHECK (
  time IS NULL OR (
    length(time) = 5
    AND substr(time, 3, 1) = ':'
    AND substr(time, 1, 2) BETWEEN '00' AND '23'
    AND substr(time, 4, 2) BETWEEN '00' AND '59'
  )
)
```

This matters because:
- The "hour guard" syntax is unspecified, so each implementer will write a slightly different SQL fragment.
- The migration tests already use `tableDefinitionIncludesAll(...)` regex matching to verify the canonical shape (see `migration016` shouldSkip at line 1283-1304). If breeding_records uses one CHECK and daily_logs uses another, the canonicalization tooling has nothing to converge against. The plan's own acceptance criterion ("Fresh install and upgraded install converge on the same table definition") becomes unverifiable.
- `'[0-2][0-9]'` matches `00–29`, not `00–23`. The follow-up "hour guard" is required, not optional. If the implementer forgets it, `24:00` silently passes the CHECK.

**Fix:** Mandate the exact daily-log CHECK syntax, copy-pasted, with `time` substituted. Don't reinvent.

### 2. "Required time on edit for already-timed records" is a state trap with no escape

> *"Edit mode requires a valid time when the loaded record was timed."*
> *"Editing an already timed record requires a valid time."*

A user enters `09:30` for a record that should be `09:35`. They tap "edit," select the time field, and hit "Clear." The form rejects save. There is no way to remove a time once added — even if it was added in error. The plan offers no rationale for the strictness.

Either:
- (a) Allow clearing a timed record back to `null` with confirmation. Most users will expect this.
- (b) Keep strict, but justify why ("data quality once entered, time is never removed") and document the workaround (delete + recreate).

Pick one and write it down. The plan currently picks (b) implicitly with no recourse.

### 3. Collection wizard "current-time default" is wrong for back-dated allocations

Task 5: *"Collection wizard on-farm allocation should use the collection workflow's selected date plus a current-time default unless the workflow already has a better time source."*

`collectionWizard.insertOnFarmAllocation` (line 297) uses `row.eventDate` for the breeding date. That date is frequently back-dated — a vet enters yesterday's collection at 9 a.m. today. With this rule, every allocation gets stamped with `now()`, producing rows like `2026-04-25 14:30` for an insemination that actually happened at `2026-04-25 09:00`.

Real risks:
- Misleading clinical record. Time-of-day affects breeding decisions; entering 14:30 when actual was 09:00 is worse than no time at all.
- Across DST boundaries or near midnight, `now()` may not even fall on `eventDate`.
- Tests that "use deterministic fixture times" (per the plan) will silently mask this in CI.

Real options:
- (a) Wizard prompts for time per allocation, same as the form.
- (b) Default to `12:00` for back-dated allocations (sentinel meaning "unknown time").
- (c) Default to `null` (legacy untimed) and let the user edit.
- (d) Detect today vs. back-dated and only auto-fill on today.

Plan picks (a-but-handwaved): "unless the workflow already has a better time source." Decide.

### 4. Same-day picker labels are unspecified — and the plan has already excluded duplicate prevention

> Non-Goals: *"Do not add same-day duplicate prevention."*
> Task 9: *"Make pregnancy-check picker labels distinguish same-day records."*

Today the label is (`PregnancyCheckFormScreen.tsx:77`):

```
${record.date} - ${record.stallionName ?? 'Unknown'} (${record.method})
```

Two records on the same date for the same stallion+method (allowed since duplicates aren't prevented) collapse to identical labels. "Distinguish" with what — the time? The collection ID? A counter `(1 of 2)`? The plan doesn't say, so the implementer guesses. Same hand-wave the breeding-event-detail review called out at issue 10.

Specify the exact label format for both timed and untimed cases. Suggested:
- Timed: `2026-04-26 09:30 — Brego (Frozen AI)`
- Untimed: `2026-04-26 — Brego (Frozen AI) — Untimed`
- Same-day timed + untimed mix: as above (the `Untimed` suffix breaks the tie).

### 5. SQL `ORDER BY` and the JS comparator must be byte-for-byte identical, with a test

Plan (Task 4): *"Prefer SQL ordering that matches the shared comparator: `ORDER BY date DESC, time IS NULL ASC, time DESC, created_at DESC, id DESC`."*

"Prefer" is too weak. If SQL ordering and the in-memory comparator drift, you get nondeterministic ordering on any code path that re-sorts (timeline events, dashboard alerts, calendar selected-day). Daily logs already have the same risk and `compareDailyLogsDesc` is invoked in several places — the parallel hasn't been audited.

Also, `time IS NULL ASC`: SQLite evaluates `IS NULL` as 0/1, and `ASC` puts 0 (false, i.e., timed) first. That matches the plan's stated intent ("timed rows before untimed rows"), but it's confusingly written. Half of code reviewers will call this out as a bug; half will let it through. Lock in either:
- `ORDER BY date DESC, (time IS NULL), time DESC, created_at DESC, id DESC` (NULL-tracking via boolean cast, default ASC = false-first), OR
- `ORDER BY date DESC, time DESC NULLS LAST, ...` (more readable; verify SQLite version supports it).

**Add a test** that fabricates 4 same-day records (timed-late, timed-early, null-A, null-B with different `created_at`/`id`) and asserts both the SQL query and the comparator return the same order.

### 6. Backup type evolution doesn't follow the existing `BackupDailyLogRow` precedent

Task 6: *"Add `time: string | null` to the current `BackupBreedingRecordRow`."*

But `BackupBreedingRecordRow` is currently a single, flat type used by every envelope V1 → V9 (`backup/types.ts:400-505`). Daily logs solved the same problem differently:

```
BackupDailyLogRowLegacy → BackupDailyLogRowV4 → BackupDailyLogRowV7
```

…with each envelope pointing to the version-appropriate shape. If you bolt `time: string | null` onto the unified `BackupBreedingRecordRow`, every existing test fixture that builds a V1–V9 envelope must be updated to include `time: null`, and all the envelope V1–V9 type aliases now claim that v1 backups can have a `time` field — they cannot.

**Fix:** Mirror the daily-log evolution. Add `BackupBreedingRecordRowLegacy` (current shape, no time) for V1–V9. Add `BackupBreedingRecordRowV10 = BackupBreedingRecordRowLegacy & { time: string | null }`. Make the V10 envelope point to V10; keep V1–V9 pointing at Legacy. The normalize step in `restore.ts` (currently around line 781-849, missing here for breeding records) must add `normalizePreV10BreedingRecordRow` that injects `time: null`. Plan does not mention this normalize step.

### 7. The plan keeps both old and new index sets without justification

Task 3 lists four indexes:
- `idx_breeding_records_mare_date` (existing)
- `idx_breeding_records_stallion_date` (existing)
- `idx_breeding_records_mare_date_time` (new)
- `idx_breeding_records_stallion_date_time` (new)

Two superset indexes covering the same prefix. SQLite's planner won't always pick the best one, write cost doubles, and the older indexes become dead weight after the new ones land. Either:
- Drop the old indexes (the new ones cover the same prefix).
- Justify keeping both with a query that benefits from the date-only index.

The plan picks "keep both" by silence.

### 8. `BackupBreedingRecordRow` is inserted by `restore.ts:401` via raw SQL — the plan must explicitly update that INSERT

The plan's Task 6 lists `restore.ts` in the file list but the bullets only cover serialization and validation. The actual `insertBreedingRecord` SQL at line 401-447 has 17 placeholders for 17 columns; you'll need 18. Skim readers will miss this. Make the bullet explicit: *"Add `time` to the INSERT column list, placeholder list, and parameter array in `insertBreedingRecord`."*

---

## Test coverage gaps

**T1.** Migration test for **empty-string time** (`time = ''`) being rejected by the CHECK. Daily-log `length(time) = 5` rejects this; the plan's GLOB might or might not, depending on the unspecified hour-guard syntax.

**T2.** Repository test for `createBreedingRecord` with `time = ''` and `time = '8:00'` (invalid: missing leading zero) and `time = '08:00 '` (whitespace). The plan only mentions "null/empty/invalid"; spell out the specific rejected forms.

**T3.** Backup test for **same-day pair in a v9 backup** restored to v10 — both records arrive untimed; subsequent edits preserve null on each. This is the migration's most realistic stress test and the plan only mentions a single record.

**T4.** Calendar test: two breeding records on the same date show the correct number of dots/markers. Plan says calendar marking is "day-based" — confirm with a test instead of leaving it as an "if event count or same-day order assumptions require it" condition.

---

## Sequencing / scope

**S1. Photos V1 also targets backup v10.** The plan acknowledges this with: *"if this feature lands first, Photos V1 must rebase to `v11`."* Both plans were authored on the same day. Whoever lands second eats the rebase. Pick a winner now or coordinate a single bumped V10 schema that includes both. The current footnote doesn't resolve the conflict; it just shifts blame to whoever is unlucky.

**S2. Wave 4 (form UI) and Wave 5 (display) should ship in one PR.** Splitting them creates a window where new records have time but no consumer renders it — every PR review will flag "why isn't the time visible?" The current six-wave breakdown overstates the independence.

---

## Smaller things worth fixing

- **Plan refers to `useClockDisplayMode`.** It exists, but the file is `src/hooks/useClockPreference.tsx` and `useClockDisplayMode` is one of two exports. Reference the file, not just the symbol — it's where someone reading the plan looks first.
- **Plan says "preserve all current columns and foreign keys: collection_id references semen_collections(id) with restrictive behavior."** The current FK is `ON UPDATE CASCADE ON DELETE RESTRICT` (migration015 line 503). Naming the rule explicitly avoids the implementer dropping CASCADE by accident in the table rebuild.
- **No mention of how `useBreedingEventDetail` consumes `record.time`.** Hook test will need updating (Task 9 only lists the screen). Easy miss.
- **DST/timezone not explicitly addressed.** Stating "all times are naïve local; export/import preserves the literal HH:MM with no timezone shift" prevents a future maintainer from "fixing" it.
- **No backfill UX for legacy untimed records.** Acceptable, but worth a one-line note that per-record edit is the only path.

---

## What's solid

- Domain calculations (DPO, foaling estimate, ovulation lookup) staying date-based is correct.
- Backup version bump is correctly identified, not skipped.
- Naming `compareBreedingRecordsDesc` and the date/time tuple sort key matches the daily-log precedent.
- Locked Implementation Assumptions section is genuinely useful — pin down the rest of the open decisions there too.

---

## Recommendation

Address issues **1, 2, 3, 4, 5, 6** before any code is written. Issues 7, 8 and the test gaps can be folded into the implementation. Don't ship Wave 1 until the CHECK syntax is locked to match daily_logs verbatim and the backup type evolution mirrors the existing `BackupDailyLogRow` ladder. Coordinate v10 ownership with Photos V1 today, not at the merge conflict.
