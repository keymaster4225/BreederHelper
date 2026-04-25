# Breeding Event Detail View - Implementation Plan

**Date:** 2026-04-25  
**Status:** Ready for implementation  
**Roadmap Item:** `P1 - Breeding event detail view`

## Goal

Add a read-only breeding event detail screen that acts as the canonical service record page for one breeding record.

The finished app should:

- open the detail view from mare breeding cards, mare calendar/day-history breeding cards, stallion breeding history, and linked on-farm allocation rows
- keep existing pencil icons as direct edit shortcuts
- show entered breeding fields without editable controls
- show linked pregnancy checks and foaling records for that service
- allow adding a pregnancy check preselected to the current breeding record
- cross-link to the related stallion and semen collection when those links exist
- cross-link back to the mare profile when the detail screen is opened from stallion-owned surfaces

## Repo Fit

This plan is grounded in the current codebase:

- Stack navigation is owned by `src/navigation/AppNavigator.tsx`.
- Mare breeding cards live in `src/screens/mare-detail/BreedingTab.tsx`.
- Calendar day-history breeding cards reuse `src/screens/mare-detail/TimelineTab.tsx`.
- Stallion breeding history lives in `src/screens/stallion-detail/BreedingHistoryTab.tsx`.
- Linked on-farm allocation rows live in `src/screens/stallion-detail/CollectionsTab.tsx`.
- Breeding record persistence already exposes `getBreedingRecordById`.
- Related pregnancy and foaling records can be loaded from the existing mare-scoped list repositories.
- Existing edit forms should remain the mutation surfaces.

This work should add a read-only service view and reuse existing repositories/forms rather than creating parallel edit flows.

## Locked Implementation Assumptions

- No SQLite schema or migration changes are required.
- No backup/restore changes are required because this feature adds no persisted entities or columns.
- The detail screen is read-only; mutation still happens through existing form screens.
- The detail screen may launch existing edit-capable screens for related entities; "read-only" means the breeding event detail surface itself has no inline editable controls.
- Existing list-card pencil buttons remain as fast edit shortcuts.
- Card body press opens the detail view.
- `BreedingEventDetail` is routed by `breedingRecordId` only; the hook derives `mareId` from the loaded breeding record.
- The detail screen hides `createdAt` and `updatedAt`.
- Missing optional fields are omitted rather than rendered as noisy blank rows.
- Linked pregnancy and foaling records open their existing edit forms.
- This item does not create pregnancy-check or foaling-record detail screens.
- The only add CTA in v1 is `Add Pregnancy Check`; `Add Foaling Record` is intentionally excluded to keep this PR focused on service review plus the most common immediate follow-up, while the existing Foaling tab flow remains the foaling creation path.
- Custom, missing, or soft-deleted stallions render as plain text and do not cross-link.
- Soft-deleted mares may still render as historical context, but the mare row must clearly indicate deleted/inactive status and must not cross-link.
- This feature intentionally creates a transitional interaction inconsistency: breeding cards open read-only detail from all breeding surfaces, while pregnancy and foaling cards still open existing edit forms until their own detail screens are planned.
- Pressable card implementation must avoid nested interactive controls: only the card body/content area becomes pressable, and the header/pencil remains a sibling outside that pressable area.

## Delivery Strategy

Implement in five waves so route contracts and loading behavior land before navigation entry points are rewired.

### Wave 1: Navigation and preselection contract

1. Add the detail route to the root stack.
2. Add optional pregnancy-check preselection to route params.
3. Update the pregnancy-check form hook to honor create-mode preselection.

### Wave 2: Detail data hook

4. Add a dedicated hook for loading one breeding event and related records.
5. Normalize missing-record and invalid-route handling.

### Wave 3: Detail screen UI

6. Build the read-only detail screen.
7. Add header edit, cross-links, related-record cards, and the add pregnancy check CTA.

### Wave 4: Entry points

8. Rewire mare, calendar/timeline, stallion breeding history, and on-farm allocation rows to open the detail view from card body presses.
9. Keep existing pencil/edit affordances wired to current edit forms.

### Wave 5: Verification

