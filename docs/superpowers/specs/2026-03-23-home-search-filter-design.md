# Home Screen Search & Filter

## Problem

The home screen mare list is a flat, unfiltered list. With up to 30 mares, finding a specific mare or narrowing to pregnant/open mares requires scrolling and tapping into each detail screen.

## Solution

Add a search bar and status filter chips to the home screen, filtering the already-loaded mare list client-side.

## UI Layout

Above the existing `FlatList`, in order:

1. **Search bar** — `TextInput` with placeholder "Search mares...", a `magnify` icon on the left, and a `close-circle` clear button on the right (visible only when text is present). 44px height.
2. **Filter chips** — Horizontal row of three tappable pills: `All` | `Pregnant` | `Open`. Active chip is filled (`colors.primary` background, white text). Inactive chips are outlined (`colors.surface` background, `colors.onSurface` text, 1px `colors.outline` border). Pill shape via large `borderRadius`. Defaults to `All`.
3. Spacing: `spacing.md` between search bar, filter chips, and the mare list.

## Filtering Logic

All client-side using the existing loaded data:

- **Search:** Case-insensitive substring match on `mare.name`.
- **Status filter:**
  - `All` — no filtering.
  - `Pregnant` — only mares with an entry in the existing `pregnantInfo` map.
  - `Open` — only mares without an entry in `pregnantInfo`.
- **Combined:** Search and status filter stack. A mare must match both to appear.
- **Empty state:** When the filtered list is empty, show "No mares match your search." instead of the regular empty state.

## State

Two new state variables in `HomeScreen`:

- `searchText: string` — defaults to `''`
- `statusFilter: 'all' | 'pregnant' | 'open'` — defaults to `'all'`

One new `useMemo`:

```typescript
const filteredMares = useMemo(() => {
  return mares.filter((mare) => {
    const matchesSearch =
      searchText === '' ||
      mare.name.toLowerCase().includes(searchText.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'pregnant' && pregnantInfo.has(mare.id)) ||
      (statusFilter === 'open' && !pregnantInfo.has(mare.id));

    return matchesSearch && matchesStatus;
  });
}, [mares, searchText, statusFilter, pregnantInfo]);
```

The `FlatList` data source changes from `mares` to `filteredMares`.

## Styling

All values from the existing `theme.ts`:

- **Search bar:** `colors.surface` background, `borderRadius.md`, 44px height, `colors.onSurface` text, `colors.onSurfaceVariant` placeholder. `MaterialCommunityIcons` `magnify` icon (left) and `close-circle` clear button (right, conditional).
- **Filter chips:** `spacing.sm` gap. Active: `colors.primary` bg, `#FFFFFF` text. Inactive: `colors.surface` bg, `colors.onSurface` text, 1px `colors.outline` border. Pill shape via `borderRadius.full`.
- **Spacing:** `spacing.md` between search bar, filter chips, and mare list.

## Scope

### Files changed

1. `src/screens/HomeScreen.tsx` — the only file modified.

### What changes

- Add `useMemo` to React imports, `TextInput` to react-native imports.
- Two new state variables (`searchText`, `statusFilter`).
- One `useMemo` for `filteredMares`.
- Search `TextInput` rendered above the list.
- Filter chip row rendered between search bar and list.
- `FlatList` `data` prop switches to `filteredMares`.
- Updated empty state message when filters produce zero results.
- New `StyleSheet` entries for search bar and filter chips.

### What does not change

- No new screens or navigation routes.
- No schema or migration changes.
- No new repository queries.
- No changes to data loading logic.

## Design Decisions

- **Client-side filtering chosen over SQL-level filtering** because the home screen already loads all mares and derives pregnancy status in memory. At ~30 mares, in-memory filtering is instant and avoids duplicating pregnancy derivation logic in SQL.
- **Name-only search** because it covers the primary use case. Breed and registration number search can be added later if needed.
- **Three-state filter (All/Pregnant/Open)** keeps it simple and maps directly to the pregnancy status already derived on the home screen.
