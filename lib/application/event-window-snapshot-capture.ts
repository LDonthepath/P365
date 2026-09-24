import { buildRepositoryBackedExpectationBaseline } from "./expectation-baseline";
import { buildQualifiedEventWindowSet } from "./event-window";
import { captureMarketSnapshot } from "./market-snapshot";
import { buildRepositoryBackedPricingBaseline } from "./pricing-baseline";
import { reconcileEvents } from "../domain/event-identity";
import {
  EVENT_WINDOW_POLICY_V1,
  type EventWindowRole,
  type QualifiedEventWindow,
  type QualifiedEventWindowSlot,
} from "../domain/event-window";
import {
  marketSnapshotBaselineKey,
  type MarketSnapshot,
  type MarketSnapshotRequirement,
} from "../domain/market-snapshot";
import type { ExpectationBaseline } from "../domain/expectation-baseline";
import type { PricingBaseline } from "../domain/pricing-baseline";
import type { Event, Observation, ObservationDomain } from "../domain/types";
import type {
  HistoricalEconomicEventResultRepository,
  HistoricalEventRepository,
  HistoricalMarketSnapshotRepository,
  HistoricalObservationRepository,
  MarketSnapshotRepository,
  ObservationRepository,
} from "../repositories/types";

const MINUTE_MS = 60_000;

export const CAPTURE_RECONSTRUCTION_LOOKBACK_MS = 90 * MINUTE_MS;

export const EVENT_WINDOW_CAPTURE_SERIES = [
  {
    domain: "ASSET",
    seriesKey: "btc.spot.usd",
    sourceId: "coingecko-market",
    maxObservationAgeMs: 10 * MINUTE_MS,
  },
  {
    domain: "ASSET",
    seriesKey: "eth.spot.usd",
    sourceId: "coingecko-market",
    maxObservationAgeMs: 10 * MINUTE_MS,
  },
  {
    domain: "ASSET",
    seriesKey: "dxy.index.usd",
    sourceId: "yahoo-finance",
    maxObservationAgeMs: 20 * MINUTE_MS,
  },
  {
    domain: "ASSET",
    seriesKey: "gold.futures.usd",
    sourceId: "yahoo-finance",
    maxObservationAgeMs: 20 * MINUTE_MS,
  },
] as const satisfies ReadonlyArray<{
  domain: ObservationDomain;
  seriesKey: string;
  sourceId: string;
  maxObservationAgeMs: number;
}>;

export type EventWindowCaptureSeries = typeof EVENT_WINDOW_CAPTURE_SERIES[number];

export type EventWindowCaptureRepositories = {
  events: HistoricalEventRepository;
  observations: HistoricalObservationRepository;
  canonicalObservations: ObservationRepository;
  eventResults: HistoricalEconomicEventResultRepository;
  snapshots: MarketSnapshotRepository;
  snapshotHistory: HistoricalMarketSnapshotRepository;
};

export type EventWindowCaptureSlotReport = {
  eventIdentityKey: string;
  eventId: string;
  role: EventWindowRole;
  targetAt: string;
  status:
    | "CAPTURED"
    | "ALREADY_CAPTURED"
    | "EVENT_NOT_AVAILABLE_AS_OF_TARGET"
    | "FAILED";
  snapshotId?: string;
  snapshotQuality?: MarketSnapshot["quality"];
  message?: string;
};

export type EventWindowCaptureReport = {
  status: "SUCCESS" | "PARTIAL" | "EMPTY" | "FAILED";
  evaluatedAt: string;
  candidateEvents: number;
  qualifiedWindows: number;
  dueSlots: number;
  captured: number;
  alreadyCaptured: number;
  unavailableEventSlots: number;
  failed: number;
  slots: EventWindowCaptureSlotReport[];
};

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Runtime Snapshot capture requires valid " + field + ".");
  }
  return parsed;
}

function staticObservationRequirementKey(
  series: EventWindowCaptureSeries,
): string {
  return [
    series.domain,
    series.seriesKey,
    series.sourceId,
  ].join(":");
}

function candidateScheduleBounds(nowMs: number): {
  from: string;
  through: string;
} {
  const maxPostOffset = Math.max(
    ...EVENT_WINDOW_POLICY_V1.slots.map((slot) => slot.offsetMs),
  );
  const minPreOffset = Math.min(
    ...EVENT_WINDOW_POLICY_V1.slots.map((slot) => slot.offsetMs),
  );

  return {
    from: new Date(
      nowMs - CAPTURE_RECONSTRUCTION_LOOKBACK_MS - maxPostOffset,
    ).toISOString(),
    through: new Date(nowMs - minPreOffset).toISOString(),
  };
}

function dueSlots(
  window: QualifiedEventWindow,
  nowMs: number,
): QualifiedEventWindowSlot[] {
  const oldestTarget = nowMs - CAPTURE_RECONSTRUCTION_LOOKBACK_MS;
  return window.slots.filter((slot) => {
    const target = Date.parse(slot.targetAt);
    return Number.isFinite(target)
      && target <= nowMs
      && target >= oldestTarget;
  });
}

