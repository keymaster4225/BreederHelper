# Mare Tracker - Product Spec

## Overview

A mobile app (iOS + Android) for horse breeders to manage mare reproductive cycles, ultrasound results, breeding records, pregnancy tracking, and foaling outcomes. Built in **React Native**. Single-user, offline-first, designed to handle up to ~30 mares per operation.

---

## Project Structure

Organize code into clear directories. Never dump everything into a single file.

```text
src/
  models/          # Data models / types
  screens/         # Full-page screen components
  components/      # Reusable UI components
  navigation/      # Navigation config
  storage/         # Local persistence layer
  utils/           # Helpers, calculations, constants
```

---

## Data Models

### Conventions

- `id`: UUID string.
- `date`: local calendar date string in `YYYY-MM-DD` format.
- Persist normalized records using foreign keys. Do not persist child arrays inside `Mare`; those lists are query-derived.
- Use soft-delete (`deletedAt`) for primary entities to reduce accidental data loss and preserve historical records.

### Mare

| Field              | Type     | Required | Notes |
|--------------------|----------|----------|-------|
| id                 | string   | yes      | UUID |
| name               | string   | yes      | |
| breed              | string   | yes      | |
| dateOfBirth        | date?    | no       | Preferred over static age |
| registrationNumber | string?  | no       | |
| notes              | string?  | no       | |
| createdAt          | string   | yes      | ISO timestamp |
| updatedAt          | string   | yes      | ISO timestamp |
| deletedAt          | string?  | no       | ISO timestamp for soft-delete |

### DailyLog

A single daily observation entry per mare. All fields except date are optional; the user may record teasing only, ultrasound only, or both on any given day.

| Field         | Type    | Required | Notes |
|---------------|---------|----------|-------|
| id            | string  | yes      | UUID |
| mareId        | string  | yes      | FK to Mare |
| date          | date    | yes      | |
| teasingScore  | int?    | no       | 0-5 scale. 0 = no interest, 5 = standing heat / ready to breed |
| rightOvary    | string? | no       | Either a follicle size in mm (example: `35mm`) or a code: `MSF`, `AHF`, `CL`, or `no findings` |
| leftOvary     | string? | no       | Same format as `rightOvary` |
| edema         | int?    | no       | 0-5 uterine edema scale |
| uterineTone   | string? | no       | Free-text descriptor |
| uterineCysts  | string? | no       | Free-text location/description (example: `2cm cyst at left horn base`) |
| notes         | string? | no       | General free-text notes |
| createdAt     | string  | yes      | ISO timestamp |
| updatedAt     | string  | yes      | ISO timestamp |

Constraint:
- Unique composite key: `(mareId, date)`.

Domain terminology for ovary findings:
- `MSF` = Multiple Small Follicles
- `AHF` = Anovulatory Hemorrhagic Follicle
- `CL` = Corpus Luteum
- Direct measurement = follicle size in mm (example: `35mm`)
- `no findings` for unremarkable exams

### Stallion

Stallions are reusable records; the same stallion can be referenced across multiple breeding records for different mares.

| Field              | Type    | Required | Notes |
|--------------------|---------|----------|-------|
| id                 | string  | yes      | UUID |
| name               | string  | yes      | |
| breed              | string? | no       | |
| registrationNumber | string? | no       | |
| sire               | string? | no       | Pedigree info |
| dam                | string? | no       | Pedigree info |
| notes              | string? | no       | |
| createdAt          | string  | yes      | ISO timestamp |
| updatedAt          | string  | yes      | ISO timestamp |
| deletedAt          | string? | no       | ISO timestamp for soft-delete |

### BreedingRecord

| Field           | Type           | Required | Notes |
|-----------------|----------------|----------|-------|
| id              | string         | yes      | UUID |
| mareId          | string         | yes      | FK to Mare |
| stallionId      | string         | yes      | FK to Stallion |
| date            | date           | yes      | Date of breeding |
| method          | BreedingMethod | yes      | Enum; see below |
| notes           | string?        | no       | |
| createdAt       | string         | yes      | ISO timestamp |
| updatedAt       | string         | yes      | ISO timestamp |

