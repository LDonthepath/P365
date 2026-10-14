/**
 * Provider-neutral validation for legacy market BACKFILL routes.
 * Pure date/range policy: importing the macro cron parser must not import
 * nonmacro HTTP providers (SoSoValue and CFTC).
 */
export const SOSOVALUE_MAX_BACKFILL_CALENDAR_DAYS = 28;
export const CFTC_GOLD_COT_MAX_BACKFILL_CALENDAR_DAYS = 370;

const DAY_MS = 24 * 60 * 60 * 1000;
type DateRange = { from: string; to: string };

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function inclusiveCalendarDays(range: DateRange): number {
  return (Date.parse(range.to + "T00:00:00.000Z")
    - Date.parse(range.from + "T00:00:00.000Z")) / DAY_MS + 1;
}

export function soSoValueBackfillRangeError(range: DateRange): string | null {
  if (!isDateOnly(range.from) || !isDateOnly(range.to) || range.from > range.to) {
    return "SoSoValue BACKFILL requires valid from/to date bounds";
  }
  return inclusiveCalendarDays(range) > SOSOVALUE_MAX_BACKFILL_CALENDAR_DAYS
    ? "SoSoValue BACKFILL is limited to " + SOSOVALUE_MAX_BACKFILL_CALENDAR_DAYS + " calendar days"
    : null;
}

export function cftcGoldCotBackfillRangeError(range: DateRange): string | null {
  if (!isDateOnly(range.from) || !isDateOnly(range.to) || range.from > range.to) {
    return "CFTC Gold COT BACKFILL requires valid from/to date bounds";
  }
  return inclusiveCalendarDays(range) > CFTC_GOLD_COT_MAX_BACKFILL_CALENDAR_DAYS
    ? "CFTC Gold COT BACKFILL is limited to " + CFTC_GOLD_COT_MAX_BACKFILL_CALENDAR_DAYS + " calendar days"
    : null;
}
