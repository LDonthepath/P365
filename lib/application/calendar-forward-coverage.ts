import type { Event } from "../domain/types";

/**
 * RECOVERY-G1-05: read-side source-coverage diagnostic, NOT a calendar
 * completeness or official-event verification service.
 * A persisted Event is evidence that one schedule was observed, never evidence
 * that a provider returned every scheduled Event (or returned zero).
 */
export const CALENDAR_FORWARD_DAYS = 7;
export const CALENDAR_REGIONS = ["US", "CHINA", "JAPAN"] as const;
export type CalendarRegion = (typeof CALENDAR_REGIONS)[number];
export type CalendarFeedId = "forex-factory" | "biquote" | "federal-reserve";
export type CoverageStatus = "KNOWN_EVENTS" | "QUALIFIED_EMPTY" | "UNKNOWN" | "READ_ERROR";
export type CalendarFeedHorizon = "CURRENT_WEEK_FEED" | "BOUNDED_ROLLING_RESPONSE" | "FOMC_DATES_ONLY";

type CalendarFeedDefinition = {
  sourceId: CalendarFeedId;
  horizon: CalendarFeedHorizon;
  regions: readonly CalendarRegion[];
};

const FEEDS: readonly CalendarFeedDefinition[] = [
  { sourceId: "forex-factory", horizon: "CURRENT_WEEK_FEED", regions: CALENDAR_REGIONS },
  { sourceId: "biquote", horizon: "BOUNDED_ROLLING_RESPONSE", regions: CALENDAR_REGIONS },
  { sourceId: "federal-reserve", horizon: "FOMC_DATES_ONLY", regions: ["US"] },
];

/** Explicit, separately qualified source-envelope proof; NOT inferred from Events.
 * No existing durable Event row stores this proof, so the live reader supplies
 * no receipts until a separately reviewed persistence/ingestion contract exists.
 */
export type CalendarCoverageReceipt = {
  sourceId: CalendarFeedId;
  retrievedAt: string;
  windowStart: string;
  windowEnd: string;
  jurisdictions: CalendarRegion[];
  outcome: "EMPTY";
  responseCompleteness: "PROVIDER_CONFIRMED_FULL_WINDOW";
  wasTruncated: false;
};

export type FeedForwardCoverage = {
  sourceId: CalendarFeedId;
  advertisedHorizon: CalendarFeedHorizon;
  /** A source's jurisdictional reach, NOT assertion of calendar completeness. */
  sourceJurisdictions: CalendarRegion[];
  /** Per-region read status for exactly this 7d request. */
  regions: { jurisdiction: CalendarRegion; status: CoverageStatus; observedEvents: number }[];
  /** Latest dated Event visible at asOf (not a provider coverage end date). */
  lastListedAt: string | null;
};

export type CalendarForwardCoverage = {
  asOf: string;
  windowStart: string;
  windowEnd: string;
  /** Overall coverage is qualified EMPTY only for the configured feeds, never globally. */
  regions: { jurisdiction: CalendarRegion; status: CoverageStatus; observedEvents: number }[];
  feeds: FeedForwardCoverage[];
  provenanceNote: string;
};

const parse = (value: string): number => Date.parse(value);

/** Explicit end-inclusive 7*24h window. Never widen with a date-only source. */
export function buildCalendarForwardCoverage(input: {
  events: readonly Event[];
  asOf: string;
  receipts?: readonly CalendarCoverageReceipt[];
  eventReadSucceeded: boolean;
  eventHistoryTruncated?: boolean;
}): CalendarForwardCoverage {
  const start = parse(input.asOf);
  if (!Number.isFinite(start)) throw new Error("Calendar forward coverage requires valid asOf");
  const end = start + CALENDAR_FORWARD_DAYS * 24 * 60 * 60_000;
  const receipts = input.receipts ?? [];
  const visible = input.events.filter((event) => {
    const when = parse(event.scheduledAt ?? "");
    const knownAt = parse(event.retrievedAt);
    return input.eventReadSucceeded && Number.isFinite(when) && Number.isFinite(knownAt)
      && knownAt <= start && when >= start && when <= end
      && CALENDAR_REGIONS.includes(event.jurisdiction as CalendarRegion)
      && FEEDS.some((feed) => feed.sourceId === event.sourceId);
  });

  const statusFor = (sourceId: CalendarFeedId, region: CalendarRegion, observed: number): CoverageStatus => {
    if (!input.eventReadSucceeded) return "READ_ERROR";
    if (observed > 0) return "KNOWN_EVENTS";
    if (input.eventHistoryTruncated) return "UNKNOWN";
    const proven = receipts.some((receipt) =>
      receipt.sourceId === sourceId
      && receipt.jurisdictions.includes(region)
      && receipt.responseCompleteness === "PROVIDER_CONFIRMED_FULL_WINDOW"
      && receipt.outcome === "EMPTY"
      && receipt.wasTruncated === false
      && Number.isFinite(parse(receipt.retrievedAt))
      && parse(receipt.retrievedAt) <= start
      && Number.isFinite(parse(receipt.windowStart))
      && Number.isFinite(parse(receipt.windowEnd))
      && parse(receipt.windowStart) <= start
      && parse(receipt.windowEnd) >= end);
    return proven ? "QUALIFIED_EMPTY" : "UNKNOWN";
  };

  const feeds = FEEDS.map((feed): FeedForwardCoverage => {
    const ownEvents = visible.filter((event) => event.sourceId === feed.sourceId);
    const lastListedAt = ownEvents.length > 0
      ? new Date(Math.max(...ownEvents.map((event) => parse(event.scheduledAt!)))).toISOString()
      : null;
    return {
      sourceId: feed.sourceId,
      advertisedHorizon: feed.horizon,
      sourceJurisdictions: [...feed.regions],
      lastListedAt,
      regions: feed.regions.map((jurisdiction) => {
        const count = ownEvents.filter((event) => event.jurisdiction === jurisdiction).length;
        return { jurisdiction, status: statusFor(feed.sourceId, jurisdiction, count), observedEvents: count };
      }),
    };
  });
  const regions = CALENDAR_REGIONS.map((jurisdiction) => {
    const relevant = feeds.flatMap((feed) => feed.regions.filter((region) => region.jurisdiction === jurisdiction));
    const count = relevant.reduce((sum, region) => sum + region.observedEvents, 0);
    const status: CoverageStatus = !input.eventReadSucceeded ? "READ_ERROR"
      : count > 0 ? "KNOWN_EVENTS"
      : relevant.length > 0 && relevant.every((region) => region.status === "QUALIFIED_EMPTY")
        ? "QUALIFIED_EMPTY" : "UNKNOWN";
    return { jurisdiction, status, observedEvents: count };
  });
  return {
    asOf: new Date(start).toISOString(),
    windowStart: new Date(start).toISOString(),
    windowEnd: new Date(end).toISOString(),
    regions,
    feeds,
    provenanceNote: "Jadwal tersimpan tidak membuktikan kelengkapan kalender. Status kosong memerlukan bukti respons sumber untuk jendela dan wilayah yang sama.",
  };
}