`BreedingMethod` enum: `liveCover`, `freshAI`, `shippedCooledAI`, `frozenAI`

Method-specific fields (show/hide dynamically based on selected method):

| Field                 | Applies To                | Type      | Notes |
|-----------------------|---------------------------|-----------|-------|
| volumeMl              | freshAI, shippedCooledAI  | number?   | Dose volume in mL |
| concentrationMPerMl   | freshAI, shippedCooledAI  | number?   | Sperm concentration (millions/mL) |
| motilityPercent       | freshAI, shippedCooledAI  | number?   | 0-100 |
| numberOfStraws        | frozenAI                  | int?      | Number of straws used |
| strawDetails          | frozenAI                  | string?   | Straw ID / batch info |
| collectionDate        | shippedCooledAI, frozenAI | date?     | When semen was collected |

Validation:
- `motilityPercent` must be between 0 and 100.
- `numberOfStraws` must be >= 1 when method is `frozenAI`.

### PregnancyCheck

| Field            | Type    | Required | Notes |
|------------------|---------|----------|-------|
| id               | string  | yes      | UUID |
| mareId           | string  | yes      | FK to Mare |
| breedingRecordId | string  | yes      | FK to BreedingRecord |
| date             | date    | yes      | Date of pregnancy check |
| result           | enum    | yes      | `positive` or `negative` |
| heartbeatDetected| bool?   | no       | Only valid when `result = positive` |
| notes            | string? | no       | |
| createdAt        | string  | yes      | ISO timestamp |
| updatedAt        | string  | yes      | ISO timestamp |
| daysPostBreeding | int     | derived  | `date - breedingRecord.date` |

Validation:
- `daysPostBreeding >= 0`.
- If `result = negative`, `heartbeatDetected` must be null/false.

### FoalingRecord

| Field            | Type    | Required | Notes |
|------------------|---------|----------|-------|
| id               | string  | yes      | UUID |
| mareId           | string  | yes      | FK to Mare |
| breedingRecordId | string? | no       | Optional if known |
| date             | date    | yes      | Foaling date |
| outcome          | enum    | yes      | `liveFoal`, `stillbirth`, `aborted`, `unknown` |
| foalSex          | enum?   | no       | `colt`, `filly`, `unknown` |
| complications    | string? | no       | Dystocia, retained placenta, etc. |
| notes            | string? | no       | |
| createdAt        | string  | yes      | ISO timestamp |
| updatedAt        | string  | yes      | ISO timestamp |

---

## Screens & Navigation

### Home Screen - Mare List
- List of all mares showing name, breed, and derived age if `dateOfBirth` is present.
- FAB or button to add a new mare.
- Tap a mare -> Mare Detail Screen.

### Add/Edit Mare Screen
- Fields: name (required), breed (required), date of birth (optional), registration number (optional), notes (optional).

