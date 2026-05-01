import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import type { HorseTransferEnvelopeV1, HorseTransferSourceHorse } from './types';

const JSON_EXTENSION = '.json';

export type PickedHorseTransferFile =
  | {
      readonly canceled: true;
    }
  | {
      readonly canceled: false;
      readonly name: string;
      readonly uri: string;
      readonly mimeType: string | null;
    };

export type WrittenHorseTransferFile = {
  readonly fileName: string;
  readonly fileUri: string;
  readonly jsonText: string;
};

export function getHorseTransferDirectoryUri(): string {
  return ensureTrailingSlash(FileSystem.documentDirectory ?? 'file:///');
}

export function createHorseTransferFileName(
  sourceHorse: Pick<HorseTransferSourceHorse, 'type' | 'name'>,
  createdAtIso: string,
): string {
  return `breedwise-${sourceHorse.type}-${slugHorseName(sourceHorse.name)}-v1-${formatTimestampForFileName(
    createdAtIso,
  )}${JSON_EXTENSION}`;
}

export function stringifyHorseTransfer(envelope: HorseTransferEnvelopeV1): string {
  return JSON.stringify(envelope, null, 2);
}

export async function writeHorseTransferFile(
  envelope: HorseTransferEnvelopeV1,
  directoryUri = getHorseTransferDirectoryUri(),
): Promise<WrittenHorseTransferFile> {
  const fileName = createHorseTransferFileName(envelope.sourceHorse, envelope.createdAt);
  const fileUri = joinFileUri(directoryUri, fileName);
  const jsonText = stringifyHorseTransfer(envelope);

  await ensureDirectoryExists(directoryUri);
  await FileSystem.writeAsStringAsync(fileUri, jsonText);

  return {
    fileName,
    fileUri,
    jsonText,
  };
}

export async function shareHorseTransferFileIfAvailable(fileUri: string): Promise<boolean> {
  const sharingAvailable = await Sharing.isAvailableAsync();
  if (!sharingAvailable) {
    return false;
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/json',
    dialogTitle: 'Share horse package',
  });

  return true;
}

export async function pickHorseTransferFile(): Promise<PickedHorseTransferFile> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || result.assets == null || result.assets.length === 0) {
    return { canceled: true };
  }

  const asset = result.assets[0];

  return {
    canceled: false,
    name: asset.name,
    uri: asset.uri,
    mimeType: asset.mimeType ?? null,
  };
}

export async function readHorseTransferTextFile(fileUri: string): Promise<string> {
  return FileSystem.readAsStringAsync(fileUri);
}

function slugHorseName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
    .replace(/^-|-$/g, '');

  return slug.length > 0 ? slug : 'horse';
}

function joinFileUri(directoryUri: string, fileName: string): string {
  return `${ensureTrailingSlash(directoryUri)}${fileName}`;
}

async function ensureDirectoryExists(directoryUri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(directoryUri);
  if (info.exists) {
    return;
  }

  await FileSystem.makeDirectoryAsync(directoryUri, { intermediates: true });
}

function formatTimestampForFileName(createdAtIso: string): string {
  const date = new Date(createdAtIso);
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}
