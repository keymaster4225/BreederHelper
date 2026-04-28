# Critique: Individual Horse Import/Export Plan

Date reviewed: 2026-04-27
Reviewed document: `docs/plans/2026-04-27-individual-horse-import-export-plan.md`
Scope: critique limited to the proposal document; no comparison to the separate implementation plan.

## Executive assessment

The product framing is right. A bounded, additive horse-package flow is the correct short-term answer for vet/buyer/seller handoffs, and treating it as a sibling pipeline to full backup/restore is a sound architectural instinct. The envelope discriminator (`artifactType: "breedwise.horseTransfer"`) cleanly separates the two file types at the boundary, the safety snapshot is good defense-in-depth, and the decision to keep fuzzy matches as suggestions rather than auto-merge is the right call given the asymmetric cost of a wrong merge.

The proposal is not implementation-ready. Its strengths are at the outermost surface (file format identity, separate Settings entry, suggestion-only fuzzy matching). Its weaknesses cluster in the interior: matching precedence, conflict semantics, ID remapping, scope validation, and privacy. Several core terms — "effective data", "lightweight reference hints", "common suffix noise", "preserved when unused" — are load-bearing without being defined. As written, two implementers reading this plan would produce systems that disagree on data-integrity outcomes.

I would approve the direction. I would not start implementation until the blocking issues below are folded back into the document.

## Strengths worth preserving

- Discriminator-based envelope (`artifactType` + `schemaVersion`) avoids the trap of overloading the existing backup format and makes "is this a horse package?" a single string check at the file boundary.
- Distinguishing "already present" (idempotent re-import) from "skip as conflict" (real divergence) is a more honest model than the common "skip everything" simplification. The user-facing summary will be more meaningful if these counts are kept separate.
- Suggestion-only fuzzy matching with explicit user confirmation is the right asymmetry: an auto-merge mistake is far more expensive than an extra confirmation tap.
- Safety snapshot before every import is the right floor.
- Public interface (`exportHorseTransfer`, `validateHorseTransferJson`, `previewHorseImport`, `importHorseTransfer`) cleanly separates the four concerns that the import flow actually has.

## Blocking issues

### 1. Match precedence is undefined

Three auto-match rules are listed without precedence:

- Auto-match by exported internal ID
- Auto-match by exact non-empty registration number
- Auto-match by exact normalized name plus exact DOB

The plan does not say what to do when two rules vote for different existing horses. Concrete cases the implementer will have to resolve silently:

- Exported ID matches mare A on destination, but exported registration number matches mare B.
- Exported ID matches no one, but registration number matches B and name+DOB matches C.
- Exported ID matches A, but A's other identifying fields (registration number, DOB, name) all disagree with the import.

Without a written rule, the implementation will resolve this by accident of code order. If the rule turns out wrong in production, the consequence is a mare's history merged onto the wrong destination horse — a class of corruption that is essentially impossible to detect after the fact.

Required plan change:

- Define an explicit precedence (suggested: ID > registration > name+DOB).
- Define what happens when a higher-precedence rule fires but its target horse contradicts the import on lower-precedence fields. Treat that as ambiguous and require user confirmation; do not let "auto-match" mean "first rule wins regardless of other signals."
- Document the "no match found, but one of these fuzzy candidates is close" UX as a distinct state from "no match, create new."

### 2. "Effective data" is not defined

The conflict policy hinges on a comparison that is named but not specified:

- "Same row ID with identical effective data: count as already present."
- "Same row ID with different data: skip as conflict."

What does "effective" exclude? Plausible answers each have consequences:

- If `created_at` / `updated_at` are included, idempotent re-imports will report phantom conflicts every time, because the source's timestamps almost always differ from the destination's at row-creation time.
- If they are excluded, the rule needs to be stated explicitly so a future maintainer doesn't tighten it back to strict equality.
- Are `deleted_at` differences a conflict? An undeleted-on-source / deleted-on-destination row is a real divergence; treating it as "already present" silently keeps the destination's deletion.
- Are JSON-stored TEXT columns (e.g. foal `milestones`, `igg_tests`) compared as strings or normalized objects? Two semantically-equal JSON blobs can serialize differently.
- Are nullable fields compared as strict equality, or is `null` treated as "no opinion"?

Required plan change:

