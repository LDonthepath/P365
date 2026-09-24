import type { Event } from "../domain/types";
import type { EventHistoryQuery } from "./types";

export const MAX_EVENT_HISTORY_LIMIT = 500;

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Invalid " + field + " timestamp: " + value);
  }
  return parsed;
}

export function validateEventHistoryQuery(
  query: EventHistoryQuery,
): { scheduledFrom?: number; scheduledThrough?: number; retrievedThrough?: number } {
  if (!query) throw new Error("Event history query is required.");
  if (
    query.eventIdentityKey !== undefined
    && !query.eventIdentityKey.trim()
  ) {
    throw new Error("Event history eventIdentityKey must be non-empty when supplied.");
  }
  if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > MAX_EVENT_HISTORY_LIMIT) {
    throw new Error(
      "Event history limit must be an integer between 1 and "
      + MAX_EVENT_HISTORY_LIMIT
      + ".",
    );
  }
  if (query.order !== "ASC" && query.order !== "DESC") {
    throw new Error("Event history order must be ASC or DESC.");
  }

  const scheduledFrom = query.scheduledAtOnOrAfter === undefined
    ? undefined
    : timestamp(query.scheduledAtOnOrAfter, "scheduledAtOnOrAfter");
  const scheduledThrough = query.scheduledAtOnOrBefore === undefined
    ? undefined
    : timestamp(query.scheduledAtOnOrBefore, "scheduledAtOnOrBefore");
  const retrievedThrough = query.retrievedAtOnOrBefore === undefined
    ? undefined
    : timestamp(query.retrievedAtOnOrBefore, "retrievedAtOnOrBefore");

  if (
    scheduledFrom !== undefined
    && scheduledThrough !== undefined
    && scheduledFrom > scheduledThrough
  ) {
    throw new Error("Event history scheduled lower bound must not be after upper bound.");
  }

  return { scheduledFrom, scheduledThrough, retrievedThrough };
}

export function compareEventHistory(a: Event, b: Event): number {
  const aSchedule = a.identity?.scheduledAt ?? a.scheduledAt ?? a.retrievedAt;
  const bSchedule = b.identity?.scheduledAt ?? b.scheduledAt ?? b.retrievedAt;
  const scheduled = timestamp(aSchedule, "Event scheduled time")
    - timestamp(bSchedule, "Event scheduled time");
  if (scheduled !== 0) return scheduled;

  const retrieved = timestamp(a.retrievedAt, "Event.retrievedAt")
    - timestamp(b.retrievedAt, "Event.retrievedAt");
  if (retrieved !== 0) return retrieved;

  return a.id.localeCompare(b.id);
}
