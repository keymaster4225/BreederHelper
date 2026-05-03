let activeLock: Promise<unknown> = Promise.resolve();
let photoStorageReadyForWrites = false;

export async function withPhotoStorageLock<T>(callback: () => Promise<T>): Promise<T> {
  const previousLock = activeLock;
  let releaseLock!: () => void;
  activeLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  await previousLock;

  try {
    return await callback();
  } finally {
    releaseLock();
  }
}

export function markPhotoStorageReadyForWrites(): void {
  photoStorageReadyForWrites = true;
}

export function resetPhotoStorageReadinessForTests(): void {
  photoStorageReadyForWrites = false;
  activeLock = Promise.resolve();
}

export function assertPhotoStorageReadyForWrites(): void {
  if (!photoStorageReadyForWrites) {
    throw new Error('Photo storage is not ready yet.');
  }
}

export function isPhotoStorageReadyForWrites(): boolean {
  return photoStorageReadyForWrites;
}
