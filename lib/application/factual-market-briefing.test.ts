import assert from "node:assert/strict";
import test from "node:test";
import type { FactualBaseline } from "../domain/baseline";
import type { Observation } from "../domain/types";
import { composeFactualMarketBriefing } from "./factual-market-briefing";

const AS_OF = "2026-10-02T00:00:00.000Z";

function observation(id: string, seriesId: string, unit = "Percent"): Observation {
  return {
    id,
    domain: "MACRO",
    subject: seriesId,
    value: "1",
    observedAt: "2026-10-01T00:00:00.000Z",
    retrievedAt: "2026-10-01T00:05:00.000Z",
    sourceId: "fred",
    quality: "FRESH",
    evidenceId: `evidence-${id}`,
    metadata: { seriesId, unit, frequency: "DAILY" },
  };
}

function baseline(
  currentObservationId: string,
  currentValue: string,
  baselineValue: string | null,
  status: FactualBaseline["status"] = "VALID",
): FactualBaseline {
  return {
    kind: "FACTUAL",
    status,
    currentObservationId,
    baselineObservationId: baselineValue === null ? null : `previous-${currentObservationId}`,
    currentValue,
    baselineValue,
    currentObservedAt: "2026-10-01T00:00:00.000Z",
    baselineObservedAt: baselineValue === null ? null : "2026-09-30T00:00:00.000Z",
    sourceId: "fred",
    quality: status === "VALID" ? "FRESH" : "UNKNOWN",
    currentObservationQuality: "FRESH",
    baselineObservationQuality: baselineValue === null ? null : "FRESH",
    qualityPolicy: "current-freshness-historical-fitness-v1",
  };
}

test("composes the existing Gate 1 factual changes in the established priority order", () => {
  const observations = [
    observation("unrate", "UNRATE"),
    observation("dgs10", "DGS10"),
    observation("dfii10", "DFII10"),
    observation("dgs2", "DGS2"),
    observation("t10yie", "T10YIE"),
    observation("t10y2y", "T10Y2Y"),
  ];
  const baselines = {
    UNRATE: baseline("unrate", "4.3", "4.2"),
    DGS10: baseline("dgs10", "4.10", "4.00"),
    DFII10: baseline("dfii10", "1.80", "1.75"),
    DGS2: baseline("dgs2", "3.90", "3.80"),
    T10YIE: baseline("t10yie", "2.30", "2.25"),
    T10Y2Y: baseline("t10y2y", "0.20", "0.15"),
  };

  const result = composeFactualMarketBriefing({ baselines, observations, asOf: AS_OF });

  assert.equal(result.whatChanged.evidenceStatus, "AVAILABLE");
  assert.equal(result.whatChanged.reasoningStatus, "NOT_EVALUATED");
  assert.deepEqual(
    result.whatChanged.items.map((item) => item.seriesId),
    ["DGS2", "DGS10", "DFII10", "T10YIE"],
    "BRF-001A preserves the existing priority and four-item display bound",
  );
  assert.equal(result.whatChanged.items[0]?.changeValue, 0.1);
  assert.equal(result.whatChanged.items[0]?.unit, "Percent");
});

test("reports insufficient evidence instead of fabricating a briefing narrative", () => {
  const observations = [observation("dgs2", "DGS2")];
  const baselines = {
    DGS2: baseline("dgs2", "3.90", null, "MISSING"),
  };

  const result = composeFactualMarketBriefing({ baselines, observations, asOf: AS_OF });

  assert.equal(result.whatChanged.evidenceStatus, "INSUFFICIENT");
  assert.equal(result.whatChanged.reasoningStatus, "NOT_EVALUATED");
  assert.deepEqual(result.whatChanged.items, []);
  assert.match(result.whatChanged.reason ?? "", /Belum ada factual baseline Macro/);
});

test("Gate 1 composer remains factual and does not emit higher-order conclusions", () => {
  const result = composeFactualMarketBriefing({
    baselines: { DGS2: baseline("dgs2", "3.90", "3.80") },
    observations: [observation("dgs2", "DGS2")],
    asOf: AS_OF,
  });
  const serialized = JSON.stringify(result).toLowerCase();

  for (const forbidden of ["bullish", "bearish", "risk-on", "risk-off", "buy", "sell", "long", "short"]) {
    assert.equal(serialized.includes(forbidden), false, `composer must not emit ${forbidden}`);
  }
  assert.equal(result.whatChanged.reasoningStatus, "NOT_EVALUATED");
});
