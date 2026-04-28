Remaining concerns

  These are tactical, not blocking:

  1. Foal-conflict rich-data loss is tested but not
  designed (line 363). When a foal is skipped because
  the destination already has one for that foaling
  record, the plan needs to state explicitly that the
  import summary surfaces what was lost — milestones,
  IgG history — not just "1 conflict." The test name
  implies coverage; the design section doesn't.
  2. Fuzzy threshold is not numerically specified.
  Scoring inputs are listed (line 221) but no
  minimum-score threshold for "candidate." Two
  implementers will pick different cutoffs. Pick one
  (e.g., normalized score ≥ 0.6) and write it down.
  3. Round-trip determinism test is missing from the
  test plan. The previous plan had "byte-identical
  modulo createdAt." The new plan has "produces
  deterministic ordering" — necessary but not
  sufficient. Restore the round-trip test; deterministic
   ordering is what makes it possible.
  4. app.version and the privacy flags are defined but
  their consumer is not. Are redactedContextStallions /
  redactedDoseRecipientAndShipping for the import-side
  preview to display? For future opt-in toggles?
  Currently both are always true in v1. State the intent
   in one sentence so they don't look like dead fields.
  5. Schema-version mismatch user copy. The plan says
  "reject" (line 23) but doesn't specify the message.
  The user can't fix this themselves — they need to know
   whether to update their app or ask the source to.
  Suggest two distinct messages: "newer version of
  BreedWise" vs. "older version of BreedWise."
  6. Shared backup helpers are "to consider," not
  mandated (lines 326–328). Schema-drift risk is real:
  full restore and horse import will both have insert
  SQL for every managed table, and the next migration
  will need to update both. Defensible to defer, but the
   deferral has a cost — note it as tech debt.
  7. Strict vs. permissive on unknown fields. Row-shape
  checks (line 159) imply strict. Confirm that row
  validation rejects unknown columns rather than
  silently ignoring them — this is the only defense
  against a tampered v1 envelope smuggling in v2 columns
   when destination is on v2.
  8. "Open" in the breeding pregnancy-check task
  sufficient. Restore the round-trip test; deterministic
   ordering is what makes it possible.
  4. app.version and the privacy flags are defined but
  their consumer is not. Are redactedContextStallions /
  redactedDoseRecipientAndShipping for the import-side
  preview to display? For future opt-in toggles?
  Currently both are always true in v1. State the intent
   in one sentence so they don't look like dead fields.
  5. Schema-version mismatch user copy. The plan says
  "reject" (line 23) but doesn't specify the message.
  The user can't fix this themselves — they need to know
   whether to update their app or ask the source to.
  Suggest two distinct messages: "newer version of
  BreedWise" vs. "older version of BreedWise."
  6. Shared backup helpers are "to consider," not
  mandated (lines 326–328). Schema-drift risk is real:
  full restore and horse import will both have insert
  SQL for every managed table, and the next migration
  will need to update both. Defensible to defer, but the
   deferral has a cost — note it as tech debt.
  7. Strict vs. permissive on unknown fields. Row-shape
  checks (line 159) imply strict. Confirm that row
  validation rejects unknown columns rather than
  silently ignoring them — this is the only defense
  against a tampered v1 envelope smuggling in v2 columns
   when destination is on v2.
  8. "Open" in the breeding pregnancy-check task
  partial-unique check. Line 270 lists tasks partial
  sufficient. Restore the round-trip test; deterministic
   ordering is what makes it possible.
  4. app.version and the privacy flags are defined but
  their consumer is not. Are redactedContextStallions /
  redactedDoseRecipientAndShipping for the import-side
  preview to display? For future opt-in toggles?
  Currently both are always true in v1. State the intent
   in one sentence so they don't look like dead fields.
  5. Schema-version mismatch user copy. The plan says
  "reject" (line 23) but doesn't specify the message.
  The user can't fix this themselves — they need to know
   whether to update their app or ask the source to.
  Suggest two distinct messages: "newer version of
  BreedWise" vs. "older version of BreedWise."
  6. Shared backup helpers are "to consider," not
  mandated (lines 326–328). Schema-drift risk is real:
  full restore and horse import will both have insert
  SQL for every managed table, and the next migration
  will need to update both. Defensible to defer, but the
   deferral has a cost — note it as tech debt.
  7. Strict vs. permissive on unknown fields. Row-shape
  checks (line 159) imply strict. Confirm that row
  validation rejects unknown columns rather than
  silently ignoring them — this is the only defense
  against a tampered v1 envelope smuggling in v2 columns
   when destination is on v2.
  8. "Open" in the breeding pregnancy-check task
  sufficient. Restore the round-trip test; deterministic
   ordering is what makes it possible.
  4. app.version and the privacy flags are defined but
  their consumer is not. Are redactedContextStallions /
  redactedDoseRecipientAndShipping for the import-side
  preview to display? For future opt-in toggles?
  Currently both are always true in v1. State the intent
   in one sentence so they don't look like dead fields.
  5. Schema-version mismatch user copy. The plan says
  "reject" (line 23) but doesn't specify the message.
  The user can't fix this themselves — they need to know
   whether to update their app or ask the source to.
  Suggest two distinct messages: "newer version of
  BreedWise" vs. "older version of BreedWise."
  6. Shared backup helpers are "to consider," not
  mandated (lines 326–328). Schema-drift risk is real:
  full restore and horse import will both have insert
  SQL for every managed table, and the next migration
  will need to update both. Defensible to defer, but the
   deferral has a cost — note it as tech debt.
  7. Strict vs. permissive on unknown fields. Row-shape
  checks (line 159) imply strict. Confirm that row
  validation rejects unknown columns rather than
  silently ignoring them — this is the only defense
  against a tampered v1 envelope smuggling in v2 columns
   when destination is on v2.
  8. "Open" in the breeding pregnancy-check task
  partial-unique check. Line 270 lists tasks partial
   ordering is what makes it possible.
  4. app.version and the privacy flags are defined but
  their consumer is not. Are redactedContextStallions /
  redactedDoseRecipientAndShipping for the import-side
  preview to display? For future opt-in toggles?
  Currently both are always true in v1. State the intent
   in one sentence so they don't look like dead fields.
  5. Schema-version mismatch user copy. The plan says
  "reject" (line 23) but doesn't specify the message.
  The user can't fix this themselves — they need to know
   whether to update their app or ask the source to.
  Suggest two distinct messages: "newer version of
  BreedWise" vs. "older version of BreedWise."
  6. Shared backup helpers are "to consider," not
  mandated (lines 326–328). Schema-drift risk is real:
  full restore and horse import will both have insert
  SQL for every managed table, and the next migration
  will need to update both. Defensible to defer, but the
   deferral has a cost — note it as tech debt.
  7. Strict vs. permissive on unknown fields. Row-shape
  checks (line 159) imply strict. Confirm that row
  validation rejects unknown columns rather than
  silently ignoring them — this is the only defense
  against a tampered v1 envelope smuggling in v2 columns
   when destination is on v2.
  8. "Open" in the breeding pregnancy-check task
  partial-unique check. Line 270 lists tasks partial
  unique conflicts as a natural-unique check. Verify the
   partial-index predicate matches what the planner
  means by "open" — the schema's index condition should
  be the source of truth for the preflight query.

  Recommendation

  Approve to start implementation. None of the remaining
   concerns block the core work — they're refinements
  that can land alongside or after the first PR. The
  architectural decisions (separate envelope type,
  raw-payload guard, PK preflight, scope closure rules,
  privacy redactions, ID rewrite policy) are all solid
  and correctly motivated.

  The only item I'd want lifted into the plan before
  code starts is #1 (foal-conflict surfacing) because
  it's a user-trust issue that's easy to forget once
  you're deep in the plumbing.