- Replace "identical effective data" with a per-table comparison spec, or a single typed equality predicate that excludes a documented metadata set.
- State the policy on `deleted_at` divergence explicitly. My recommendation: treat it as a conflict, not "already present" — silently re-deleting or silently un-deleting are both bad.
- For JSON TEXT columns, compare parsed/canonicalized objects, not raw strings.

### 3. Child ID collisions with unrelated horses are not addressed

"Imported child IDs are preserved when unused" handles the no-collision case. "If the horse matched by identity instead of ID, child foreign keys are remapped to the local horse ID" handles the parent-FK side of identity matching.

Neither handles the case the implementation will actually face most often: an imported child row whose ID coincidentally exists on the destination but belongs to a *different* primary horse. The current ID generator (`id-<base36 time>-<8 chars of base36 random>` per `src/utils/id.ts`) gives roughly 41 bits of randomness. On a single farm with hundreds of daily logs that's negligible; across many devices and exports, "preserved when unused" stops being safe to assume.

Specifically:

- A `daily_logs` row in the import has ID `xyz` and `mare_id` belonging to the imported mare. The destination already has a `daily_logs` row with ID `xyz` belonging to a different mare on the same farm. The plan's rules say:
  - "Preserved when unused" — but it is in use.
  - "Same row ID with different data: skip as conflict" — so the row is dropped.
  - And every uterine_fluid / uterine_flushes / uterine_flush_products row that referenced `xyz` will now also drop, by the parent-skipped cascade.
- Worse: if the comparison is loose enough to call them "already present" (e.g. identical for some subset of fields), the imported children will silently re-attach their data to an unrelated mare's daily log on the destination.

This is a real data-integrity hole, not a hypothetical one.

Required plan change:

- Define a child-ID rewrite policy: when an imported child's ID exists on the destination but the row's parent FK does not match the matched primary horse, rewrite the imported ID and update every downstream FK in the envelope before insert.
- Specify that ID comparison alone is never sufficient to declare "already present" — the row's ownership chain must also match.
- Add a test: imported `daily_logs.id` collides with a daily log owned by a different mare on the destination; expected behavior is rewrite-and-insert under the correct mare, not skip.

### 4. "Natural unique collision" skips silently lose dependent data

The plan says: "Natural unique collisions, such as daily log mare/date/time or one foal per foaling record: skip as conflict." Combined with "Required-parent children are skipped when their parent is skipped or missing", this means a single skipped daily log can silently drop:

- The uterine_fluid row attached to it.
- The uterine_flushes row attached to it.
- All uterine_flush_products under that flush.

A foal skipped because the destination already has a foal for that foaling record will silently drop:

- All milestone progress recorded on the source's foal (stored on the foal row in JSON).
- All IgG test results stored on the foal row.

The user sees "X skipped" with no indication of which specific records, no indication that dependent rich data was also discarded, and no path to recover that data short of viewing the source side directly.

Required plan change:

- The result type needs to surface skip *reasons* per affected row, not just per-table counts. The proposal already says "plus skip reasons" — make that concrete: which row, which constraint, which dependent rows were also dropped.
- The summary UI must let the user see specifics, not just "5 conflicts." A vet returning a mare's records to an owner who already had a partial copy needs to know "the daily log on 2026-04-15 already existed on your device, so we skipped it and the uterine fluid I recorded against it."
- Foal milestone/IgG loss is a user-visible regression even when the import otherwise looks successful. Either keep the skipped-foal data attached to a "needs review" surface, or warn explicitly in the summary.

### 5. Scope validation is implicit

The test plan mentions "unsupported schema rejection" and "malformed cross-table references", and the import behavior section assumes a single primary horse. But the proposal never states the structural guarantees the validator must enforce:

- A mare envelope must contain exactly one row in `mares`, and that row's `id` must equal the source horse identity.
- Every row in mare-owned tables (`daily_logs`, `breeding_records`, `pregnancy_checks`, `foaling_records`, `medication_logs`, mare `tasks`) must reference that one mare.
- `foals` must reach the primary mare through `foaling_records.mare_id`.
- `uterine_fluid`, `uterine_flushes`, and `uterine_flush_products` must reach the primary mare through their `daily_log_id` chain.
- A stallion envelope must contain exactly one row in `stallions`, and `semen_collections`, `frozen_semen_batches`, `collection_dose_events` must all reach that stallion through their FK chains.
- Mare-package context stallions and collections (if included) should be exactly the set referenced by included breeding records — not an arbitrary superset.

