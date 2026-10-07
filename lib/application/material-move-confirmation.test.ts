import assert from "node:assert/strict";
import test from "node:test";
import { BTC_ETF_NET_FLOW_SERIES_KEY } from "../domain/observation-semantics";
import {
  BINANCE_BTC_SPOT_FLOW_DURABLE_METHODOLOGY,
} from "./btc-spot-flow-history";
import {
  buildBtcSpotFlowConfirmationContribution,
} from "./btc-spot-flow-confirmation";
import type { BtcEtfFlowReadModel } from "./btc-etf-flow";
import type {
  ContinuousMoveAssessment,
  ContinuousMoveHorizonAssessment,
} from "./continuous-move-detector";
import {
  GDELT_GAL_DURABLE_SNAPSHOT_METHODOLOGY,
} from "./gdelt-gal-history";
import {
  buildMaterialMoveConfirmation,
} from "./material-move-confirmation";
import type {
  MoveBtcSpotFlowEvidence,
  MoveEvidenceBundle,
} from "./move-evidence-bundle";

const AS_OF = "2026-10-07T02:30:00.000Z";

function target(direction: "UP" | "DOWN") {
  return {
    targetId: "move-target",
    asset: "BTC" as const,
    responseObservationKey: "ASSET:btc.spot.usd:coingecko-market",
    direction,
    knowledgeAt: AS_OF,
  };
}

function spotFlow(input: {
  nets?: number[];
  coverage?: MoveBtcSpotFlowEvidence["coverage"];
  retrievedAt?: string;
} = {}): MoveBtcSpotFlowEvidence {
  const nets = input.nets ?? [4, 6];
  const retrievedAt = input.retrievedAt ?? "2026-10-07T02:29:30.000Z";
  const windows = nets.map((net, index) => {
    const buy = 50 + net / 2;
    const sell = 50 - net / 2;
    return {
      evidenceId: "spot-flow-" + index,
      windowKey: "window-" + index,
      observedAt: new Date(Date.parse("2026-10-07T02:20:00.000Z") + index * 300_000).toISOString(),
      retrievedAt,
      totalBaseVolumeBtc: buy + sell,
      takerBuyBaseVolumeBtc: buy,
      takerSellBaseVolumeBtc: sell,
      netTakerBaseVolumeBtc: net,
      takerBuyShare: buy / (buy + sell),
      tradeCount: 100 + index,
    };
  });

  return {
    state: "AVAILABLE_SYNCHRONOUS",
    coverage: input.coverage ?? "COMPLETE",
    methodology: BINANCE_BTC_SPOT_FLOW_DURABLE_METHODOLOGY,
    venue: "BINANCE",
    pair: "BTCUSDT",
    windowSeconds: 300,
    startAt: "2026-10-07T02:15:00.000Z",
    endAt: "2026-10-07T02:30:00.000Z",
    expectedCompletedWindows: windows.length,
    windows,
  };
}

function etfFlow(value: number): BtcEtfFlowReadModel {
  const point = {
    value,
    observedAt: "2026-10-06T00:00:00.000Z",
    providerTradingDate: "2026-10-06",
    retrievedAt: "2026-10-07T00:30:00.000Z",
    quality: "UNKNOWN" as const,
    observationId: "etf-flow-1",
  };

  return {
    asOf: AS_OF,
    seriesKey: BTC_ETF_NET_FLOW_SERIES_KEY,
    latest: point,
    previous: null,
    recent: [point],
  };
}

function materialHorizon(
  horizonMs: number,
  direction: "UP" | "DOWN",
): ContinuousMoveHorizonAssessment {
  const signedPercentChange = direction === "UP" ? 1.25 : -1.25;
  return {
    horizonMs,
    status: "MATERIAL_MOVE",
    targetStartObservationId: "btc-start-" + horizonMs,
    targetEndObservationId: "btc-end",
    targetStartObservedAt: new Date(Date.parse(AS_OF) - horizonMs).toISOString(),
    targetEndObservedAt: AS_OF,
    alignmentErrorMs: 0,
    direction,
    signedPercentChange,
    magnitudePercent: Math.abs(signedPercentChange),
    materialityThresholdPercent: 0.9,
    targetPercentileRank: 98,
    historicalSampleSize: 120,
    historicalSamples: [],
  };
}

function assessment(
  directions: Array<{ horizonMs: number; direction: "UP" | "DOWN" }> = [
    { horizonMs: 60 * 60 * 1000, direction: "UP" },
  ],
): ContinuousMoveAssessment {
  return {
    id: "move-assessment-1",
    version: "v1",
    policy: "continuous-market-move-detector-v1",
    methodologyId: "continuous-market-move-materiality-v1",
    methodologyVersion: "v1",
    seriesKey: "btc.spot.usd",
    sourceId: "coingecko-market",
    asOf: AS_OF,
    targetEndObservationId: "btc-end",
    targetEndObservedAt: AS_OF,
    status: "MATERIAL_MOVE",
    hasMaterialMove: true,
    horizons: directions.map((item) => materialHorizon(item.horizonMs, item.direction)),
    causalAttribution: "NOT_EVALUATED",
  };
}