10. Add hook and screen tests.
11. Run targeted checks and broader quality gates.

## Task Breakdown

### Task 1: Add navigation contracts

**Files**

- Modify: `src/navigation/AppNavigator.tsx`

**Implementation**

- Import the new `BreedingEventDetailScreen`.
- Add `BreedingEventDetail: { breedingRecordId: string }` to `RootStackParamList`.
- Change `PregnancyCheckForm` params from `{ mareId: string; pregnancyCheckId?: string }` to `{ mareId: string; pregnancyCheckId?: string; breedingRecordId?: string }`.
- Register the new stack screen with title `Breeding Event`.

**Acceptance criteria**

- TypeScript route typing allows opening the detail screen from mare, calendar, and stallion surfaces with only a breeding record ID.
- Existing callers of `PregnancyCheckForm` continue to typecheck without providing `breedingRecordId`.

### Task 2: Support pregnancy-check create preselection

**Files**

- Modify: `src/hooks/usePregnancyCheckForm.ts`
- Modify: `src/screens/PregnancyCheckFormScreen.tsx`
- Modify or add: `src/hooks/usePregnancyCheckForm.screen.test.tsx`

**Implementation**

- Add `initialBreedingRecordId?: string` to `UsePregnancyCheckFormArgs`.
- Pass `route.params.breedingRecordId` from `PregnancyCheckFormScreen`.
- In create mode, after `listBreedingRecordsByMare(mareId)` resolves:
  - If `initialBreedingRecordId` matches one of the mare's records, set it as `breedingRecordId`.
  - Otherwise, keep the existing fallback to `records[0].id`.
- In edit mode, ignore `initialBreedingRecordId` and use the existing pregnancy check's saved `breedingRecordId`.

**Acceptance criteria**

- Opening `PregnancyCheckForm` from a breeding event preselects that event.
- Invalid or stale preselection does not break the form.
- Edit mode remains unchanged.

### Task 3: Add detail loading hook

**Files**

- Create: `src/hooks/useBreedingEventDetail.ts`

**Implementation**

Create a hook with this shape:

```ts
type UseBreedingEventDetailArgs = {
  readonly breedingRecordId: string;
};
```

The hook should return:

```ts
{
  isLoading: boolean;
  error: string | null;
  invalidRouteMessage: string | null;
  recordMissingAfterPriorLoad: boolean;
  record: BreedingRecord | null;
  mare: Mare | null;
  stallion: Stallion | null;
  collection: SemenCollection | null;
  pregnancyChecks: PregnancyCheck[];
  foalingRecords: FoalingRecord[];
  foalByFoalingRecordId: Record<string, Foal>;
  reload: () => Promise<void>;
}
```

Load data with existing repositories:

- `getBreedingRecordById(breedingRecordId)`
- `getMareById(record.mareId)` after the breeding record loads
- `getStallionById(record.stallionId)` when `record.stallionId` exists
- `getSemenCollectionById(record.collectionId)` when `record.collectionId` exists
- `listPregnancyChecksByMare(record.mareId)`
- `listFoalingRecordsByMare(record.mareId)`
- `listFoalsByMare(record.mareId)`

Focus/reload ownership:

- The hook owns `useFocusEffect(useCallback(() => { void reload(); }, [reload]))`, matching existing data hooks such as `useMareCalendarData`.
- The screen must not also wire `useFocusEffect` or an initial `useEffect` for loading.
- `reload` must be stable via `useCallback`.
- The hook must guard async state updates with a request-generation counter. Each reload increments the generation; only the latest generation may update state. This prevents stale focus-triggered loads from overwriting fresher data.

Filter related records in the hook:

- `pregnancyChecks.filter((check) => check.breedingRecordId === breedingRecordId)`
- `foalingRecords.filter((record) => record.breedingRecordId === breedingRecordId)`

Invalid-route behavior:

