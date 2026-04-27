# Adversarial Review: Breeding Event Detail View Plan

**Reviewing:** `docs/plans/2026-04-25-breeding-event-detail-view-implementation-plan.md`
**Date:** 2026-04-25

**Verdict:** Solid scaffolding, but the plan ships several quiet failure modes and waves a hand over a few real implementation choices. About 8–10 substantive issues need to be locked down before code is written, plus several scope decisions that deserve to be re-defended.

---

## Substantive issues (must address before coding)

### 1. Stale-detail flow after delete-from-edit is broken UX
The flow `Detail → header pencil → BreedingRecordForm → Delete` calls `deleteBreedingRecord` then `onGoBack()` (`useBreedingRecordForm.ts:452-454`). The form pops, the detail screen re-focuses, `useFocusEffect` calls `reload()`, the hook discovers `getBreedingRecordById` returns null, calls `onInvalidRoute('This breeding record no longer exists.')`, and the user — who *just* deleted it — sees an alert telling them it doesn't exist. The plan says nothing about this.

Pick one: (a) the detail screen distinguishes "never loaded" from "previously loaded then disappeared" and silently `goBack()` in the second case, or (b) the edit form, when invoked from detail, pops twice on delete. The plan should specify.

### 2. `useFocusEffect` reload semantics are unspecified and will double-load
Existing pattern (`useMareCalendarData.ts:84-88`, `useStallionManagement.ts:35`) puts `useFocusEffect(useCallback(() => { void loadData(); }, [loadData]))` *inside the hook*. The plan instead has the hook expose `reload` and asks the screen to wire `useFocusEffect`. Plus the data hook (Task 3) has no stated mount-time `useEffect` — but Task 4 only mentions `useFocusEffect` for "reload after returning from edit forms," implying a separate initial load. Decide:

- **Option A:** Hook owns `useFocusEffect` (matches `useMareCalendarData`). Screen never wires loading.
- **Option B:** Hook exposes `reload`; screen wires both initial `useEffect(reload, [])` and `useFocusEffect(reload)` and the screen test mocks `useFocusEffect` like the existing ones do (`MareCalendarScreen.screen.test.tsx:8`).

As written you'll double-load on initial mount or forget initial-load entirely. The plan must lock the contract.

### 3. Race conditions on rapid focus/blur
`reload()` is `Promise<void>`. If focus fires twice quickly (returning from a nested form, then losing focus to a modal, then refocusing), an older `setState` can land after a newer one and replace fresh data with stale data. The plan should require an `isMountedRef` (or generation counter) and document discarding stale resolves. None of `useMareCalendarData` does this either, but this hook gates on linked-record presence and is more sensitive.

### 4. Pressable-inside-Pressable for cards-with-pencils is hand-waved
Tasks 5 and 6 say "wrap the card body in a pressable container or make the whole card pressable while ensuring the pencil still receives its own press." Today `BreedingTab.tsx:29-37` and `TimelineTab.tsx` `BreedingCard` (lines 138-150) put `EditIconButton` inside the card. The existing precedent (`stallion-detail/CollectionsTab.tsx:421-435`) avoids the conflict by *only* making rows pressable when no inner button is present.

Two real concerns the plan dismisses:
- On Android, nested `Pressable` can flash both pressed states; on web/Touchable-derived surfaces, parent `onPress` can still fire. The cookbook approach in this codebase is to wrap a sibling `Pressable` over body content, not the entire card.
- Long-press, accessibility focus order, and screen-reader announcement get worse when an interactive icon button is nested inside another interactive button.

Pick option B (wrap the card-body sub-area, leave the header/pencil outside the Pressable) and make it a directive, not a "or."

### 5. Soft-deleted mares/stallions are unhandled
- `getMareById()` (`mares.ts:32-55`) returns the row *regardless of `deleted_at`* — there is no `WHERE deleted_at IS NULL` clause. So a deleted mare still loads and the detail screen will render against it as if normal. Is that intentional? The plan never mentions soft-delete state at all.
- Similarly `getStallionById` filtering depends on the function signature (lines 61-72 of `stallions.ts` — quick check needed). If the stallion was soft-deleted, the cross-link to `StallionDetail` may render a broken target. The plan should specify whether soft-deleted entities show as deleted, hide cross-links, or render as plain text.

### 6. Why is `mareId` in the route param at all?
`record.mareId` is the source of truth on the breeding record. Including `mareId` in route params creates two sources of truth (and forces the new "different mare" error path the plan defines). Cleaner: route is `{ breedingRecordId: string }` and the hook derives `mareId` from the loaded record. Pros: no `record.mareId !== mareId` validation branch, no risk of stale call sites passing a wrong mareId, less typing churn at every call site.

If the plan keeps `mareId` (e.g. to prefetch the mare in parallel before the breeding record resolves), say *why*, because today it's just defensive duplication. The "different mare" error path in particular has no useful recovery — what should the user do?

### 7. `onInvalidRoute` callback timing is undefined
The plan calls `onInvalidRoute` from inside a load function. If that function in turn calls `navigation.goBack()` synchronously (which the screen will likely have it do), and React is mid-render, you can get warnings or double-navigation. The plan should specify that the callback is invoked from a `useEffect` / async boundary, or have the hook return an `invalidRouteMessage: string | null` that the screen renders/acts on declaratively. The current pattern in `usePregnancyCheckForm.ts:83-93` uses `Alert.alert` + `onGoBackRef.current()` from inside the load — fine, but the new hook will be doing this in a focus-driven reload too, where the screen is already mounted; reproducing the exact pattern needs care.

