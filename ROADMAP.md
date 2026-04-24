# BreedWise Roadmap

> Last updated: 2026-04-23
>
> This document is the prioritized plan for BreedWise. The flat `TODO` file is now a raw inbox — new ideas get dumped there, then triaged into this roadmap during a periodic sweep. See [Intake & triage process](#intake--triage-process).

---

## How to read this

- Features are grouped into **themes**. Themes keep related work visible together so sequencing decisions can account for shared surfaces (e.g. anything touching the daily-log wizard).
- Within each theme, items are tagged:
  - **P0** — do next. At most 1-2 P0s across the whole roadmap at any time.
  - **P1** — queued; ready to start once a P0 ships.
  - **P2** — parked but tracked. Needs more design, more user signal, or is blocked on something else.
- **Currently building** names the single in-flight effort. If nothing is actively in progress, that section says so.
- **Engineering health** is separate from feature themes on purpose — it lets tech-debt items stay visible without competing for feature-priority slots.
- Canonical domain reference: [`mare-tracker-spec.md`](./mare-tracker-spec.md). Implementation conventions: [`CLAUDE.md`](./CLAUDE.md).

---

## Currently building

*Nothing actively in flight on `main`.* Last shipped work was multiple daily checks per mare (merged 2026-04-23, commit `710ad97`).

The `feature/collection-wizard` branch exists but has not been merged — its current state should be reviewed before picking up new work, in case it's stale or supersedable.

---

## Themes

### Theme: Mare care depth

Features that deepen mare reproductive recordkeeping beyond what the current daily log + pregnancy check flow captures.

- **P0 — Cyst mapping** (`TODO:29`)
  Recurring user ask. Needs a design pass: how cysts are located on the uterus, how they're tracked over time, and whether they live on the daily log or as a separate longitudinal record.
- **P1 — Fluid tracking** (`TODO:11`)
  Not yet scoped. Needs a detail workshop — which fluids, where in the workflow they're recorded, and what actions the app should prompt (see related P2 under *Proactive workflow*).
- **P1 — Breeding record timestamps**
  Add a time field to breeding records, like timed daily log checks, so same-day services can be recorded and ordered accurately. Open question: whether time should be required on new records or optional for backward compatibility with existing breeding entries.
- **P2 — Mare ovulation trends** (`TODO:19`)
  Analytics view. Blocked on data volume — needs enough historical ovulation logs per mare to be useful.

### Theme: Stallion depth

Features that extend stallion records beyond current collection + frozen batch tracking.

- **P1 — Outside-mare breeding records from stallion section**
  Allow recording a breeding against a stallion without requiring the mare to exist in the database. Use case: the user is the stallion owner and an outside mare arrives to be bred — they want to log the service without creating a full mare record. Design questions: (a) minimum fields to capture for an outside mare (name? owner? registration?), (b) whether the record can later be "upgraded" / linked if that mare is eventually added to the database, (c) how outside-mare services render on the stallion's breeding history alongside mare-linked records, (d) whether straw-consumption tracking and fertility-trend analytics include these records or only in-database services.
- **P1 — Stallion fertility trends** (`TODO:17`)
  Analytics view. Like mare ovulation trends, benefits from accumulated data — but the per-stallion slice may be useful sooner because a single stallion covers many mares.
- **P1 — Frozen semen straw consumption** (`TODO:7`)
  Decrement `strawsRemaining` on a batch when straws are used in a breeding record. Currently inventory is tracked at batch level but not debited on use.
- **P2 — Frozen semen low-inventory alerts** (`TODO:9`)
  Dashboard alert when a batch drops below a configurable threshold. Depends on consumption tracking above.
- **P2 — Frozen semen bulk-edit / multi-batch operations** (`TODO:15`)
  UX for managing multiple batches at once (e.g. moving many to a different tank).
- **P2 — Stallion hub Phase 3**
  Meds/health tab, home-screen stallion section, per-stallion analytics surface. Carries over from the earlier stallion-hub planning memory.

### Theme: Proactive workflow

Features that make the app tell the user what to do next, rather than only recording what the user already did.

- **P0 — In-app reminders** (`TODO:23`)
  User-set reminders for next scan, next meds dose, etc. Foundational: later features (smart prompts, auto-scheduled events) build on the reminder primitive.
- **P1 — Auto-scheduled events from recorded actions** (`TODO:27`)
  Recording a breeding → auto-adds 14-day and 30-day pregnancy checks. Recording a foaling → auto-adds IgG test, first vet check. Depends on reminders being in place.
- **P2 — Conditional smart prompts** (`TODO:25`)
  Example: fluid detected on a daily log → prompt user to flush/infuse. Needs design — which conditions, how prompts are delivered, how they're dismissed. Depends on fluid tracking shipping first.

### Theme: Media & attachments

- **P1 — Photos on mares, foals, and ultrasound screen** (`TODO:21`)
  Scope decision needed up front: per-entity single photo vs photo gallery, local-only vs synced. Storage approach should be decided before implementation.
- **P1 — Daily log photo attachments**
  Let users attach one or more pictures at the end of the daily log workflow, alongside the free-text `Notes` field. Open questions: whether this is a simple gallery per log or a broader attachment model, and whether photos stay local-only or need future sync support.

### Theme: Scheduling & visibility

- **P1 — Calendar-at-a-glance across all mares** (`TODO:13`)
  Visual design is the main unknown. Existing per-mare `MareCalendarScreen` is the starting point.
- **P2 — 12h / 24h clock toggle** (`TODO:1`)
  Global setting. Small scope once a settings-screen pattern exists.

### Theme: Foundational polish

Cross-cutting UX and structural features that aren't a single user-visible feature but improve the overall app.

- **P1 — Bottom tab nav Phases 3-5**
  Continuation of the bottom-tab migration (Phases 1-2 shipped 2026-04-05).
- **P1 — Archive / soft-delete UX for mares and stallions**
  Users want to hide retired animals without losing the historical record. Some soft-delete plumbing already exists (`isDeleted` gating in tests) — this is the UX surface.

---

## Engineering health

Sourced from the most recent architecture audits ([`BROOKS_AUDIT_2026-04-23-corrected.md`](./BROOKS_AUDIT_2026-04-23-corrected.md), [`ARCHITECTURE_AUDIT.md`](./ARCHITECTURE_AUDIT.md)). Verified against `main` at `710ad97` before writing this section. Items already remediated by the architecture remediation commit (`a2e95d2`) have been dropped.

- **P1 — Extract per-step state from `useDailyLogWizard`**
  Currently 680 LoC at `src/hooks/useDailyLogWizard.ts`. Growing every time a wizard step is added; blocks future wizard changes. High long-term payoff.
- **P1 — DB test seam**
  `src/storage/db.ts` is a singleton with no injection point. Repository tests that need a swappable DB currently have to work around it. Warranted before the next round of repository work.
- **P2 — Screen → hook policy consistency**
  CLAUDE.md says screens delegate data access to hooks under `src/hooks/`. Roughly half of screens still call repositories directly. Decide whether to enforce uniformly or relax the rule.
- **P2 — Deduplicate `TAB_KEY_TO_INDEX`**
  Defined independently in `src/screens/StallionDetailScreen.tsx`, `src/screens/MareDetailScreen.tsx`, and `src/screens/mare-detail/MareDetailTabStrip.tsx`. Pull into a shared module. ~3-line import change.
- **P2 — Rename/split `src/models/types.ts`**
  Currently one file holds every domain type. Consider splitting per aggregate (mare, stallion, foal, breeding). Suggestion-level — not blocking.
- **P2 — Relocate `src/utils/backup/`**
  Backup pipeline lives under `utils/` but reaches into `storage/` and `db`. Better home is `storage/backup/` or a new `services/` layer. Suggestion-level — not blocking.

---

## Intake & triage process

New feature requests are common enough that they need a predictable pipeline. This section defines it.

### Step 1 — Capture (cheap)

When an idea appears, append one line to [`TODO`](./TODO). Don't bother categorizing yet. The point is to not lose the idea.

### Step 2 — Triage (weekly, or at session start)

For any `TODO` entry older than a few days, fill this template and move it into the relevant theme above. Then delete the `TODO` line.

```
### <Feature name>
- Source: <user / self / breeder X>
- Problem: <what pain does this solve>
- Sketch: <1-3 sentences of what it looks like>
- Open questions: <unknowns that block estimation>
- Proposed theme: <one of the 6>
- Proposed priority: <P0 / P1 / P2>
```

Triage rules of thumb:
- If the problem isn't concrete, it goes to **P2** until the problem is articulated.
- If there's no design direction for how the feature looks, it goes to **P2** or **P1** with an *Open questions* note.
- **P0** is earned, not assigned. A feature moves to P0 only when the prior P0 ships or is deliberately paused.

### Step 3 — Ship

When a roadmap item is completed and merged to `main`:

1. Remove it from its theme.
2. Add a one-line entry to [Recently shipped](#recently-shipped) with the date and merge commit.
3. Keep the last ~10 entries there; older items roll off (git history is the real record).

---

## Recently shipped

- 2026-04-23 — Multiple daily checks per mare (`710ad97`)
- 2026-04-22 — Mare recipient flag (`30540f8`)
- 2026-04-22 — Architecture remediation + repository seam (`a2e95d2`)
- 2026-04-20 — Per-mare gestation length — closed `TODO:3` (configurable foaling-date base)
- 2026-04-20 — Data storage hardening (6 new data-integrity rules in `CLAUDE.md`)
- 2026-04-05 — Bottom tab nav Phases 1-2
- ~2026-04-08 — Stallion Collection Tracking Phase 2 (dose disposition)
- 2026-04-04 — Stallion Collection Tracking Phase 1
- 2026-03-29 — Foal IgG tracking
- 2026-03-29 — Medications
- 2026-03-27 — Mare calendar view
- 2026-03-26 — Dashboard alerts

---

## Change log for this document

- 2026-04-23 — Added *Breeding record timestamps* under Mare care depth (P1).
- 2026-04-23 — Added *Daily log photo attachments* under Media & attachments (P1).
- 2026-04-23 — Added *Outside-mare breeding records from stallion section* under Stallion depth (P1).
- 2026-04-23 — Initial roadmap extracted from flat `TODO` + planning memory + Brooks audits.
