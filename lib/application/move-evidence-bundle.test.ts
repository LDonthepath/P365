import assert from "node:assert/strict";
import test from "node:test";
import type { Event, Observation } from "../domain/types";
import type { GdeltGalFeedSnapshot } from "../data/gdelt-gal";
import {
  InMemoryEventRepository,
  InMemoryEvidenceRepository,
  InMemoryHistoricalEventRepository,
  InMemoryObservationRepository,
} from "../repositories/memory";
import type { ContinuousMoveAssessment } from "./continuous-move-detector";
import {
  BTC_SPOT_FLOW_METHODOLOGY,
  type BtcSpotFlowWindow,
} from "./btc-spot-flow";
import { btcSpotFlowWindowsToEvidence } from "./btc-spot-flow-history";
import { gdeltGalSnapshotsToEvidence } from "./gdelt-gal-history";
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

function spotFlowWindow(observedAt: string, overrides: Partial<BtcSpotFlowWindow> = {}): BtcSpotFlowWindow {
  const observedAtMs = Date.parse(observedAt);
  const providerIntervalStartMs = observedAtMs - 5 * 60 * 1000;
  return {
    asset: "BTC",
    venue: "BINANCE",
    pair: "BTCUSDT",
    baseUnit: "BTC",
    providerIntervalStartMs,
    observedAt,
    windowSeconds: 300,
    totalBaseVolumeBtc: 10,
    takerBuyBaseVolumeBtc: 6,
    takerSellBaseVolumeBtc: 4,
    netTakerBaseVolumeBtc: 2,
    takerBuyShare: 0.6,
    tradeCount: 100,
    coverage: "COMPLETE",
    methodology: BTC_SPOT_FLOW_METHODOLOGY,
    ...overrides,
  };
}

async function seedCompleteSpotFlow(
  evidence: InMemoryEvidenceRepository,
  startAt: string,
  endAt: string,
): Promise<{ finalEvidenceId: string; lateCorrectionId: string }> {
  const start = Date.parse(startAt);
  const end = Date.parse(endAt);
  const windowMs = 5 * 60 * 1000;
  const firstBoundary = Math.floor(start / windowMs) * windowMs + windowMs;
  const lastBoundary = Math.floor(end / windowMs) * windowMs;

  let finalEvidenceId = "";
  for (let boundary = firstBoundary; boundary <= lastBoundary; boundary += windowMs) {
    const observedAt = new Date(boundary).toISOString();
    const row = btcSpotFlowWindowsToEvidence({
      windows: [spotFlowWindow(observedAt)],
      retrievedAt: new Date(boundary + 10_000).toISOString(),
    })[0];
    await evidence.save(row);
    if (boundary === lastBoundary) finalEvidenceId = row.id;
  }

  const corrected = btcSpotFlowWindowsToEvidence({
    windows: [spotFlowWindow(new Date(lastBoundary).toISOString(), {
      takerBuyBaseVolumeBtc: 7,
      takerSellBaseVolumeBtc: 3,
      netTakerBaseVolumeBtc: 4,
      takerBuyShare: 0.7,
      tradeCount: 101,
    })],
    retrievedAt: "2026-10-02T05:00:00.000Z",
  })[0];
  await evidence.save(corrected);

  return { finalEvidenceId, lateCorrectionId: corrected.id };
}

function gdeltSnapshot(input: {
  asset: "BTC" | "GOLD";
  buildAt: string;
  candidates?: GdeltGalFeedSnapshot["candidates"];
}): GdeltGalFeedSnapshot {
  const build = Date.parse(input.buildAt);
  const candidates = input.candidates ?? [];
  return {
    asset: input.asset,
    feedLastBuildAt: new Date(build).toISOString(),
    feedWindowStartAt: new Date(build - 15 * 60 * 1000).toISOString(),
    coverage: "ROLLING_15_MINUTES",
    totalFeedItems: 100,
    invalidItemCount: 0,
    matchingCandidateCount: candidates.length,
    candidateCoverage: "COMPLETE",
    candidates,
  };
}