### Mare Detail Screen
- Header with mare info (name, breed, derived age, registration #).
- Tabbed interface with sections:
- Daily Logs: chronological list, button to add/edit log.
- Breeding Records: list of breeding events, button to add/edit record.
- Pregnancy Checks: list of checks, button to add/edit check.
- Foaling Records: list of foaling outcomes, button to add/edit foaling record.

### Add Daily Log Screen
- Date picker (defaults to today).
- Teasing Score: segmented button control, 0-5, optional and clearable.
- Right Ovary: text input with hint `35mm`, `MSF`, `AHF`, `CL`, or `no findings`.
- Left Ovary: same as right.
- Uterine Edema: segmented button control, 0-5, optional and clearable.
- Uterine Tone: text input.
- Uterine Cysts: text input with hint `2cm cyst at left horn base`.
- Notes: multiline text input.

### Stallion Management Screen
- Accessible from main navigation (drawer, tab, or settings).
- List of all stallions.
- Add/edit stallion with fields: name, breed, registration #, sire, dam, notes.

### Add Breeding Record Screen
- Date picker.
- Stallion selector populated from Stallion list, with option to add new stallion inline.
- Breeding Method selector (Live Cover, Fresh AI, Shipped Cooled AI, Frozen AI).
- Dynamic form fields based on selected method.
- Notes: multiline text input.

### Add Pregnancy Check Screen
- Breeding Record selector: mare's breeding records (show stallion name + date).
- Date picker.
- Auto-display `Days post-breeding: X` from selected breeding record.
- Result toggle: positive / negative.
- Heartbeat Detected checkbox (enabled only when result is positive).
- Notes: multiline text input.

### Add Foaling Record Screen
- Date picker.
- Optional breeding record selector.
- Outcome selector.
- Optional foal sex selector.
- Complications and notes inputs.

---

## Calculated Features

- Days post-breeding: auto-calculate on pregnancy checks using selected breeding record date.
- Estimated foaling date: for positive checks, calculate using the mare's gestation length from the associated breeding date. Default to 340 days unless the mare record has a different value saved.
- Derived age: if date of birth exists, show current age on mare list/detail.

---

## Technical Requirements

### Platform & Framework
- React Native (iOS and Android).
- TypeScript required.

### Storage
- Local-first: all data persists on-device; app must work fully offline.
- Use SQLite as primary app datastore (for relational integrity and query performance).
- AsyncStorage may be used only for small key-value app settings (for example, theme or onboarding flags).
- Data must survive app restarts.

### Data Integrity Rules
- Enforce FK integrity between mare, stallion, breeding, pregnancy, and foaling records.
- Deletion behavior:
- Soft-delete Mare and Stallion records.
- Keep historical child records linked to soft-deleted parents.
- Prevent hard-delete while referenced, unless a full purge flow is explicitly triggered.

### Future Considerations (do not implement yet, but design with these in mind)
- Cloud sync / backup so data is recoverable if a phone is lost.
- Cycle prediction using ultrasound and teasing patterns.
- Medication logging and scheduling with push notifications.
- Timeline / summary views per mare.
- Ultrasound image attachments.
- Offspring photo gallery per mare.
- Graphical uterine cyst mapping.
- Mare profile photos.
- Multi-user access (vet, barn manager, owner sharing data).

### UI/UX Guidelines
- Clean, functional UI for barn use.
- Material Design 3 / modern mobile conventions.
- Forms should be scrollable (long forms + on-screen keyboard).
- Observation fields optional except date.
- Segmented buttons for teasing and edema scales (0-5), clearable.
- Dynamic form sections based on breeding method.

---

## Build Phases

Build incrementally in this order:

1. Project scaffolding: React Native setup, navigation, folder organization.
2. Mare profiles: mare list, add/edit mare, mare detail screen.
3. Daily logging: DailyLog model, add/edit log form, unique `(mareId, date)` enforcement.
4. Stallion management: Stallion model, stallion list/add/edit screen.
5. Breeding records: BreedingRecord model with dynamic method-specific fields.
6. Pregnancy checks: model, validation rules, days post-breeding, estimated foaling date.
7. Foaling records: model, add/edit UI, mare detail integration.
8. Local storage: SQLite schema, migrations, persistence.
9. Input validation & error handling: required fields, value ranges, date constraints, edge cases.

---

## Domain Glossary

| Term | Meaning |
|------|---------|
| Teasing | Exposing a mare to a stallion to assess estrus behavior; scored 0-5 |
| Standing heat | Mare is receptive and ready to breed (teasing score 5) |
| Follicle | Fluid-filled structure on the ovary containing the egg; measured in mm |
| MSF | Multiple Small Follicles; many small follicles, no dominant one |
| AHF | Anovulatory Hemorrhagic Follicle; follicle fills with blood instead of ovulating |
| CL | Corpus Luteum; structure that forms after ovulation |
| Uterine edema | Fluid/swelling pattern in uterine tissue; graded 0-5 |
| Uterine tone | Firmness/texture of uterine wall; described in free text |
| Live cover | Natural breeding with stallion physically present |
| Fresh AI | Artificial insemination with freshly collected semen |
| Shipped cooled AI | AI with semen collected elsewhere and shipped cooled |
| Frozen AI | AI with cryopreserved semen straws |
| Motility | Percentage of sperm actively moving |
| Gestation | Mare-specific gestation length, defaulting to 340 days in horses |
