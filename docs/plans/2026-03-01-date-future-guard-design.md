# Date Future-Guard Forms Design

**Date:** 2026-03-01

## Scope
Apply a "no future date" rule using local device date on:
- DailyLogFormScreen
- BreedingRecordFormScreen
- FoalingRecordFormScreen
- PregnancyCheckFormScreen

## Requirements
- Users cannot pick a date after today from the date picker.
- Save flow must still validate and reject future dates.
- Error message is shared across screens: `Date cannot be in the future.`
- "Today" is based on device local time, not UTC.

## Approach
1. Extend shared `FormDateInput` with optional `maximumDate?: Date`.
2. Pass `maximumDate` to native `DateTimePicker`.
3. Add a shared validation helper in `utils/validation.ts` to reject local dates after local today.
4. In each target screen:
   - pass `maximumDate={new Date()}` to relevant `FormDateInput` fields
   - run future-date validation in `validate()` before save
5. Add unit tests for the new validation helper.

## Affected Date Fields
- DailyLogFormScreen: `date`
- BreedingRecordFormScreen: `date`, `collectionDate`
- FoalingRecordFormScreen: `date`
- PregnancyCheckFormScreen: `date`

## Error Handling
- Validation failure uses field errors and prevents save.
- Shared message text: `Date cannot be in the future.`

## Testing
- Add tests for today, past, and future date behavior in `validation.test.ts`.
- Manual verification that picker blocks future dates on all listed form fields.
