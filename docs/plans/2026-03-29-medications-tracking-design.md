# Medications Tracking — Design Spec

## Summary

Add a medication logging feature to BreedWise. Breeders record administered doses (medication name, date, dose, route) per mare. The feature integrates with the existing calendar (teal dots), dashboard (gap detection alerts), and mare detail screen (5th tab).

Scope: **log-only** — no scheduling or course management. Dashboard gap alerts use a **recent-streak heuristic** for likely-active daily medications; they should not infer that an older completed course is still active.

---

## 1. Data Model

### MedicationLog Table (SQLite)

```sql
CREATE TABLE IF NOT EXISTS medication_logs (
  id TEXT PRIMARY KEY,
  mare_id TEXT NOT NULL,
  date TEXT NOT NULL,
  medication_name TEXT NOT NULL,
  dose TEXT,
  route TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (mare_id) REFERENCES mares(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (date GLOB '????-??-??'),
  CHECK (route IS NULL OR route IN ('oral', 'IM', 'IV', 'intrauterine', 'SQ'))
);

CREATE INDEX IF NOT EXISTS idx_medication_logs_mare_date
  ON medication_logs (mare_id, date DESC);
```

No unique constraint on (mare_id, date, medication_name) — same med can be logged multiple times per day (e.g., oxytocin AM and PM).

### Migration

Add to `src/storage/migrations/index.ts`:

```typescript
const migration006 = `
CREATE TABLE IF NOT EXISTS medication_logs (
  id TEXT PRIMARY KEY,
  mare_id TEXT NOT NULL,
  date TEXT NOT NULL,
  medication_name TEXT NOT NULL,
  dose TEXT,
  route TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (mare_id) REFERENCES mares(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (date GLOB '????-??-??'),
  CHECK (route IS NULL OR route IN ('oral', 'IM', 'IV', 'intrauterine', 'SQ'))
);

CREATE INDEX IF NOT EXISTS idx_medication_logs_mare_date
  ON medication_logs (mare_id, date DESC);
`;
```

Add entry to `migrations` array:
```typescript
{
  id: 6,
  name: '006_create_medication_logs',
  statements: splitStatements(migration006),
},
```

### TypeScript Types

Add to `src/models/types.ts`:

```typescript
export type MedicationRoute = 'oral' | 'IM' | 'IV' | 'intrauterine' | 'SQ';

export interface MedicationLog {
  id: UUID;
  mareId: UUID;
  date: LocalDate;
  medicationName: string;
  dose: string | null;
  route: MedicationRoute | null;
  notes: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
```

---

## 2. Constants

New file: `src/utils/medications.ts`

```typescript
import type { MedicationRoute } from '@/models/types';

export const PREDEFINED_MEDICATIONS = [
  'Regumate',
  'Deslorelin',
  'Oxytocin',
  'PGF2α',
  'Progesterone',
  'Excede',
  'Gentamicin',
] as const;

export const MEDICATION_ROUTE_OPTIONS: readonly { readonly label: string; readonly value: MedicationRoute }[] = [
  { label: 'Oral', value: 'oral' },
  { label: 'IM', value: 'IM' },
  { label: 'IV', value: 'IV' },
  { label: 'Intrauterine', value: 'intrauterine' },
  { label: 'SQ', value: 'SQ' },
];

export function formatRoute(route: MedicationRoute): string {
  switch (route) {
    case 'oral': return 'Oral';
    case 'intrauterine': return 'Intrauterine';
    default: return route; // IM, IV, SQ already uppercase
  }
}
```

---

## 3. Repository

Add to `src/storage/repositories/queries.ts`:

### Row Type

```typescript
type MedicationLogRow = {
  id: string;
  mare_id: string;
  date: string;
  medication_name: string;
  dose: string | null;
  route: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
```

### Row Mapper

```typescript
function mapMedicationLogRow(row: MedicationLogRow): MedicationLog {
  return {
    id: row.id,
    mareId: row.mare_id,
    date: row.date,
    medicationName: row.medication_name,
    dose: row.dose,
    route: row.route as MedicationRoute | null,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
```

### CRUD Functions

```typescript
export async function createMedicationLog(input: {
  id: string;
  mareId: string;
  date: LocalDate;
  medicationName: string;
  dose?: string | null;
  route?: MedicationRoute | null;
  notes?: string | null;
}): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO medication_logs (
      id, mare_id, date, medication_name, dose, route, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      input.id,
      input.mareId,
      input.date,
      input.medicationName,
      input.dose ?? null,
      input.route ?? null,
      input.notes ?? null,
      now,
      now,
    ]
  );
}

export async function getMedicationLogById(id: string): Promise<MedicationLog | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<MedicationLogRow>(
    `SELECT id, mare_id, date, medication_name, dose, route, notes, created_at, updated_at
     FROM medication_logs WHERE id = ?;`,
    [id]
  );
  return row ? mapMedicationLogRow(row) : null;
}

export async function listMedicationLogsByMare(mareId: string): Promise<MedicationLog[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MedicationLogRow>(
    `SELECT id, mare_id, date, medication_name, dose, route, notes, created_at, updated_at
     FROM medication_logs WHERE mare_id = ? ORDER BY date DESC;`,
    [mareId]
  );
  return rows.map(mapMedicationLogRow);
}

export async function listAllMedicationLogs(): Promise<MedicationLog[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MedicationLogRow>(
    `SELECT id, mare_id, date, medication_name, dose, route, notes, created_at, updated_at
     FROM medication_logs ORDER BY date DESC;`
  );
  return rows.map(mapMedicationLogRow);
}

export async function updateMedicationLog(
  id: string,
  input: {
    date: LocalDate;
    medicationName: string;
    dose?: string | null;
    route?: MedicationRoute | null;
    notes?: string | null;
  }
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE medication_logs
     SET date = ?, medication_name = ?, dose = ?, route = ?, notes = ?, updated_at = ?
     WHERE id = ?;`,
    [
      input.date,
      input.medicationName,
      input.dose ?? null,
      input.route ?? null,
      input.notes ?? null,
      now,
      id,
    ]
  );
}

