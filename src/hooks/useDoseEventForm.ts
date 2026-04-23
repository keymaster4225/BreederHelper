import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import type {
  CollectionDoseEvent,
  CreateCollectionDoseEventInput,
  UpdateCollectionDoseEventInput,
  UUID,
} from '@/models/types';
import { createDoseEvent, updateDoseEvent } from '@/storage/repositories';
import { CARRIER_SERVICES, getCarrierServiceSuggestions } from '@/utils/carrierServices';
import { CONTAINER_TYPES, getContainerTypeSuggestions } from '@/utils/containerTypes';
import {
  parseOptionalInteger,
  parseOptionalNumber,
  validateLocalDate,
  validateLocalDateNotInFuture,
  validateNumberRange,
  validateRequired,
} from '@/utils/validation';

import { useRecordForm } from './useRecordForm';

type FormErrors = {
  recipient?: string;
  recipientPhone?: string;
  recipientStreet?: string;
  recipientCity?: string;
  recipientState?: string;
  recipientZip?: string;
  carrierService?: string;
  containerType?: string;
  eventDate?: string;
  doseCount?: string;
  doseSemenVolumeMl?: string;
  doseExtenderVolumeMl?: string;
};

type UseDoseEventFormArgs = {
  readonly visible: boolean;
  readonly collectionId: UUID;
  readonly event?: CollectionDoseEvent;
  readonly onSaved: () => void;
  readonly onClose: () => void;
};

function isFiniteNumber(value: number | null): value is number {
  return value != null && Number.isFinite(value);
}

