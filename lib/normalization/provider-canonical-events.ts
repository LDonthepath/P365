/** Forex Factory and Federal Reserve event provider DTOs -> existing canonical builders. */
import type { CalendarEvent } from "../data/types";
import type { FomcEventInput } from "../data/federal-reserve-events";
import { forexFactoryJurisdiction } from "../data/event-jurisdiction";
import type { CalendarCanonicalInput } from "../domain/normalization-inputs";
import {
  calendarToCanonicalRecords as buildCalendarRecords,
  fomcToCanonicalRecords as buildFomcRecords,
} from "../domain/normalize";

export { P365_SOURCES } from "../domain/normalize";

export function calendarToCanonicalRecords(items: CalendarEvent[], sourceId: string) {
  const qualified: CalendarCanonicalInput[] = items.map(({ id, event, country, dateISO, impact, status }) =>
    ({ id, event, country, dateISO, impact, status, jurisdiction: forexFactoryJurisdiction(country) }));
  return buildCalendarRecords(qualified, sourceId);
}

export function fomcToCanonicalRecords(items: FomcEventInput[], sourceId: string) {
  return buildFomcRecords(items.map(({ scheduledAt, label, sourceUrl }) => ({ scheduledAt, label, sourceUrl })), sourceId);
}
