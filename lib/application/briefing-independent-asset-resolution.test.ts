import assert from "node:assert/strict";
import test from "node:test";
import type { MaterialMoveAssetReadModel, MaterialMoveMonitorReadModel } from "./material-move-monitor";
import { composeFactualMarketBriefing } from "./factual-market-briefing";

const AS_OF = "2026-10-11T00:00:00.000Z";
type Asset = MaterialMoveAssetReadModel["asset"];
type Status = MaterialMoveAssetReadModel["status"];

function assessedAsset(asset: Asset, status: Status, complete = false): MaterialMoveAssetReadModel {
  const material = status === "MATERIAL_MOVE";
  return {
    asset,
    seriesKey: asset === "BTC" ? "btc.spot.usd" : "gold.futures.usd",
    sourceId: asset === "BTC" ? "coingecko-market" : "yahoo-finance",
    observedAt: AS_OF,
    marketContext: null,
    status,
    hasMaterialMove: material,
    horizons: material ? [{
      horizonMinutes: 60,
      status: "MATERIAL_MOVE",
      signedPercentChange: 1.2,
      targetStartObservedAt: "2026-10-10T23:00:00.000Z",
      targetEndObservedAt: AS_OF,
      materialityThresholdPercent: 0.8,
      targetPercentileRank: 98,
      historicalSampleSize: 450,
    }] : [],
    evidence: material && complete
      ? { evidenceCompleteness: "EVIDENCE_COMPLETE" } as NonNullable<MaterialMoveAssetReadModel["evidence"]>
      : null,
    causalAttribution: "NOT_EVALUATED",
  };
}

function briefing(
  assets: MaterialMoveAssetReadModel[],
  status: MaterialMoveMonitorReadModel["status"] = "OK",
) {
  return composeFactualMarketBriefing({
    baselines: {}, observations: [], asOf: AS_OF,
    materialMoveMonitor: { asOf: AS_OF, status, assets, causalAttribution: "NOT_EVALUATED" },
  });
}

const states = ["MATERIAL_MOVE", "BELOW_MATERIALITY_THRESHOLD", "INSUFFICIENT_DATA"] as const;

test("G1-02: each BTC/Gold MATERIAL, BELOW and INSUFFICIENT pair is evaluated independently", () => {
  for (const btcStatus of states) for (const goldStatus of states) {
    const btc = assessedAsset("BTC", btcStatus);
    const gold = assessedAsset("GOLD", goldStatus);
    const material = [btcStatus, goldStatus].includes("MATERIAL_MOVE");
    const bothBelow = btcStatus === "BELOW_MATERIALITY_THRESHOLD" && goldStatus === "BELOW_MATERIALITY_THRESHOLD";
    const missing = (["BTC", "GOLD"] as const).filter((asset) =>
      (asset === "BTC" ? btcStatus : goldStatus) === "INSUFFICIENT_DATA");
    const expectedStatus = material ? "MATERIAL_MOVE_EVIDENCE_INCOMPLETE"
      : bothBelow ? "NO_MATERIAL_MOVE" : "MARKET_DATA_INSUFFICIENT";
    const expectedCoverage = missing.length === 2 ? "INSUFFICIENT"
      : missing.length === 1 ? "PARTIAL" : "COMPLETE";
    for (const assets of [[btc, gold], [gold, btc]]) {
      const result = briefing(assets);
      assert.equal(result.resolution.status, expectedStatus, `${btcStatus}/${goldStatus}`);
      assert.equal(result.resolution.assessmentCoverage, expectedCoverage);
      assert.deepEqual(result.resolution.insufficientAssets, missing);
      assert.deepEqual(result.resolution.materialAssets,
        (["BTC", "GOLD"] as const).filter((asset) =>
          (asset === "BTC" ? btcStatus : goldStatus) === "MATERIAL_MOVE"));
      assert.equal(result.marketMoves.materialMoveCount, Number(btc.hasMaterialMove) + Number(gold.hasMaterialMove));
      assert.equal(result.marketMoves.evidenceStatus,
        missing.length === 2 ? "INSUFFICIENT" : "AVAILABLE");
      assert.equal(result.resolution.reasoningStatus, "NOT_EVALUATED");
      assert.ok(result.marketMoves.items.every((item) => item.causalAttribution === "NOT_EVALUATED"));
      if (missing.length === 1) {
        assert.match(result.resolution.statement, /belum cukup.*parsial/);
        assert.match(result.resolution.statement, missing[0] === "BTC"
          ? /Bitcoin/ : /Emas berjangka COMEX \(GC=F\)/);
      }
      if (!material && missing.length) {
        assert.notEqual(result.resolution.status, "NO_MATERIAL_MOVE");
      }
      if (bothBelow) {
        assert.match(result.resolution.statement, /Belum ada pergerakan material/);
      }
    }
  }
});

