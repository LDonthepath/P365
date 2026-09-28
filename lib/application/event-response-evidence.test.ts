import type { EconomicEventResult } from "../domain/event-result";
import {
  qualifyEventWindow,
  type QualifiedEventWindow,
} from "../domain/event-window";
import {
  buildMarketSnapshot,
  marketSnapshotObservationKey,
  type MarketSnapshot,
} from "../domain/market-snapshot";
import type { Event, Observation } from "../domain/types";
import { InMemoryObservationRepository } from "../repositories/memory";
import type {
  EconomicEventResultHistoryQuery,
  HistoricalEconomicEventResultRepository,
} from "../repositories/types";
import { buildRepositoryBackedEventResponseEvidence } from "./event-response-evidence";

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      label
      + ": expected "
      + JSON.stringify(expected)
      + ", got "
      + JSON.stringify(actual),
    );
  }
}

function observation(
  id: string,
  metricId: string,
  value: string,
  observedAt: string,
  retrievedAt: string,
): Observation {
  return {
    id,
    domain: "ASSET",
    subject: metricId,
    value,
    observedAt,
    retrievedAt,
    sourceId: metricId === "btc.spot.usd"
      ? "coingecko-market"
      : "yahoo-finance",
    quality: "FRESH",
    evidenceId: "evidence-" + id,
    metadata: {
      metricId,
      unit: metricId === "dxy.index.usd" ? "Index" : "USD",
      frequency: "INTRADAY",
    },
  };
}

function event(): Event {
  const scheduledAt = "2026-10-15T12:30:00.000Z";
  return {
    id: "biquote-event-cpi",
    subject: "CPI",
    description: "US CPI",
    jurisdiction: "US",
    scheduledAt,
    releasedAt: scheduledAt,
    retrievedAt: "2026-10-15T10:00:00.000Z",
    status: "UPCOMING",
    importance: "HIGH",
    sourceId: "biquote",
    evidenceId: "evidence-event",
    identity: {
      version: "v1",
      key: "event:v1:US:2026-10-15T12:30:00.000Z:cpi",
      semanticKey: "cpi",
      scheduledAt,
      jurisdiction: "US",
    },
  };
}

function requireWindow(item: Event): QualifiedEventWindow {
  const qualified = qualifyEventWindow(item);
  if (!qualified.eligible) {
    throw new Error("Expected qualified event: " + qualified.code);
  }
  return qualified.window;
}

function snapshot(
  capturedAt: string,
  observations: Observation[],
  primaryEvent: Event,
): MarketSnapshot {
  return buildMarketSnapshot({
    capturedAt,
    scope: "MVP_MACRO_CRYPTO_GOLD_EVENT",
    observations,
    events: [primaryEvent],
    requirements: [
      ...observations.map((item) => ({
        kind: "OBSERVATION" as const,
        key: marketSnapshotObservationKey(item),
      })),
      {
        kind: "EVENT" as const,
        key: primaryEvent.identity!.key,
      },
    ],
  });
}

class EventResultHistory implements HistoricalEconomicEventResultRepository {
  readonly queries: EconomicEventResultHistoryQuery[] = [];

  constructor(private readonly items: EconomicEventResult[]) {}

  async findHistory(
    query: EconomicEventResultHistoryQuery,
  ): Promise<EconomicEventResult[]> {
    this.queries.push(query);
    const after = query.retrievedAtOnOrAfter
      ? Date.parse(query.retrievedAtOnOrAfter)
      : Number.NEGATIVE_INFINITY;
    const before = query.retrievedAtOnOrBefore
      ? Date.parse(query.retrievedAtOnOrBefore)
      : Number.POSITIVE_INFINITY;

    const filtered = this.items.filter((item) => {
      const retrieved = Date.parse(item.retrievedAt);
      return item.eventIdentityKey === query.eventIdentityKey
        && (query.sourceId === undefined || item.sourceId === query.sourceId)
        && (
          query.expectedType === undefined
          || item.expectedType === query.expectedType
        )
        && retrieved >= after
        && retrieved <= before;
    });

    return filtered
      .sort((a, b) => {
        const direction = query.order === "DESC" ? -1 : 1;
        const time = Date.parse(a.retrievedAt) - Date.parse(b.retrievedAt);
        return time !== 0
          ? time * direction
          : a.id.localeCompare(b.id) * direction;
      })
      .slice(0, query.limit);
  }
}

