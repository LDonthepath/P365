import assert from "node:assert/strict";
import test from "node:test";
import type { EconomicEventResult } from "../domain/event-result";
import { qualifyEventWindow } from "../domain/event-window";
import {
  buildMarketSnapshot,
  marketSnapshotObservationKey,
} from "../domain/market-snapshot";
import type { Event, Observation } from "../domain/types";
import { InMemoryObservationRepository } from "../repositories/memory";
import type {
  EconomicEventResultHistoryQuery,
  HistoricalEconomicEventResultRepository,
} from "../repositories/types";
import { buildCalibratedIntradayEventResponseEvidence } from "./event-response-evidence";
import { INTRADAY_HISTORICAL_CALIBRATION_V1 } from "./intraday-historical-calibration";

function event(): Event {
  const scheduledAt = "2026-10-15T12:30:00.000Z";
  return {
    id: "event-cpi",
    subject: "CPI",
    description: "US CPI",
    jurisdiction: "US",
    scheduledAt,
    // This UPCOMING calendar event has not released by the PRE snapshot.
    retrievedAt: "2026-10-15T10:00:00.000Z",
    status: "UPCOMING",
    importance: "HIGH",
    sourceId: "biquote",
    evidenceId: "e-event",
    identity: {
      version: "v1",
      key: "event:v1:US:2026-10-15T12:30:00.000Z:cpi",
      semanticKey: "cpi",
      scheduledAt,
      jurisdiction: "US",
    },
  };
}

function observation(input: {
  id: string;
  seriesKey: string;
  sourceId: string;
  value: number;
  observedAt: string;
  retrievedAt: string;
  unit: string;
}): Observation {
  return {
    id: input.id,
    domain: "ASSET",
    subject: input.seriesKey,
    value: String(input.value),
    observedAt: input.observedAt,
    retrievedAt: input.retrievedAt,
    sourceId: input.sourceId,
    quality: "FRESH",
    evidenceId: "e-" + input.id,
    identity: {
      version: "v1",
      seriesKey: input.seriesKey,
      measurementId: "m-" + input.id,
      revisionFingerprint: "r-" + input.id,
    },
    metadata: {
      metricId: input.seriesKey,
      unit: input.unit,
      frequency: "INTRADAY",
    },
  };
}

function historySeries(input: {
  prefix: string;
  seriesKey: string;
  sourceId: string;
  unit: string;
  base: number;
}): Observation[] {
  const start = Date.parse("2026-10-15T07:14:50.000Z");
  return Array.from({ length: 31 }, (_, index) => {
    const observedAt = new Date(start + index * 10 * 60_000).toISOString();
    const retrievedAt = new Date(Date.parse(observedAt) + 30_000).toISOString();
    return observation({
      id: input.prefix + "-" + index,
      seriesKey: input.seriesKey,
      sourceId: input.sourceId,
      value: input.base * (1 + index * 0.001),
      observedAt,
      retrievedAt,
      unit: input.unit,
    });
  });
}

class EventResultHistory implements HistoricalEconomicEventResultRepository {
  constructor(private readonly items: EconomicEventResult[]) {}

  async findHistory(query: EconomicEventResultHistoryQuery): Promise<EconomicEventResult[]> {
    const lower = query.retrievedAtOnOrAfter
      ? Date.parse(query.retrievedAtOnOrAfter)
      : Number.NEGATIVE_INFINITY;
    const upper = query.retrievedAtOnOrBefore
      ? Date.parse(query.retrievedAtOnOrBefore)
      : Number.POSITIVE_INFINITY;

    return this.items
      .filter((item) => {
        const retrievedAt = Date.parse(item.retrievedAt);
        return item.eventIdentityKey === query.eventIdentityKey
          && (!query.sourceId || item.sourceId === query.sourceId)
          && (!query.expectedType || item.expectedType === query.expectedType)
          && retrievedAt >= lower
          && retrievedAt <= upper;
      })
      .sort((a, b) => {
        const direction = query.order === "DESC" ? -1 : 1;
        const diff = Date.parse(a.retrievedAt) - Date.parse(b.retrievedAt);
        return diff !== 0
          ? diff * direction
          : a.id.localeCompare(b.id) * direction;
      })
      .slice(0, query.limit);
  }
}