async function seedCompleteGdeltHistory(input: {
  evidence: InMemoryEvidenceRepository;
  asset: "BTC" | "GOLD";
  startAt: string;
  endAt: string;
  withCandidate: boolean;
}): Promise<{ snapshotCount: number; candidateUrl: string; lateCandidateUrl: string }> {
  const start = Date.parse(input.startAt);
  const end = Date.parse(input.endAt);
  const intervalMs = 15 * 60 * 1000;
  const firstBuild = Math.floor(start / intervalMs) * intervalMs + intervalMs;
  const candidateUrl = "https://example.com/move-window-candidate";
  const lateCandidateUrl = "https://example.com/learned-after-cutoff";
  let snapshotCount = 0;

  for (let build = firstBuild; build <= end; build += intervalMs) {
    const buildAt = new Date(build).toISOString();
    const includeCandidate = input.withCandidate && build === firstBuild + 2 * intervalMs;
    const snapshot = gdeltSnapshot({
      asset: input.asset,
      buildAt,
      candidates: includeCandidate
        ? [{
            asset: input.asset,
            url: candidateUrl,
            title: input.asset === "BTC"
              ? "Bitcoin headline inside MOVE window"
              : "Gold market headline inside MOVE window",
            domain: "example.com",
            providerDate: new Date(build - 60_000).toISOString(),
            providerDateSemantics: "PUBLICATION_OR_FIRST_SEEN",
          }]
        : [],
    });
    const row = gdeltGalSnapshotsToEvidence({
      snapshots: [snapshot],
      retrievedAt: new Date(build + 5_000).toISOString(),
    })[0];
    await input.evidence.save(row);
    snapshotCount += 1;
  }

  const lateBuild = end + intervalMs;
  await input.evidence.save(gdeltGalSnapshotsToEvidence({
    snapshots: [gdeltSnapshot({
      asset: input.asset,
      buildAt: new Date(lateBuild).toISOString(),
      candidates: [{
        asset: input.asset,
        url: lateCandidateUrl,
        title: "Headline learned after MOVE cutoff",
        domain: "example.com",
        providerDate: new Date(end - 60_000).toISOString(),
        providerDateSemantics: "PUBLICATION_OR_FIRST_SEEN",
      }],
    })],
    retrievedAt: new Date(lateBuild + 5_000).toISOString(),
  })[0]);

  return { snapshotCount, candidateUrl, lateCandidateUrl };
}

test("MOVE-002B builds one deterministic point-in-time evidence bundle without writes", async () => {
  const observations = new InMemoryObservationRepository();
  const evidence = new InMemoryEvidenceRepository();
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

  const { finalEvidenceId, lateCorrectionId } = await seedCompleteSpotFlow(
    evidence,
    start120At,
    endAt,
  );
  const newsSeed = await seedCompleteGdeltHistory({
    evidence,
    asset: "BTC",
    startAt: start120At,
    endAt,
    withCandidate: true,
  });

  const assessment = materialAssessment();
  const first = await buildMoveEvidenceBundle({ assessment, observations, events, evidence });
  const second = await buildMoveEvidenceBundle({ assessment, observations, events, evidence });

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

  assert.equal(first.bundle.unscheduledCatalysts.state, "AVAILABLE_CATALYST");
  assert.equal(first.bundle.unscheduledCatalysts.coverage, "COMPLETE");
  assert.equal(first.bundle.unscheduledCatalysts.snapshots.length, newsSeed.snapshotCount);
  assert.equal(
    first.bundle.unscheduledCatalysts.coveredDurationMs,
    120 * 60 * 1000,
  );
  assert.deepEqual(
    first.bundle.unscheduledCatalysts.candidates.map((item) => item.url),
    [newsSeed.candidateUrl],
  );
  assert.equal(
    first.bundle.unscheduledCatalysts.candidates[0]?.temporalFit,
    "WITHIN_MOVE_WINDOW",
  );
  assert.equal(
    first.bundle.unscheduledCatalysts.candidates.some(
      (item) => item.url === newsSeed.lateCandidateUrl,
    ),
    false,
  );
  assert.equal(
    first.bundle.unscheduledCatalysts.currentSourceCapability,
    "GDELT_GAL_DURABLE_ROLLING_15M",
  );
  assert.equal(first.bundle.cryptoMarketStructure?.state, "INSUFFICIENT_DATA");
  assert.equal(first.bundle.cryptoMarketStructure?.components.length, 4);
  const spotFlow = first.bundle.cryptoMarketStructure?.components.find(
    (item) => item.component === "BTC_SPOT_FLOW",
  );
  assert.equal(spotFlow?.state, "AVAILABLE_SYNCHRONOUS");
  assert.equal(spotFlow?.spotFlow?.coverage, "COMPLETE");
  assert.equal(spotFlow?.spotFlow?.expectedCompletedWindows, 24);
  assert.equal(spotFlow?.spotFlow?.windows.length, 24);
  assert.equal(spotFlow?.spotFlow?.windows.at(-1)?.evidenceId, finalEvidenceId);
  assert.notEqual(spotFlow?.spotFlow?.windows.at(-1)?.evidenceId, lateCorrectionId);
  assert.equal(spotFlow?.spotFlow?.windows.at(-1)?.netTakerBaseVolumeBtc, 2);
  assert.equal(first.bundle.intradayRatesPricing.state, "MISSING_HIGH_VALUE_EVIDENCE");
  assert.equal(
    first.bundle.intradayRatesPricing.policy,
    "FREE_ONLY_NO_APPROVED_RUNTIME",
  );
  assert.equal(first.bundle.evidenceCompleteness, "EVIDENCE_INCOMPLETE");
  assert.equal(first.bundle.causalAttribution, "NOT_EVALUATED");
  assert.equal(first.bundle.writesPerformed, false);
});

