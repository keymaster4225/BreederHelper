# BreedWise Roadmap

> Last updated: 2026-04-27
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

No feature implementation is currently marked in flight.

Latest shipped work on `main` is the dashboard task system and sticky follow-up action bar (pushed 2026-04-27, merge `0770001`).

---

## Themes

### Theme: Mare care depth

Features that deepen mare reproductive recordkeeping beyond what the current daily log + pregnancy check flow captures.

- **P0 — Cyst mapping** (`TODO:37`)
  Recurring user ask. Needs a design pass: how cysts are located on the uterus, how they're tracked over time, and whether they live on the daily log or as a separate longitudinal record.
- **P2 — Mare ovulation trends** (`TODO:27`)
  Analytics view. Blocked on data volume — needs enough historical ovulation logs per mare to be useful.

### Theme: Stallion depth

Features that extend stallion records beyond current collection + frozen batch tracking.

- **P1 — Outside-mare breeding records from stallion section**
  Allow recording a breeding against a stallion without requiring the mare to exist in the database. Use case: the user is the stallion owner and an outside mare arrives to be bred — they want to log the service without creating a full mare record. Design questions: (a) minimum fields to capture for an outside mare (name? owner? registration?), (b) whether the record can later be "upgraded" / linked if that mare is eventually added to the database, (c) how outside-mare services render on the stallion's breeding history alongside mare-linked records, (d) whether straw-consumption tracking and fertility-trend analytics include these records or only in-database services.
- **P1 — Outside-mare allocation in collection workflow** (`TODO:9`)
  On-farm dose allocation in the add-collection workflow should allow an outside mare, not only mares already saved in the app. Coordinate this with the broader outside-mare breeding-record design so the same outside-mare fields and display rules are reused.
- **P1 — Stallion fertility trends** (`TODO:25`)
  Analytics view. Like mare ovulation trends, benefits from accumulated data — but the per-stallion slice may be useful sooner because a single stallion covers many mares.
- **P1 — Frozen semen straw consumption** (`TODO:15`)
  Decrement `strawsRemaining` on a batch when straws are used in a breeding record. Currently inventory is tracked at batch level but not debited on use.
- **P2 — Frozen semen low-inventory alerts** (`TODO:17`)
  Dashboard alert when a batch drops below a configurable threshold. Depends on consumption tracking above.
- **P2 — Frozen semen bulk-edit / multi-batch operations** (`TODO:23`)
  UX for managing multiple batches at once (e.g. moving many to a different tank).
- **P2 — Stallion hub Phase 3**
  Meds/health tab, home-screen stallion section, per-stallion analytics surface. Carries over from the earlier stallion-hub planning memory.

### Theme: Proactive workflow

Features that make the app tell the user what to do next, rather than only recording what the user already did.

- **P1 — Auto-scheduled events from recorded actions** (`TODO:35`)
  The persisted task foundation and breeding-generated pregnancy-check task path shipped in `0770001`. Remaining scope: broaden generated tasks beyond the current breeding follow-up path, including ovulation → next scan and foaling → IgG / vet-check tasks, and decide whether 30-day pregnancy checks should be generated alongside the current due-date rule.
- **P2 — Conditional smart prompts** (`TODO:33`)
  Example: fluid detected on a daily log → prompt user to flush/infuse. Needs design — which conditions, how prompts are delivered, how they're dismissed, and how this should build on the shipped daily-log fluid fields and flush follow-up flow.

### Theme: Media & attachments

- **P1 — Photos V1** (`TODO:29`, ready to implement)
  Implement the scoped offline-first photo system in [`docs/plans/2026-04-26-photos-v1-implementation-plan.md`](./docs/plans/2026-04-26-photos-v1-implementation-plan.md): mare and stallion profile photos, daily-log attachments, camera/library import, app-owned JPEG masters and thumbnails, and archive backup/restore. Follow the Phase 0 hard gates before storage work: prove SDK 55 file byte/append behavior, streaming archive memory behavior, and backup picker/share support for `.breedwisebackup`.

### Theme: Scheduling & visibility

- **P1 — Calendar-at-a-glance across all mares** (`TODO:21`)
  Visual design is the main unknown. Existing per-mare `MareCalendarScreen` is the starting point.

### Theme: Cloud backup & collaboration

Features that move BreedWise beyond single-device local storage while preserving the offline-first workflow. Treat backup and sync as separate stages so disaster recovery can ship without committing the app to full multi-user conflict resolution too early.

- **P2 — Staged cloud backup and multi-user sync path**
  Long-term direction from `mare-tracker-spec.md`: data should be recoverable if a phone is lost, and eventually may support more than one user. Stage this deliberately: (1) cloud backup snapshots for lost-phone recovery; (2) single-account cloud restore across devices, still avoiding simultaneous editing; (3) read-only sharing for selected animals or records; (4) full multi-user collaboration with accounts, farm/workspace membership, roles, offline write queues, conflict handling, audit history, and attachment sync. Design prerequisite: make near-term local entities more sync-friendly with stable IDs, consistent `createdAt` / `updatedAt`, soft-delete semantics, and clear ownership boundaries.

