const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeUuid(raw: string, label: string): string {
  const value = raw.trim().toLowerCase();
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`Invalid ${label}: ${raw}`);
  }
  return value;
}
