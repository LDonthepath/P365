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
  buildMarketSnapshot,
  marketSnapshotBaselineKey,
  type MarketSnapshot,
  type MarketSnapshotRequest,
  type MarketSnapshotRequirement,
} from "../domain/market-snapshot";
import {
  SNAPSHOT_SUPERSESSION_POLICY_V1,
  selectActiveMarketSnapshot,
} from "../domain/snapshot-supersession";
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
    | "CORRECTED"
    | "ALREADY_CAPTURED"
    | "EVENT_NOT_AVAILABLE_AS_OF_TARGET"
    | "FAILED";
  snapshotId?: string;
  supersedesSnapshotId?: string;
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
  corrected: number;
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

function latestEventRevisions(events: Event[]): Event[] {
  const latest = new Map<string, Event>();

  for (const event of events) {
    const identity = event.identity?.key ?? "event-id:" + event.id;
    const key = identity + "|" + event.sourceId;
    const existing = latest.get(key);
    if (!existing) {
      latest.set(key, event);
      continue;
    }

    const eventRetrievedAt = Date.parse(event.retrievedAt);
    const existingRetrievedAt = Date.parse(existing.retrievedAt);
    if (
      eventRetrievedAt > existingRetrievedAt
      || (
        eventRetrievedAt === existingRetrievedAt
        && event.id.localeCompare(existing.id) < 0
      )
    ) {
      latest.set(key, event);
    }
  }

  return [...latest.values()];
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

  const slotSnapshots = snapshots.filter((snapshot) =>
    snapshot.metadata?.eventWindowId === window.id
    && snapshot.metadata?.eventIdentityKey === window.eventIdentityKey
    && snapshot.metadata?.eventWindowRole === slot.role
  );

  return selectActiveMarketSnapshot(slotSnapshots);
}

function snapshotQualityRank(quality: MarketSnapshot["quality"]): number {
  if (quality === "COMPLETE") return 3;
  if (quality === "STALE") return 2;
  if (quality === "PARTIAL") return 1;
  return 0;
}

function informativeBaselineCount(snapshot: MarketSnapshot): number {
  return snapshot.baselineRefs.filter(
    (ref) => ref.status !== "MISSING" && ref.status !== "UNKNOWN",
  ).length;
}

function strictlyImprovesSnapshot(
  candidate: MarketSnapshot,
  existing: MarketSnapshot,
): boolean {
  const qualityNotWorse =
    snapshotQualityRank(candidate.quality) >= snapshotQualityRank(existing.quality);
  const missingNotWorse =
    candidate.missingRequirements.length <= existing.missingRequirements.length;
  const observationsNotWorse =
    candidate.observationRefs.length >= existing.observationRefs.length;
  const baselinesNotWorse =
    informativeBaselineCount(candidate) >= informativeBaselineCount(existing);

  if (
    !qualityNotWorse
    || !missingNotWorse
    || !observationsNotWorse
    || !baselinesNotWorse
  ) {
    return false;
  }

  return (
    snapshotQualityRank(candidate.quality) > snapshotQualityRank(existing.quality)
    || candidate.missingRequirements.length < existing.missingRequirements.length
    || candidate.observationRefs.length > existing.observationRefs.length
    || informativeBaselineCount(candidate) > informativeBaselineCount(existing)
  );
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

  return reconcileEvents(latestEventRevisions(versions))[0] ?? null;
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

    const baseRequest: MarketSnapshotRequest = {
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
    };
    const candidate = buildMarketSnapshot(baseRequest);

    if (existing) {
      const correctionCandidateId = existing.metadata?.correctionCandidateSnapshotId;
      if (
        existing.id === candidate.id
        || correctionCandidateId === candidate.id
        || !strictlyImprovesSnapshot(candidate, existing)
      ) {
        return {
          eventIdentityKey: input.window.eventIdentityKey,
          eventId: event.id,
          role: input.slot.role,
          targetAt: input.slot.targetAt,
          status: "ALREADY_CAPTURED",
          snapshotId: existing.id,
          snapshotQuality: existing.quality,
        };
      }

      const corrected = await captureMarketSnapshot(
        {
          ...baseRequest,
          metadata: {
            ...baseRequest.metadata,
            captureOwner: "CAP-001C",
            captureMode: "AS_OF_RECONSTRUCTION_CORRECTION",
            correctionPolicy: SNAPSHOT_SUPERSESSION_POLICY_V1,
            supersedesSnapshotId: existing.id,
            correctionCandidateSnapshotId: candidate.id,
          },
        },
        input.repositories.snapshots,
      );

      return {
        eventIdentityKey: input.window.eventIdentityKey,
        eventId: event.id,
        role: input.slot.role,
        targetAt: input.slot.targetAt,
        status: "CORRECTED",
        snapshotId: corrected.id,
        supersedesSnapshotId: existing.id,
        snapshotQuality: corrected.quality,
      };
    }

    const snapshot = await captureMarketSnapshot(
      baseRequest,
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
      // FND-019 reconciliation is not a revision selector. Newest canonical
      // Event versions must enter first so releasedAt/occurredAt updates are
      // retained before provider-level reconciliation.
      order: "DESC",
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
      corrected: 0,
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

  const windowSet = buildQualifiedEventWindowSet(
    latestEventRevisions(candidates),
  );
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
      corrected: 0,
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
  const corrected = slots.filter((slot) => slot.status === "CORRECTED").length;
  const alreadyCaptured = slots.filter(
    (slot) => slot.status === "ALREADY_CAPTURED",
  ).length;
  const unavailableEventSlots = slots.filter(
    (slot) => slot.status === "EVENT_NOT_AVAILABLE_AS_OF_TARGET",
  ).length;
  const failed = slots.filter((slot) => slot.status === "FAILED").length;

  const succeeded = captured + corrected + alreadyCaptured;
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
    corrected,
    alreadyCaptured,
    unavailableEventSlots,
    failed,
    slots,
  };
}
