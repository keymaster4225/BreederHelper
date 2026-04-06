# BreedWise Style Guide

This document is the authoritative reference for building screens in the BreedWise app. Follow these patterns exactly when creating or modifying UI.

## Tech Stack

- React Native 0.83 + Expo SDK 55 + TypeScript
- React Navigation (native stack + bottom tabs)
- `expo-sqlite` for data, `@expo/vector-icons` (MaterialCommunityIcons) for icons
- Custom fonts: **Lora** (serif, headings) and **Inter** (sans-serif, body/labels)
- Import alias: `@/*` maps to `src/*`

---

## Theme Tokens

All visual values come from `src/theme.ts`. Never use raw hex values in screens — always import from theme.

### Colors

```
Primary (sage green):
  primary:            '#97B498'   -- Buttons, FAB, active tabs, checkboxes
  onPrimary:          '#FFFFFF'   -- Text/icons on primary backgrounds
  primaryContainer:   '#D5E5D6'   -- Light green containers, first-run buttons
  onPrimaryContainer: '#2E5A30'   -- Dark text on primary containers

Secondary (tan/gold):
  secondary:            '#C19A6B' -- Supporting actions, alert accents
  onSecondary:          '#FFFFFF'
  secondaryContainer:   '#F0E2CE' -- Tags, shipped badges
  onSecondaryContainer: '#5C3D1F'

Tertiary (warm brown):
  tertiary:            '#8B7355'  -- Accent elements
  onTertiary:          '#FFFFFF'
  tertiaryContainer:   '#E8DCCC'
  onTertiaryContainer: '#3E2F1C'

Error:
  error:            '#BA1A1A'     -- Error text, validation messages
  onError:          '#FFFFFF'
  errorContainer:   '#FFDAD6'     -- Delete button background
  onErrorContainer: '#410002'

Surface (cream):
  surface:          '#FDFBF7'     -- App background, input backgrounds
  onSurface:        '#4A3728'     -- Primary text (dark cocoa)
  surfaceVariant:   '#F4EFE0'     -- Card backgrounds, icon button bg
  onSurfaceVariant: '#706259'     -- Secondary text, labels, hints

Outline:
  outline:        '#C4B5A4'       -- Active borders, filter chip borders
  outlineVariant: '#DDD4C5'       -- Subtle borders, card borders, input borders

Semantic (domain-specific):
  positive:  '#4CAF50'   -- Positive pregnancy result
  negative:  '#E53935'   -- Negative pregnancy result
  heartbeat: '#EC407A'   -- Heartbeat indicator
  pregnant:  '#66BB6A'   -- Pregnant status badge, live foal outcome
  foaled:    '#42A5F5'   -- Foaled status
  loss:      '#EF5350'   -- Embryonic loss / abortion
  open:      '#78909C'   -- Open / not pregnant

Teasing/Edema score scale (0-5):
  score0: '#9E9E9E'   -- No interest (gray)
  score1: '#FFCC80'   -- Minimal (light orange)
  score2: '#FFB74D'   -- Mild
  score3: '#FFA726'   -- Moderate
  score4: '#FF9800'   -- Strong
  score5: '#EF6C00'   -- Standing heat / max (dark orange)

Foal sex:
  colt:  '#5B9BD5'    -- Blue
  filly: '#E48BA5'    -- Pink
```

### Typography

Headlines use `fontFamily: 'Lora_400Regular'`. Titles/body/labels use `fontFamily: 'Inter_500Medium'` or `'Inter_400Regular'`.

```
headlineLarge:  { fontSize: 32, fontWeight: '400', lineHeight: 40 }
headlineMedium: { fontSize: 28, fontWeight: '400', lineHeight: 36 }
headlineSmall:  { fontSize: 24, fontWeight: '400', lineHeight: 32 }

titleLarge:  { fontSize: 22, fontWeight: '400', lineHeight: 28 }
titleMedium: { fontSize: 16, fontWeight: '500', lineHeight: 24, letterSpacing: 0.15 }
titleSmall:  { fontSize: 14, fontWeight: '500', lineHeight: 20, letterSpacing: 0.1 }

bodyLarge:  { fontSize: 16, fontWeight: '400', lineHeight: 24, letterSpacing: 0.15 }
bodyMedium: { fontSize: 14, fontWeight: '400', lineHeight: 20, letterSpacing: 0.25 }
bodySmall:  { fontSize: 12, fontWeight: '400', lineHeight: 16, letterSpacing: 0.4 }

labelLarge:  { fontSize: 14, fontWeight: '500', lineHeight: 20, letterSpacing: 0.1 }
labelMedium: { fontSize: 12, fontWeight: '500', lineHeight: 16, letterSpacing: 0.5 }
labelSmall:  { fontSize: 11, fontWeight: '500', lineHeight: 16, letterSpacing: 0.5 }
```