export async function deleteMedicationLog(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM medication_logs WHERE id = ?;`, [id]);
}
```

Also add `MedicationLog` and `MedicationRoute` to the import from `@/models/types` at the top of queries.ts.

---

## 4. Navigation

### RootStackParamList

Add to `src/navigation/AppNavigator.tsx`:

```typescript
MareDetail: {
  mareId: string;
  initialTab?: 'dailyLogs' | 'breeding' | 'pregnancy' | 'foaling' | 'meds';
};

MedicationForm: { mareId: string; medicationLogId?: string };
```

### Screen Registration

Add after the other form screen registrations:

```typescript
<Stack.Screen name="MedicationForm" component={MedicationFormScreen} options={{ title: 'Medication' }} />
```

Import: `import { MedicationFormScreen } from '@/screens/MedicationFormScreen';`

---

## 5. Form Screen

New file: `src/screens/MedicationFormScreen.tsx`

### Behavior

- **Create mode:** `medicationLogId` is undefined. Date defaults to today. Medication, dose, route, notes start empty.
- **Edit mode:** `medicationLogId` is provided. Load existing record via `getMedicationLogById`. Populate all fields. Show delete button.
- **Header:** Dynamically set to "Add Medication" (create) or "Edit Medication" (edit).
- **Save:** Validates, then calls `createMedicationLog` or `updateMedicationLog`. On success: `navigation.goBack()`.
- **Delete:** Calls `deleteMedicationLog`, then `navigation.goBack()`.

### Form Fields (in order)

1. **Medication** (required)
   - `OptionSelector` with options: 7 predefined meds + `{ label: 'Custom', value: 'custom' }`.
   - When "Custom" is selected, show a `FormTextInput` below for free-text entry.
   - When a predefined med is selected, the text input hides and the selected value is used as `medicationName`.
   - On edit: if the loaded `medicationName` matches a predefined value, pre-select it. Otherwise, select "Custom" and populate the text input.
   - Wrapped in `FormField` with `label="Medication"` and `required`.

2. **Date** (required)
   - `FormDateInput` with `maximumDate={new Date()}` (no future dates).
   - Default: today's date (create mode) or loaded date (edit mode).
   - `displayFormat="MM-DD-YYYY"` to match other forms.
   - Wrapped in `FormField` with `label="Date"` and `required`.

3. **Dose** (optional)
   - `FormTextInput` with `placeholder="e.g., 10 mL"`.
   - Wrapped in `FormField` with `label="Dose"`.

4. **Route** (optional)
   - `OptionSelector` with 5 route options from `MEDICATION_ROUTE_OPTIONS`.
   - Clearable: tapping the already-selected option deselects it (set to null).
   - Wrapped in `FormField` with `label="Route"`.

5. **Notes** (optional)
   - `FormTextInput` with `multiline`.
   - Wrapped in `FormField` with `label="Notes"`.

6. **Save button** — `PrimaryButton`, label "Saving..." when in progress, disabled while saving.
7. **Delete button** (edit mode only) — `DeleteButton` with confirmation `Alert.alert`.

### Validation

```typescript
type FormErrors = {
  medicationName?: string;
  date?: string;
};
```

- `medicationName`: `validateRequired(name.trim(), 'Medication')` — must be non-empty.
- `date`: `validateLocalDate(date, 'Date', true)` then `validateLocalDateNotInFuture(date)`.

### Layout

```tsx
<Screen style={{ paddingTop: 0 }}>
  <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={formStyles.form}>
      {/* Fields here */}
    </ScrollView>
  </KeyboardAvoidingView>
</Screen>
```

### Shared Control Update

Update `src/components/FormControls.tsx` so `OptionSelector` can support nullable values without screen-specific hacks:

```typescript
type OptionSelectorProps<T extends string> = {
  value: T | null;
  options: Option<T>[];
  onChange: (value: T | null) => void;
  allowDeselect?: boolean;
};
```

Behavior:
- Default behavior remains unchanged for existing callers.
- When `allowDeselect` is true and the user taps the currently-selected option, call `onChange(null)`.
- Use `allowDeselect` only for the medication route field in this feature.

---

## 6. Mare Detail — 5th Tab

### MareDetailScreen Changes (`src/screens/MareDetailScreen.tsx`)

1. Add to `TAB_OPTIONS`:
   ```typescript
   const TAB_OPTIONS = [
     { label: 'Daily Logs' },
     { label: 'Breeding' },
     { label: 'Pregnancy' },
     { label: 'Foaling' },
     { label: 'Meds' },         // NEW — index 4
   ] as const;
   ```

2. Add state:
   ```typescript
   const [medicationLogs, setMedicationLogs] = useState<MedicationLog[]>([]);
   ```

3. Derive initial tab from `route.params.initialTab`:
   ```typescript
   const initialTabIndex = route.params.initialTab === 'meds'
     ? 4
     : route.params.initialTab === 'foaling'
       ? 3
       : route.params.initialTab === 'pregnancy'
         ? 2
         : route.params.initialTab === 'breeding'
           ? 1
           : 0;

   const [activeTabIndex, setActiveTabIndex] = useState(initialTabIndex);
   ```

4. Add to `Promise.all` in `loadData`:
   ```typescript
   const [mareRecord, logs, breeding, checks, foaling, foals, stallions, meds] = await Promise.all([
     getMareById(mareId),
     listDailyLogsByMare(mareId),
     listBreedingRecordsByMare(mareId),
     listPregnancyChecksByMare(mareId),
     listFoalingRecordsByMare(mareId),
     listFoalsByMare(mareId),
     listStallions(),
     listMedicationLogsByMare(mareId),  // NEW
   ]);
   ```
   Then: `setMedicationLogs(meds);`

5. Pass `initialTabIndex` into `PagerView`:
   ```tsx
   <PagerView
     ref={pagerRef}
     style={styles.pager}
     initialPage={initialTabIndex}
     onPageSelected={handlePageSelected}
   >
   ```

6. Add imports: `MedicationLog` from types, `listMedicationLogsByMare` from repositories, `MedicationsTab` from mare-detail.

7. Add in PagerView (after FoalingTab, as 5th page):
   ```tsx
   <View key="4" style={styles.page}>
     <MedicationsTab
       mareId={mareId}
       medicationLogs={medicationLogs}
       navigation={navigation}
     />
   </View>
   ```

### MedicationsTab

New file: `src/screens/mare-detail/MedicationsTab.tsx`

```typescript
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { PrimaryButton } from '@/components/Buttons';
import { CardRow, EditIconButton, cardStyles } from '@/components/RecordCardParts';
import { MedicationLog } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { formatRoute } from '@/utils/medications';
import { spacing } from '@/theme';

type Props = {
  mareId: string;
  medicationLogs: readonly MedicationLog[];
  navigation: NativeStackNavigationProp<RootStackParamList, 'MareDetail'>;
};

export function MedicationsTab({ mareId, medicationLogs, navigation }: Props): JSX.Element {
  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <PrimaryButton
          label="Add Medication"
          onPress={() => navigation.navigate('MedicationForm', { mareId })}
        />
        {medicationLogs.length === 0 ? (
          <View style={cardStyles.emptyTabState}>
            <Text style={cardStyles.emptyText}>No medications logged yet.</Text>
          </View>
        ) : null}
        {medicationLogs.map((log) => (
          <View key={log.id} style={cardStyles.card}>
            <View style={cardStyles.cardHeader}>
              <Text style={cardStyles.cardTitle}>{log.date}</Text>
              <EditIconButton
                onPress={() => navigation.navigate('MedicationForm', { mareId, medicationLogId: log.id })}
              />
            </View>
            <CardRow label="Medication" value={log.medicationName} />
            {log.dose ? <CardRow label="Dose" value={log.dose} /> : null}
            {log.route ? <CardRow label="Route" value={formatRoute(log.route)} /> : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  scrollContent: { gap: spacing.md, paddingBottom: spacing.xxxl },
});
```

### Barrel Export

Add to `src/screens/mare-detail/index.ts`:
```typescript
export { MedicationsTab } from './MedicationsTab';
```

---

## 7. Calendar Integration

### timelineEvents.ts Changes

1. **Add import:** `MedicationLog` from `@/models/types`.

2. **Widen type union:**
   ```typescript
   export type TimelineEventType = 'foaling' | 'pregnancyCheck' | 'breeding' | 'ovulation' | 'heat' | 'medication';
   ```

3. **Widen data union:**
   ```typescript
   export interface TimelineEvent {
     readonly id: string;
     readonly type: TimelineEventType;
     readonly date: LocalDate;
     readonly data: DailyLog | BreedingRecord | PregnancyCheck | FoalingRecord | MedicationLog;
   }
   ```

4. **Add to TYPE_PRIORITY:**
   ```typescript
   const TYPE_PRIORITY: Record<TimelineEventType, number> = {
     foaling: 0,
     pregnancyCheck: 1,
     breeding: 2,
     ovulation: 3,
     heat: 4,
     medication: 5,  // NEW — lowest display priority
   };
   ```

5. **Add 5th parameter to buildTimelineEvents:**
   ```typescript
   export function buildTimelineEvents(
     dailyLogs: readonly DailyLog[],
     breedingRecords: readonly BreedingRecord[],
     pregnancyChecks: readonly PregnancyCheck[],
     foalingRecords: readonly FoalingRecord[],
     medicationLogs: readonly MedicationLog[] = [],  // NEW — default empty for backward compat
   ): readonly TimelineEvent[] {
   ```

6. **Add medication event mapping** (inside the function, before `const all = ...`):
   ```typescript
   const medicationEvents: readonly TimelineEvent[] = medicationLogs.map((r) => ({
     id: r.id,
     type: 'medication' as const,
     date: r.date,
     data: r,
   }));
   ```

7. **Include in all array:**
   ```typescript
   const all = [...logEvents, ...breedingEvents, ...checkEvents, ...foalingEvents, ...medicationEvents];
   ```

### calendarMarking.ts Changes

1. **Add import:** `MedicationLog` from `@/models/types`.

2. **Add to DOT_COLORS:**
   ```typescript
   const DOT_COLORS: Record<TimelineEventType, string> = {
     heat: '#FF9800',
     ovulation: '#9C27B0',
     breeding: '#2196F3',
     pregnancyCheck: '#4CAF50',
     foaling: '#E91E63',
     medication: '#009688',  // NEW — teal
   };
   ```

3. **Add to CALENDAR_LEGEND:**
   ```typescript
   { key: 'medication', label: 'Medication', color: DOT_COLORS.medication },
   ```

4. **Add `medicationLogs` parameter to `buildCalendarMarking`:**
   ```typescript
   export function buildCalendarMarking(
     dailyLogs: readonly DailyLog[],
     breedingRecords: readonly BreedingRecord[],
     pregnancyChecks: readonly PregnancyCheck[],
     foalingRecords: readonly FoalingRecord[],
     selectedDay: LocalDate | null,
     medicationLogs: readonly MedicationLog[] = [],  // NEW
   ): MarkedDates {
     const events = buildTimelineEvents(dailyLogs, breedingRecords, pregnancyChecks, foalingRecords, medicationLogs);
   ```

### TimelineTab.tsx Changes

1. **Add to EVENT_COLORS:**
   ```typescript
   const EVENT_COLORS = {
     heat: '#FF9800',
     ovulation: '#9C27B0',
     breeding: '#2196F3',
     pregnancyCheck: '#4CAF50',
     foaling: '#E91E63',
     medication: '#009688',  // NEW
   } as const;
   ```

2. **Add to EventTypeBadge labels:**
   ```typescript
   const labels: Record<TimelineEvent['type'], string> = {
     heat: 'Heat',
     ovulation: 'Ovulation',
     breeding: 'Breeding',
     pregnancyCheck: 'Preg Check',
     foaling: 'Foaling',
     medication: 'Medication',  // NEW
   };
   ```

3. **Add MedicationCard component:**
   ```typescript
   function MedicationCard({ event, navigation, mareId }: {
     event: TimelineEvent;
     navigation: Props['navigation'];
     mareId: string;
   }): JSX.Element {
     const log = event.data as MedicationLog;
     return (
       <View style={cardStyles.card}>
         <View style={cardStyles.cardHeader}>
           <Text style={cardStyles.cardTitle}>{event.date}</Text>
           <EditIconButton onPress={() => navigation.navigate('MedicationForm', { mareId, medicationLogId: log.id })} />
         </View>
         <View style={cardStyles.cardRow}>
           <EventTypeBadge type="medication" />
           <Text style={styles.cardDetail}>{log.medicationName}</Text>
         </View>
         {log.dose ? <CardRow label="Dose" value={log.dose} /> : null}
         {log.route ? <CardRow label="Route" value={formatRoute(log.route)} /> : null}
       </View>
     );
   }
   ```

4. **Add case in TimelineCard switch:**
   ```typescript
   case 'medication':
     return <MedicationCard event={event} navigation={navigation} mareId={mareId} />;
   ```

5. **Add `medicationLogs` to Props and pass through to buildTimelineEvents:**
   ```typescript
   // In Props type:
   readonly medicationLogs: readonly MedicationLog[];

   // In TimelineTab body:
   const events = buildTimelineEvents(dailyLogs, breedingRecords, pregnancyChecks, foalingRecords, medicationLogs);
   ```

6. **Add imports:** `MedicationLog` from types, `formatRoute` from medications.

### MareCalendarScreen.tsx Changes

1. **Add state:**
   ```typescript
   const [medicationLogs, setMedicationLogs] = useState<MedicationLog[]>([]);
   ```

2. **Add to Promise.all in loadData:**
   ```typescript
   listMedicationLogsByMare(mareId),
   ```
   Then: `setMedicationLogs(meds);`

3. **Pass to buildCalendarMarking:**
   ```typescript
   const markedDates = useMemo(
     () => buildCalendarMarking(dailyLogs, breedingRecords, pregnancyChecks, foalingRecords, selectedDay, medicationLogs),
     [dailyLogs, breedingRecords, pregnancyChecks, foalingRecords, selectedDay, medicationLogs]
   );
   ```

4. **Filter medication logs for the selected day:**
   ```typescript
   const filteredMedicationLogs = useMemo(
     () => medicationLogs.filter((m) => m.date === selectedDay),
     [medicationLogs, selectedDay]
   );
   ```

5. **Pass filtered medication logs to TimelineTab:**
   ```typescript
   <TimelineTab ... medicationLogs={filteredMedicationLogs} ... />
   ```

6. **Add imports:** `MedicationLog` from types, `listMedicationLogsByMare` from repositories.

---

## 8. Dashboard Alert: Medication Gap Detection

### Constants

Add to `src/utils/dashboardAlerts.ts`:

```typescript
export const MEDICATION_GAP_MIN_STREAK_DAYS = 2;
export const MEDICATION_GAP_ACTIVE_WINDOW_DAYS = 3;
```

### Type Changes

Add `'medicationGap'` to `AlertKind`:
```typescript
export type AlertKind =
  | 'approachingDueDate'
  | 'pregnancyCheckNeeded'
  | 'recentOvulation'
  | 'heatActivity'
  | 'noRecentLog'
  | 'medicationGap';  // NEW
```

Add `medicationLogs` to `DashboardInput`:
```typescript
export interface DashboardInput {
  readonly mares: readonly Mare[];
  readonly dailyLogs: readonly DailyLog[];
  readonly breedingRecords: readonly BreedingRecord[];
  readonly pregnancyChecks: readonly PregnancyCheck[];
  readonly foalingRecords: readonly FoalingRecord[];
  readonly medicationLogs: readonly MedicationLog[];  // NEW
  readonly today: LocalDate;
}
```

### Gap Detection Function

```typescript
function checkMedicationGap(
  mare: Mare,
  medicationLogs: readonly MedicationLog[],
  today: LocalDate
): DashboardAlert | null {
  if (medicationLogs.length === 0) return null;

  // Group logs by medication name
  const byName = new Map<string, string[]>();
  for (const log of medicationLogs) {
    const existing = byName.get(log.medicationName);
    if (existing) {
      existing.push(log.date);
    } else {
      byName.set(log.medicationName, [log.date]);
    }
  }

  let bestAlert: DashboardAlert | null = null;
  let bestDaysAgo = Infinity;

  for (const [medName, dates] of byName) {
    // Deduplicate and sort ascending
    const uniqueDates = [...new Set(dates)].sort();

    // Find the longest recent consecutive-day streak
    // Walk backwards from most recent date
    let streakLength = 1;
    for (let i = uniqueDates.length - 1; i > 0; i--) {
      const curr = daysBetween(uniqueDates[i], uniqueDates[i - 1]);
      if (curr === 1) {
        streakLength++;
      } else {
        break; // streak broken
      }
    }

    // Only alert if streak was 2+ days (establishes a likely daily-course pattern)
    if (streakLength < MEDICATION_GAP_MIN_STREAK_DAYS) continue;

    const lastDoseDate = uniqueDates[uniqueDates.length - 1];
    const daysAgo = daysBetween(today, lastDoseDate);

    // Ignore stale historical streaks. In log-only mode we cannot reliably infer
    // that an older completed course is still active.
    if (daysAgo > MEDICATION_GAP_ACTIVE_WINDOW_DAYS) continue;

    // Only alert if last dose was before today (gap exists)
    if (daysAgo < 1) continue;

    // Pick the most recent gap (smallest daysAgo)
    if (daysAgo < bestDaysAgo) {
      bestDaysAgo = daysAgo;
      bestAlert = {
        kind: 'medicationGap',
        priority: 'medium',
        mareId: mare.id,
        mareName: mare.name,
        title: `${medName} gap`,
        subtitle: daysAgo === 1 ? 'Last dose: yesterday' : `Last dose: ${daysAgo} days ago`,
        sortKey: daysAgo,
      };
    }
  }

  return bestAlert;
}
```

**Behavior notes:**
- A single isolated dose (no streak) does NOT trigger a gap alert. This is intentional — gap detection targets daily-course medications like Regumate where 2+ consecutive days establishes the pattern.
- A historical streak that ended more than `MEDICATION_GAP_ACTIVE_WINDOW_DAYS` ago does NOT trigger an alert. This prevents old completed courses from surfacing as permanent false positives.
- If multiple meds have gaps, only the most recent gap is reported (one alert per mare).
- The `daysBetween` helper already exists in the file (wraps `calculateDaysPostBreeding`).

### Wire Into generateDashboardAlerts

Add after the existing alert generators in the `for (const mare of mares)` loop:

```typescript
const medsByMare = groupByMareId(input.medicationLogs);

// Inside the loop:
const mareMeds = medsByMare.get(mare.id) ?? [];

const medGapAlert = checkMedicationGap(mare, mareMeds, today);
if (medGapAlert) alerts.push(medGapAlert);
```

Add import: `MedicationLog` from `@/models/types`.

---

## 9. AlertCard Configuration

Add to `ALERT_CONFIG` in `src/components/AlertCard.tsx`:

```typescript
medicationGap: { icon: 'pill', accentColor: '#009688' },
```

The `pill` icon is available in `MaterialCommunityIcons`. Accent color matches the teal calendar dot.

---

## 10. HomeScreen Changes

In `src/screens/HomeScreen.tsx`:

1. **Add to bulk query:**
   ```typescript
   import { listAllMedicationLogs } from '@/storage/repositories';

   // In loadData Promise.all:
   const [mares, dailyLogs, breedingRecords, pregnancyChecks, foalingRecords, medicationLogs] = await Promise.all([
     listMares(),
     listAllDailyLogs(),
     listAllBreedingRecords(),
     listAllPregnancyChecks(),
     listAllFoalingRecords(),
     listAllMedicationLogs(),  // NEW
   ]);
   ```

2. **Pass to generateDashboardAlerts:**
   ```typescript
   const alerts = generateDashboardAlerts({
     mares, dailyLogs, breedingRecords, pregnancyChecks, foalingRecords,
     medicationLogs,  // NEW
     today,
   });
   ```

3. **Add navigation case in `onAlertPress`:**
   ```typescript
   case 'medicationGap':
     navigation.navigate('MareDetail', { mareId: alert.mareId, initialTab: 'meds' });
     break;
   ```

---

## Files Summary

### Create (3 files)

| File | Purpose |
|------|---------|
| `src/screens/MedicationFormScreen.tsx` | Medication form (create/edit) |
| `src/screens/mare-detail/MedicationsTab.tsx` | 5th tab on mare detail |
| `src/utils/medications.ts` | Predefined meds, routes, formatRoute |

### Modify (14 files)

| File | Change |
|------|--------|
| `src/models/types.ts` | Add `MedicationRoute` type, `MedicationLog` interface |
| `src/storage/migrations/index.ts` | Add migration `006_create_medication_logs` |
| `src/storage/repositories/queries.ts` | Add `MedicationLogRow`, mapper, 6 CRUD functions |
| `src/navigation/AppNavigator.tsx` | Add `MedicationForm` to param list + screen registration |
| `src/components/FormControls.tsx` | Add optional `allowDeselect` support to `OptionSelector` |
| `src/screens/MareDetailScreen.tsx` | Add 5th tab "Meds", load med data in Promise.all |
| `src/screens/mare-detail/index.ts` | Export `MedicationsTab` |
| `src/utils/timelineEvents.ts` | Add `'medication'` to type/priority/data union, 5th param |
| `src/utils/calendarMarking.ts` | Add teal dot color, legend entry, `medicationLogs` param |
| `src/screens/mare-detail/TimelineTab.tsx` | Add `MedicationCard`, event color, badge label, props |
| `src/screens/MareCalendarScreen.tsx` | Load + pass medication data to marking + timeline |
| `src/utils/dashboardAlerts.ts` | Add `medicationGap` kind, `DashboardInput.medicationLogs`, gap detection function |
| `src/components/AlertCard.tsx` | Add `medicationGap` to `ALERT_CONFIG` (pill icon, teal) |
| `src/screens/HomeScreen.tsx` | Bulk query meds, pass to alerts, navigation case |

---

## Testing Strategy

### Unit Tests

1. **Gap detection** (`dashboardAlerts.test.ts` or new file):
   - 3 consecutive days → skip 1 day → returns `medicationGap` alert
   - Single dose (no streak) → returns null
   - 2 consecutive days + dose today → returns null (no gap)
   - 2 consecutive days ending 5+ days ago → returns null (stale historical course)
   - Two meds, one with gap, one without → returns alert for the one with gap
   - Same med logged twice in one day → treated as one day in streak
   - Empty medication logs → returns null

2. **formatRoute** (`medications.test.ts`):
   - `'oral'` → `'Oral'`
   - `'intrauterine'` → `'Intrauterine'`
   - `'IM'` → `'IM'`

3. **Calendar marking with medications** (`calendarMarking.test.ts`):
   - Medication log on a date → teal dot appears in marking

4. **Selected-day timeline filtering** (`MareCalendarScreen` test or `TimelineTab` integration test):
   - Medication on selected day appears in timeline
   - Medication on a different day does NOT appear in selected-day timeline

5. **Route selector clear behavior** (`FormControls.test.tsx` or medication form test):
   - Tapping selected route again clears it to null

### Typecheck + Existing Tests

- `npm run typecheck` — zero errors
- `npm test` — all existing tests still pass

### Manual Verification

1. Create mare → go to Meds tab → "No medications logged yet."
2. Add Medication → pick Regumate, set date, dose "10 mL", route Oral → Save
3. Card appears on Meds tab with all fields
4. Edit the card → change dose → Save → card updates
5. Delete the card → confirm → card removed
6. Add 3 consecutive days of Regumate → skip a day → check dashboard → "Regumate gap" alert
7. Tap the dashboard alert → mare detail opens directly on the Meds tab
8. Open calendar → teal dots on medication days
9. Tap calendar day with medication → only that day’s medication event shows in timeline below
10. Tap selected Route option again → route clears
11. Try "Custom" medication → type name → saves correctly
