# Mare Calendar View Design

**Date:** 2026-03-27
**Status:** Draft

## Summary

Replace the per-mare History screen (`MareTimelineScreen`) with a visual calendar view (`MareCalendarScreen`). The calendar shows a monthly grid with colored dots indicating reproductive events (heat, ovulation, breeding, pregnancy check, foaling). Tapping a day reveals event cards below the calendar. The calendar icon on mare detail header replaces the current history icon.

This is the same data the timeline showed, presented as a scannable monthly grid so breeders can spot patterns at a glance -- heat cycle timing, breeding-to-check intervals, seasonal trends.

## Architecture

### Screen Structure

```
MareCalendarScreen
├── Calendar (react-native-calendars)
│   └── markedDates built from buildCalendarMarking()
├── Legend row (5 colored dots with labels)
└── Day detail section (ScrollView)
    └── TimelineTab (reused, filtered to selected day)
```

### Data Flow

1. Screen receives `mareId` from navigation params
2. `useFocusEffect` loads all records via `Promise.all` (same pattern as current `MareTimelineScreen`)
3. `buildCalendarMarking()` transforms records into `react-native-calendars` `markedDates` object
4. On day press: filter raw records to only those matching the selected date, pass to `TimelineTab`
5. `TimelineTab` renders event cards with edit navigation (existing behavior, fully reused)

### Library

**`react-native-calendars`** -- multi-dot marking type. Provides:
- Monthly grid with built-in month navigation arrows
- `markedDates` prop accepting multiple colored dots per day
- Theme customization to match equestrian color scheme
- `onDayPress` callback for day selection

## Screen Layout

```
┌──────────────────────────────────┐
│  ←  Calendar            (header) │
├──────────────────────────────────┤
│     ◄   March 2026   ►          │
│  Su  Mo  Tu  We  Th  Fr  Sa     │
│                   1   2   3      │
│   4   5   6   7   8   9  10     │
│  11  12  13  14  15● 16  17     │
│  18  19  20  21  22  23  24     │
│  25  26  27  28  29  30  31     │
├──────────────────────────────────┤
│ ● Heat  ● Ovul  ● Bred  ...     │
├──────────────────────────────────┤
│  March 15                        │
│ ┌──────────────────────────────┐ │
│ │ Heat    Score: 4      ✎     │ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ Breeding  Live Cover   ✎    │ │
│ │ Stallion: Thunder             │ │
│ └──────────────────────────────┘ │
│                                  │
│  (or "No events on this date")   │
└──────────────────────────────────┘
```

- Calendar grid: fixed height (~320px), not scrollable
- Legend: single row, fixed height
- Day events: fills remaining space, scrollable via `TimelineTab`'s `ScrollView`

## Calendar Marking

### Color Scheme

| Event Type | Color | Hex | Dot Key |
|---|---|---|---|
| Heat (teasing >= 4 OR edema >= 4) | Orange | `#FF9800` | `heat` |
| Ovulation (ovulationDetected) | Purple | `#9C27B0` | `ovulation` |
| Breeding (any record) | Blue | `#2196F3` | `breeding` |
| Pregnancy Check (pos or neg) | Green | `#4CAF50` | `pregnancyCheck` |
| Foaling (any record) | Pink | `#E91E63` | `foaling` |

Regular daily logs without heat-level scores or ovulation are NOT shown as dots.

### Marking Builder

New utility `src/utils/calendarMarking.ts`:

```typescript
function buildCalendarMarking(
  dailyLogs: readonly DailyLog[],
  breedingRecords: readonly BreedingRecord[],
  pregnancyChecks: readonly PregnancyCheck[],
  foalingRecords: readonly FoalingRecord[],
  selectedDay: LocalDate | null,
): MarkedDates
```

Returns a `MarkedDates` object keyed by `LocalDate` string, with `dots` array and optional `selected` flag. Reuses `buildTimelineEvents` from `timelineEvents.ts` to determine which dates have which event types (avoids duplicating heat/ovulation classification logic).

### Heat detection fix

Update `filterDailyLogs` in `src/utils/timelineEvents.ts` to also detect heat when `edema >= 4` (currently only checks `teasingScore >= 4`). This aligns with the dashboard alert logic in `dashboardAlerts.ts` and ensures calendar dots and event cards agree on what counts as a heat day.

