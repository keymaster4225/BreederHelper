import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DeleteButton, PrimaryButton } from '@/components/Buttons';
import { CardRow, cardStyles } from '@/components/RecordCardParts';
import { FormField, FormTextInput } from '@/components/FormControls';
import {
  CERVICAL_FIRMNESS_LABELS,
  FLUID_LOCATION_LABELS,
  FOLLICLE_STATE_LABELS,
  OVARY_CONSISTENCY_LABELS,
  OVARY_STRUCTURE_LABELS,
  UTERINE_TONE_CATEGORY_LABELS,
} from '@/models/enums';
import type { DailyLogOvulationSource } from '@/models/types';
import {
  type DailyLogWizardLegacyNotes,
  type DailyLogWizardFlushDraft,
  type DailyLogWizardOvaryDraft,
  type DailyLogWizardUterusDraft,
  type FlushDecision,
  type ScoreOption,
} from '@/hooks/useDailyLogWizard';
import { borderRadius, colors, spacing, typography } from '@/theme';
import { formatDailyLogTime } from '@/utils/dailyLogTime';

type Props = {
  date: string;
  time: string;
  teasingScore: ScoreOption;
  rightOvary: DailyLogWizardOvaryDraft;
  leftOvary: DailyLogWizardOvaryDraft;
  uterus: DailyLogWizardUterusDraft;
  flushDecision: FlushDecision;
  flush: DailyLogWizardFlushDraft;
  notes: string;
  legacyNotes: DailyLogWizardLegacyNotes;
  legacyOvulationDetected: boolean | null;
  ovulationSource: DailyLogOvulationSource;
  isEdit: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  onNotesChange: (value: string) => void;
  onJumpToStep: (stepIndex: number) => void;
  onSave: () => void;
  onDelete: () => void;
};

function formatScoreValue(value: ScoreOption): string {
  return value === '' ? 'N/A' : value;
}

function formatTriStateValue(value: boolean | null): string {
  if (value === true) {
    return 'Yes';
  }
  if (value === false) {
    return 'No';
  }
  return 'Unknown';
}

type FormatOvarySummaryOptions = {
  showFollicleState?: boolean;
  singleFollicleSize?: boolean;
};

function formatOvarySummary(
  ovary: DailyLogWizardOvaryDraft,
  options: FormatOvarySummaryOptions = {},
): string {
  const { showFollicleState = true, singleFollicleSize = false } = options;
  const rows: string[] = [];

  rows.push(`Ovulation: ${formatTriStateValue(ovary.ovulation)}`);

  if (showFollicleState && ovary.follicleState) {
    rows.push(`Follicle state: ${FOLLICLE_STATE_LABELS[ovary.follicleState]}`);
  }

  if (ovary.follicleState === 'measured') {
    const values = ovary.follicleMeasurements
      .map((measurement) => measurement.value.trim())
      .filter(Boolean);

    if (singleFollicleSize) {
      rows.push(values.length > 0 ? `Follicle size: ${values[0]} mm` : 'Follicle size: not entered');
    } else {
      rows.push(
        values.length > 0
          ? `Measurements: ${values.join(', ')} mm`
          : 'Measurements: none entered',
      );
    }
  }

  if (ovary.consistency) {
    rows.push(`Consistency: ${OVARY_CONSISTENCY_LABELS[ovary.consistency]}`);
  }

  if (ovary.structures.length > 0) {
    rows.push(
      `Structures: ${ovary.structures
        .map((value) => OVARY_STRUCTURE_LABELS[value])
        .join(', ')}`,
    );
  }

  return rows.join('\n');
}

function formatUterusSummary(uterus: DailyLogWizardUterusDraft): string {
  const rows: string[] = [];
  rows.push(`Edema: ${formatScoreValue(uterus.edema)}`);

  if (uterus.uterineToneCategory) {
    rows.push(`Tone: ${UTERINE_TONE_CATEGORY_LABELS[uterus.uterineToneCategory]}`);
  }
  if (uterus.cervicalFirmness) {
    rows.push(`Cervix: ${CERVICAL_FIRMNESS_LABELS[uterus.cervicalFirmness]}`);
  }

  rows.push(`Discharge: ${formatTriStateValue(uterus.dischargeObserved)}`);
  if (uterus.dischargeObserved === true && uterus.dischargeNotes.trim()) {
    rows.push(`Discharge notes: ${uterus.dischargeNotes.trim()}`);
  }

  if (uterus.fluidPockets.length > 0) {
    rows.push(
      `Fluid pockets: ${uterus.fluidPockets
        .map((row) => `${row.depthMm} mm ${FLUID_LOCATION_LABELS[row.location]}`)
        .join('; ')}`,
    );
  }

  if (uterus.uterineCysts.trim()) {
    rows.push(`Uterine cysts: ${uterus.uterineCysts.trim()}`);
  }

  return rows.join('\n');
}

