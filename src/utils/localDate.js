const pad2 = (n) => String(n).padStart(2, '0');

/**
 * YYYY-MM-DD for the moment `value` happened, in the device's LOCAL timezone.
 *
 * completedAt is stored as a UTC ISO timestamp (correct, and unchanged); slicing it
 * with .slice(0, 10) yields the UTC date, which is the next calendar day for anything
 * finished after ~21:00 in UTC-3. Every report that prints a date derived from a
 * stored timestamp goes through here so they all agree on "what day was that".
 *
 * A bare date string ('2026-06-15', e.g. a block's declared startedAt) has no time
 * component and no timezone to convert — it is returned untouched, otherwise it would
 * parse as UTC midnight and shift back a day west of Greenwich.
 */
export const localDateStr = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
