# Uterine Cyst Map Design

**Date:** 2026-04-18  
**Status:** Draft

## Summary

BreedWise should display uterine cysts as a dedicated anatomical map tied to each daily log, not as a generic zone selector or a freehand sketch. The primary screen is editor-first: one large uterus diagram for the selected exam date, followed by that exam's cyst list, with history accessible through a date timeline.

This design optimizes for history review while preserving quick day-of-exam entry.

## Core Decisions

- Use an anatomical uterus map, not abstract zones.
- Keep cyst maps tied to `DailyLog` records. No standalone cyst-map exams in v1.
- Keep the existing `Uterine Cysts` free-text field for narrative notes.
- Add a small adjacent action in the daily log form that opens that date's cyst map editor.
- Make the main dedicated screen editor-first, with one selected exam map at a time.
- Use snapshot-based history, with optional manual continuity tracking across dates.
- Show cyst-map presence on daily log cards as icon plus pin count.

## Screen Model

### Primary screen

Add a dedicated `DailyLogCystMapScreen` linked to a specific `dailyLogId`.

Default layout:

1. Selected exam date header
2. Large anatomical uterus map
3. Cyst list for the selected exam
4. Exam-date timeline / date rail for switching between mapped exams

This keeps the current exam as the main focus while still supporting longitudinal review.

### Daily log workflow

- The daily log form keeps the current `Uterine Cysts` text input.
- A small icon/button beside that field opens the cyst map editor for the same daily log date.
- The editor should open directly to that date's map, not to a general history landing screen.

### Mare detail workflow

- Users should be able to reach cyst maps from individual daily log cards.
- There should also be a mare-level shortcut into cyst-map history.
- Shortcut placement is intentionally left unresolved for now and should be revisited later.

Default implementation assumption until revisited:
- place the shortcut in the `Daily Logs` tab header rather than adding a new mare-detail tab or a header icon

## Map Interaction

### Placement model

- Users tap roughly on the anatomical uterus drawing.
- The app snaps the pin to the nearest hidden anatomical anchor.
- The anchor network should use balanced density, weighted toward the high end of that range.

Recommended v1 anchor density:
- approximately 24 hidden anchor points total
- denser coverage across left horn tip/mid/base, right horn tip/mid/base, uterine body, and bifurcation-related positions

This preserves comparability across exams without making the map feel coarse.

### Per-pin data

Each pin stores:

- snapped anatomical position
- optional size
- optional short note
- optional tracked cyst link

### History seed behavior

When opening the cyst map for a new daily log date and a prior mapped exam exists:

- show the previous exam's pins as ghost pins
- ghost pins are visual references only
- users can confirm, move, relink, or ignore them
- the app must not silently carry prior cysts forward as active pins

## History And Tracking

### Snapshot model

Each mapped exam date stores a full snapshot of that day's cyst map.

This is the base history model and must work independently of cross-date tracking.

### Optional continuity tracking

Users may manually indicate that a cyst on a new exam matches a previously tracked cyst.

Rules:

- no automatic matching
- no silent continuity assumptions
- tracked cysts keep stable labels such as `C1`, `C2`, `C3`
- the UI should favor small numbered identities over color-based continuity

### Missing previously tracked cysts

If a previously tracked cyst is not mapped on a later exam:

- make no automatic clinical assumption
- do not automatically mark it absent or resolved
- on save, prompt the user whether they want to stop tracking / remove it from active tracking
- if the user does nothing, preserve the prior tracked identity without creating a new absence record

## Data Model Direction

### New entities

#### `TrackedCyst`

- `id`
- `mareId`
- `label`
- `isActive`
- `createdAt`
- `closedAt?`

#### `CystMapSnapshot`

- `id`
- `dailyLogId` (unique)
- `mareId`
- `date`
- `createdAt`
- `updatedAt`

#### `CystMapPin`

- `id`
- `snapshotId`
- `anchorId`
- `sizeValue?`
- `sizeUnit?`
- `note?`
- `trackedCystId?`
- `displayOrder`

### Derived summary shape

Expose lightweight daily-log summary data for list and form UI:

- `hasCystMap`
- `pinCount`

Avoid adding extra summary fields in v1 unless the UI clearly needs them.

## Surface-Level UI Behavior

### Daily log cards

- show a cyst-map icon plus pin count when a map exists
- tapping the summary opens that log's cyst map
- do not embed a mini uterus preview on cards in v1

### Dedicated map screen

- show one selected exam at a time
- make the current map large and legible on mobile
- keep history switching available through a date timeline or date rail
- do not default to side-by-side comparison in v1

## Validation And Test Scenarios

- Opening the cyst map from the daily log form loads the editor for that exact log date.
- Tapping the uterus creates a pin snapped to the nearest hidden anchor.
- A later exam with a prior mapped date shows ghost pins instead of active copied pins.
- Manual linking preserves stable tracked cyst labels across dates.
- Omitting a previously tracked cyst does not silently mark it resolved.
- Save flow prompts the user when previously tracked cysts were not re-mapped.
- Daily log cards show icon plus count when a map exists.
- Timeline switching updates the main map and pin list to the selected exam.
- The `Uterine Cysts` text field continues to work independently for narrative notes.

## Follow-Up Note

The mare-detail shortcut placement is intentionally unresolved and should be revisited later. The current default assumption is to place the shortcut in the `Daily Logs` tab header, but that is not a locked product decision.