async function main(): Promise<void> {
  const primaryEvent = event();
  const window = requireWindow(primaryEvent);

  const btcBefore = observation(
    "btc-before",
    "btc.spot.usd",
    "68000",
    "2026-10-15T12:24:50.000Z",
    "2026-10-15T12:24:55.000Z",
  );
  const dxyBefore = observation(
    "dxy-before",
    "dxy.index.usd",
    "103.5",
    "2026-10-15T12:24:45.000Z",
    "2026-10-15T12:24:50.000Z",
  );
  const btcAfter = observation(
    "btc-after",
    "btc.spot.usd",
    "68700",
    "2026-10-15T12:34:50.000Z",
    "2026-10-15T12:34:55.000Z",
  );
  const dxyAfter = observation(
    "dxy-after",
    "dxy.index.usd",
    "103.1",
    "2026-10-15T12:34:45.000Z",
    "2026-10-15T12:34:50.000Z",
  );

  const before = snapshot(
    "2026-10-15T12:25:00.000Z",
    [btcBefore, dxyBefore],
    primaryEvent,
  );
  const after = snapshot(
    "2026-10-15T12:35:00.000Z",
    [btcAfter, dxyAfter],
    primaryEvent,
  );

  const observationRepository = new InMemoryObservationRepository();
  await observationRepository.saveMany([
    btcBefore,
    dxyBefore,
    btcAfter,
    dxyAfter,
  ]);

  const eventResultRepository = new EventResultHistory([
    {
      id: "forecast",
      eventId: primaryEvent.id,
      eventIdentityKey: primaryEvent.identity!.key,
      expected: 2.8,
      expectedType: "FORECAST",
      unit: "%",
      period: "Sep 2026",
      retrievedAt: "2026-10-15T12:20:00.000Z",
      sourceId: "biquote",
      evidenceId: "evidence-forecast",
    },
    {
      id: "actual",
      eventId: primaryEvent.id,
      eventIdentityKey: primaryEvent.identity!.key,
      actual: 2.5,
      unit: "%",
      period: "Sep 2026",
      releasedAt: "2026-10-15T12:30:00.000Z",
      retrievedAt: "2026-10-15T12:31:00.000Z",
      sourceId: "biquote",
      evidenceId: "evidence-actual",
    },
    {
      id: "future-revision",
      eventId: primaryEvent.id,
      eventIdentityKey: primaryEvent.identity!.key,
      actual: 2.4,
      unit: "%",
      period: "Sep 2026",
      releasedAt: "2026-10-15T12:30:00.000Z",
      retrievedAt: "2026-10-15T12:36:00.000Z",
      sourceId: "biquote",
      evidenceId: "evidence-future",
    },
  ]);

  const dxyKey = marketSnapshotObservationKey(dxyBefore);
  const btcKey = marketSnapshotObservationKey(btcBefore);

  const result = await buildRepositoryBackedEventResponseEvidence({
    window,
    before,
    after,
    events: [primaryEvent],
    observationRepository,
    eventResultRepository,
    surpriseSourceId: "biquote",
    surpriseExpectedType: "FORECAST",
    thresholds: [
      {
        observationKey: dxyKey,
        basis: "ABSOLUTE_PERCENT_CHANGE",
        minimumMagnitude: 0.1,
      },
      {
        observationKey: btcKey,
        basis: "ABSOLUTE_PERCENT_CHANGE",
        minimumMagnitude: 0.1,
      },
    ],
    rules: [{
      driverObservationKey: dxyKey,
      responseObservationKey: btcKey,
      expectedRelation: "OPPOSITE_DIRECTION",
      methodologyId: "explicit-event-window-relation",
      methodologyVersion: "v1",
    }],
  });

  assertEqual(
    result.bundle.knowledgeAt,
    after.capturedAt,
    "post-event Snapshot owns EVR knowledge cutoff",
  );
  assertEqual(
    result.surprise.asOf,
    after.capturedAt,
    "SUR-001 uses exact post-event Snapshot cutoff",
  );
  assertEqual(
    result.surprise.actualEventResultId,
    "actual",
    "post-cutoff EventResult revision cannot leak backward",
  );
  assertEqual(
    result.surprise.relation,
    "BELOW_EXPECTATION",
    "factual surprise remains mechanical",
  );
  assertEqual(
    result.repricing.assessment.status,
    "REPRICING_OBSERVED",
    "existing RPR-001 output is reused",
  );
  assertEqual(
    result.transmission.status,
    "COHERENT",
    "existing TRN-001 output is reused",
  );
  assertEqual(
    result.bundle.causalAttribution,
    "NOT_EVALUATED",
    "integrated evidence remains non-causal",
  );
  assertEqual(
    eventResultRepository.queries[1]?.retrievedAtOnOrBefore,
    after.capturedAt,
    "actual EventResult query is capped at post-event Snapshot capturedAt",
  );
}

void main();
