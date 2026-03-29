# Move Timeline to Dedicated History Screen

## Summary

The mare detail screen's 5 tab pills overflow to a second row. The Timeline tab is conceptually distinct from the other 4 (read-only aggregated view vs. CRUD record types), so we move it to a dedicated "History" screen accessed via a clock icon in the mare header card. This restores the clean 4-pill layout.

## Architecture

### Navigation

Add a new stack route `MareTimeline` with param `{ mareId: string }`. The screen title dynamically updates to the mare's name (matching MareDetailScreen pattern via `navigation.setOptions`). The route is pushed from the clock icon button in the mare detail header card.

### MareTimelineScreen (new)

A new screen at `src/screens/MareTimelineScreen.tsx` that:
- Accepts `mareId` from route params
- Loads all reproductive data (daily logs, breeding records, pregnancy checks, foaling records, foals, stallions) using the same repository queries as MareDetailScreen
- Passes loaded data to the existing `TimelineTab` component
- Uses the `Screen` wrapper for layout consistency
- Shows loading indicator and error state

### MareDetailScreen (modified)

- `TAB_OPTIONS` reduced to 4 entries: Daily Logs, Breeding, Pregnancy, Foaling
- PagerView renders 4 children (TimelineTab removed)
- `TimelineTab` import removed
- Clock icon (`IconButton` with `🕓`) added to `cardHeader` View, positioned before the edit pencil
- Clock icon navigates to `MareTimeline` route with current `mareId`
- `initialPage` remains 0 (now Daily Logs)

### Icon

Uses the existing `IconButton` component with unicode character `🕓` (U+1F553), matching the `✎` pattern already used for the edit button. Both render as `Text` elements inside a `Pressable`.

## Data Flow

```
MareDetailScreen                    MareTimelineScreen
┌───────────────────┐               ┌───────────────────┐
│ headerCard        │               │ Screen wrapper     │
│  [🕓] [✎]        │──navigate──>  │ loads own data     │
│ [Logs][Breed]...  │               │ renders TimelineTab│
│ PagerView (4 tabs)│               └───────────────────┘
└───────────────────┘
```

MareTimelineScreen loads its own data independently rather than receiving it via navigation params. This avoids serializing large arrays through the navigation layer and ensures fresh data on each visit.

## Components

| Component | File | Change |
|-----------|------|--------|
| AppNavigator | `src/navigation/AppNavigator.tsx` | Add `MareTimeline` route |
| MareTimelineScreen | `src/screens/MareTimelineScreen.tsx` | New file |
| MareDetailScreen | `src/screens/MareDetailScreen.tsx` | Remove Timeline tab, add clock icon |
| TimelineTab | `src/screens/mare-detail/TimelineTab.tsx` | Widen `navigation` prop type to accept `'MareDetail' \| 'MareTimeline'` route (currently hardcoded to `'MareDetail'`) |

## Error Handling

MareTimelineScreen replicates the same error handling pattern as MareDetailScreen: try/catch around data loading, error state displayed as text, loading indicator while fetching.

## Testing Strategy

- Typecheck: `npm run typecheck`
- Unit tests: `npm test` (existing tests should pass; no behavioral changes to existing components)
- Manual: verify 4 pills fit on one row, clock icon navigates correctly, timeline content is identical
