import type { EconomicEventResult } from "../domain/event-result";
import type { EconomicEventResultHistoryQuery } from "./types";

export const MAX_EVENT_RESULT_HISTORY_LIMIT = 500;

export function eventResultHistoryTimestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("Invalid " + field + " timestamp: " + value);
  return parsed;
}

export function validateEconomicEventResultHistoryQuery(
  query: EconomicEventResultHistoryQuery,
): { from?: number; through?: number } {
  if (!query || !query.eventIdentityKey?.trim()) {
    throw new Error("EventResult history requires a non-empty eventIdentityKey.");
  }
  if (query.sourceId !== undefined && !query.sourceId.trim()) {
    throw new Error("EventResult history sourceId filter must be non-empty when supplied.");
  }
  if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > MAX_EVENT_RESULT_HISTORY_LIMIT) {
    throw new Error(
      "EventResult history limit must be an integer between 1 and "
      + MAX_EVENT_RESULT_HISTORY_LIMIT
      + ".",
    );
  }
  if (query.order !== "ASC" && query.order !== "DESC") {
    throw new Error("EventResult history order must be ASC or DESC.");
  }

  const from = query.retrievedAtOnOrAfter === undefined
    ? undefined
    : eventResultHistoryTimestamp(query.retrievedAtOnOrAfter, "retrievedAtOnOrAfter");
  const through = query.retrievedAtOnOrBefore === undefined
    ? undefined
    : eventResultHistoryTimestamp(query.retrievedAtOnOrBefore, "retrievedAtOnOrBefore");
  if (from !== undefined && through !== undefined && from > through) {
    throw new Error("EventResult history lower availability bound must not be after its upper bound.");
  }
  return { from, through };
}

export function compareEconomicEventResultHistory(
  a: EconomicEventResult,
  b: EconomicEventResult,
): number {
  const retrieved = eventResultHistoryTimestamp(
    a.retrievedAt,
    "EconomicEventResult.retrievedAt",
  ) - eventResultHistoryTimestamp(
    b.retrievedAt,
    "EconomicEventResult.retrievedAt",
  );
  if (retrieved !== 0) return retrieved;
  return a.id.localeCompare(b.id);
}