test("G1-02: qualified BTC move survives insufficient Gold, even with inconsistent aggregate status", () => {
  const btc = assessedAsset("BTC", "MATERIAL_MOVE", true);
  const gold = assessedAsset("GOLD", "UNAVAILABLE");
  const result = briefing([gold, btc], "UNAVAILABLE");
  assert.equal(result.marketMoves.evidenceStatus, "AVAILABLE");
  assert.equal(result.marketMoves.materialMoveCount, 1);
  assert.equal(result.resolution.status, "MATERIAL_MOVE_EVIDENCE_COMPLETE");
  assert.equal(result.resolution.evidenceCompleteness, "EVIDENCE_COMPLETE");
  assert.equal(result.resolution.assessmentCoverage, "PARTIAL");
  assert.deepEqual(result.resolution.materialAssets, ["BTC"]);
  assert.deepEqual(result.resolution.insufficientAssets, ["GOLD"]);
  assert.match(result.resolution.statement, /Bitcoin mengalami pergerakan material/);
  assert.match(result.resolution.statement, /Penilaian Emas berjangka COMEX \(GC=F\) belum cukup/);
  assert.match(result.resolution.driverStatement, /hubungan sebab-akibat belum dievaluasi/);
});

test("G1-02: qualified Gold move survives insufficient BTC", () => {
  const result = briefing([
    assessedAsset("BTC", "UNKNOWN"),
    assessedAsset("GOLD", "MATERIAL_MOVE"),
  ], "PARTIAL");
  assert.equal(result.resolution.status, "MATERIAL_MOVE_EVIDENCE_INCOMPLETE");
  assert.deepEqual(result.resolution.materialAssets, ["GOLD"]);
  assert.deepEqual(result.resolution.insufficientAssets, ["BTC"]);
  assert.match(result.resolution.statement, /Emas berjangka COMEX \(GC=F\) mengalami pergerakan material/);
  assert.match(result.resolution.statement, /Penilaian Bitcoin belum cukup/);
});

test("G1-02: qualified below-threshold BTC stays factual when Gold missing or incompatible", () => {
  for (const status of ["INSUFFICIENT_DATA", "UNKNOWN", "INCOMPATIBLE", "UNAVAILABLE"] as const) {
    const result = briefing([assessedAsset("BTC", "BELOW_MATERIALITY_THRESHOLD"), assessedAsset("GOLD", status)]);
    assert.equal(result.resolution.status, "MARKET_DATA_INSUFFICIENT");
    assert.equal(result.resolution.assessmentCoverage, "PARTIAL");
    assert.match(result.resolution.statement, /Bitcoin berada di bawah ambang materialitas/);
    assert.match(result.resolution.statement, /Emas berjangka COMEX \(GC=F\) belum cukup/);
    assert.doesNotMatch(result.resolution.statement, /Belum ada pergerakan material Bitcoin atau/);
  }
});

test("G1-02: missing instrument and contradictory material flag fail closed", () => {
  const below = assessedAsset("BTC", "BELOW_MATERIALITY_THRESHOLD");
  const material = assessedAsset("GOLD", "MATERIAL_MOVE");
  material.hasMaterialMove = false; // contradictory flag must not be counted
  const result = briefing([below, material]);
  assert.equal(result.marketMoves.materialMoveCount, 0);
  assert.equal(result.resolution.status, "MARKET_DATA_INSUFFICIENT");
  assert.deepEqual(result.resolution.insufficientAssets, ["GOLD"]);
  assert.match(result.resolution.statement, /Bitcoin berada di bawah ambang materialitas/);
  assert.equal(briefing([below]).resolution.assessmentCoverage, "PARTIAL");
  assert.equal(briefing([]).resolution.assessmentCoverage, "INSUFFICIENT");
  assert.deepEqual(briefing([]).resolution.insufficientAssets, ["BTC", "GOLD"]);
});

test("G1-02: two material assets retain aggregate evidence completeness, not assessment coverage", () => {
  const btc = assessedAsset("BTC", "MATERIAL_MOVE", true);
  const gold = assessedAsset("GOLD", "MATERIAL_MOVE");
  const result = briefing([gold, btc], "OK");
  assert.equal(result.resolution.status, "MATERIAL_MOVE_EVIDENCE_INCOMPLETE");
  assert.equal(result.resolution.assessmentCoverage, "COMPLETE");
  assert.equal(result.resolution.evidenceCompleteness, "EVIDENCE_INCOMPLETE");
  assert.deepEqual(result.resolution.materialAssets, ["BTC", "GOLD"]);
  assert.deepEqual(result.resolution.insufficientAssets, []);
  assert.doesNotMatch(result.resolution.statement, /parsial/);
});