async function existingSlotSnapshot(
  window: QualifiedEventWindow,
  slot: QualifiedEventWindowSlot,
  repository: HistoricalMarketSnapshotRepository,
): Promise<MarketSnapshot | null> {
  const snapshots = await repository.findHistory({
    scope: window.snapshotScope,
    capturedAtOnOrAfter: slot.targetAt,
    capturedAtOnOrBefore: slot.targetAt,
    order: "ASC",
    limit: 100,
  });

  return snapshots.find((snapshot) =>
    snapshot.metadata?.eventWindowId === window.id
    && snapshot.metadata?.eventIdentityKey === window.eventIdentityKey
    && snapshot.metadata?.eventWindowRole === slot.role
  ) ?? null;
}

async function eventAsOfTarget(
  window: QualifiedEventWindow,
  targetAt: string,
  repository: HistoricalEventRepository,
): Promise<Event | null> {
  const versions = await repository.findHistory({
    eventIdentityKey: window.eventIdentityKey,
    retrievedAtOnOrBefore: targetAt,
    order: "DESC",
    limit: 100,
  });

  return reconcileEvents(versions)[0] ?? null;
}

async function capturePricingInputs(input: {
  targetAt: string;
  historical: HistoricalObservationRepository;
  canonical: ObservationRepository;
}): Promise<{
  observations: Observation[];
  baselines: PricingBaseline[];
  requirements: MarketSnapshotRequirement[];
}> {
  const observations: Observation[] = [];
  const baselines: PricingBaseline[] = [];
  const requirements: MarketSnapshotRequirement[] = [];

  for (const series of EVENT_WINDOW_CAPTURE_SERIES) {
    const baseline = await buildRepositoryBackedPricingBaseline(
      {
        identity: {
          domain: series.domain,
          seriesKey: series.seriesKey,
        },
        sourceId: series.sourceId,
        asOf: input.targetAt,
        maxObservationAgeMs: series.maxObservationAgeMs,
      },
      input.historical,
    );

    baselines.push(baseline);
    requirements.push({
      kind: "OBSERVATION",
      key: staticObservationRequirementKey(series),
    });
    requirements.push({
      kind: "BASELINE",
      key: marketSnapshotBaselineKey(baseline),
    });

    if (baseline.observationId) {
      const observation = await input.canonical.findById(
        baseline.observationId,
      );
      if (observation) observations.push(observation);
    }
  }

  return { observations, baselines, requirements };
}

async function expectationInput(input: {
  event: Event;
  window: QualifiedEventWindow;
  targetAt: string;
  repository: HistoricalEconomicEventResultRepository;
}): Promise<{
  baseline: ExpectationBaseline;
  requirement: MarketSnapshotRequirement;
}> {
  const baseline = await buildRepositoryBackedExpectationBaseline(
    {
      eventIdentityKey: input.window.eventIdentityKey,
      sourceId: input.event.sourceId,
      releaseAt: input.window.t0,
      asOf: input.targetAt,
    },
    input.repository,
  );

  return {
    baseline,
    requirement: {
      kind: "BASELINE",
      key: marketSnapshotBaselineKey(baseline),
    },
  };
}

async function captureSlot(input: {
  window: QualifiedEventWindow;
  slot: QualifiedEventWindowSlot;
  repositories: EventWindowCaptureRepositories;
}): Promise<EventWindowCaptureSlotReport> {
  try {
    const existing = await existingSlotSnapshot(
      input.window,
      input.slot,
      input.repositories.snapshotHistory,
    );
    if (existing) {
      return {
        eventIdentityKey: input.window.eventIdentityKey,
        eventId: input.window.eventId,
        role: input.slot.role,
        targetAt: input.slot.targetAt,
        status: "ALREADY_CAPTURED",
        snapshotId: existing.id,
        snapshotQuality: existing.quality,
      };
    }

    const event = await eventAsOfTarget(
      input.window,
      input.slot.targetAt,
      input.repositories.events,
    );
    if (!event) {
      return {
        eventIdentityKey: input.window.eventIdentityKey,
        eventId: input.window.eventId,
        role: input.slot.role,
        targetAt: input.slot.targetAt,
        status: "EVENT_NOT_AVAILABLE_AS_OF_TARGET",
        message:
          "Primary Event identity was not available to P365 by the slot target.",
      };
    }

    const pricing = await capturePricingInputs({
      targetAt: input.slot.targetAt,
      historical: input.repositories.observations,
      canonical: input.repositories.canonicalObservations,
    });
    const expectation = await expectationInput({
      event,
      window: input.window,
      targetAt: input.slot.targetAt,
      repository: input.repositories.eventResults,
    });

    const snapshot = await captureMarketSnapshot(
      {
        capturedAt: input.slot.targetAt,
        scope: input.window.snapshotScope,
        observations: pricing.observations,
        events: [event],
        baselines: [
          ...pricing.baselines,
          expectation.baseline,
        ],
        requirements: [
          {
            kind: "EVENT",
            key: input.window.eventIdentityKey,
          },
          ...pricing.requirements,
          expectation.requirement,
        ],
        metadata: {
          captureOwner: "CAP-001",
          captureMode: "AS_OF_RECONSTRUCTION",
          eventWindowPolicy: EVENT_WINDOW_POLICY_V1.version,
          eventWindowId: input.window.id,
          eventIdentityKey: input.window.eventIdentityKey,
          eventWindowRole: input.slot.role,
          eventWindowPhase: input.slot.phase,
          targetAt: input.slot.targetAt,
          t0: input.window.t0,
          t0Source: input.window.t0Source,
        },
      },
      input.repositories.snapshots,
    );

    return {
      eventIdentityKey: input.window.eventIdentityKey,
      eventId: event.id,
      role: input.slot.role,
      targetAt: input.slot.targetAt,
      status: "CAPTURED",
      snapshotId: snapshot.id,
      snapshotQuality: snapshot.quality,
    };
  } catch (error) {
    return {
      eventIdentityKey: input.window.eventIdentityKey,
      eventId: input.window.eventId,
      role: input.slot.role,
      targetAt: input.slot.targetAt,
      status: "FAILED",
      message: error instanceof Error
        ? error.message
        : "Snapshot capture failed.",
    };
  }
}