Header card names use `fontFamily: 'Lora_700Bold', fontWeight: '700'` on top of `titleMedium`.

### Spacing

4-point base unit system. Use these for all padding, margins, and gaps.

```
xs:   4    -- Between card rows, minimal gaps
sm:   8    -- Between form fields, badge padding, icon gaps
md:   12   -- Main content gaps, card padding
lg:   16   -- Screen edge padding, section gaps
xl:   20   -- Between major sections
xxl:  24   -- Large section spacing
xxxl: 32   -- ScrollView bottom padding in tabs
```

### Border Radius

```
sm:   8    -- Form inputs, icon wraps, checkboxes
md:   12   -- Cards, alert cards, modal sheets
lg:   24   -- Header cards, list row cards, action cards
xl:   32   -- Buttons (PrimaryButton, SecondaryButton, DeleteButton)
full: 9999 -- Pill badges, filter chips, tab buttons, FAB
```

### Elevation

```
level0: No shadow
level1: { shadowOffset: {0,1}, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }
        Used on: cards, list rows, stat cards, action cards
level2: { shadowOffset: {0,2}, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 }
        Used on: detail header cards
level3: { shadowOffset: {0,4}, shadowOpacity: 0.10, shadowRadius: 8, elevation: 6 }
        Rarely used
```

---

## Shared Components

All live in `src/components/`. Always use these instead of building from scratch.

### Screen (`Screen.tsx`)

Wraps every screen. Provides SafeAreaView + padding.

```tsx
<Screen>
  {/* screen content */}
</Screen>
```

- Background: `colors.surface`
- Padding: `spacing.lg` (16px) all sides
- Flex: 1

### Buttons (`Buttons.tsx`)

| Component | Background | Text Color | Border | Radius | Use |
|-----------|-----------|-----------|--------|--------|-----|
| `PrimaryButton` | `primary` | `onPrimary` | none | `xl` | Main save/add actions |
| `SecondaryButton` | transparent | `onSurface` | `outlineVariant` 1px | `xl` | Secondary actions |
| `IconButton` | `surfaceVariant` | `onSurface` | none | `xl` | 28x28 icon buttons |
| `DeleteButton` | `errorContainer` | `error` | none | `xl` | Destructive actions |

All buttons: `paddingVertical: spacing.md`, pressed opacity 0.85 (primary/delete) or 0.7 (secondary).

`IconButton` accepts either a string (rendered as text) or ReactNode (e.g. MaterialCommunityIcons). It has 8px `hitSlop`.

### Form Controls (`FormControls.tsx`)

**FormField** — label + error wrapper for any input:
```tsx
<FormField label="Name" required error={errors.name}>
  <FormTextInput value={name} onChangeText={setName} placeholder="Mare name" />
</FormField>
```
- Label: `labelLarge`, `colors.onSurface`
- Required: appends " *"
- Error: `bodySmall`, `colors.error`, shown below input

**FormTextInput** — styled TextInput:
- Background: `colors.surface`, border: 1px `outlineVariant`, radius: `borderRadius.md`
- Min height: 48px, padding: horizontal `md`, vertical `sm`
- Multiline variant: min height 90px, `textAlignVertical: 'top'`

**FormDateInput** — pressable that opens DateTimePicker:
- Props: `value`, `onChange`, `clearable?`, `displayFormat?` ('MM-DD-YYYY' or 'YYYY-MM-DD'), `maximumDate?`
- iOS: spinner display. Android: default display.
- Optional "Clear" button appears when value exists.

