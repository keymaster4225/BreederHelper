export type DataInvalidationDomain =
  | 'all'
  | 'mares'
  | 'stallions'
  | 'dailyLogs'
  | 'breedingRecords'
  | 'pregnancyChecks'
  | 'foalingRecords'
  | 'foals'
  | 'medicationLogs'
  | 'semenCollections'
  | 'collectionDoseEvents';

export type DataInvalidationEvent = {
  readonly domain: DataInvalidationDomain;
  readonly occurredAt: number;
};

type Listener = (event: DataInvalidationEvent) => void;

const listeners = new Set<Listener>();

export function emitDataInvalidation(domain: DataInvalidationDomain): void {
  if (listeners.size === 0) return;

  const event: DataInvalidationEvent = {
    domain,
    occurredAt: Date.now(),
  };

  for (const listener of listeners) {
    listener(event);
  }
}

export function subscribeDataInvalidation(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function subscribeDataInvalidationForDomains(
  domains: readonly DataInvalidationDomain[],
  onInvalidate: () => void,
): () => void {
  const domainSet = new Set(domains);
  return subscribeDataInvalidation((event) => {
    if (event.domain === 'all' || domainSet.has(event.domain)) {
      onInvalidate();
    }
  });
}
