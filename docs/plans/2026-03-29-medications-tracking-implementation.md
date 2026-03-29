# Medications Tracking — Implementation Plan

## Goal

Implement the medications tracking feature defined in
`docs/plans/2026-03-29-medications-tracking-design.md` with the approved fixes:

- recent-streak medication gap alerts only
- alert navigation opens Mare Detail on the Meds tab
- medication route selection is clearable via shared form control support
- Mare Calendar only shows medication timeline items for the selected day

---

## Delivery Order

### Phase 1: Storage and Domain Model

Implement the persistence layer first so every downstream screen can build on stable types and queries.

Files:
- `src/models/types.ts`
- `src/storage/migrations/index.ts`
- `src/storage/repositories/queries.ts`
- `src/utils/medications.ts`

Work:
- Add `MedicationRoute` and `MedicationLog` types.
- Add migration `006_create_medication_logs`.
- Add medication row typing, mapping, CRUD, mare-scoped listing, and global listing functions.
- Add medication constants and route formatting helpers.

Acceptance:
- Type definitions compile cleanly.
- Migration is appended correctly and follows existing repository patterns.
- Repository functions match current naming and return shapes.

### Phase 2: Navigation and Shared Form Control

Add the route surfaces required for the new screen and make the shared selector support clearable route values without one-off form logic.

Files:
- `src/navigation/AppNavigator.tsx`
- `src/components/FormControls.tsx`

Work:
- Add `MedicationForm` to `RootStackParamList`.
- Extend `MareDetail` params with optional `initialTab`.
- Register `MedicationFormScreen`.
- Extend `OptionSelector` with nullable selection support and `allowDeselect`.

Acceptance:
- Existing callers of `OptionSelector` retain current behavior.
- New `MedicationForm` route typechecks everywhere.

### Phase 3: Medication Form and Meds Tab

Build the feature’s primary UI once storage and navigation are ready.

Files:
- `src/screens/MedicationFormScreen.tsx`
- `src/screens/mare-detail/MedicationsTab.tsx`
- `src/screens/mare-detail/index.ts`

Work:
- Implement create/edit/delete medication form using existing form-screen conventions.
- Support predefined medications plus custom free-text medication entry.
- Support optional dose, route, and notes.
- Support clearable route selection.
- Add Meds tab with add button, empty state, and editable medication cards.

Acceptance:
- Create/edit/delete flows mirror existing record form behavior.
- Form validation blocks empty medication names and future dates.
- Meds tab renders empty and populated states correctly.

### Phase 4: Mare Detail Integration

Wire medication data into the main mare workflow.

Files:
- `src/screens/MareDetailScreen.tsx`

Work:
- Load medication logs in the existing mare detail data fetch.
- Add Meds as the fifth tab.
- Respect `route.params.initialTab` when opening the screen.
- Pass medication logs into `MedicationsTab`.

Acceptance:
- Alert-driven navigation can open directly on the Meds tab.
- Standard navigation still defaults to the first tab.

### Phase 5: Calendar and Timeline Integration

Expose medication activity in the calendar dots and timeline history.

Files:
- `src/utils/timelineEvents.ts`
- `src/utils/calendarMarking.ts`
- `src/screens/mare-detail/TimelineTab.tsx`
- `src/screens/MareCalendarScreen.tsx`

Work:
- Add `medication` timeline event support.
- Add teal medication dots and legend entry.
- Render medication cards in the timeline.
- Load medication logs on the mare calendar screen.
- Filter medication logs by `selectedDay` before passing them to `TimelineTab`.

Acceptance:
- Medication days show teal dots.
- Selected-day timeline only shows medication records for that day.

### Phase 6: Dashboard Alerts

Add recent-streak medication gap alerts without creating long-lived false positives.

Files:
- `src/utils/dashboardAlerts.ts`
- `src/components/AlertCard.tsx`
- `src/screens/HomeScreen.tsx`

Work:
- Add `medicationGap` alert kind and medication logs to dashboard input.
- Implement recent-streak heuristic with `MEDICATION_GAP_MIN_STREAK_DAYS` and `MEDICATION_GAP_ACTIVE_WINDOW_DAYS`.
- Add alert card icon/color configuration.
- Bulk-load medication logs on the home screen.
- Route medication gap alerts to `MareDetail` with `initialTab: 'meds'`.

Acceptance:
- Alerts only appear for likely-active recent daily medication patterns.
- Tapping a medication gap alert lands on the Meds tab for the correct mare.

### Phase 7: Test and Verify

Finish with targeted regression coverage and manual QA.

Files:
- `src/utils/dashboardAlerts.test.ts`
- `src/utils/calendarMarking.test.ts`
- `src/utils/timelineEvents.test.ts`
- `src/components/FormControls.tsx` test coverage if present, otherwise add a focused UI test in the closest existing test location

Work:
- Add gap-detection tests, including stale-course suppression.
- Add medication calendar marking coverage.
- Add medication timeline event coverage.
- Add route deselection coverage.
- Run typecheck and full test suite.
- Perform manual verification across form, tabs, calendar, and dashboard.

Acceptance:
- `npm run typecheck` passes.
- `npm test` passes.
- Manual QA covers the critical user paths in the design doc.

---

## Dependency Notes

- Do not start UI work before repository and route types are in place.
- Do not wire dashboard alerts before `listAllMedicationLogs` exists.
- Do not implement route deselection only inside the medication screen; the shared control change is part of the approved design.
- Calendar selected-day filtering must be implemented in `MareCalendarScreen`, not inside `TimelineTab`.

---

## Checkbox Task List

### Storage and Types

