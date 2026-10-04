import assert from "node:assert/strict";
import test from "node:test";
import type { Event, Observation } from "../domain/types";
import {
  InMemoryEventRepository,
  InMemoryHistoricalEventRepository,
  InMemoryObservationRepository,
} from "../repositories/memory";
import type { ContinuousMoveAssessment } from "./continuous-move-detector";
import { buildMoveEvidenceBundle } from "./move-evidence-bundle";

function observation(input: {
  id: string;
  domain?: Observation["domain"];
  seriesKey: string;
  sourceId: string;
  value: number;
  observedAt: string;
  retrievedAt: string;
  quality?: Observation["quality"];
  metadata?: Observation["metadata"];
}): Observation {
  return {
    id: input.id,
    domain: input.domain ?? "ASSET",
    subject: input.seriesKey,
    value: String(input.value),
    observedAt: input.observedAt,
    retrievedAt: input.retrievedAt,
    sourceId: input.sourceId,
    quality: input.quality ?? "FRESH",
    evidenceId: `evidence-${input.id}`,
    identity: {
      version: "v1",
      seriesKey: input.seriesKey,
      measurementId: `${input.seriesKey}:${input.observedAt}`,
      revisionFingerprint: `revision-${input.id}`,
    },
    metadata: input.metadata ?? {
      metricId: input.seriesKey,
      unit: "USD",
      frequency: "5m",
    },
  };
}

function materialAssessment(): ContinuousMoveAssessment {
  const end = "2026-10-02T04:30:00.000Z";
  return {
    id: "move-btc-1",
    version: "v1",
    policy: "continuous-market-move-detector-v1",
    methodologyId: "continuous-market-move-materiality-v1",
    methodologyVersion: "v1",
    seriesKey: "btc.spot.usd",
    sourceId: "coingecko-market",
    asOf: "2026-10-02T04:30:30.000Z",
    targetEndObservationId: "btc-end",
    targetEndObservedAt: end,
    status: "MATERIAL_MOVE",
    hasMaterialMove: true,
    horizons: [
      {
        horizonMs: 15 * 60 * 1000,
        status: "BELOW_MATERIALITY_THRESHOLD",
        targetStartObservationId: "btc-15m",
        targetEndObservationId: "btc-end",
        targetStartObservedAt: "2026-10-02T04:15:00.000Z",
        targetEndObservedAt: end,
        historicalSampleSize: 120,
        historicalSamples: [],
      },
      {
        horizonMs: 60 * 60 * 1000,
        status: "MATERIAL_MOVE",
        targetStartObservationId: "btc-start-60m",
        targetEndObservationId: "btc-end",
        targetStartObservedAt: "2026-10-02T03:30:00.000Z",
        targetEndObservedAt: end,
        signedPercentChange: 1.8,
        magnitudePercent: 1.8,
        historicalSampleSize: 120,
        historicalSamples: [],
      },
      {
        horizonMs: 120 * 60 * 1000,
        status: "MATERIAL_MOVE",
        targetStartObservationId: "btc-start-120m",
        targetEndObservationId: "btc-end",
        targetStartObservedAt: "2026-10-02T02:30:00.000Z",
        targetEndObservedAt: end,
        signedPercentChange: 2.2,
        magnitudePercent: 2.2,
        historicalSampleSize: 120,
        historicalSamples: [],
      },
    ],
    causalAttribution: "NOT_EVALUATED",
  };
}

const synchronous = [
  ["btc.spot.usd", "coingecko-market", 100, 101, 102],
  ["eth.spot.usd", "coingecko-market", 200, 201, 202],
  ["dxy.index.usd", "yahoo-finance", 98, 97.95, 97.9],
  ["gold.futures.usd", "yahoo-finance", 2600, 2605, 2610],
  ["fx.usdjpy.jpy_per_usd", "yahoo-finance", 150, 149.8, 149.5],
  ["fx.usdcnh.cnh_per_usd", "yahoo-finance", 7.1, 7.09, 7.08],
] as const;