### Theme: Foundational polish

Cross-cutting UX and structural features that aren't a single user-visible feature but improve the overall app.

- **P1 — Bottom tab nav Phases 3-5**
  Continuation of the bottom-tab migration (Phases 1-2 shipped 2026-04-05).
- **P1 — Archive / soft-delete UX for mares and stallions**
  Users want to hide retired animals without losing the historical record. Some soft-delete plumbing already exists (`isDeleted` gating in tests) — this is the UX surface.

---

## Engineering health

Sourced from the most recent architecture audits ([`BROOKS_AUDIT_2026-04-23-corrected.md`](./docs/BROOKS_AUDIT_2026-04-23-corrected.md), [`ARCHITECTURE_AUDIT.md`](./docs/ARCHITECTURE_AUDIT.md)). Verified against `main` at `710ad97` before writing this section. Items already remediated by the architecture remediation commit (`a2e95d2`) have been dropped.

- **P1 — DB test seam**
  `src/storage/db.ts` is a singleton with no injection point. Repository tests that need a swappable DB currently have to work around it. Warranted before the next round of repository work.
- **P2 — Screen → hook policy consistency**
  CLAUDE.md says screens delegate data access to hooks under `src/hooks/`. Roughly half of screens still call repositories directly. Decide whether to enforce uniformly or relax the rule.
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

- 2026-04-27 — Dashboard task system, manual reminders, and workflow task routing — closed `TODO:31`, partially delivered `TODO:35` (`0770001`)
- 2026-04-27 — Sticky follow-up action bar and daily-log follow-up navigation fix (`0770001`)
- 2026-04-27 — Breeding record timestamps (`9fc5071`)
- 2026-04-27 — Daily log fluid tracking and flush follow-up — closed `TODO:19` (`74d360b`)
- 2026-04-27 — Collection entry wizard / scrollability rework — closed `TODO:7` (`5224d66`)
- 2026-04-25 — Breeding event detail view — closed `TODO:5` (`3875543`)
- 2026-04-24 — Remove optional form placeholders — closed `TODO:11` (`50bdd74`)
- 2026-04-24 — Deduplicated detail tab route maps (`83e0486`)
- 2026-04-24 — Configurable 12h / 24h clock setting — closed `TODO:1` (`46acf9c`)
- 2026-04-24 — Daily log wizard step-state refactor (`eae89c5`)
- 2026-04-23 — Multiple daily checks per mare (`710ad97`)

---

## Change log for this document

- 2026-04-27 — Recorded *Dashboard task system, manual reminders, and workflow task routing* as shipped, closed `TODO:31`, and narrowed the remaining *Auto-scheduled events from recorded actions* scope.
- 2026-04-27 — Recorded *Sticky follow-up action bar and daily-log follow-up navigation fix* as shipped.
- 2026-04-27 — Corrected stale *Remove optional form placeholders* status and recorded it as shipped.
- 2026-04-27 — Recorded *Breeding record timestamps*, *Daily log fluid tracking and flush follow-up*, and *Collection entry wizard / scrollability rework* as shipped and removed them from active roadmap themes.
- 2026-04-26 — Promoted *Photos V1* under Media & attachments (P1) as ready to implement and linked the implementation plan.
- 2026-04-25 — Recorded *Breeding event detail view* as shipped and removed it from Mare care depth.
- 2026-04-25 — Added staged *Cloud backup and multi-user sync path* under Cloud backup & collaboration (P2).
- 2026-04-25 — Moved *Remove "optional" labels from text inputs* out of Foundational polish and marked it as implemented locally pending commit/merge.
- 2026-04-24 — Recorded *Deduplicated detail tab route maps* as shipped and removed the active engineering-health item.
- 2026-04-24 — Recorded *Configurable 12h / 24h clock setting* as shipped.
- 2026-04-24 — Recorded *Daily log wizard step-state refactor* as shipped.
- 2026-04-24 — Added *Breeding event detail view* under Mare care depth (P1).
- 2026-04-24 — Added *Collection entry wizard / scrollability rework* under Stallion depth (P1).
- 2026-04-24 — Added *Outside-mare allocation in collection workflow* under Stallion depth (P1).
- 2026-04-24 — Added *Remove "optional" labels from text inputs* under Foundational polish (P1).
- 2026-04-24 — Pruned completed or de-scoped items from the active roadmap.
- 2026-04-23 — Added *Breeding record timestamps* under Mare care depth (P1).
- 2026-04-23 — Added *Daily log photo attachments* under Media & attachments (P1).
- 2026-04-23 — Added *Outside-mare breeding records from stallion section* under Stallion depth (P1).
- 2026-04-23 — Initial roadmap extracted from flat `TODO` + planning memory + Brooks audits.