async function defaultRepositories(): Promise<EventWindowCaptureRepositories> {
  const repositories = await import("../repositories/dashboard-repository");
  return {
    events: repositories.historicalEventRepository,
    observations: repositories.historicalObservationRepository,
    canonicalObservations: repositories.canonicalRepositories.observations,
    eventResults: repositories.historicalEconomicEventResultRepository,
    snapshots: repositories.marketSnapshotRepository,
    snapshotHistory: repositories.historicalMarketSnapshotRepository,
  };
}

/**
 * Materializes deterministic event-window Snapshots from durable history.
 *
 * capturedAt is the semantic slot target, not wall-clock execution time.
 * This makes retries idempotent and allows safe reconstruction after a delayed
 * scheduler invocation while every input remains constrained to
 * retrievedAt <= targetAt.
 */
export async function runEventWindowSnapshotCapture(
  options: {
    now?: string;
  } = {},
  dependencies: {
    repositories?: EventWindowCaptureRepositories;
  } = {},
): Promise<EventWindowCaptureReport> {
  const now = options.now ?? new Date().toISOString();
  const nowMs = timestamp(now, "now");
  const evaluatedAt = new Date(nowMs).toISOString();
  const repositories = dependencies.repositories ?? await defaultRepositories();
  const bounds = candidateScheduleBounds(nowMs);

  let candidates: Event[];
  try {
    candidates = await repositories.events.findHistory({
      scheduledAtOnOrAfter: bounds.from,
      scheduledAtOnOrBefore: bounds.through,
      retrievedAtOnOrBefore: evaluatedAt,
      importance: "HIGH",
      order: "ASC",
      limit: 500,
    });
  } catch (error) {
    return {
      status: "FAILED",
      evaluatedAt,
      candidateEvents: 0,
      qualifiedWindows: 0,
      dueSlots: 0,
      captured: 0,
      alreadyCaptured: 0,
      unavailableEventSlots: 0,
      failed: 1,
      slots: [{
        eventIdentityKey: "unavailable",
        eventId: "unavailable",
        role: "PRE",
        targetAt: evaluatedAt,
        status: "FAILED",
        message: error instanceof Error
          ? error.message
          : "Event history query failed.",
      }],
    };
  }

  const windowSet = buildQualifiedEventWindowSet(candidates);
  const due = windowSet.windows.flatMap((window) =>
    dueSlots(window, nowMs).map((slot) => ({ window, slot })),
  );

  if (due.length === 0) {
    return {
      status: "EMPTY",
      evaluatedAt,
      candidateEvents: candidates.length,
      qualifiedWindows: windowSet.windows.length,
      dueSlots: 0,
      captured: 0,
      alreadyCaptured: 0,
      unavailableEventSlots: 0,
      failed: 0,
      slots: [],
    };
  }

  const slots: EventWindowCaptureSlotReport[] = [];
  for (const item of due) {
    slots.push(await captureSlot({
      window: item.window,
      slot: item.slot,
      repositories,
    }));
  }

  const captured = slots.filter((slot) => slot.status === "CAPTURED").length;
  const alreadyCaptured = slots.filter(
    (slot) => slot.status === "ALREADY_CAPTURED",
  ).length;
  const unavailableEventSlots = slots.filter(
    (slot) => slot.status === "EVENT_NOT_AVAILABLE_AS_OF_TARGET",
  ).length;
  const failed = slots.filter((slot) => slot.status === "FAILED").length;

  const succeeded = captured + alreadyCaptured;
  const status: EventWindowCaptureReport["status"] =
    failed === slots.length
      ? "FAILED"
      : failed > 0 || unavailableEventSlots > 0
        ? "PARTIAL"
        : succeeded > 0
          ? "SUCCESS"
          : "EMPTY";

  return {
    status,
    evaluatedAt,
    candidateEvents: candidates.length,
    qualifiedWindows: windowSet.windows.length,
    dueSlots: due.length,
    captured,
    alreadyCaptured,
    unavailableEventSlots,
    failed,
    slots,
  };
}