test("HIST-001E binds calibrated historical context to the same EVR event/window/knowledge chain", async () => {
  const primaryEvent = event();
  const qualified = qualifyEventWindow(primaryEvent);
  assert.equal(qualified.eligible, true);
  if (!qualified.eligible) throw new Error("Expected qualified event.");

  const btcBefore = observation({
    id: "btc-before",
    seriesKey: "btc.spot.usd",
    sourceId: "coingecko-market",
    value: 100,
    observedAt: "2026-10-15T12:24:50.000Z",
    retrievedAt: "2026-10-15T12:24:55.000Z",
    unit: "USD",
  });
  const dxyBefore = observation({
    id: "dxy-before",
    seriesKey: "dxy.index.usd",
    sourceId: "yahoo-finance",
    value: 100,
    observedAt: "2026-10-15T12:24:50.000Z",
    retrievedAt: "2026-10-15T12:24:55.000Z",
    unit: "Index",
  });
  const goldBefore = observation({
    id: "gold-before",
    seriesKey: "gold.futures.usd",
    sourceId: "yahoo-finance",
    value: 100,
    observedAt: "2026-10-15T12:24:50.000Z",
    retrievedAt: "2026-10-15T12:24:55.000Z",
    unit: "USD",
  });

  const btcAfter = observation({
    id: "btc-after",
    seriesKey: "btc.spot.usd",
    sourceId: "coingecko-market",
    value: 102,
    observedAt: "2026-10-15T12:34:50.000Z",
    retrievedAt: "2026-10-15T12:34:55.000Z",
    unit: "USD",
  });
  const dxyAfter = observation({
    id: "dxy-after",
    seriesKey: "dxy.index.usd",
    sourceId: "yahoo-finance",
    value: 99,
    observedAt: "2026-10-15T12:34:50.000Z",
    retrievedAt: "2026-10-15T12:34:55.000Z",
    unit: "Index",
  });
  const goldAfter = observation({
    id: "gold-after",
    seriesKey: "gold.futures.usd",
    sourceId: "yahoo-finance",
    value: 101,
    observedAt: "2026-10-15T12:34:50.000Z",
    retrievedAt: "2026-10-15T12:34:55.000Z",
    unit: "USD",
  });

  const before = buildMarketSnapshot({
    capturedAt: "2026-10-15T12:25:00.000Z",
    scope: "MVP_MACRO_CRYPTO_GOLD_EVENT",
    observations: [btcBefore, dxyBefore, goldBefore],
    events: [primaryEvent],
    requirements: [
      ...[btcBefore, dxyBefore, goldBefore].map((item) => ({
        kind: "OBSERVATION" as const,
        key: marketSnapshotObservationKey(item),
      })),
      { kind: "EVENT" as const, key: primaryEvent.identity!.key },
    ],
  });

  const after = buildMarketSnapshot({
    capturedAt: "2026-10-15T12:35:00.000Z",
    scope: "MVP_MACRO_CRYPTO_GOLD_EVENT",
    observations: [btcAfter, dxyAfter, goldAfter],
    events: [primaryEvent],
    requirements: [
      ...[btcAfter, dxyAfter, goldAfter].map((item) => ({
        kind: "OBSERVATION" as const,
        key: marketSnapshotObservationKey(item),
      })),
      { kind: "EVENT" as const, key: primaryEvent.identity!.key },
    ],
  });

  const repository = new InMemoryObservationRepository();
  await repository.saveMany([
    ...historySeries({
      prefix: "btc-h",
      seriesKey: "btc.spot.usd",
      sourceId: "coingecko-market",
      unit: "USD",
      base: 90,
    }),
    ...historySeries({
      prefix: "dxy-h",
      seriesKey: "dxy.index.usd",
      sourceId: "yahoo-finance",
      unit: "Index",
      base: 95,
    }),
    ...historySeries({
      prefix: "gold-h",
      seriesKey: "gold.futures.usd",
      sourceId: "yahoo-finance",
      unit: "USD",
      base: 98,
    }),
    btcBefore,
    dxyBefore,
    goldBefore,
    btcAfter,
    dxyAfter,
    goldAfter,
  ]);

  const eventResults = new EventResultHistory([
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
      evidenceId: "e-forecast",
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
      evidenceId: "e-actual",
    },
  ]);

  const btcKey = marketSnapshotObservationKey(btcBefore);
  const dxyKey = marketSnapshotObservationKey(dxyBefore);

  const result = await buildCalibratedIntradayEventResponseEvidence({
    window: qualified.window,
    before,
    after,
    events: [primaryEvent],
    observationRepository: repository,
    historicalObservationRepository: repository,
    eventResultRepository: eventResults,
    surpriseSourceId: "biquote",
    surpriseExpectedType: "FORECAST",
    thresholds: [
      {
        observationKey: btcKey,
        basis: "ABSOLUTE_PERCENT_CHANGE",
        minimumMagnitude: 0.1,
      },
      {
        observationKey: dxyKey,
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

  assert.equal(result.historicalContext.eventIdentityKey, result.bundle.eventIdentityKey);
  assert.equal(result.historicalContext.windowId, result.bundle.windowId);
  assert.equal(result.historicalContext.afterRole, result.bundle.afterRole);
  assert.equal(result.historicalContext.knowledgeAt, result.bundle.knowledgeAt);
  assert.equal(result.historicalContext.comparisonId, result.bundle.repricing.comparisonId);
  assert.equal(result.historicalContext.causalAttribution, "NOT_EVALUATED");
  assert.equal(result.historicalContext.missingObservationKeys.length, 0);
  assert.equal(result.historicalContext.series.length, 3);

  for (const series of result.historicalContext.series) {
    assert.equal(series.comparisonHorizonMs, 10 * 60_000);
    assert.equal(series.historicalBaseline.status, "VALID");
    assert.equal(series.historicalBaseline.sampleSize, 30);
    assert.equal(
      Date.parse(series.historicalBaseline.methodology.observedAtOnOrBefore)
        < Date.parse(before.capturedAt),
      true,
    );
    assert.equal(
      series.historicalBaseline.methodology.minimumSampleSize,
      INTRADAY_HISTORICAL_CALIBRATION_V1.minimumSampleSize,
    );
    assert.equal(
      series.historicalBaseline.methodology.transformation,
      INTRADAY_HISTORICAL_CALIBRATION_V1.transformation,
    );
  }
});
