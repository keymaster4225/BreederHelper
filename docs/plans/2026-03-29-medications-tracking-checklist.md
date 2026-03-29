# Medications Tracking — Checklist

## Storage and Types

- [ ] Add `MedicationRoute` and `MedicationLog` to `src/models/types.ts`
- [ ] Add migration `006_create_medication_logs` to `src/storage/migrations/index.ts`
- [ ] Add medication row typing and mapper in `src/storage/repositories/queries.ts`
- [ ] Add medication CRUD and listing functions in `src/storage/repositories/queries.ts`
- [ ] Create `src/utils/medications.ts`
- [ ] Add predefined medications, route options, and `formatRoute`

## Navigation and Shared Controls

- [ ] Extend `MareDetail` route params with `initialTab?`
- [ ] Add `MedicationForm` to `RootStackParamList`
- [ ] Register `MedicationFormScreen` in `src/navigation/AppNavigator.tsx`
- [ ] Add nullable `onChange` support to `OptionSelector`
- [ ] Add `allowDeselect` behavior to `OptionSelector`
- [ ] Verify existing `OptionSelector` callers remain unchanged

## Medication Form

- [ ] Create `src/screens/MedicationFormScreen.tsx`
- [ ] Implement create mode defaults
- [ ] Implement edit mode load flow
- [ ] Add dynamic header title
- [ ] Add predefined medication selection
- [ ] Add custom medication entry path
- [ ] Add date validation and future-date guard
- [ ] Add dose, route, and notes fields
- [ ] Add save flow
- [ ] Add delete flow
- [ ] Add error handling

## Mare Detail

- [ ] Create `src/screens/mare-detail/MedicationsTab.tsx`
- [ ] Export `MedicationsTab` from `src/screens/mare-detail/index.ts`
- [ ] Add Meds to `TAB_OPTIONS`
- [ ] Add medication logs state to `MareDetailScreen`
- [ ] Load medication logs in mare detail `Promise.all`
- [ ] Honor `initialTab` when opening Mare Detail
- [ ] Add MedicationsTab as the fifth pager page

## Calendar and Timeline

- [ ] Add `medication` to `TimelineEventType`
- [ ] Include `MedicationLog` in `TimelineEvent.data`
- [ ] Map medication logs in `buildTimelineEvents`
- [ ] Add medication dot color and legend entry in `calendarMarking.ts`
- [ ] Add medication card support in `TimelineTab.tsx`
- [ ] Add `medicationLogs` prop to `TimelineTab`
- [ ] Load medication logs in `MareCalendarScreen.tsx`
- [ ] Pass medication logs to `buildCalendarMarking`
- [ ] Filter medication logs by `selectedDay`
- [ ] Pass filtered medication logs into `TimelineTab`

## Dashboard Alerts

- [ ] Add `MEDICATION_GAP_MIN_STREAK_DAYS`
- [ ] Add `MEDICATION_GAP_ACTIVE_WINDOW_DAYS`
- [ ] Add `medicationGap` to `AlertKind`
- [ ] Add `medicationLogs` to `DashboardInput`
- [ ] Implement `checkMedicationGap`
- [ ] Group medication logs by mare in `generateDashboardAlerts`
- [ ] Add medication alert styling in `src/components/AlertCard.tsx`
- [ ] Load `listAllMedicationLogs` in `HomeScreen.tsx`
- [ ] Pass medication logs into `generateDashboardAlerts`
- [ ] Route medication alerts to `MareDetail` with `initialTab: 'meds'`

## Tests

- [ ] Add gap alert test for recent consecutive-day gap
- [ ] Add gap alert test for single-dose no-alert behavior
- [ ] Add gap alert test for streak ending today
- [ ] Add gap alert test for stale historical streak suppression
- [ ] Add gap alert test for duplicate same-day logs counting as one day
- [ ] Add calendar marking test for medication dots
- [ ] Add timeline event test for medication events
- [ ] Add selected-day timeline filtering test
- [ ] Add route deselection test

## Verification

- [ ] Run `npm run typecheck`
- [ ] Run `npm test`
- [ ] Verify create/edit/delete medication flows manually
- [ ] Verify custom medication entry manually
- [ ] Verify route deselection manually
- [ ] Verify teal calendar dots manually
- [ ] Verify selected-day medication timeline filtering manually
- [ ] Verify medication gap alert behavior manually
- [ ] Verify medication alert tap opens the Meds tab manually