### 8. Inconsistent timeline interaction
After this lands, on the calendar/timeline a breeding card opens a read-only detail, but a pregnancy check card and foaling card still open their *edit forms*. That mixed semantic — "tap = view" for one card type and "tap = edit" for the others — will train users wrong. Either:
- Only make the entry interactive on the BreedingTab (mare detail), not on TimelineTab/Calendar; reserve TimelineTab tap = edit (today's behavior).
- Or commit to a roadmap follow-up that gives PC and foaling their own detail screens, and call it out in this plan as a known transitional inconsistency.

### 9. "Add Pregnancy Check" CTA only — but `FoalingRecord.breedingRecordId` exists too
`FoalingRecord` has `breedingRecordId?: UUID | null` (`types.ts:356`). The "Locked Implementation Assumptions" arbitrarily restrict v1 to one CTA without justifying it. The most natural follow-up from a positive PC is recording a foaling event tied to that breeding. Either:
- Add the symmetric `Add Foaling Record` CTA + foaling-form preselection (Task 2 has the template).
- Or explain in the plan *why* foaling is excluded — e.g. "foaling forms have to be created from the foaling tab today and we don't want to add a second preselection mechanism in this PR." Right now it just reads as scope-cutting for its own sake.

### 10. "Service Details" section is incomplete for non-AI methods
Task 4 enumerates fields for `freshAI`, `shippedCooledAI`, `frozenAI` only. What about `liveCover`/in-hand/pasture (whatever the enum exposes — verify in `models/enums.ts`)? They presumably have only date/method/notes — but the plan should say so explicitly so the implementer doesn't ship a section that's empty for those methods (which violates the "missing optional fields are omitted rather than rendered as noisy blank rows" rule, since the *whole section* may be empty). Should the section header itself be hidden when no service details exist?

Likewise, the "Collection row" content is unspecified ("Collection row when `record.collectionId` exists"). Show what — a date, a volume, the stallion's collection ID? Implementer will guess.

---

## Test coverage gaps (Task 9)

These are missing and at least four of them are exactly the bugs the substantive issues above predict:

- **Reload after delete-from-edit-form** (issue 1) — no test exercises the focus-effect path after the underlying record is gone.
- **`useFocusEffect` reload after returning from edit/PC/foaling forms** (issue 2) — the test list covers happy-path navigation but never asserts that data is refetched on focus.
- **Pencil press in a card body does NOT also trigger card body press** (issue 4) — should be an explicit assertion since this is the only thing keeping the two affordances separate.
- **Soft-deleted mare or stallion** (issue 5) — render path is undefined and untested.
- **Invalid `breedingRecordId` route param** — calls `onInvalidRoute`. Tested?
- **Mismatch case**: `record.mareId !== mareId` route param. Tested?
- **PC list ordering**: which way is sorted (date asc/desc)? Plan never specifies, so a test couldn't even assert the right answer.

The plan also tests `Add Pregnancy Check opens PregnancyCheckForm with breedingRecordId`, but should also test that on submit, the `usePregnancyCheckForm` actually preselects the right record (i.e. an integration test through the hook, not just a navigation-arg assertion).

---

## Design / scope pushback

- **Cross-link to MareDetail is missing.** When opening detail from the *stallion* breeding history, there is no way back to the mare's profile. A "View mare" cross-link is the symmetric counterpart of the stallion cross-link the plan already includes. Why omit it?
- **Cross-link to a *form* breaks the read-only contract.** Tapping the collection row opens `CollectionForm` (which is editable). The plan asserts the screen is read-only "with one primary mutation affordance in the header," then immediately ships secondary mutation affordances via the cross-links. Either accept that detail can be a launch pad for editing related entities (and adjust the wording), or build a read-only collection chip that doesn't navigate.
- **`StallionDetail` cross-link with `initialTab: 'breeding'` from the very tab the user came from** is a quiet UX loop. Minor — but easy to detect: if `previousRoute === 'StallionDetail'`, omit the link.
- **Accessibility**: `accessibilityLabel` is suggested, but `accessibilityRole="button"` is not. The Pressable wrappers in `CollectionsTab.tsx:191-193` already set both — match that.
- **CTA placement ambiguity** ("above or below the list" — Task 4) — pick above; that's the codebase convention (`BreedingTab.tsx:22`).
- **No forward-compat note for backup pipeline.** The CLAUDE.md "Data Integrity Rules" section requires backup-pipeline updates *only* for new persisted entities; this plan doesn't add any, so backup is correctly untouched. Worth one line in the plan stating this so a reviewer doesn't have to re-derive it.

---

## Smaller things

- The plan repeats the literal strings for invalid-route messages. Constants in the hook would make tests less brittle.
- The "Acceptance Criteria" list at the bottom doesn't include any of: focus reload works, pencil and body presses don't conflict, deleted-from-edit flow doesn't show ghost-record alert. These are exactly the things a reviewer should verify.
- Wave 5's "broader screen suite" condition ("if the implementation touched shared navigation or reusable card behavior") is true *by definition* for this plan (it touches RootStackParamList and reusable card pressable behavior). Just say "run the broader suite."
- The hook return type lists `error: string | null` but `onInvalidRoute` is the route-error channel. Are these distinct? (One is "your route is bad," the other is "the load itself failed.") Fine, but the plan should disambiguate.

---

## Bottom line

The plan is well-grounded structurally — every path it cites exists, the wave order is sensible, and there's no schema risk. But it under-specifies four things that will produce real bugs (`useFocusEffect` semantics, ghost-record alert on delete, Pressable nesting, soft-delete handling) and one design choice (`mareId` in route params) that adds complexity for no clearly stated reason. Tighten Tasks 3, 4, 5, and 9 along the lines above before starting implementation.