test("MOVE-002B keeps the Gold target on Gold-specific background boundaries", async () => {
  const observations = new InMemoryObservationRepository();
  const evidence = new InMemoryEvidenceRepository();
  const eventStore = new InMemoryEventRepository();
  const events = new InMemoryHistoricalEventRepository(eventStore);
  const assessment: ContinuousMoveAssessment = {
    ...materialAssessment(),
    id: "move-gold-1",
    seriesKey: "gold.futures.usd",
    sourceId: "yahoo-finance",
    targetEndObservationId: "gold-end",
    horizons: materialAssessment().horizons.map((item) => ({
      ...item,
      targetStartObservationId: item.targetStartObservationId
        ? item.targetStartObservationId.replace("btc", "gold")
        : undefined,
      targetEndObservationId: "gold-end",
    })),
  };

  await seedCompleteGdeltHistory({
    evidence,
    asset: "GOLD",
    startAt: "2026-10-02T02:30:00.000Z",
    endAt: "2026-10-02T04:30:00.000Z",
    withCandidate: false,
  });

  const result = await buildMoveEvidenceBundle({ assessment, observations, events, evidence });
  assert.equal(result.status, "READY");
  if (result.status !== "READY") return;

  assert.equal(result.bundle.targetAsset, "GOLD");
  assert.equal(result.bundle.slowBackground.items.length, 1);
  assert.equal(result.bundle.slowBackground.items[0]?.kind, "GOLD_CFTC_POSITIONING");
  assert.equal(result.bundle.slowBackground.items[0]?.state, "INSUFFICIENT_DATA");
  assert.equal(result.bundle.cryptoMarketStructure, undefined);
  assert.equal(result.bundle.unscheduledCatalysts.state, "AVAILABLE_CATALYST");
  assert.equal(result.bundle.unscheduledCatalysts.coverage, "COMPLETE");
  assert.equal(result.bundle.unscheduledCatalysts.candidates.length, 0);
  assert.match(
    result.bundle.unscheduledCatalysts.reason ?? "",
    /no temporally eligible asset candidate/,
  );
  assert.equal(result.bundle.intradayRatesPricing.state, "MISSING_HIGH_VALUE_EVIDENCE");
  assert.equal(result.bundle.evidenceCompleteness, "EVIDENCE_INCOMPLETE");
  assert.equal(result.bundle.causalAttribution, "NOT_EVALUATED");
  assert.equal(result.bundle.writesPerformed, false);
});

test("MOVE-002B refuses to build a bundle when MOVE-001C did not trigger", async () => {
  const observations = new InMemoryObservationRepository();
  const evidence = new InMemoryEvidenceRepository();
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

  const result = await buildMoveEvidenceBundle({ assessment, observations, events, evidence });
  assert.equal(result.status, "NOT_TRIGGERED");
});