export function useDoseEventForm({
  visible,
  collectionId,
  event,
  onSaved,
  onClose,
}: UseDoseEventFormArgs) {
  const isEdit = event != null;

  const [recipient, setRecipient] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientStreet, setRecipientStreet] = useState('');
  const [recipientCity, setRecipientCity] = useState('');
  const [recipientState, setRecipientState] = useState('');
  const [recipientZip, setRecipientZip] = useState('');
  const [carrierService, setCarrierService] = useState('');
  const [containerType, setContainerType] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [doseCount, setDoseCount] = useState('');
  const [doseSemenVolumeMl, setDoseSemenVolumeMl] = useState('');
  const [doseExtenderVolumeMl, setDoseExtenderVolumeMl] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const { isSaving, runSave } = useRecordForm();

  useEffect(() => {
    if (!visible) {
      return;
    }

    setRecipient(event?.recipient ?? '');
    setRecipientPhone(event?.recipientPhone ?? '');
    setRecipientStreet(event?.recipientStreet ?? '');
    setRecipientCity(event?.recipientCity ?? '');
    setRecipientState(event?.recipientState ?? '');
    setRecipientZip(event?.recipientZip ?? '');
    setCarrierService(event?.carrierService ?? '');
    setContainerType(event?.containerType ?? '');
    setTrackingNumber(event?.trackingNumber ?? '');
    setEventDate(event?.eventDate ?? '');
    setDoseCount(event?.doseCount != null ? String(event.doseCount) : '');
    setDoseSemenVolumeMl(
      event?.doseSemenVolumeMl != null ? String(event.doseSemenVolumeMl) : '',
    );
    setDoseExtenderVolumeMl(
      event?.doseExtenderVolumeMl != null ? String(event.doseExtenderVolumeMl) : '',
    );
    setNotes(event?.notes ?? '');
    setErrors({});
  }, [event, visible]);

  const totalPerDoseMl = useMemo(() => {
    const semen = parseOptionalNumber(doseSemenVolumeMl);
    const extender = parseOptionalNumber(doseExtenderVolumeMl);
    if (!isFiniteNumber(semen) || !isFiniteNumber(extender)) {
      return null;
    }
    return semen + extender;
  }, [doseExtenderVolumeMl, doseSemenVolumeMl]);

  const totalSemenUsedMl = useMemo(() => {
    const semen = parseOptionalNumber(doseSemenVolumeMl);
    const count = parseOptionalInteger(doseCount);
    if (!isFiniteNumber(semen) || !isFiniteNumber(count)) {
      return null;
    }
    return semen * count;
  }, [doseCount, doseSemenVolumeMl]);

  const totalExtenderUsedMl = useMemo(() => {
    const extender = parseOptionalNumber(doseExtenderVolumeMl);
    const count = parseOptionalInteger(doseCount);
    if (!isFiniteNumber(extender) || !isFiniteNumber(count)) {
      return null;
    }
    return extender * count;
  }, [doseCount, doseExtenderVolumeMl]);

  const validate = useCallback((): FormErrors => {
    const parsedDoseCount = parseOptionalInteger(doseCount);
    const parsedDoseSemenVolumeMl = parseOptionalNumber(doseSemenVolumeMl);
    const parsedDoseExtenderVolumeMl = parseOptionalNumber(doseExtenderVolumeMl);

    return {
      recipient: validateRequired(recipient, 'Recipient name') ?? undefined,
      recipientPhone: validateRequired(recipientPhone, 'Recipient phone') ?? undefined,
      recipientStreet: validateRequired(recipientStreet, 'Recipient street') ?? undefined,
      recipientCity: validateRequired(recipientCity, 'Recipient city') ?? undefined,
      recipientState: validateRequired(recipientState, 'Recipient state') ?? undefined,
      recipientZip: validateRequired(recipientZip, 'Recipient ZIP') ?? undefined,
      carrierService: validateRequired(carrierService, 'Carrier/service') ?? undefined,
      containerType: validateRequired(containerType, 'Container type') ?? undefined,
      eventDate:
        validateLocalDate(eventDate, 'Ship date', true) ??
        validateLocalDateNotInFuture(eventDate) ??
        undefined,
      doseCount:
        parsedDoseCount == null
          ? 'Dose Count is required.'
          : validateNumberRange(parsedDoseCount, 'Dose Count', 1, 1000) ?? undefined,
      doseSemenVolumeMl:
        parsedDoseSemenVolumeMl == null
          ? 'Dose Semen Volume (mL) is required.'
          : validateNumberRange(parsedDoseSemenVolumeMl, 'Dose Semen Volume (mL)', 0.01, 1000) ??
            undefined,
      doseExtenderVolumeMl:
        parsedDoseExtenderVolumeMl == null
          ? 'Dose Extender Volume (mL) is required.'
          : validateNumberRange(
              parsedDoseExtenderVolumeMl,
              'Dose Extender Volume (mL)',
              0,
              1000,
            ) ?? undefined,
    };
  }, [
    carrierService,
    containerType,
    doseCount,
    doseExtenderVolumeMl,
    doseSemenVolumeMl,
    eventDate,
    recipient,
    recipientCity,
    recipientPhone,
    recipientState,
    recipientStreet,
    recipientZip,
  ]);

  const handleSave = useCallback(async (): Promise<void> => {
    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    const parsedDoseCount = parseOptionalInteger(doseCount);
    const parsedDoseSemenVolumeMl = parseOptionalNumber(doseSemenVolumeMl);
    const parsedDoseExtenderVolumeMl = parseOptionalNumber(doseExtenderVolumeMl);

    if (
      !isFiniteNumber(parsedDoseCount) ||
      !isFiniteNumber(parsedDoseSemenVolumeMl) ||
      !isFiniteNumber(parsedDoseExtenderVolumeMl)
    ) {
      Alert.alert('Save error', 'Shipment dose values are invalid.');
      return;
    }

    await runSave(
      async () => {
        const baseInput: CreateCollectionDoseEventInput | UpdateCollectionDoseEventInput = {
          collectionId,
          eventType: 'shipped',
          recipient: recipient.trim(),
          recipientPhone: recipientPhone.trim(),
          recipientStreet: recipientStreet.trim(),
          recipientCity: recipientCity.trim(),
          recipientState: recipientState.trim(),
          recipientZip: recipientZip.trim(),
          carrierService: carrierService.trim(),
          containerType: containerType.trim(),
          trackingNumber: trackingNumber.trim() || null,
          doseCount: parsedDoseCount,
          doseSemenVolumeMl: parsedDoseSemenVolumeMl,
          doseExtenderVolumeMl: parsedDoseExtenderVolumeMl,
          eventDate: eventDate.trim(),
          notes: notes.trim() || null,
        };

        if (event) {
          const createInput = baseInput as CreateCollectionDoseEventInput;
          const updateInput: UpdateCollectionDoseEventInput = {
            eventType: createInput.eventType,
            recipient: createInput.recipient,
            recipientPhone: createInput.recipientPhone,
            recipientStreet: createInput.recipientStreet,
            recipientCity: createInput.recipientCity,
            recipientState: createInput.recipientState,
            recipientZip: createInput.recipientZip,
            carrierService: createInput.carrierService,
            containerType: createInput.containerType,
            trackingNumber: createInput.trackingNumber,
            doseCount: createInput.doseCount,
            doseSemenVolumeMl: createInput.doseSemenVolumeMl,
            doseExtenderVolumeMl: createInput.doseExtenderVolumeMl,
            eventDate: createInput.eventDate,
            notes: createInput.notes,
          };
          await updateDoseEvent(event.id, updateInput);
        } else {
          await createDoseEvent(baseInput as CreateCollectionDoseEventInput);
        }

        onSaved();
        onClose();
      },
      {
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Failed to save shipment.';
          Alert.alert('Save error', message);
        },
      },
    );
  }, [
    collectionId,
    containerType,
    doseCount,
    doseExtenderVolumeMl,
    doseSemenVolumeMl,
    event,
    eventDate,
    notes,
    onClose,
    onSaved,
    recipient,
    recipientCity,
    recipientPhone,
    recipientState,
    recipientStreet,
    recipientZip,
    runSave,
    trackingNumber,
    validate,
    carrierService,
  ]);

  return {
    isEdit,
    isSaving,
    recipient,
    recipientPhone,
    recipientStreet,
    recipientCity,
    recipientState,
    recipientZip,
    carrierService,
    containerType,
    trackingNumber,
    eventDate,
    doseCount,
    doseSemenVolumeMl,
    doseExtenderVolumeMl,
    notes,
    errors,
    totalPerDoseMl,
    totalSemenUsedMl,
    totalExtenderUsedMl,
    carrierServiceOptions: CARRIER_SERVICES,
    getCarrierServiceSuggestions,
    containerTypeOptions: CONTAINER_TYPES,
    getContainerTypeSuggestions,
    setRecipient,
    setRecipientPhone,
    setRecipientStreet,
    setRecipientCity,
    setRecipientState,
    setRecipientZip,
    setCarrierService,
    setContainerType,
    setTrackingNumber,
    setEventDate,
    setDoseCount,
    setDoseSemenVolumeMl,
    setDoseExtenderVolumeMl,
    setNotes,
    handleSave,
  };
}
