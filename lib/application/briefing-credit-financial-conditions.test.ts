import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FactualMarketBriefingPanel } from "../../app/dashboard/factual-market-briefing-panel";
import type { CreditFinancialConditionsReadModel } from "./credit-financial-conditions";
import { composeFactualMarketBriefing } from "./factual-market-briefing";

const AS_OF = "2026-10-07T11:30:00.000Z";

const creditConditions: CreditFinancialConditionsReadModel = {
  status: "OK",
  reason: null,
  series: [
    {
      seriesKey: "BAMLH0A0HYM2",
      value: 3.12,
      valueUnit: "PERCENT",
      observedAt: "2026-10-05T00:00:00.000Z",
      retrievedAt: "2026-10-06T14:31:04.082Z",
      sourceId: "fred",
      quality: "FRESH",
      change1d: -6,
      change1dFrom: "2026-10-02T00:00:00.000Z",
      change1w: -16,
      change1wFrom: "2026-09-28T00:00:00.000Z",
      changeUnit: "BPS",
    },
    {
      seriesKey: "BAMLC0A0CM",
      value: 0.84,
      valueUnit: "PERCENT",
      observedAt: "2026-10-05T00:00:00.000Z",
      retrievedAt: "2026-10-06T14:31:02.158Z",
      sourceId: "fred",
      quality: "FRESH",
      change1d: -2,
      change1dFrom: "2026-10-02T00:00:00.000Z",
      change1w: -4,
      change1wFrom: "2026-09-28T00:00:00.000Z",
      changeUnit: "BPS",
    },
    {
      seriesKey: "VIXCLS",
      value: 15.52,
      valueUnit: "INDEX",
      observedAt: "2026-10-05T00:00:00.000Z",
      retrievedAt: "2026-10-06T14:31:02.771Z",
      sourceId: "fred",
      quality: "FRESH",
      change1d: -0.68,
      change1dFrom: "2026-10-02T00:00:00.000Z",
      change1w: -1.58,
      change1wFrom: "2026-09-28T00:00:00.000Z",
      changeUnit: "INDEX_POINTS",
    },
    {
      seriesKey: "T10Y2Y",
      value: 0.48,
      valueUnit: "PERCENT",
      observedAt: "2026-10-06T00:00:00.000Z",
      retrievedAt: "2026-10-06T21:31:03.503Z",
      sourceId: "fred",
      quality: "FRESH",
      change1d: 3,
      change1dFrom: "2026-10-05T00:00:00.000Z",
      change1w: 9,
      change1wFrom: "2026-09-29T00:00:00.000Z",
      changeUnit: "BPS",
    },
  ],
};

test("briefing surfaces factual credit conditions without higher-order labels", () => {
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
    ["BAMLH0A0HYM2", "BAMLC0A0CM", "VIXCLS", "T10Y2Y"],
  );

  const html = renderToStaticMarkup(
    createElement(FactualMarketBriefingPanel, { data: result }),
  );
  assert.match(html, /CREDIT &amp; FINANCIAL CONDITIONS/);
  assert.match(html, /US High Yield OAS/);
  assert.match(html, /US Investment Grade OAS/);
  assert.match(html, /VIX/);
  assert.match(html, /Kurva Treasury 10Y−2Y/);

  const normalized = html.toLowerCase();
  assert.equal(normalized.includes("bullish"), false);
  assert.equal(normalized.includes("bearish"), false);
  assert.equal(normalized.includes("risk-on"), false);
  assert.equal(normalized.includes("risk-off"), false);
});