Without these checks, a tampered or buggy export with multiple mares would silently merge them all on import, violating the product promise of "one horse." Validation needs to *prove* the package is scoped, not trust it to be.

Required plan change:

- Promote scope validation to a first-class section.
- Spell out the closure rules above.
- Specify the rejection error message for each violation so the user gets actionable feedback.

### 6. Privacy boundary is not addressed

The proposal frames the feature around handoffs to vets, buyers, and sellers. The current scope choices include data those parties may not need:

- Stallion exports include `collection_dose_events`. The dose-event row, in the existing backup schema, carries recipient/shipping context — names, addresses, phone numbers, tracking numbers, carrier service. A stallion owner sharing an export with a vet will, by default, also share months of customer contact and shipping history they didn't intend to.
- Mare exports include full breeding records, which may carry notes about third-party stallion arrangements.
- Mare exports include the full referenced stallion records by implication (if breeding records' `stallion_id` requires the stallion to be present for FK integrity). A mare buyer receiving an export of a mare they're considering will also receive the seller's full stallion records — DOB, registration, pedigree, notes — for every stallion that mare was ever bred to.

Once a JSON file leaves the device via the OS share sheet, recall is impossible. The privacy boundary belongs in v1, not "polish for v2."

Required plan change:

- Decide and document the default privacy policy. My recommendation: exclude recipient/shipping fields from `collection_dose_events` by default; include only an opt-in toggle "Include recipient and shipment history" in the export sheet.
- Decide whether full stallion rows in mare exports are necessary or whether a context stub (id, name, registration number) suffices for FK integrity. The schema almost certainly requires the full row to satisfy `NOT NULL` constraints, in which case the question becomes: which non-essential columns should be redacted on export?
- Make the export preview the place where the user sees what categories of data leave the device — this is the last point at which "cancel" is free.
- Add tests enforcing whichever redaction policy is chosen.

### 7. Fuzzy matching is named but not specified

"Normalize case, punctuation, whitespace, and common suffix noise. Score exact normalized equality, token containment, token overlap, and simple edit-distance/trigram similarity. Example: `maple` and `maple rsf` should appear as a likely match, not auto-merge."

This reads as direction, not specification. Implementers will need:

- The exact normalization rules. What counts as "common suffix noise"? `RSF`, `Sr.`, `(deceased)`, breed indicators (`(Arab)`, `(QH)`), registration suffixes? The set is finite but currently unenumerated.
- The exact similarity threshold. Below which score does a candidate not appear at all? Above which score does it become a "high confidence" suggestion vs. a "low confidence" hint?
- The disqualifying signals. Does a DOB conflict (both present, different) disqualify a fuzzy match? It should. Does a registration-number conflict disqualify it? My answer is yes; the plan does not say.
- The behavior when there are zero / one / many fuzzy candidates. The single-candidate case is easy. The many-candidates case ("we found 4 mares whose names overlap with the import") is the actual UX problem.

Required plan change:

- Convert the fuzzy-matching paragraph from prose to a small specification: normalization rules, scoring inputs, threshold, disqualifiers, candidate-count UX states.

### 8. The "create the horse if no match exists" path is under-specified

When auto-match finds nothing and the user does not pick a fuzzy candidate, the import creates the horse. But:

- Does it use the exported `id`? That ID may collide with an existing (possibly soft-deleted) row on the destination.
- Or generate a new ID? Then every child FK that pointed at the source ID needs to be remapped consistently.

The plan does not say. Both choices have data-integrity consequences and the implementation must commit to one.

Required plan change:

- Specify: if the exported ID is unused on the destination (including soft-deleted rows), insert with the exported ID. Otherwise, generate a new ID and remap every child FK in the envelope before insert. State this explicitly so the test fixture can verify it both ways.

### 9. Schema-version compatibility is not stated

`schemaVersion: 1` is declared but the cross-version policy is not. The questions a maintainer will face:

- Destination is on `schemaVersion 1`, file is on `schemaVersion 2`. Reject?
- Destination is on `schemaVersion 2`, file is on `schemaVersion 1`. Adapt forward? Reject? Accept by ignoring fields the v2 schema added?
- A v1 file references a column that v2 dropped or renamed.

The Assumptions section is silent on this. The v1 file format will outlive v1 of the app; that is the entire point of having a portable format.

Required plan change:

- Decide and document the policy. A defensible default for v1: destination accepts only its own schemaVersion or earlier; older envelopes are normalized through a documented adapter; newer envelopes are rejected with "This file was created by a newer version of BreedWise; please update before importing."
- Add a test for each branch (older, equal, newer).

### 10. There is no update path, and the plan does not say so plainly

"Import creates the horse if no match exists. If a match exists, it preserves the existing horse profile and adds only non-conflicting related records."

There is no path that says "the source has corrected this row; replace the destination's version." A vet who corrects a pregnancy check date and re-sends the export will not see the correction propagate to the owner's device. The skip-as-conflict count will simply tick up by one with no mention of "what changed."

This is a deliberate scope limit and a defensible v1 choice. But the user-facing copy and the Assumptions section need to make it unambiguous, otherwise the user will assume otherwise:

> "Importing never overwrites existing data. To update destination records, edit them manually or restore the full backup file."

Required plan change:

- Add the explicit non-update statement to Assumptions and to the import preview/summary copy.
- Decide whether the summary should highlight "5 records had different data on the source than on this device — they were not changed" so the user knows divergence happened.

## Specification gaps

### A. Envelope shape is not concrete

"`createdAt`, app metadata, source horse identity, table subsets, and lightweight reference hints" leaves four of those five terms undefined.

- "App metadata" — version string, build number, what else?
- "Source horse identity" — id + name + registration + DOB? Just id + display name?
- "Table subsets" — same column projection as repositories use, or a separate projection?
- "Lightweight reference hints" — what is this? Hints for matching? Hints for FK resolution? Hints for the preview UI?

Without a concrete shape, the test plan's "transfer envelope validation" cannot be designed. Add a short types section showing the actual `HorseTransferEnvelopeV1` interface, even if just at field-name granularity.

### B. Deterministic ordering is unstated

For testable round trips and for stable diffs between two exports of the same data, every table query in the serializer needs an `ORDER BY`. SQLite row order is not a contract. The proposal does not mention ordering. This will surface as flaky tests if not specified up front.

### C. Cancellation, partial failure, and snapshot lifecycle are unspecified

The safety snapshot is described as a precondition but not as a state machine. The implementation needs answers for:

- User picks a file, sees the preview, taps cancel. Was a snapshot created? It should not be, because nothing changed.
- Validation fails after pick but before insert. Was a snapshot created? It should not be.
- Import transaction aborts mid-way (FK error, disk full). The snapshot exists. Does the user see "import failed; a safety snapshot was created if you need to recover"? Does the snapshot list refresh?
- Snapshot retention — does this import contribute to the existing snapshot retention budget, or is it separate?

Required plan change: add a "Failure semantics" subsection covering the above.

### D. Data invalidation after import is not mentioned

After insert, every mounted screen that reads the affected tables must refresh — mare list, stallion list, mare detail tabs, dashboard alerts, frozen-semen tab, foal screens. The proposal says nothing about this. Without invalidation, users will see stale UI until they background-and-foreground the app or navigate away and back.

Required plan change: state that successful import emits a data-invalidation signal covering at minimum the mares, stallions, daily logs, breeding records, pregnancy checks, foaling records, foals, medications, semen collections, frozen-semen batches, collection dose events, tasks, and dashboard alerts.

### E. Filename slug safety is unstated

`breedwise-mare-maple-v1-YYYYMMDD-HHmmss.json` looks fine for "maple". For a mare named "Maple's Big Day" or "RSF / Sage" the slug must be sanitized for cross-OS filename safety. The plan should state the slug rule (lowercase, alphanumeric, hyphens, max length, fallback for empty result) so the implementation does not pick something that breaks on Windows-targeted shares.

### F. The `tasks` table needs explicit handling

Mare exports include "mare tasks". The schema has at least one partial unique index on tasks tied to open breeding pregnancy-check tasks. That means task imports can hit non-PK unique conflicts. Some tasks have soft pointers (`source_record_id`, `completed_record_id`) into other tables. The proposal does not specify:

- Whether soft pointers are validated against the package's contents.
- Whether orphan pointers (referencing a row not in the envelope) are nulled, rejected, or imported as-is.
- Whether task uniqueness conflicts use the same skip-as-conflict rule, or whether task de-duplication needs special handling.

Required plan change: add a short subsection on task pointer integrity, similar in shape to the foal/foaling cardinality rule.

## UX and flow gaps

### G. Where the export icon goes is not described

Mare and stallion detail screens already have action affordances in the header (calendar, edit). Adding a third icon to the header invites accidental taps, especially on the smaller stallion screen. A dedicated overflow / "Share" affordance may be cleaner. The plan should at least note where the icon goes and what its accessibility label is, since every icon-only button in this codebase requires `accessibilityLabel`.

### H. The import preview is the heart of the import UX

"Opening a picker/preview screen before import" reduces a complex screen to a sentence. The preview is doing the most important user-facing work in this feature:

- Surfacing the per-table counts and the already-present-vs-new breakdown.
- Surfacing the matched horse (or the suggestion list) and giving the user a chance to confirm or change the match.
- Surfacing privacy categories included in the file (if relevant for export-side preview, not import-side).
- Surfacing the safety-snapshot promise.

A few concrete bullets describing what the preview shows would unblock the screen-test coverage and make the result types easier to design.

### I. Settings entry adjacency

Adding "Import Horse" to the same Settings/Backup screen that hosts destructive full-restore actions risks confusion. The visual and copy treatment must make clear that one operation replaces the database and the other adds records, with no "Restore" wording shared between them. A short note in the proposal would lock in that decision.

## Test plan gaps

The proposed tests are a reasonable base. Add coverage for:

- Match-precedence: two auto-match rules pointing at different existing horses; expected behavior is ambiguous-match flow with confirmation.
- Auto-match by ID where the matched horse's other identifying fields disagree with the import; expected behavior is ambiguous-match flow.
- Child ID collision with a row owned by a different mare on the destination; expected behavior is rewrite-and-insert under the correct mare.
- Natural unique collision on `daily_logs (mare_id, date, time)` with new ID; expected behavior is documented (skip + cascade or reject + clear error).
- Foal-skip cascade: imported foal is skipped because the foaling record already has a foal; the import summary surfaces the skipped foal's identity and any rich data lost.
- Foal milestone / IgG data is not silently dropped without acknowledgment.
- Tampered envelope with multiple mares — rejected.
- Tampered envelope with `horseType: "stallion"` and mare-only tables populated — rejected.
- Privacy redaction policy enforced (exclude or include recipient/shipping data per chosen default).
- Schema-version older / equal / newer than destination — accepted (with normalization) / accepted / rejected, respectively.
- Idempotent re-import of an unchanged export inserts 0 rows even with `created_at`/`updated_at` drift on rows that were previously inserted.
- Successful import emits the data-invalidation signal.
- Cancellation does not create a safety snapshot; validation failure does not create a safety snapshot.
- Import failure after snapshot creation surfaces the snapshot to the user.
- Filename slug for unusual horse names is filesystem-safe across platforms.
- Round-trip determinism: serialize same data twice → identical files modulo `createdAt`.

## Suggested plan patch

Concrete revisions before this becomes implementation-ready:

1. Add a "Matching precedence" subsection: ID > registration > name+DOB, with the ambiguous-match branch defined explicitly. Disqualifying signals listed.
2. Replace "identical effective data" with a per-table comparison spec (or a single typed predicate) that documents which metadata fields are excluded and how JSON columns are compared.
3. Add a "Child ID handling" subsection covering imported-ID-collides-with-unrelated-row, including the rewrite-and-FK-update policy.
4. Add a "Conflict cascade" subsection that defines what the import summary tells the user when a parent skip drops dependent children.
5. Add a "Scope validation" subsection that enumerates the structural guarantees the validator must enforce on each envelope type.
6. Add a "Privacy" subsection with the default redaction policy and the export-side preview that discloses included categories.
7. Convert fuzzy matching from prose to a small specification: normalization rules, scoring inputs, threshold, disqualifiers, candidate-count UX states.
8. Add a "Schema-version compatibility" subsection committing to a v1 policy.
9. Add a "Failure semantics" subsection covering cancellation, validation failure, mid-import abort, snapshot lifecycle, and data invalidation.
10. Add the concrete `HorseTransferEnvelopeV1` shape, even at field-name granularity.
11. Add the explicit "import never overwrites existing data" statement to Assumptions and to the import summary copy.

The product boundary in this proposal is good. The interior — matching, conflict semantics, ID handling, privacy, validation — is where most of the design decisions still need to be written down. Once they are, the UI work is the easy part.
