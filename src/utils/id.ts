export function newId(): string {
  const timePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `id-${timePart}-${randomPart}`;
}