function formatFlushSummary(flush: DailyLogWizardFlushDraft): string {
  const rows: string[] = [];
  rows.push(`Base solution: ${flush.baseSolution.trim() || 'Not entered'}`);
  rows.push(`Total volume: ${flush.totalVolumeMl.trim() || 'Not entered'} mL`);

  if (flush.products.length > 0) {
    rows.push(
      `Products: ${flush.products
        .map((product) => {
          const name = product.productName.trim() || 'Unnamed product';
          const dose = product.dose.trim() || 'dose not entered';
          return `${name} (${dose})`;
        })
        .join('; ')}`,
    );
  }

  if (flush.notes.trim()) {
    rows.push(`Notes: ${flush.notes.trim()}`);
  }

  return rows.join('\n');
}

type ReviewSectionProps = {
  title: string;
  summary: string;
  editLabel: string;
  onEdit: () => void;
};

function ReviewSection({
  title,
  summary,
  editLabel,
  onEdit,
}: ReviewSectionProps): JSX.Element {
  return (
    <View style={cardStyles.card}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Pressable
          style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
          onPress={onEdit}
          accessibilityRole="button"
        >
          <Text style={styles.editButtonText}>{editLabel}</Text>
        </Pressable>
      </View>
      <Text style={styles.sectionSummary}>{summary}</Text>
    </View>
  );
}

export function ReviewStep({
  date,
  time,
  teasingScore,
  rightOvary,
  leftOvary,
  uterus,
  flushDecision,
  flush,
  notes,
  legacyNotes,
  legacyOvulationDetected,
  ovulationSource,
  isEdit,
  isSaving,
  isDeleting,
  onNotesChange,
  onJumpToStep,
  onSave,
  onDelete,
}: Props): JSX.Element {
  const legacyValuesExist =
    Boolean(legacyNotes.rightOvary) ||
    Boolean(legacyNotes.leftOvary) ||
    Boolean(legacyNotes.uterineTone) ||
    ovulationSource === 'legacy';

  return (
    <>
      <ReviewSection
        title="Basics"
        summary={`Date: ${date}\nTime: ${formatDailyLogTime(time || null)}\nTeasing: ${formatScoreValue(teasingScore)}`}
        editLabel="Edit Basics"
        onEdit={() => onJumpToStep(0)}
      />

      <ReviewSection
        title="Right Ovary"
        summary={formatOvarySummary(rightOvary, { showFollicleState: false, singleFollicleSize: true })}
        editLabel="Edit Right Ovary"
        onEdit={() => onJumpToStep(1)}
      />

      <ReviewSection
        title="Left Ovary"
        summary={formatOvarySummary(leftOvary, { showFollicleState: false, singleFollicleSize: true })}
        editLabel="Edit Left Ovary"
        onEdit={() => onJumpToStep(2)}
      />

      <ReviewSection
        title="Uterus"
        summary={formatUterusSummary(uterus)}
        editLabel="Edit Uterus"
        onEdit={() => onJumpToStep(3)}
      />

      {uterus.fluidPockets.length > 0 && flushDecision === 'yes' ? (
        <ReviewSection
          title="Flush"
          summary={formatFlushSummary(flush)}
          editLabel="Edit Flush"
          onEdit={() => onJumpToStep(4)}
        />
      ) : null}

      {legacyValuesExist ? (
        <View style={cardStyles.card}>
          <Text style={styles.sectionTitle}>Preserved Legacy Notes</Text>
          <CardRow label="Right ovary" value={legacyNotes.rightOvary || '-'} />
          <CardRow label="Left ovary" value={legacyNotes.leftOvary || '-'} />
          <CardRow label="Uterine tone" value={legacyNotes.uterineTone || '-'} />
          {ovulationSource === 'legacy' ? (
            <CardRow
              label="Global ovulation"
              value={`${formatTriStateValue(legacyOvulationDetected)} (preserved)`}
            />
          ) : null}
        </View>
      ) : null}

      <FormField label="Notes">
        <FormTextInput value={notes} onChangeText={onNotesChange} multiline />
      </FormField>

      <View style={styles.actions}>
        <PrimaryButton
          label={isSaving ? 'Saving...' : 'Save'}
          onPress={onSave}
          disabled={isSaving || isDeleting}
        />
        {isEdit ? (
          <DeleteButton
            label={isDeleting ? 'Deleting...' : 'Delete'}
            onPress={onDelete}
            disabled={isSaving || isDeleting}
          />
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...typography.labelLarge,
    color: colors.onSurface,
  },
  sectionSummary: {
    ...typography.bodySmall,
    color: colors.onSurface,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  editButton: {
    borderColor: colors.outline,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  editButtonText: {
    ...typography.labelSmall,
    color: colors.onSurface,
  },
  actions: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  pressed: {
    opacity: 0.7,
  },
});