- If the first load cannot find the breeding record, set `invalidRouteMessage` to `This breeding record no longer exists.`.
- If a previous load succeeded and a later focus reload cannot find the breeding record, set `recordMissingAfterPriorLoad: true` and do not set an alert-worthy invalid-route message. This covers the flow `Detail -> Edit -> Delete -> back to Detail`; the screen should silently go back.
- If the mare cannot be loaded, set `invalidRouteMessage` to `This mare no longer exists.`.
- Keep route-load errors distinct from ordinary load errors: `invalidRouteMessage` means navigation cannot continue; `error` means data loading failed but the route itself was structurally valid.

Do not fail the whole screen for:

- missing linked stallion
- missing linked collection
- soft-deleted linked stallion

Soft-delete behavior:

- If the mare row has `deletedAt`, still render the screen for historical context and label the mare as deleted/inactive in the summary.
- If the stallion row has `deletedAt`, render the stallion name as plain text with deleted/inactive status and do not provide a `StallionDetail` cross-link.
- If the collection exists for a soft-deleted stallion, render collection context as plain text and do not navigate to `CollectionForm`.

**Acceptance criteria**

- The hook centralizes all repository access for the detail screen.
- Presentation components do not import repositories directly.
- Missing optional links still allow the breeding record to render.
- Initial load happens exactly once through the hook-owned focus effect.
- Returning from an edit form refreshes the detail data.
- Deleting the breeding record from the edit form returns the user away from the now-stale detail screen without showing a "record not found" alert.

### Task 4: Build `BreedingEventDetailScreen`

**Files**

- Create: `src/screens/BreedingEventDetailScreen.tsx`
- Modify if useful: `src/components/RecordCardParts.tsx`

**Implementation**

- Use `Screen` and a `ScrollView`.
- Do not call `useFocusEffect` in the screen; loading and focus reloads belong to `useBreedingEventDetail`.
- Use `navigation.setOptions` to set a header-right pencil button after the record is loaded.
- Use an effect to respond to `invalidRouteMessage` and `recordMissingAfterPriorLoad`:
  - `invalidRouteMessage`: show `Alert.alert('Unable to open breeding event', invalidRouteMessage)` and then `navigation.goBack()`.
  - `recordMissingAfterPriorLoad`: call `navigation.goBack()` without an alert.
- Header pencil navigates to:

```ts
navigation.navigate('BreedingRecordForm', {
  mareId: record.mareId,
  breedingRecordId: record.id,
});
```

Render sections:

1. **Summary**
   - Date, displayed with `formatLocalDate(record.date, 'MM-DD-YYYY')`.
   - Mare name.
   - Method via `formatBreedingMethod(record.method)`.
   - Stallion display:
     - `record.stallionName`
     - else linked `stallion.name`
     - else `Unknown`
   - Mare row:
     - shows `mare.name`
     - is pressable and opens `MareDetail` when the mare is active
     - renders as plain text with deleted/inactive status when `mare.deletedAt` exists

2. **Service Details**
   - Hide the entire section when there are no details beyond the summary.
   - For `liveCover`, only render this section when collection/date/notes exist; otherwise do not show an empty service-details card.
   - Collection row when `record.collectionId` exists:
     - label as `Collection`
     - display `formatLocalDate(collection.collectionDate, 'MM-DD-YYYY')` when the linked collection loads
     - display `Linked collection` when only the ID exists
     - include raw volume and motility on secondary rows if the collection loads and those values exist
   - Collection date when `record.collectionDate` exists.
   - For `freshAI` and `shippedCooledAI`: volume, concentration, motility when present.
   - For `frozenAI`: number of straws, straw volume, straw details when present.
   - Notes when present.

3. **Related Pregnancy Checks**
   - Empty text: `No pregnancy checks linked to this breeding event.`
   - Card rows: date, result, heartbeat, days post-breeding.
   - Pressing a card or pencil opens `PregnancyCheckForm`.
   - Place `Add Pregnancy Check` above the list, matching existing tab add-button convention. It navigates to:

```ts
navigation.navigate('PregnancyCheckForm', {
  mareId: record.mareId,
  breedingRecordId: record.id,
});
```

4. **Related Foaling Records**
   - Empty text: `No foaling records linked to this breeding event.`
   - Card rows: date, outcome, foal sex, foal name when present.
   - Pressing a card or pencil opens `FoalingRecordForm`.

Cross-links:

- If `record.mareId` exists and the mare is active, make the mare row pressable and navigate to:

```ts
navigation.navigate('MareDetail', {
  mareId: record.mareId,
  initialTab: 'breeding',
});
```

- If `record.stallionId` exists, `stallion` loads, and `stallion.deletedAt == null`, make the stallion row pressable and navigate to:

```ts
navigation.navigate('StallionDetail', {
  stallionId: record.stallionId,
  initialTab: 'breeding',
});
```

- If both `record.stallionId` and `record.collectionId` exist, `stallion.deletedAt == null`, and `collection` loads, make the collection row pressable and navigate to:

```ts
navigation.navigate('CollectionForm', {
  stallionId: record.stallionId,
  collectionId: record.collectionId,
});
```

- Pressable rows must set `accessibilityRole="button"` and useful `accessibilityLabel` values.

**Acceptance criteria**

- The screen is read-only.
- The screen has one primary breeding-event mutation affordance in the header: edit breeding record.
- Related records and cross-links navigate to existing screens only, and any edit-capable destination is clearly a separate screen.
- Optional empty fields do not clutter the UI.
- There is no empty service-details card for live-cover records with no extra fields.
- Invalid first-load routes alert and leave the screen; post-delete stale records leave the screen silently.

### Task 5: Rewire mare breeding cards

**Files**

- Modify: `src/screens/mare-detail/BreedingTab.tsx`

**Implementation**

- Import `Pressable`.
- Do not nest `EditIconButton` inside a parent `Pressable`.
- Keep the card header and pencil as a non-pressable sibling.
- Wrap only the card body/content rows in a `Pressable`.
- The body `Pressable` must set `accessibilityRole="button"` and an `accessibilityLabel`.
- Body press navigates to:

```ts
navigation.navigate('BreedingEventDetail', {
  breedingRecordId: record.id,
});
```

- Keep the existing `EditIconButton` behavior unchanged.

**Acceptance criteria**

- Tapping a card opens detail.
- Tapping the pencil opens edit.
- Pressing the pencil does not also fire the body press.
- Empty state and add button remain unchanged.

### Task 6: Rewire timeline and calendar breeding cards

**Files**

- Modify: `src/screens/mare-detail/TimelineTab.tsx`

**Implementation**

- Import `Pressable`.
- In `BreedingCard`, do not nest `EditIconButton` inside a parent `Pressable`.
- Keep the card header and pencil as a non-pressable sibling.
- Wrap only the breeding card body/content rows in a `Pressable`.
- The body `Pressable` must set `accessibilityRole="button"` and an `accessibilityLabel`.
- Body press navigates to `BreedingEventDetail`.
- Keep the existing pencil behavior unchanged.
- This intentionally makes breeding cards view-first while pregnancy and foaling cards remain edit-first until those record types get their own detail screens.

Because `MareCalendarScreen` reuses `TimelineTab`, no separate calendar implementation should be needed.

**Acceptance criteria**

- Calendar day-history breeding events open the new detail view.
- Timeline card pencil still opens edit.
- Other event card types remain unchanged.

### Task 7: Rewire stallion breeding history

**Files**

- Modify: `src/screens/stallion-detail/BreedingHistoryTab.tsx`

**Implementation**

- Change linked breeding card press behavior from opening `MareDetail` to opening `BreedingEventDetail`.
- Preserve legacy unlinked records as non-navigable cards unless they have a valid `mareId` and breeding record ID through the normal linked list.
- The detail screen itself provides the cross-link back to the mare profile.

Navigation target:

```ts
navigation.navigate('BreedingEventDetail', {
  breedingRecordId: r.id,
});
```

**Acceptance criteria**

- Linked breeding rows open the service detail screen.
- Legacy rows remain visually distinct and do not imply unavailable navigation.

### Task 8: Rewire linked on-farm allocation rows

**Files**

- Modify: `src/screens/stallion-detail/CollectionsTab.tsx`

**Implementation**

- For `usedOnSite` dose events with `linkedBreeding`, change the row press target from `BreedingRecordForm` to `BreedingEventDetail`.
- If an explicit edit icon is present for a linked breeding row in the future, keep that icon pointed at `BreedingRecordForm`.