**Note:** When a daily log has both `ovulationDetected` and high heat scores (teasing >= 4 or edema >= 4), ovulation takes priority and the heat signal is intentionally suppressed. This is the existing behavior and is correct -- ovulation is the more significant event.

## Day Detail Section

Reuse `TimelineTab` component directly from `src/screens/mare-detail/TimelineTab.tsx`:

1. Filter each record array (dailyLogs, breeding, pregnancy, foaling) to only include records where `record.date === selectedDay`
2. Pass filtered arrays to `TimelineTab`
3. `TimelineTab` calls `buildTimelineEvents` and renders event cards with edit/navigation capability

When no day is selected or the selected day has no events, show: "No events on this date."

### Updated Event Colors

Update `EVENT_COLORS` in `TimelineTab.tsx` to match the new calendar dot colors for visual consistency:
- `ovulation`: `#EF6C00` → `#9C27B0` (purple)
- `breeding`: `colors.secondary` → `#2196F3` (blue)
- `foaling`: `colors.positive` → `#E91E63` (pink)

### Navigation type fix

Update `TimelineTab`'s `Props` type: change `navigation` prop from `NativeStackNavigationProp<RootStackParamList, 'MareDetail' | 'MareTimeline'>` to `NativeStackNavigationProp<RootStackParamList, 'MareDetail' | 'MareCalendar'>` to match the renamed route.

## Calendar Theming

Match the equestrian theme:
- `todayTextColor`: `colors.primary` (#97B498)
- `selectedDayBackgroundColor`: `colors.primary` (#97B498)
- `selectedDayTextColor`: `#FFFFFF`
- `arrowColor`: `colors.primary`
- `monthTextColor`: `colors.onSurface`
- `textDayFontFamily`: Inter (sans-serif body)
- `textMonthFontFamily`: Lora (serif headers)
- Background: `colors.surface` (#FDFBF7)

## Navigation Changes

### Route update

In `AppNavigator.tsx`:
- Rename route from `MareTimeline` to `MareCalendar`
- Update `RootStackParamList`: `MareCalendar: { mareId: string }`
- Register `MareCalendarScreen` instead of `MareTimelineScreen`
- Header title: "Calendar"

### Mare detail icon

In `MareDetailScreen.tsx` (line 126):
- Change `MaterialIcons name="history"` to `MaterialCommunityIcons name="calendar-month"`
- Change navigation target from `'MareTimeline'` to `'MareCalendar'`
- Update accessibility label to "View Calendar"

## Files

### New
- `src/screens/MareCalendarScreen.tsx` -- main calendar screen
- `src/utils/calendarMarking.ts` -- builds `markedDates` from records

### Modified
- `src/navigation/AppNavigator.tsx` -- route rename + screen swap
- `src/screens/MareDetailScreen.tsx` -- icon change + navigation target
- `src/screens/mare-detail/TimelineTab.tsx` -- update `EVENT_COLORS` to new scheme
- `src/utils/timelineEvents.ts` -- add edema-based heat detection to `filterDailyLogs`
- `package.json` / `package-lock.json` -- add `react-native-calendars`

### Deleted
- `src/screens/MareTimelineScreen.tsx` -- replaced by `MareCalendarScreen`

## Testing Strategy

### Unit tests
- `calendarMarking.test.ts`: verify `buildCalendarMarking` produces correct dots for each event type, handles multiple events on same day, handles empty data, marks selected day
- `timelineEvents.test.ts`: add test for edema-based heat detection (existing tests should still pass)

### Manual verification
1. Install `react-native-calendars`, run `npm install`
2. Navigate to mare detail, tap calendar icon
3. Verify calendar shows with current month, today highlighted
4. Verify colored dots appear on dates with events
5. Tap a day with events -- verify cards appear below with correct data
6. Tap edit on an event card -- verify navigation to correct form
7. Navigate months forward/back -- verify dots update
8. Tap a day with no events -- verify empty state message
9. Verify legend shows all 5 event types with correct colors
10. Run `npm run typecheck` and `npm test`
