import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { Observation } from "../domain/types";
import type { BaselinePresentation } from "./baseline";
import type { MaterialMoveMonitorReadModel } from "../application/material-move-monitor";
import { buildFinancialMarketOverview } from "./financial-market-overview";

const ASOF = "2026-10-09T14:00:00.000Z";
const EMPTY_MOVE: MaterialMoveMonitorReadModel = {
  asOf: ASOF, status: "OK", assets: [], causalAttribution: "NOT_EVALUATED",
};

function observation(
  key: string, value: string, sourceId = "fred",
  observedAt = "2026-10-08T00:00:00.000Z", quality: Observation["quality"] = "FRESH",
  retrievedAt = "2026-10-09T12:00:00.000Z",
): Observation {
  return {
    id: key + "-id", domain: sourceId === "fred" ? "MACRO" : "ASSET",
    subject: key, value, observedAt, retrievedAt, sourceId, quality, evidenceId: key + "-evidence",
    identity: { version: "v1", seriesKey: key, measurementId: key + "-measurement", revisionFingerprint: "v1" },
    metadata: sourceId === "fred" ? { seriesId: key, frequency: "DAILY", unit: "Percent" } : {},
  };
}

function build(observations: Observation[], baselines: BaselinePresentation[] = [],
  materialMove: MaterialMoveMonitorReadModel = EMPTY_MOVE) {
  return buildFinancialMarketOverview({
    asOf: ASOF, observations, baselines, materialMove,
  });
}

function row(model: ReturnType<typeof build>, key: string) {
  const result = model.groups.flatMap((group) => group.items).find((item) => item.key === key);
  assert.ok(result, "series absent: " + key);
  return result;
}

test("all six domains are displayed even when a provider has no qualified data", () => {
  const model = build([]);
  assert.deepEqual(model.groups.map((group) => group.name), [
    "USD & FX", "Rates & Bonds", "Equities & Risk", "Commodities",
    "Credit & Funding", "Crypto",
  ]);
  assert.ok(model.groups.every((group) => group.coverage === "BELUM TERSEDIA"));
  assert.equal(row(model, "DGS2").value, null);
  assert.equal(row(model, "DGS2").change, null);
  assert.equal(model.pairs.length, 0);
  assert.equal(model.causalAttribution, "NOT_EVALUATED");
});

test("no bad finite fallback, future observation, post-cutoff retrieval, or wrong source", () => {
  const values = [
    observation("DGS2", "NaN"),
    observation("DGS2", "5.1", "not-fred"),
    observation("DGS2", "5.1", "fred", "2026-10-10T00:00:00.000Z"),
    observation("DGS2", "5.1", "fred", "2026-10-08T00:00:00.000Z", "FRESH", "2026-10-10T00:00:00.000Z"),
  ];
  assert.equal(row(build(values), "DGS2").value, null);
  assert.equal(row(build([observation("btc.spot.usd", "0", "coingecko-market")]), "btc.spot.usd").value, null);
});

test("stale remains a visible partial fact with preserved source timestamps", () => {
  const item = row(build([observation("DGS10", "4.25", "fred", "2026-10-08", "STALE")]), "DGS10");
  assert.equal(item.value, 4.25);
  assert.equal(item.status, "SEBAGIAN");
  assert.equal(item.quality, "STALE");
  assert.equal(item.observedAt, "2026-10-08");
  assert.equal(item.change, null);
});

test("futures cannot be relabelled as spot and remain source-native", () => {
  const gold = row(build([
    observation("gold.futures.usd", "4000", "yahoo-finance", "2026-10-09T12:00:00.000Z"),
    observation("gold.spot.usd", "3999", "fake-spot-feed", "2026-10-09T12:00:00.000Z"),
  ]), "gold.futures.usd");
  assert.match(gold.name, /COMEX/);
  assert.match(gold.note ?? "", /Bukan XAU\/USD Spot/);
  assert.equal(gold.value, 4000);
  assert.equal(gold.sourceId, "yahoo-finance");
});

