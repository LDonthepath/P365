import assert from "node:assert/strict";
import test from "node:test";
import { qualifyEventWindow, type QualifiedEventWindow } from "../domain/event-window";
import { buildMarketSnapshot, marketSnapshotObservationKey, type MarketSnapshot } from "../domain/market-snapshot";
import type { Event, Observation } from "../domain/types";
import { InMemoryObservationRepository } from "../repositories/memory";
import type { HistoricalObservationRepository, ObservationHistoryQuery } from "../repositories/types";
import { buildRepositoryBackedEventWindowHistoricalContext } from "./event-window-historical-context";

function observation(input: {
  id: string;
  seriesKey: string;
  value: string;
  observedAt: string;
  retrievedAt: string;
  sourceId?: string;
}): Observation {
  return {
    id: input.id,
    domain: "ASSET",
    subject: input.seriesKey,
    value: input.value,
    observedAt: input.observedAt,
    retrievedAt: input.retrievedAt,
    sourceId: input.sourceId ?? "coingecko-market",
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
      unit: "USD",
      frequency: "INTRADAY",
    },
  };
}

function primaryEvent(): Event {
  const scheduledAt = "2026-10-15T12:30:00.000Z";
  return {
    id: "event-cpi",
    subject: "CPI",
    description: "US CPI",
    jurisdiction: "US",
    scheduledAt,
    releasedAt: scheduledAt,
    retrievedAt: "2026-10-15T10:00:00.000Z",
    status: "UPCOMING",
    importance: "HIGH",
    sourceId: "biquote",
    evidenceId: "e-event-cpi",
    identity: {
      version: "v1",
      key: "event:v1:US:2026-10-15T12:30:00.000Z:cpi",
      semanticKey: "cpi",
      scheduledAt,
      jurisdiction: "US",
    },
  };
}

function requireWindow(event: Event): QualifiedEventWindow {
  const result = qualifyEventWindow(event);
  if (!result.eligible) throw new Error("Expected qualified event window.");
  return result.window;
}

function snapshot(capturedAt: string, observation: Observation, event: Event): MarketSnapshot {
  return buildMarketSnapshot({
    capturedAt,
    scope: "MVP_MACRO_CRYPTO_GOLD_EVENT",
    observations: [observation],
    events: [event],
    requirements: [
      { kind: "OBSERVATION", key: marketSnapshotObservationKey(observation) },
      { kind: "EVENT", key: event.identity!.key },
    ],
  });
}

class MemoryHistory implements HistoricalObservationRepository {
  constructor(private readonly rows: Observation[]) {}

  async findHistory(query: ObservationHistoryQuery): Promise<Observation[]> {
    const filtered = this.rows.filter((item) =>
      item.domain === query.identity.domain
      && item.identity?.seriesKey === query.identity.seriesKey
      && (!query.sourceId || item.sourceId === query.sourceId)
      && (!query.observedAtOnOrAfter || item.observedAt >= query.observedAtOnOrAfter)
      && (!query.observedAtOnOrBefore || item.observedAt <= query.observedAtOnOrBefore)
      && (!query.retrievedAtOnOrBefore || item.retrievedAt <= query.retrievedAtOnOrBefore)
    );
    return filtered
      .sort((a, b) => {
        const direction = query.order === "ASC" ? 1 : -1;
        return direction * (
          a.observedAt.localeCompare(b.observedAt)
          || a.retrievedAt.localeCompare(b.retrievedAt)
          || a.id.localeCompare(b.id)
        );
      })
      .slice(0, query.limit);
  }
}

test("HIST-001C compares the exact PRE-to-post Observation horizon against history", async () => {
  const event = primaryEvent();
  const window = requireWindow(event);
  const beforeObservation = observation({
    id: "btc-before",
    seriesKey: "btc.spot.usd",
    value: "100",
    observedAt: "2026-10-15T12:24:50.000Z",
    retrievedAt: "2026-10-15T12:24:55.000Z",
  });
  const afterObservation = observation({
    id: "btc-after",
    seriesKey: "btc.spot.usd",
    value: "105",
    observedAt: "2026-10-15T12:34:50.000Z",
    retrievedAt: "2026-10-15T12:34:55.000Z",
  });

  const before = snapshot("2026-10-15T12:25:00.000Z", beforeObservation, event);
  const after = snapshot("2026-10-15T12:35:00.000Z", afterObservation, event);

  const observations = new InMemoryObservationRepository();
  await observations.saveMany([beforeObservation, afterObservation]);

  const history = new MemoryHistory([
    observation({
      id: "h0",
      seriesKey: "btc.spot.usd",
      value: "100",
      observedAt: "2026-10-15T12:00:00.000Z",
      retrievedAt: "2026-10-15T12:00:30.000Z",
    }),
    observation({
      id: "h1",
      seriesKey: "btc.spot.usd",
      value: "110",
      observedAt: "2026-10-15T12:10:00.000Z",
      retrievedAt: "2026-10-15T12:10:30.000Z",
    }),
    observation({
      id: "h2",
      seriesKey: "btc.spot.usd",
      value: "110",
      observedAt: "2026-10-15T12:20:00.000Z",
      retrievedAt: "2026-10-15T12:20:30.000Z",
    }),
  ]);

  const key = marketSnapshotObservationKey(beforeObservation);
  const result = await buildRepositoryBackedEventWindowHistoricalContext({
    window,
    before,
    after,
    events: [event],
    observationRepository: observations,
    historicalObservationRepository: history,
    series: [{
      observationKey: key,
      transformation: "PERCENT_CHANGE",
      lookbackMs: 60 * 60 * 1000,
      minimumSampleSize: 2,
      methodologyId: "intraday-event-move-percentile",
      methodologyVersion: "v1",
    }],
  });

  assert.equal(result.afterRole, "T_PLUS_5");
  assert.equal(result.knowledgeAt, after.capturedAt);
  assert.equal(result.contaminationStatus, "CLEAN");
  assert.deepEqual(result.missingObservationKeys, []);
  assert.equal(result.series.length, 1);
  assert.equal(result.series[0].comparisonHorizonMs, 10 * 60 * 1000);
  assert.equal(result.series[0].historicalBaseline.status, "VALID");
  assert.equal(result.series[0].historicalBaseline.targetValue, 5);
  assert.equal(result.series[0].historicalBaseline.sampleSize, 2);
  assert.equal(result.series[0].historicalBaseline.median, 5);
  assert.equal(result.series[0].historicalBaseline.percentileRank, 50);
  assert.deepEqual(
    result.series[0].historicalBaseline.targetObservationIds,
    ["btc-before", "btc-after"],
  );
  assert.equal(result.causalAttribution, "NOT_EVALUATED");
});