- [ ] Add `MedicationRoute` and `MedicationLog` to `src/models/types.ts`
- [ ] Add migration `006_create_medication_logs` to `src/storage/migrations/index.ts`
- [ ] Add `MedicationLogRow` to `src/storage/repositories/queries.ts`
- [ ] Add `mapMedicationLogRow` to `src/storage/repositories/queries.ts`
- [ ] Add `createMedicationLog`
- [ ] Add `getMedicationLogById`
- [ ] Add `listMedicationLogsByMare`
- [ ] Add `listAllMedicationLogs`
- [ ] Add `updateMedicationLog`
- [ ] Add `deleteMedicationLog`
- [ ] Create `src/utils/medications.ts`
- [ ] Add predefined medication constants
- [ ] Add medication route options
- [ ] Add `formatRoute`

### Navigation and Shared Controls

- [ ] Extend `MareDetail` route params with `initialTab?`
- [ ] Add `MedicationForm` to `RootStackParamList`
- [ ] Register `MedicationFormScreen` in `src/navigation/AppNavigator.tsx`
- [ ] Update `OptionSelector` props to allow nullable changes
- [ ] Add `allowDeselect` behavior to `OptionSelector`
- [ ] Confirm existing `OptionSelector` callers still behave the same

### Medication Form

- [ ] Create `src/screens/MedicationFormScreen.tsx`
- [ ] Add create mode defaults
- [ ] Add edit mode loading via `getMedicationLogById`
- [ ] Add dynamic header title
- [ ] Add predefined medication selection
- [ ] Add custom medication text entry path
- [ ] Add date field with no-future-date guard
- [ ] Add optional dose field
- [ ] Add optional route field with deselect support
- [ ] Add optional notes field
- [ ] Add save flow for create/update
- [ ] Add delete flow for edit mode
- [ ] Add duplicate/load/save/delete error handling consistent with existing screens

### Mare Detail Meds Tab

- [ ] Create `src/screens/mare-detail/MedicationsTab.tsx`
- [ ] Export `MedicationsTab` from `src/screens/mare-detail/index.ts`
- [ ] Add Meds to `TAB_OPTIONS`
- [ ] Add medication logs state to `MareDetailScreen`
- [ ] Load medication logs in `MareDetailScreen` `Promise.all`
- [ ] Add `initialTab` to tab index initialization
- [ ] Pass `initialTabIndex` into `PagerView`
- [ ] Render `MedicationsTab` as the fifth page
- [ ] Wire add button to `MedicationForm`
- [ ] Wire edit button to `MedicationForm`

### Calendar and Timeline

- [ ] Add `medication` to `TimelineEventType`
- [ ] Extend `TimelineEvent.data` to include `MedicationLog`
- [ ] Add medication event mapping in `buildTimelineEvents`
- [ ] Add medication color to `calendarMarking.ts`
- [ ] Add medication legend entry
- [ ] Add `medicationLogs` parameter to `buildCalendarMarking`
- [ ] Add medication badge label and color to `TimelineTab`
- [ ] Add `MedicationCard` renderer to `TimelineTab`
- [ ] Add `medicationLogs` prop to `TimelineTab`
- [ ] Load medication logs in `MareCalendarScreen`
- [ ] Pass medication logs into `buildCalendarMarking`
- [ ] Filter medication logs by `selectedDay`
- [ ] Pass filtered medication logs into `TimelineTab`

### Dashboard Alerts

- [ ] Add `MEDICATION_GAP_MIN_STREAK_DAYS`
- [ ] Add `MEDICATION_GAP_ACTIVE_WINDOW_DAYS`
- [ ] Add `medicationGap` to `AlertKind`
- [ ] Add `medicationLogs` to `DashboardInput`
- [ ] Implement `checkMedicationGap`
- [ ] Group medication logs by mare in `generateDashboardAlerts`
- [ ] Push medication gap alerts into the alerts list
- [ ] Add `medicationGap` icon/color to `src/components/AlertCard.tsx`
- [ ] Load `listAllMedicationLogs` in `HomeScreen`
- [ ] Pass medication logs into `generateDashboardAlerts`
- [ ] Route medication gap alert presses to `MareDetail` with `initialTab: 'meds'`

### Tests

- [ ] Add dashboard alert test for recent consecutive-day gap
- [ ] Add dashboard alert test for single-dose no-alert behavior
- [ ] Add dashboard alert test for streak ending today
- [ ] Add dashboard alert test for stale historical streak suppression
- [ ] Add dashboard alert test for duplicate same-day logs counting as one day
- [ ] Add calendar marking test for medication dot rendering
- [ ] Add timeline event test for medication inclusion
- [ ] Add selected-day timeline test for medication filtering
- [ ] Add route deselection test for `OptionSelector`

### Verification

- [ ] Run `npm run typecheck`
- [ ] Run `npm test`
- [ ] Manually create a medication log from the Meds tab
- [ ] Manually edit a medication log
- [ ] Manually delete a medication log
- [ ] Verify custom medication entry works
- [ ] Verify route deselection works
- [ ] Verify teal calendar dots appear on medication days
- [ ] Verify selected-day timeline only shows that day’s medication entries
- [ ] Verify medication gap alert appears for recent missed daily course
- [ ] Verify medication gap alert tap opens Mare Detail on the Meds tab

---

## Done Criteria

This feature is done when:

- medication logs can be created, edited, deleted, and viewed per mare
- medication events appear in calendar dots and timeline history
- dashboard medication alerts use the bounded recent-streak heuristic
- alert taps open the Meds tab directly
- shared route selection supports clearing without regressions
- tests and manual verification pass