**FormPickerInput** / **FormSelectInput** — pressable that opens modal dropdown:
- Modal: black 0.4 opacity backdrop, `surface` sheet, `borderRadius.lg`, max 360px height
- Options: 48px min height, `bodyLarge` text, selected option shown in `primary` color with `labelLarge`

**OptionSelector** — horizontal row of pill radio buttons:
- Inactive: `surface` bg, 1px `outline` border
- Active: `primary` bg, `primary` border, `onPrimary` text
- Radius: `borderRadius.full`, min height 44px, `flexWrap: 'wrap'`

**FormCheckbox** — checkbox + label:
- Box: 24x24px, 2px border, radius `sm`. Checked: `primary` bg, white checkmark.
- Label: `labelLarge`, min row height 44px

**formStyles.form** — use as ScrollView `contentContainerStyle`:
```tsx
<ScrollView contentContainerStyle={formStyles.form}>
```
`{ gap: spacing.lg, paddingBottom: spacing.xl }`

### Record Card Parts (`RecordCardParts.tsx`)

**CardRow** — label/value pair in a row:
```tsx
<CardRow label="Method" value="Fresh AI" />
```
- Label: `bodySmall`, `onSurfaceVariant`. Value: `bodyMedium`, `onSurface`. Shows "-" if null.

**ScoreBadge** — colored 0-5 score badge using `getScoreColors()`:
```tsx
<ScoreBadge score={log.teasingScore} />
```

**EditIconButton** — pencil icon button:
```tsx
<EditIconButton onPress={() => navigation.navigate(...)} />
```

**cardStyles** — shared StyleSheet for record cards:
```
cardStyles.listWrap  -- gap: spacing.md (wrapper for card lists)
cardStyles.card      -- surface bg, outlineVariant border, borderRadius.lg, elevation.level1, padding md
cardStyles.cardHeader -- row, space-between, marginBottom xs
cardStyles.cardTitle  -- titleSmall
cardStyles.emptyTabState -- centered, paddingVertical xl
cardStyles.emptyText -- bodyMedium, onSurfaceVariant, centered
```

### StatusBadge (`StatusBadge.tsx`)

Pill-shaped colored badge:
```tsx
<StatusBadge label="Pregnant" backgroundColor={colors.pregnant} textColor="#fff" />
```
- Self-aligned (flex-start), `borderRadius.full`, padding: horizontal `sm`, vertical 2px
- Text: `labelMedium`

### DashboardSection + AlertCard

**DashboardSection** — collapsible "Today's Tasks" section with AlertCard list.

**AlertCard** — pressable card with colored left border, icon in tinted square, 3 text lines, chevron.
- Icon wrap: 40x40px, `borderRadius.sm`, background = accent color + `'18'` (hex opacity suffix)
- Priority border colors: high = `secondary`, medium = `primary`, low = `outline`

---

## Screen Patterns

### List Screen (Mares tab, Stallions tab)

Structure inside `<Screen>`:
1. Loading overlay (absolute positioned, pointer-events: none)
2. Empty state OR populated list
3. FAB (absolute, bottom-right)

**Empty state:**
- Icon: 72px, `colors.primary`
- Heading: `titleLarge`
- Subtitle: `bodyMedium`, `onSurfaceVariant`, centered
- Button: `primaryContainer` bg, `borderRadius.md`

**Populated list:**
1. Hint text (`bodySmall`, centered)
2. Search bar: 44px height, magnify icon + TextInput + clear icon, `surface` bg, `outline` border, `borderRadius.md`
3. Filter chips (optional): horizontal row, `borderRadius.full`, active = `primary` bg, inactive = `surface` + `outline` border
4. FlatList with row cards:
   - Row: `surfaceVariant` bg, `borderRadius.lg`, `elevation.level1`, `flexDirection: 'row'`, padding `md`
   - Left: flex 1, gap `xs` — title (`titleMedium`), subtitle (`bodyMedium`), meta (`bodySmall`)
   - Right: `EditIconButton` or inline delete button
   - Pressed: opacity 0.92
   - Long press: reveals delete button
5. FAB: 56x56, circular, `primary` bg, white plus icon, elevation 6, absolute bottom-right (`spacing.xl` inset), zIndex 10

