const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Real (database) lead ids are UUIDs; demo records are not linkable. */
export function isLeadId(value: string): boolean {
  return UUID_RE.test(value);
}