test("MOVE-002B builds one deterministic point-in-time evidence bundle without writes", async () => {
  const observations = new InMemoryObservationRepository();
  const eventStore = new InMemoryEventRepository();
  const events = new InMemoryHistoricalEventRepository(eventStore);

  const start120At = "2026-10-02T02:30:00.000Z";
  const start60At = "2026-10-02T03:30:00.000Z";
  const endAt = "2026-10-02T04:30:00.000Z";

  await observations.saveMany(synchronous.flatMap(
    ([seriesKey, sourceId, start120, start60, end], index) => [
      observation({
        id: `sync-${index}-start-120`,
        seriesKey,
        sourceId,
        value: start120,
        observedAt: start120At,
        retrievedAt: "2026-10-02T02:30:10.000Z",
      }),
      observation({
        id: `sync-${index}-start-60`,
        seriesKey,
        sourceId,
        value: start60,
        observedAt: start60At,
        retrievedAt: "2026-10-02T03:30:10.000Z",
      }),
      observation({
        id: `sync-${index}-end`,
        seriesKey,
        sourceId,
        value: end,
        observedAt: endAt,
        retrievedAt: "2026-10-02T04:30:10.000Z",
      }),
    ],
  ));

  // Same effective DXY point, but learned after the MOVE cutoff: must not leak backward.
  await observations.save(observation({
    id: "dxy-later-revision",
    seriesKey: "dxy.index.usd",
    sourceId: "yahoo-finance",
    value: 80,
    observedAt: endAt,
    retrievedAt: "2026-10-02T05:00:00.000Z",
  }));

  await observations.save(observation({
    id: "stablecoin-latest",
    domain: "MARKET",
    seriesKey: "crypto.usd_stablecoin_market_cap.usd",
    sourceId: "defillama-stablecoin",
    value: 300_000_000_000,
    observedAt: "2026-10-02T01:00:00.000Z",
    retrievedAt: "2026-10-02T01:10:00.000Z",
    metadata: {
      metricId: "crypto.usd_stablecoin_market_cap.usd",
      unit: "USD",
      frequency: "DAILY",
    },
  }));

  await observations.save(observation({
    id: "btc-etf-flow",
    domain: "MARKET",
    seriesKey: "crypto.us_spot_btc_etf_net_flow.usd",
    sourceId: "sosovalue-etf-flow",
    value: 125_000_000,
    observedAt: "2026-09-30T00:00:00.000Z",
    retrievedAt: "2026-10-01T02:00:00.000Z",
    metadata: {
      metricId: "crypto.us_spot_btc_etf_net_flow.usd",
      providerTradingDate: "2026-09-30",
      unit: "USD",
      frequency: "DAILY",
    },
  }));

  const scheduledAt = "2026-10-02T03:30:00.000Z";
  const event: Event = {
    id: "event-known",
    subject: "Qualified scheduled event",
    description: "Test event",
    jurisdiction: "US",
    scheduledAt,
    retrievedAt: "2026-10-02T01:00:00.000Z",
    status: "UPCOMING",
    importance: "HIGH",
    sourceId: "test-calendar",
    evidenceId: "event-evidence",
    identity: {
      version: "v1",
      key: "event:v1:US:test:2026-10-02T03:30:00.000Z",
      semanticKey: "test",
      scheduledAt,
      jurisdiction: "US",
    },
  };
  await eventStore.save(event);

  await eventStore.save({
    ...event,
    id: "event-learned-late",
    retrievedAt: "2026-10-02T05:00:00.000Z",
    evidenceId: "event-evidence-late",
    identity: {
      ...event.identity!,
      key: "event:v1:US:test-late:2026-10-02T03:45:00.000Z",
      semanticKey: "test-late",
      scheduledAt: "2026-10-02T03:45:00.000Z",
    },
    scheduledAt: "2026-10-02T03:45:00.000Z",
  });

  const assessment = materialAssessment();
  const first = await buildMoveEvidenceBundle({ assessment, observations, events });
  const second = await buildMoveEvidenceBundle({ assessment, observations, events });

  assert.equal(first.status, "READY");
  assert.equal(second.status, "READY");
  if (first.status !== "READY" || second.status !== "READY") return;

  assert.equal(first.bundle.id, second.bundle.id);
  assert.equal(first.bundle.investigationWindow.startAt, start120At);
  assert.equal(first.bundle.investigationWindow.endAt, endAt);
  assert.deepEqual(first.bundle.investigationWindow.materialHorizonsMs, [
    60 * 60 * 1000,
    120 * 60 * 1000,
  ]);

  assert.equal(first.bundle.synchronousMarket.state, "AVAILABLE_SYNCHRONOUS");
  assert.equal(first.bundle.synchronousMarket.coverage, "COMPLETE");
  assert.equal(first.bundle.synchronousMarket.horizons.length, 2);
  assert.deepEqual(
    first.bundle.synchronousMarket.horizons.map((item) => [
      item.horizonMs,
      item.startAt,
      item.coverage,
    ]),
    [
      [60 * 60 * 1000, start60At, "COMPLETE"],
      [120 * 60 * 1000, start120At, "COMPLETE"],
    ],
  );

  for (const horizon of first.bundle.synchronousMarket.horizons) {
    assert.equal(horizon.series.length, 6);
    const dxy = horizon.series.find((item) => item.seriesKey === "dxy.index.usd");
    assert.equal(dxy?.state, "AVAILABLE_SYNCHRONOUS");
    assert.equal(dxy?.end?.observationId, "sync-2-end");
    assert.notEqual(dxy?.end?.observationId, "dxy-later-revision");
  }

  assert.equal(first.bundle.scheduledCatalysts.state, "AVAILABLE_CATALYST");
  assert.deepEqual(first.bundle.scheduledCatalysts.events.map((item) => item.eventId), [
    "event-known",
  ]);

  assert.equal(first.bundle.slowBackground.state, "AVAILABLE_BACKGROUND");
  assert.deepEqual(
    first.bundle.slowBackground.items.map((item) => [item.kind, item.state]),
    [
      ["USD_STABLECOIN_LIQUIDITY", "AVAILABLE_BACKGROUND"],
      ["BTC_ETF_NET_FLOW", "AVAILABLE_BACKGROUND"],
    ],
  );

  assert.equal(first.bundle.unscheduledCatalysts.state, "INSUFFICIENT_DATA");
  assert.equal(first.bundle.cryptoMarketStructure?.state, "INSUFFICIENT_DATA");
  assert.equal(first.bundle.cryptoMarketStructure?.components.length, 4);
  assert.equal(first.bundle.intradayRatesPricing.state, "MISSING_HIGH_VALUE_EVIDENCE");
  assert.equal(
    first.bundle.intradayRatesPricing.policy,
    "FREE_ONLY_NO_APPROVED_RUNTIME",
  );
  assert.equal(first.bundle.evidenceCompleteness, "EVIDENCE_INCOMPLETE");
  assert.equal(first.bundle.causalAttribution, "NOT_EVALUATED");
  assert.equal(first.bundle.writesPerformed, false);
});

test("MOVE-002B refuses to build a bundle when MOVE-001C did not trigger", async () => {
  const observations = new InMemoryObservationRepository();
  const eventStore = new InMemoryEventRepository();
  const events = new InMemoryHistoricalEventRepository(eventStore);
  const assessment: ContinuousMoveAssessment = {
    ...materialAssessment(),
    id: "below-threshold",
    status: "BELOW_MATERIALITY_THRESHOLD",
    hasMaterialMove: false,
    horizons: materialAssessment().horizons.map((item) => ({
      ...item,
      status: "BELOW_MATERIALITY_THRESHOLD",
    })),
  };

  const result = await buildMoveEvidenceBundle({ assessment, observations, events });
  assert.equal(result.status, "NOT_TRIGGERED");
});