### Detail Screen (Mare detail, Stallion detail)

Structure inside `<Screen>`:
1. Error text (if any)
2. Header card + tab strip + PagerView (when data loaded)
3. Loading indicator (absolute)

**Header card:**
- `surfaceVariant` bg, `borderRadius.lg`, `elevation.level2`, padding `md`, marginBottom `md`
- Name: `titleMedium` + `fontFamily: 'Lora_700Bold'`
- Detail lines: `bodySmall`, `onSurfaceVariant`
- Actions (calendar, etc.) in a row on the right of the name

**Tab strip** (`MareDetailTabStrip`):
- Horizontal ScrollView, no indicator
- Pill buttons: `borderRadius.full`, min height 44px
- Active: `primary` bg/border, `onPrimary` text
- Inactive: `surface` bg, `outline` border, `onSurface` text
- Gap: `spacing.sm`

**PagerView** — `flex: 1`, hosts tab content components

**Tab content pattern:**
```tsx
<View style={{ flex: 1 }}>
  <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xxxl }}>
    <PrimaryButton label="Add Record" onPress={...} />
    {records.length === 0 ? (
      <View style={cardStyles.emptyTabState}>
        <Text style={cardStyles.emptyText}>No records yet.</Text>
      </View>
    ) : null}
    {records.map((r) => (
      <View style={cardStyles.card}>
        <View style={cardStyles.cardHeader}>
          <Text style={cardStyles.cardTitle}>{r.date}</Text>
          <EditIconButton onPress={...} />
        </View>
        <CardRow label="..." value="..." />
      </View>
    ))}
  </ScrollView>
</View>
```

### Form Screen

Structure inside `<Screen>`:
```tsx
<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
  <ScrollView contentContainerStyle={formStyles.form} keyboardShouldPersistTaps="handled">
    <FormField label="Name" required error={errors.name}>
      <FormTextInput value={name} onChangeText={setName} placeholder="..." />
    </FormField>
    {/* more fields */}
    <View style={{ gap: 12 }}>
      <PrimaryButton label={isEdit ? 'Update' : 'Add'} onPress={...} disabled={isSaving} />
      {isEdit ? <DeleteButton label="Delete" onPress={...} /> : null}
    </View>
  </ScrollView>
</KeyboardAvoidingView>
```

- Loading state: show `<ActivityIndicator color={colors.primary} size="large" />` alone
- Validation: run on submit, set `errors` state, show via `FormField` `error` prop
- Navigation title: set via `navigation.setOptions({ title: '...' })` in `useEffect`

### Dashboard Screen (Home tab)

**First-run empty state** (no animals):
- Welcome header: centered icon + heading (`headlineSmall`) + subtitle (`bodyLarge`)
- Get-started row: two side-by-side pressable cards (same style as stat cards)
- Feature overview: section title (`titleMedium`) + list of feature rows with tinted icon wraps

**Populated state:**
- Stats row: 3 equal flex cards — icon (24px) + count (`headlineSmall`) + label (`labelMedium`)
- Alerts section (DashboardSection) or "All caught up" message

---

## Navigation

### Bottom Tabs (`src/navigation/TabNavigator.tsx`)

3 tabs: Home (dashboard icon), Mares (horse icon), Stallions (horse-variant icon)
- Tab bar: `surface` bg, `primary` active tint, `onSurfaceVariant` inactive tint
- Label font: `Inter_500Medium`

### Stack Navigator (`src/navigation/AppNavigator.tsx`)

- Header: `surface` bg, `onSurface` tint, `Lora_700Bold` title font, no shadow
- Content bg: `surface`

### Route params (key routes):

```
MareDetail:        { mareId, initialTab? }
StallionDetail:    { stallionId, initialTab? }
EditMare:          { mareId? }
StallionForm:      { stallionId? }
AVPreferencesForm: { stallionId }
CollectionForm:    { stallionId, collectionId? }
DailyLogForm:      { mareId, logId? }
BreedingRecordForm: { mareId, breedingRecordId? }
PregnancyCheckForm: { mareId, pregnancyCheckId? }
FoalingRecordForm:  { mareId, foalingRecordId? }
FoalForm:          { mareId, foalingRecordId, foalId?, defaultSex? }
MedicationForm:    { mareId, medicationLogId? }
MareCalendar:      { mareId }
```