test("HIST-001C keeps an available target series even when historical depth is insufficient", async () => {
  const event = primaryEvent();
  const window = requireWindow(event);
  const beforeObservation = observation({
    id: "btc-before",
    seriesKey: "btc.spot.usd",
    value: "100",
    observedAt: "2026-10-15T12:24:50.000Z",
    retrievedAt: "2026-10-15T12:24:55.000Z",
  });
  const afterObservation = observation({
    id: "btc-after",
    seriesKey: "btc.spot.usd",
    value: "101",
    observedAt: "2026-10-15T12:34:50.000Z",
    retrievedAt: "2026-10-15T12:34:55.000Z",
  });
  const before = snapshot("2026-10-15T12:25:00.000Z", beforeObservation, event);
  const after = snapshot("2026-10-15T12:35:00.000Z", afterObservation, event);
  const observations = new InMemoryObservationRepository();
  await observations.saveMany([beforeObservation, afterObservation]);

  const result = await buildRepositoryBackedEventWindowHistoricalContext({
    window,
    before,
    after,
    events: [event],
    observationRepository: observations,
    historicalObservationRepository: new MemoryHistory([]),
    series: [{
      observationKey: marketSnapshotObservationKey(beforeObservation),
      transformation: "ABSOLUTE_PERCENT_CHANGE",
      lookbackMs: 24 * 60 * 60 * 1000,
      minimumSampleSize: 20,
      methodologyId: "intraday-event-magnitude",
      methodologyVersion: "v1",
    }],
  });

  assert.deepEqual(result.missingObservationKeys, []);
  assert.equal(result.series.length, 1);
  assert.equal(result.series[0].historicalBaseline.status, "INSUFFICIENT_DATA");
  assert.equal(result.series[0].historicalBaseline.sampleSize, 0);
});

test("HIST-001C records requested series that are absent from the Snapshot pair", async () => {
  const event = primaryEvent();
  const window = requireWindow(event);
  const beforeObservation = observation({
    id: "btc-before",
    seriesKey: "btc.spot.usd",
    value: "100",
    observedAt: "2026-10-15T12:24:50.000Z",
    retrievedAt: "2026-10-15T12:24:55.000Z",
  });
  const afterObservation = observation({
    id: "btc-after",
    seriesKey: "btc.spot.usd",
    value: "102",
    observedAt: "2026-10-15T12:34:50.000Z",
    retrievedAt: "2026-10-15T12:34:55.000Z",
  });
  const before = snapshot("2026-10-15T12:25:00.000Z", beforeObservation, event);
  const after = snapshot("2026-10-15T12:35:00.000Z", afterObservation, event);
  const observations = new InMemoryObservationRepository();
  await observations.saveMany([beforeObservation, afterObservation]);

  const btcKey = marketSnapshotObservationKey(beforeObservation);
  const missingGoldKey = "ASSET:gold.futures.usd:yahoo-finance";
  const result = await buildRepositoryBackedEventWindowHistoricalContext({
    window,
    before,
    after,
    events: [event],
    observationRepository: observations,
    historicalObservationRepository: new MemoryHistory([]),
    series: [
      {
        observationKey: btcKey,
        transformation: "PERCENT_CHANGE",
        lookbackMs: 24 * 60 * 60 * 1000,
        minimumSampleSize: 2,
        methodologyId: "btc",
        methodologyVersion: "v1",
      },
      {
        observationKey: missingGoldKey,
        transformation: "PERCENT_CHANGE",
        lookbackMs: 24 * 60 * 60 * 1000,
        minimumSampleSize: 2,
        methodologyId: "gold",
        methodologyVersion: "v1",
      },
    ],
  });

  assert.deepEqual(result.requestedObservationKeys, [btcKey, missingGoldKey].sort());
  assert.deepEqual(result.missingObservationKeys, [missingGoldKey]);
  assert.equal(result.series.length, 1);
  assert.equal(result.series[0].observationKey, btcKey);
});