test("baseline delta uses bps only when provider, value, date and status are compatible", () => {
  const o = observation("SOFR", "4.30");
  const base: BaselinePresentation = {
    kind: "FACTUAL", seriesId: "SOFR", currentValue: "4.30", baselineValue: "4.20",
    changeValue: 0.10, status: "VALID", quality: "FRESH",
    currentObservedAt: o.observedAt, baselineObservedAt: "2026-10-07T00:00:00.000Z",
    sourceId: "fred", reason: null,
  };
  assert.ok(Math.abs(row(build([o], [base]), "SOFR").change! - 10) < 1e-8);
  assert.equal(row(build([o], [{ ...base, sourceId: "yahoo-finance" }]), "SOFR").change, null);
  assert.equal(row(build([o], [{ ...base, status: "INCOMPATIBLE" }]), "SOFR").change, null);
  assert.equal(row(build([o], [{ ...base, currentValue: "4.31" }]), "SOFR").change, null);
});

test("DGS2, DFII10 and DXY do not synthesize a second change outside unified macro", () => {
  const dgs = observation("DGS2", "4.05");
  const model = build([dgs]);
  assert.equal(row(model, "DGS2").change, null);
  const withUnified = buildFinancialMarketOverview({
    asOf: ASOF, observations: [dgs], baselines: [], materialMove: EMPTY_MOVE,
    unifiedMacro: [{
      seriesKey: "DGS2",
      latest: { observationId: dgs.id, value: 4.05, observedAt: dgs.observedAt,
        retrievedAt: dgs.retrievedAt, quality: "FRESH", freshness: "FRESH", sourceId: "fred" },
      previous: { observationId: "previous", value: 4.00, observedAt: "2026-10-07", retrievedAt: dgs.retrievedAt },
      change: 5, reason: null,
    }],
  });
  assert.equal(row(withUnified, "DGS2").change, 5);
  assert.equal(row(withUnified, "DGS2").changeUnit, "BPS");
});

const START = "2026-10-09T12:00:00.000Z";
const END = "2026-10-09T13:00:00.000Z";
function move(companionChange: number, mismatchMs = 0): MaterialMoveMonitorReadModel {
  return {
    asOf: ASOF, status: "OK", causalAttribution: "NOT_EVALUATED",
    assets: [{
      asset: "BTC", seriesKey: "btc.spot.usd", sourceId: "coingecko-market",
      hasMaterialMove: true,
      horizons: [{
        horizonMinutes: 60, status: "MATERIAL_MOVE", signedPercentChange: 2,
        materialityThresholdPercent: 1, targetPercentileRank: 99, historicalSampleSize: 120,
        targetStartObservedAt: START, targetEndObservedAt: END,
      }],
      evidence: {
        synchronousFingerprint: [{
          horizonMinutes: 60, coverage: "COMPLETE",
          series: [{
            seriesKey: "dxy.index.usd", sourceId: "yahoo-finance",
            state: "AVAILABLE_SYNCHRONOUS", signedPercentChange: companionChange,
            start: { observationId: "start", value: 101,
              observedAt: new Date(Date.parse(START) + mismatchMs).toISOString(),
              retrievedAt: START, quality: "FRESH" },
            end: { observationId: "end", value: 101.5,
              observedAt: END, retrievedAt: END, quality: "FRESH" },
          }],
        }],
      },
    }],
  } as unknown as MaterialMoveMonitorReadModel;
}

test("qualified synchronous MOVE fingerprint shows factual same/opposite/flat direction", () => {
  for (const [change, direction] of [[1, "SEARAH"], [-1, "BERLAWANAN"], [0, "DATAR"]] as const) {
    const result = build([], [], move(change));
    assert.equal(result.pairs.length, 1);
    assert.equal(result.pairs[0].direction, direction);
    assert.equal(result.pairs[0].horizonMinutes, 60);
    assert.equal(result.causalAttribution, "NOT_EVALUATED");
  }
});

test("misaligned MOVE or missing evidence fails closed without daily-rate comparisons", () => {
  assert.equal(build([], [], move(1, 121000)).pairs.length, 0);
  assert.equal(build([observation("DGS2", "4.00")]).pairs.length, 0);
  assert.match(build([], [], move(1, 121000)).comparisonNote, /Belum dapat dibandingkan/);
});

test("Pasar board is wired once, collapses details and does not request a new provider", () => {
  const view = readFileSync("app/dashboard/dashboard-view.tsx", "utf8");
  const jsx = readFileSync("app/dashboard/financial-market-overview-panel.tsx", "utf8");
  assert.equal((view.match(/<FinancialMarketOverviewPanel data=/g) ?? []).length, 1);
  assert.match(view, /activeMenu === "heatmap"/);
  assert.match(jsx, /<details className=/);
  assert.match(jsx, /causalitas tidak dievaluasi/i);
  assert.doesNotMatch(jsx, /fetch\(|createClient|insert\(/);
});