---

## Display Formatting Utilities

Located in `src/utils/`. Use these for consistent display — never format inline.

**`outcomeDisplay.ts`:**
- `formatBreedingMethod(method)` — liveCover -> "Live Cover", freshAI -> "Fresh AI", etc.
- `formatOutcome(outcome)` — liveFoal -> "Live Foal", stillbirth -> "Stillbirth", etc.
- `getOutcomeColor(outcome)` — liveFoal -> `colors.pregnant`, stillbirth/aborted -> `colors.loss`
- `formatFoalSex(sex)` / `getFoalSexColor(sex)` — colt -> blue, filly -> pink
- `formatFoalColor(color)` — bay -> "Bay", pintoPaint -> "Pinto/Paint", etc.

**`scoreColors.ts`:**
- `getScoreColors(score)` — returns `{ backgroundColor, textColor }` for score 0-5 badges

**`dates.ts`:**
- `formatLocalDate(value, format?)` — display dates as 'YYYY-MM-DD' or 'MM-DD-YYYY'
- `toLocalDate(date)` / `fromLocalDate(string)` — convert between Date and 'YYYY-MM-DD'
- `deriveAgeYears(dateOfBirth)` — calculate age from DOB string

---

## Interaction Conventions

- **Pressed state:** Primary actions = 0.85 opacity. Secondary = 0.7. List rows = 0.92.
- **Long press:** On list rows, reveals inline delete button (red `errorContainer` bg, `error` border).
- **Delete confirmation:** Always use `Alert.alert` with Cancel + destructive Delete button.
- **Loading during save:** Disable button via `disabled` prop, show spinner on the button or inline.
- **Empty states:** Centered text using `cardStyles.emptyTabState` + `cardStyles.emptyText`.
- **Error display:** Red text (`colors.error`) near the problem. Form errors under the field.
- **Keyboard:** Call `Keyboard.dismiss()` before opening date pickers. Use `keyboardShouldPersistTaps="handled"` on ScrollViews in forms.

---

## Data Conventions

- **Dates:** Stored as `YYYY-MM-DD` strings. Displayed as `MM-DD-YYYY` in UI via `FormDateInput displayFormat`.
- **IDs:** Generated with `newId()` from `src/utils/id.ts`.
- **Soft delete:** Set `deletedAt` timestamp. List queries filter `WHERE deleted_at IS NULL`.
- **Repositories:** All DB access goes through `src/storage/repositories/`. Business logic stays in `src/utils/` or `src/hooks/`.

---

## Hooks Pattern

Screens delegate data loading to custom hooks in `src/hooks/`:
- `useHomeScreenData` — mare list with search/filter/pregnancy info
- `useDashboardData` — counts + alerts for dashboard
- `useStallionDetailData` — stallion + collections + breeding history
- `useMareDetailData` — mare + all related records

Hooks return `{ data, isLoading, error, loadData }` pattern. Screens call `loadData` inside `useFocusEffect`.

---

## File Organization

```
src/
  components/       -- Shared UI components (Screen, Buttons, FormControls, etc.)
  hooks/            -- Data-loading hooks for screens
  models/types.ts   -- Domain types (Mare, Stallion, DailyLog, etc.)
  navigation/       -- AppNavigator (stack) + TabNavigator (bottom tabs)
  screens/          -- Top-level screen components
    mare-detail/    -- Mare detail tabs + header + tab strip
    stallion-detail/ -- Stallion detail tabs + header
  storage/
    repositories/   -- SQLite CRUD functions
    migrations/     -- Schema migrations
    db.ts           -- DB initialization
  utils/            -- Pure functions (validation, formatting, dates, alerts)
  theme.ts          -- All design tokens
```

When creating a new screen:
1. Add route to `RootStackParamList` in `AppNavigator.tsx`
2. Add `<Stack.Screen>` entry
3. Create screen file in `src/screens/`
4. If it needs data loading, create a hook in `src/hooks/`
5. Use `Screen` wrapper, existing form/card components, theme tokens
6. Follow the matching screen pattern (list, detail, or form) from above