function bundle(input: {
  move: ContinuousMoveAssessment;
  etfValue?: number;
  spot?: MoveBtcSpotFlowEvidence;
}): MoveEvidenceBundle {
  const spot = input.spot ?? spotFlow();
  return {
    id: "bundle-1",
    version: "v1",
    policy: "move-evidence-bundle-v1",
    moveAssessmentId: input.move.id,
    targetAsset: "BTC",
    targetSeriesKey: "btc.spot.usd",
    asOf: input.move.asOf,
    investigationWindow: {
      startAt: "2026-10-07T01:30:00.000Z",
      endAt: "2026-10-07T02:30:00.000Z",
      materialHorizonsMs: [60 * 60 * 1000],
    },
    synchronousMarket: {
      state: "AVAILABLE_SYNCHRONOUS",
      coverage: "COMPLETE",
      alignmentToleranceMs: 120_000,
      horizons: [],
    },
    scheduledCatalysts: {
      state: "AVAILABLE_CATALYST",
      coverage: "COMPLETE",
      events: [],
    },
    slowBackground: {
      state: "AVAILABLE_BACKGROUND",
      items: [{
        kind: "BTC_ETF_NET_FLOW",
        state: "AVAILABLE_BACKGROUND",
        data: etfFlow(input.etfValue ?? 100_000_000),
      }],
    },
    unscheduledCatalysts: {
      state: "INSUFFICIENT_DATA",
      coverage: "EMPTY",
      methodology: GDELT_GAL_DURABLE_SNAPSHOT_METHODOLOGY,
      asset: "BTC",
      startAt: "2026-10-07T01:30:00.000Z",
      endAt: "2026-10-07T02:30:00.000Z",
      windowDurationMs: 60 * 60 * 1000,
      coveredDurationMs: 0,
      snapshots: [],
      candidates: [],
      currentSourceCapability: "GDELT_GAL_DURABLE_ROLLING_15M",
    },
    cryptoMarketStructure: {
      state: "INSUFFICIENT_DATA",
      components: [{
        component: "BTC_SPOT_FLOW",
        state: "AVAILABLE_SYNCHRONOUS",
        reason: "Complete durable Binance spot-flow is available.",
        spotFlow: spot,
      }],
      reason: "Other market-structure components remain incomplete.",
    },
    intradayRatesPricing: {
      state: "MISSING_HIGH_VALUE_EVIDENCE",
      reason: "No approved free intraday rates runtime.",
      policy: "FREE_ONLY_NO_APPROVED_RUNTIME",
    },
    evidenceCompleteness: "EVIDENCE_INCOMPLETE",
    causalAttribution: "NOT_EVALUATED",
    writesPerformed: false,
  };
}

test("CONF-001D maps aggregate Binance taker flow to MARKET_STRUCTURE alignment", () => {
  const result = buildBtcSpotFlowConfirmationContribution({
    target: target("UP"),
    spotFlow: spotFlow({ nets: [4, 6] }),
  });

  assert.equal(result.status, "QUALIFIED");
  if (result.status !== "QUALIFIED") return;
  assert.equal(result.netTakerBaseVolumeBtc, 10);
  assert.equal(result.contribution.evidenceClass, "MARKET_STRUCTURE");
  assert.equal(result.contribution.judgement, "SUPPORTING");
  assert.equal(result.contribution.knownAt, "2026-10-07T02:29:30.000Z");
});

test("CONF-001D fails closed when Binance spot-flow coverage is incomplete", () => {
  const result = buildBtcSpotFlowConfirmationContribution({
    target: target("UP"),
    spotFlow: spotFlow({ coverage: "PARTIAL" }),
  });

  assert.equal(result.status, "UNRESOLVED");
});

test("CONF-001D refuses spot-flow evidence learned after the target cutoff", () => {
  const result = buildBtcSpotFlowConfirmationContribution({
    target: target("UP"),
    spotFlow: spotFlow({ retrievedAt: "2026-10-07T02:31:00.000Z" }),
  });

  assert.equal(result.status, "UNRESOLVED");
});

test("CONF-001D produces CONFIRMING only when FLOW and MARKET_STRUCTURE independently align", () => {
  const move = assessment();
  const result = buildMaterialMoveConfirmation({
    assessment: move,
    bundle: bundle({ move, etfValue: 100_000_000, spot: spotFlow({ nets: [4, 6] }) }),
  });

  assert.equal(result.status, "OK");
  if (result.status !== "OK") return;
  assert.equal(result.targetDirection, "UP");
  assert.equal(result.assessment.resolution, "CONFIRMING");
  assert.equal(result.assessment.directionalClassCount, 2);
  assert.equal(result.assessment.supportingClassCount, 2);
  assert.equal(result.assessment.causalAttribution, "NOT_EVALUATED");
  assert.deepEqual(
    result.evidence.map((item) => [item.evidenceClass, item.judgement]),
    [["FLOW", "SUPPORTING"], ["MARKET_STRUCTURE", "SUPPORTING"]],
  );
});

test("CONF-001D reports MIXED when ETF flow and synchronous taker flow disagree", () => {
  const move = assessment();
  const result = buildMaterialMoveConfirmation({
    assessment: move,
    bundle: bundle({ move, etfValue: -100_000_000, spot: spotFlow({ nets: [4, 6] }) }),
  });

  assert.equal(result.status, "OK");
  if (result.status !== "OK") return;
  assert.equal(result.assessment.resolution, "MIXED");
  assert.equal(result.assessment.supportingClassCount, 1);
  assert.equal(result.assessment.contradictingClassCount, 1);
});

test("CONF-001D refuses to manufacture one direction when material horizons conflict", () => {
  const move = assessment([
    { horizonMs: 15 * 60 * 1000, direction: "UP" },
    { horizonMs: 120 * 60 * 1000, direction: "DOWN" },
  ]);
  const result = buildMaterialMoveConfirmation({
    assessment: move,
    bundle: bundle({ move }),
  });

  assert.equal(result.status, "INSUFFICIENT");
  if (result.status !== "INSUFFICIENT") return;
  assert.match(result.reason, /consistent observed direction/i);
});