Navigation target:

```ts
navigation.navigate('BreedingEventDetail', {
  breedingRecordId: linkedBreeding.id,
});
```

**Acceptance criteria**

- On-farm allocation rows open the service detail screen.
- Shipment and frozen batch rows are unchanged.

### Task 9: Add screen and navigation tests

**Files**

- Create: `src/screens/BreedingEventDetailScreen.screen.test.tsx`
- Modify as needed:
  - `src/screens/MareDetailScreen.screen.test.tsx`
  - `src/screens/MareCalendarScreen.screen.test.tsx`
  - `src/screens/StallionDetailScreen.screen.test.tsx`
  - existing collection/stallion screen tests where on-farm allocation navigation is already covered

**Test cases**

- Detail screen renders a live cover record with date, mare, stallion, method, and notes.
- Live cover with no extra service fields does not render an empty service-details card.
- Detail screen renders fresh or shipped AI semen fields only when present.
- Detail screen renders frozen AI straw fields only when present.
- Optional null fields are hidden.
- Header pencil opens `BreedingRecordForm`.
- `Add Pregnancy Check` opens `PregnancyCheckForm` with `breedingRecordId`.
- `usePregnancyCheckForm` preselects the route-provided breeding record on create and falls back when invalid.
- Linked pregnancy check card opens `PregnancyCheckForm` with `pregnancyCheckId`.
- Linked foaling card opens `FoalingRecordForm` with `foalingRecordId`.
- Active mare row opens `MareDetail`; deleted/inactive mare renders non-navigable status text.
- Linked stallion row opens `StallionDetail`.
- Soft-deleted stallion renders as plain text and does not navigate.
- Linked collection row opens `CollectionForm`.
- Missing stallion still renders fallback stallion display without crashing.
- Invalid first-load `breedingRecordId` triggers invalid-route handling.
- A successful prior load followed by a missing record on focus reload navigates back without showing the invalid-route alert.
- Focus reload refetches data after returning from breeding, pregnancy, or foaling edit forms.
- Out-of-order reload resolution cannot overwrite the latest state.
- Mare breeding tab body press opens detail and pencil opens edit.
- Mare breeding tab pencil press does not also trigger detail navigation.
- Timeline/calendar breeding body press opens detail and pencil opens edit.
- Timeline/calendar breeding pencil press does not also trigger detail navigation.
- Stallion linked breeding row opens detail.
- Linked on-farm allocation row opens detail.
- Related pregnancy checks and foaling records render in repository order, which is currently descending by date.

**Acceptance criteria**

- Tests cover both the new canonical route and preservation of direct edit shortcuts.
- Tests cover focus reload, stale-record deletion, invalid route, soft-deleted link behavior, and body-vs-pencil press separation.

### Task 10: Verification

Run targeted checks first:

```bash
npm run typecheck
npm test -- src/hooks/usePregnancyCheckForm.screen.test.tsx
npm run test:screen -- src/screens/BreedingEventDetailScreen.screen.test.tsx
npm run test:screen -- src/screens/MareDetailScreen.screen.test.tsx src/screens/MareCalendarScreen.screen.test.tsx src/screens/StallionDetailScreen.screen.test.tsx
npm run lint
```

Then run the broader screen suite because this feature touches shared navigation and card interaction behavior:

```bash
npm run test:screen
```

## Acceptance Criteria

- Every visible breeding-history surface opens the same read-only detail screen from the card body.
- Direct edit pencils still open the existing edit form.
- Pencil presses do not also trigger card-body navigation.
- The detail screen shows all user-entered breeding data relevant to the breeding method.
- Linked pregnancy checks and foaling records are visible and navigable.
- Adding a pregnancy check from detail preselects the current breeding event.
- Linked stallion and collection rows navigate when valid links exist.
- Soft-deleted mare/stallion links render as historical plain text instead of broken navigation.
- Returning from edit screens refreshes detail data.
- Deleting the breeding record from the edit form leaves the stale detail screen without a misleading missing-record alert.
- No schema migration is introduced.
- Typecheck, targeted tests, broader screen tests, and lint pass.
