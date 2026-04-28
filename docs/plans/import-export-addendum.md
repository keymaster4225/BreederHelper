# Individual Horse Import / Export Addendum

> Date: 2026-04-28  
> Status: Folded into source plan during Wave 0 hardening  
> Source spec: `docs/plans/2026-04-27-individual-horse-import-export-implementation-plan.md`  
> Execution runbook: `docs/plans/2026-04-28-individual-horse-import-export-execution-waves.md`

## Resolved Decisions

This addendum records the critique items that were promoted into the source
implementation plan before feature code starts. The source implementation plan is
the behavioral contract; this file is only a compact audit trail.

- Foal conflicts must surface rich lost-data context. When an imported foal
  conflicts with an existing foal for the mapped foaling record, the import
  summary states that the destination foal was preserved and reports whether
  imported `milestones` and `igg_tests` differ from the destination row.
- Fuzzy candidates use normalized score threshold `>= 0.6`. Fuzzy candidates are
  suggestions only and never auto-match.
- Round-trip determinism is required for both mare and stallion exports:
  exporting the same unchanged horse package twice should produce byte-identical
  JSON after normalizing `createdAt`.
- `app.version` and privacy flags are user-facing metadata for preview and
  summary copy. In v1, privacy flags are always `true` for the package types
  where redaction applies and describe redactions that already occurred.
- Schema mismatch copy is exact:
  - Newer package: `This horse package was created by a newer version of BreedWise. Update BreedWise and try again.`
  - Older package: `This horse package uses an older BreedWise data format that cannot be imported by this version. Ask the sender to export it again from an updated app.`
- v1 validation is strict. It rejects unknown top-level envelope keys, missing
  top-level envelope keys, unknown table keys, missing table keys, missing row
  fields, and unknown row fields.
- Shared table specs and raw insert helpers should be extracted when that
  prevents full restore and horse import from drifting. Any duplicated
  restore/import SQL left after Wave 4 must be listed as explicit tech debt.
- The open breeding pregnancy-check task natural-key preflight uses the schema
  predicate from `idx_tasks_open_breeding_preg_check_unique`:
  `status = 'open' AND source_type = 'breedingRecord' AND source_reason = 'breedingPregnancyCheck'`.
