import type { Event } from "../domain/types";

/**
 * Event risk window — presentation only.
 *
 * Lists scheduled HIGH-importance events near "now" so a trader can see timing
 * risk before opening a position. It states schedule facts only: no direction,
 * no "avoid/safe" wording, no market interpretation.
 */

export const EVENT_RISK_WINDOW_HOURS = 24;
/** Keep a just-passed event visible briefly; post-release volatility can persist. */
export const EVENT_RISK_POST_MINUTES = 30;

const FOREX_FACTORY_SOURCE_ID = "forex-factory";
/** Sources whose scheduledAt is a date anchor (00:00 UTC), not a real release time. */
const DATE_ONLY_SOURCE_IDS = new Set(["federal-reserve"]);
const MS_MINUTE = 60_000;
const MS_HOUR = 3_600_000;

export type RiskWindowEntry = { subject: string; sourceId: string };

export type RiskWindowSlot = {
  key: string;
  /** ISO timestamp (TIME) or the anchor date at 00:00 UTC (DATE_ONLY). */
  scheduledAt: string;
  precision: "TIME" | "DATE_ONLY";
  /** Minutes from now (negative = already started). Null when the time is unknown. */
  minutesUntil: number | null;
  entries: RiskWindowEntry[];
};

export type RiskWindowCoverage =
  /** Every loaded source is known to reach the end of the window. */
  | { kind: "COMPLETE" }
  /** The calendar list was capped; events after `knownUntil` are unknown, not absent. */
  | { kind: "TRUNCATED"; knownUntil: string }
  /** The main calendar provider returned nothing, so absence proves nothing. */
  | { kind: "NO_CALENDAR_DATA" };

export type EventRiskWindow = {
  windowHours: number;
  slots: RiskWindowSlot[];
  coverage: RiskWindowCoverage;
};

export type EventRiskWindowOptions = {
  windowHours?: number;
  postMinutes?: number;
  /** Cap applied to the Forex Factory list at ingestion (see ECONOMIC_CALENDAR_LIMIT). */
  calendarLimit: number;
};

function parseMs(iso: string | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function utcDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function buildEventRiskWindow(events: Event[], now: Date, options: EventRiskWindowOptions): EventRiskWindow {
  const windowHours = options.windowHours ?? EVENT_RISK_WINDOW_HOURS;
  const postMinutes = options.postMinutes ?? EVENT_RISK_POST_MINUTES;
  const nowMs = now.getTime();
  const startMs = nowMs - postMinutes * MS_MINUTE;
  const endMs = nowMs + windowHours * MS_HOUR;
  const startDate = utcDateKey(startMs);
  const endDate = utcDateKey(endMs);

  const slots = new Map<string, { sortMs: number; slot: RiskWindowSlot; seen: Set<string> }>();

  for (const event of events) {
    if (event.importance !== "HIGH") continue;
    const ms = parseMs(event.scheduledAt);
    if (ms === null) continue;

    const dateOnly = DATE_ONLY_SOURCE_IDS.has(event.sourceId);
    let key: string;
    let slotScheduledAt: string;
    let minutesUntil: number | null;

    if (dateOnly) {
      const dateKey = utcDateKey(ms);
      if (dateKey < startDate || dateKey > endDate) continue;
      key = `date:${dateKey}`;
      slotScheduledAt = `${dateKey}T00:00:00.000Z`;
      minutesUntil = null;
    } else {
      if (ms < startMs || ms > endMs) continue;
      const minuteMs = ms - (ms % MS_MINUTE);
      key = `time:${new Date(minuteMs).toISOString()}`;
      slotScheduledAt = new Date(minuteMs).toISOString();
      minutesUntil = Math.round((minuteMs - nowMs) / MS_MINUTE);
    }

    let bucket = slots.get(key);
    if (!bucket) {
      bucket = {
        sortMs: Date.parse(slotScheduledAt),
        slot: { key, scheduledAt: slotScheduledAt, precision: dateOnly ? "DATE_ONLY" : "TIME", minutesUntil, entries: [] },
        seen: new Set(),
      };
      slots.set(key, bucket);
    }
    // Drop only exact repeats (same subject in the same slot). Cross-provider
    // duplicates with different titles stay visible: identity is unresolved (FND-019).
    const subjectKey = event.subject.trim().toLowerCase();
    if (bucket.seen.has(subjectKey)) continue;
    bucket.seen.add(subjectKey);
    bucket.slot.entries.push({ subject: event.subject, sourceId: event.sourceId });
  }

  const ordered = [...slots.values()].sort((a, b) => a.sortMs - b.sortMs).map((bucket) => bucket.slot);

  return { windowHours, slots: ordered, coverage: coverageFor(events, endMs, options.calendarLimit) };
}

function coverageFor(events: Event[], windowEndMs: number, calendarLimit: number): RiskWindowCoverage {
  const forexFactory = events.filter((event) => event.sourceId === FOREX_FACTORY_SOURCE_ID);
  if (forexFactory.length === 0) return { kind: "NO_CALENDAR_DATA" };
  // The ingestion keeps only the nearest N upcoming events of any impact, so a
  // full list means later events (including HIGH ones) may have been cut.
  if (forexFactory.length < calendarLimit) return { kind: "COMPLETE" };
  const times = forexFactory.map((event) => parseMs(event.scheduledAt)).filter((ms): ms is number => ms !== null);
  if (times.length === 0) return { kind: "NO_CALENDAR_DATA" };
  const knownUntilMs = Math.max(...times);
  if (knownUntilMs >= windowEndMs) return { kind: "COMPLETE" };
  return { kind: "TRUNCATED", knownUntil: new Date(knownUntilMs).toISOString() };
}

/** Indonesian countdown text. Positive = upcoming, negative = already started. */
export function formatCountdownID(minutesUntil: number): string {
  if (minutesUntil === 0) return "sekarang";
  const abs = Math.abs(minutesUntil);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  const span = hours > 0 ? (minutes > 0 ? `${hours} j ${minutes} mnt` : `${hours} j`) : `${minutes} mnt`;
  return minutesUntil > 0 ? `dalam ${span}` : `${span} lalu`;
}

/** Proximity flag for styling only; the countdown text carries the meaning. */
export function isNearWindow(minutesUntil: number | null): boolean {
  return minutesUntil !== null && minutesUntil <= 60;
}
