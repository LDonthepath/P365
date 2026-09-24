import { reconcileEvents } from "../domain/event-identity";
import {
  qualifyEventWindow,
  type EventWindowQualification,
  type QualifiedEventWindow,
} from "../domain/event-window";
import type { Event } from "../domain/types";

export type QualifiedEventWindowSet = {
  windows: QualifiedEventWindow[];
  rejected: Exclude<EventWindowQualification, { eligible: true }>[];
};

/**
 * Reuses FND-019 reconciliation before qualifying event windows, so one real
 * event identity owns one EVW-001 plan even when multiple providers observed
 * the same release.
 */
export function buildQualifiedEventWindowSet(
  events: Event[],
): QualifiedEventWindowSet {
  const reconciled = reconcileEvents(events);
  const windows: QualifiedEventWindow[] = [];
  const rejected: Exclude<EventWindowQualification, { eligible: true }>[] = [];

  for (const event of reconciled) {
    const qualification = qualifyEventWindow(event);
    if (qualification.eligible) {
      windows.push(qualification.window);
    } else {
      rejected.push(qualification);
    }
  }

  windows.sort(
    (a, b) => a.t0.localeCompare(b.t0)
      || a.eventIdentityKey.localeCompare(b.eventIdentityKey),
  );
  rejected.sort(
    (a, b) => a.eventId.localeCompare(b.eventId)
      || a.code.localeCompare(b.code),
  );

  return { windows, rejected };
}
