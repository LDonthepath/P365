import {
  findEventWindowContaminants,
  type EventWindowRole,
} from "../domain/event-window";
import {
  assessEventRepricing,
  type EventRepricingAssessment,
  type EventRepricingThreshold,
} from "../domain/event-repricing";
import { productionRepricingThresholdFor } from "../domain/repricing-threshold-policy";
import type { Event } from "../domain/types";
import type {
  IntradayEventMonitorResult,
  IntradayRepricingComparisonSource,
} from "./intraday-event-monitor";

export type BriefingEventRepricingWindow =
  | {
      status: "ASSESSED";
      role: Exclude<EventWindowRole, "PRE">;
      capturedAt: string;
      assessment: EventRepricingAssessment;
    }
  | {
      status: "INSUFFICIENT_THRESHOLDS";
      role: Exclude<EventWindowRole, "PRE">;
      capturedAt: string;
      reason: string;
    };

export type BriefingEventRepricingItem = {
  eventIdentityKey: string;
  eventId: string;
  subject: string;
  jurisdiction: string;
  t0: string;
  windows: BriefingEventRepricingWindow[];
};

export type BriefingEventRepricingResult =
  | { status: "OK"; data: BriefingEventRepricingItem[] }
  | { status: "INSUFFICIENT"; reason: string }
  | { status: "EMPTY" }
  | { status: "ERROR" };

function latestEventsAsOf(events: Event[], asOf: string): Event[] {
  const cutoff = Date.parse(asOf);
  if (!Number.isFinite(cutoff)) return [];

  const latest = new Map<string, Event>();
  for (const event of events) {
    const retrievedAt = Date.parse(event.retrievedAt);
    if (!Number.isFinite(retrievedAt) || retrievedAt > cutoff) continue;

    const key = event.identity?.key ?? event.id;
    const current = latest.get(key);
    if (
      !current
      || Date.parse(event.retrievedAt) > Date.parse(current.retrievedAt)
      || (
        event.retrievedAt === current.retrievedAt
        && event.id.localeCompare(current.id) < 0
      )
    ) {
      latest.set(key, event);
    }
  }

  return [...latest.values()];
}

function thresholdsFor(
  source: IntradayRepricingComparisonSource,
): EventRepricingThreshold[] {
  const thresholds = new Map<string, EventRepricingThreshold>();

  for (const change of source.comparison.observationChanges) {
    if (!change.beforeObservedAt || !change.afterObservedAt) continue;

    const beforeObservedAt = Date.parse(change.beforeObservedAt);
    const afterObservedAt = Date.parse(change.afterObservedAt);
    if (
      !Number.isFinite(beforeObservedAt)
      || !Number.isFinite(afterObservedAt)
      || afterObservedAt <= beforeObservedAt
    ) {
      continue;
    }

    const threshold = productionRepricingThresholdFor({
      observationKey: change.key,
      afterRole: source.role,
      comparisonHorizonMs: afterObservedAt - beforeObservedAt,
    });
    if (threshold) thresholds.set(threshold.observationKey, threshold);
  }

  return [...thresholds.values()].sort(
    (a, b) => a.observationKey.localeCompare(b.observationKey),
  );
}

/**
 * Gate 3b pure composition boundary.
 *
 * All Snapshot/Observation inputs were already resolved by the existing
 * Intraday monitor. Event history comes from the dashboard's pre-existing
 * durable HIGH-event query. This function performs no I/O.
 */
export function buildBriefingEventRepricing(input: {
  monitor: IntradayEventMonitorResult;
  eventHistory: Event[];
  eventHistoryComplete: boolean;
}): BriefingEventRepricingResult {
  if (input.monitor.status === "ERROR") return { status: "ERROR" };
  if (input.monitor.status !== "OK" || input.monitor.data.length === 0) {
    return { status: "EMPTY" };
  }
  if (!input.eventHistoryComplete) {
    return {
      status: "INSUFFICIENT",
      reason:
        "Riwayat event HIGH yang diperlukan untuk memeriksa contamination belum lengkap.",
    };
  }

  const data = input.monitor.data.map((item): BriefingEventRepricingItem => {
    const source = item.repricingSource;
    if (!source) {
      return {
        eventIdentityKey: item.eventIdentityKey,
        eventId: item.eventId,
        subject: item.subject,
        jurisdiction: item.jurisdiction,
        t0: item.t0,
        windows: [],
      };
    }

    const windows = source.comparisons.map(
      (comparisonSource): BriefingEventRepricingWindow => {
        const thresholds = thresholdsFor(comparisonSource);
        if (!thresholds.length) {
          return {
            status: "INSUFFICIENT_THRESHOLDS",
            role: comparisonSource.role,
            capturedAt: comparisonSource.comparison.afterCapturedAt,
            reason:
              "Tidak ada threshold RPR-002B yang cocok persis dengan horizon Observation canonical pada window ini.",
          };
        }

        const contaminants = findEventWindowContaminants({
          primary: source.window,
          baselineCapturedAt: comparisonSource.comparison.beforeCapturedAt,
          evaluatedCapturedAt: comparisonSource.comparison.afterCapturedAt,
          events: latestEventsAsOf(
            input.eventHistory,
            comparisonSource.comparison.afterCapturedAt,
          ),
        });

        return {
          status: "ASSESSED",
          role: comparisonSource.role,
          capturedAt: comparisonSource.comparison.afterCapturedAt,
          assessment: assessEventRepricing({
            windowId: source.window.id,
            eventIdentityKey: source.window.eventIdentityKey,
            beforeRole: "PRE",
            afterRole: comparisonSource.role,
            contaminationStatus: contaminants.length > 0
              ? "CONTAMINATED"
              : "CLEAN",
            contaminants,
            comparison: comparisonSource.comparison,
            thresholds,
          }),
        };
      },
    );

    return {
      eventIdentityKey: item.eventIdentityKey,
      eventId: item.eventId,
      subject: item.subject,
      jurisdiction: item.jurisdiction,
      t0: item.t0,
      windows,
    };
  });

  return { status: "OK", data };
}
