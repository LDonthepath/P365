import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { createElement } from "react";

(globalThis as typeof globalThis & { React?: typeof React }).React = React;
import { renderToStaticMarkup } from "react-dom/server";
import { FactualMarketBriefingPanel } from "../../app/dashboard/factual-market-briefing-panel";
import type { CreditFinancialConditionsReadModel } from "./credit-financial-conditions";
import { composeFactualMarketBriefing } from "./factual-market-briefing";

const AS_OF = "2026-10-07T11:30:00.000Z";

function change(
  targetAt: string,
  predecessorObservationId: string,
  predecessorValue: number,
  predecessorObservedAt: string,
  predecessorRetrievedAt: string,
  value: number,
) {
  return {
    targetAt,
    predecessorObservationId,
    predecessorValue,
    predecessorObservedAt,
    predecessorRetrievedAt,
    targetGapMs: Date.parse(targetAt) - Date.parse(predecessorObservedAt),
    value,
  };
}

const creditConditions: CreditFinancialConditionsReadModel = {
  status: "OK",
  reason: null,
  series: [
    {
      seriesKey: "BAMLH0A0HYM2",
      observationId: "hy-latest",
      value: 3.12,
      valueUnit: "PERCENT",
      observedAt: "2026-10-05T00:00:00.000Z",
      retrievedAt: "2026-10-06T14:31:04.082Z",
      sourceId: "fred",
      acquisitionQuality: "FRESH",
      freshness: "FRESH",
      change1d: change("2026-10-04T00:00:00.000Z", "hy-1d", 3.10, "2026-10-02T00:00:00.000Z", "2026-10-03T14:00:00.000Z", 2),
      change1w: change("2026-09-28T00:00:00.000Z", "hy-1w", 3.02, "2026-09-28T00:00:00.000Z", "2026-09-29T14:00:00.000Z", 10),
      change4w: change("2026-09-07T00:00:00.000Z", "hy-4w", 3.40, "2026-09-04T00:00:00.000Z", "2026-09-05T14:00:00.000Z", -28),
      changeUnit: "BPS",
    },
    {
      seriesKey: "BAMLC0A0CM",
      observationId: "ig-latest",
      value: 0.84,
      valueUnit: "PERCENT",
      observedAt: "2026-10-05T00:00:00.000Z",
      retrievedAt: "2026-10-06T14:31:02.158Z",
      sourceId: "fred",
      acquisitionQuality: "FRESH",
      freshness: "FRESH",
      change1d: change("2026-10-04T00:00:00.000Z", "ig-1d", 0.85, "2026-10-02T00:00:00.000Z", "2026-10-03T14:00:00.000Z", -1),
      change1w: change("2026-09-28T00:00:00.000Z", "ig-1w", 0.83, "2026-09-28T00:00:00.000Z", "2026-09-29T14:00:00.000Z", 1),
      change4w: change("2026-09-07T00:00:00.000Z", "ig-4w", 0.92, "2026-09-04T00:00:00.000Z", "2026-09-05T14:00:00.000Z", -8),
      changeUnit: "BPS",
    },
    {
      seriesKey: "VIXCLS",
      observationId: "vix-latest",
      value: 15.52,
      valueUnit: "INDEX",
      observedAt: "2026-10-05T00:00:00.000Z",
      retrievedAt: "2026-10-06T14:31:02.771Z",
      sourceId: "fred",
      acquisitionQuality: "FRESH",
      freshness: "FRESH",
      change1d: change("2026-10-04T00:00:00.000Z", "vix-1d", 15.31, "2026-10-02T00:00:00.000Z", "2026-10-03T14:00:00.000Z", 0.21),
      change1w: change("2026-09-28T00:00:00.000Z", "vix-1w", 16.07, "2026-09-28T00:00:00.000Z", "2026-09-29T14:00:00.000Z", -0.55),
      change4w: change("2026-09-07T00:00:00.000Z", "vix-4w", 18, "2026-09-04T00:00:00.000Z", "2026-09-05T14:00:00.000Z", -2.48),
      changeUnit: "INDEX_POINTS",
    },
  ],
};

test("briefing surfaces contract-aligned credit conditions with 4W and retrieval lineage", () => {
  const result = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: AS_OF,
    creditConditions,
  });

  assert.equal(result.creditConditions.evidenceStatus, "AVAILABLE");
  assert.equal(result.creditConditions.reason, null);
  assert.deepEqual(
    result.creditConditions.items.map((item) => item.seriesKey),
    ["BAMLH0A0HYM2", "BAMLC0A0CM", "VIXCLS"],
  );

  const html = renderToStaticMarkup(
    createElement(FactualMarketBriefingPanel, { data: result }),
  );
  assert.match(html, /CREDIT &amp; FINANCIAL CONDITIONS/);
  assert.match(html, /US High Yield OAS/);
  assert.match(html, /US Investment Grade OAS/);
  assert.match(html, /VIX/);
  assert.doesNotMatch(html, /<strong>Kurva Treasury 10Y−2Y<\/strong>/);
  assert.match(html, /4 minggu/);
  assert.match(html, /diperoleh/);
  assert.match(html, /04 Sep 2026/);
  assert.match(html, /diperoleh 06 Okt 2026/);

  const normalized = html.toLowerCase();
  assert.equal(normalized.includes("bullish"), false);
  assert.equal(normalized.includes("bearish"), false);
  assert.equal(normalized.includes("risk-on"), false);
  assert.equal(normalized.includes("risk-off"), false);
});
