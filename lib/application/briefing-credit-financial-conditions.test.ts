import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { createElement } from "react";

(globalThis as typeof globalThis & { React?: typeof React }).React = React;
import { renderToStaticMarkup } from "react-dom/server";
import { FactualMarketBriefingPanel } from "../../app/dashboard/factual-market-briefing-panel";
import type { CreditFinancialConditionsReadModel } from "./credit-financial-conditions";
import { composeFactualMarketBriefing } from "./factual-market-briefing";
import type { RatesInflationReadModel } from "./rates-inflation";

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


const ratesPolicy: RatesInflationReadModel = {
  status: "OK",
  sep: { status: "UNAVAILABLE", reason: "SEP tidak diperlukan untuk fixture ini." },
  series: [
    {
      seriesKey: "DFII10",
      value: 2.92,
      valueUnit: "PERCENT",
      observedAt: "2026-10-02",
      retrievedAt: "2026-10-05T20:00:00.000Z",
      quality: "FRESH",
      cadence: "DAILY",
      change1d: 4,
      change1dFrom: "2026-10-01",
      change1w: 5,
      change1wFrom: "2026-09-25",
      changeUnit: "BPS",
    },
    {
      seriesKey: "DTWEXBGS",
      value: 121.3848,
      valueUnit: "INDEX",
      observedAt: "2026-10-02",
      retrievedAt: "2026-10-05T20:00:00.000Z",
      quality: "FRESH",
      cadence: "DAILY",
      change1d: -0.33,
      change1dFrom: "2026-10-01",
      change1w: 0.73,
      change1wFrom: "2026-09-25",
      changeUnit: "PERCENT",
    },
    {
      seriesKey: "WRESBAL",
      value: 2948.09,
      valueUnit: "USD_BILLIONS",
      observedAt: "2026-09-30",
      retrievedAt: "2026-10-01T21:00:00.000Z",
      quality: "FRESH",
      cadence: "WEEKLY",
      change1d: null,
      change1dFrom: null,
      change1w: 48.09,
      change1wFrom: "2026-09-23",
      changeUnit: "USD_BILLIONS",
    },
    {
      seriesKey: "SOFR_IORB_SPREAD",
      value: -2,
      valueUnit: "BPS",
      observedAt: "2026-10-02",
      retrievedAt: "2026-10-05T12:00:00.000Z",
      quality: "FRESH",
      cadence: "DAILY",
      change1d: 1,
      change1dFrom: "2026-10-01",
      change1w: -2,
      change1wFrom: "2026-09-25",
      changeUnit: "BPS",
    },
  ],
};

test("briefing explains factual rates and credit changes using release-frequency-aware primary comparisons", () => {
  const result = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: AS_OF,
    ratesPolicy,
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
  assert.match(html, /04 · Apa yang berubah pada kredit dan volatilitas\?/);
  assert.match(html, /aria-label="US High Yield OAS"/);
  assert.match(html, /3,12%/);
  assert.match(html, /Observasi 05 Okt 2026/);
  assert.match(html, /TERBARU SAAT DIPEROLEH/);
  assert.match(html, /<details class="briefing-rate-details">/);
  assert.match(html, /US High Yield OAS/);
  assert.match(html, /US Investment Grade OAS/);
  assert.match(html, /VIX/);
  assert.doesNotMatch(html, /<strong>Kurva Treasury 10Y−2Y<\/strong>/);
  assert.match(html, /Dibanding observasi harian sebelumnya/);
  assert.match(html, /observasi mingguan sebelumnya · 23 Sep 2026/);
  assert.match(html, /Apa artinya:/);
  assert.match(html, /Spread high-yield melebar/);
  assert.match(html, /Real yield AS 10 tahun naik/);
  assert.match(html, /Reserve balances bertambah/);
  assert.doesNotMatch(html, /cadence/i);
  const creditSection = html.slice(html.indexOf('id="briefing-credit-conditions"'), html.indexOf('id="briefing-macro-background"'));
  assert.doesNotMatch(creditSection, /4 minggu/);
  assert.match(html, /diperoleh/);
  assert.match(html, /diperoleh 06 Okt 2026/);

  const normalized = html.toLowerCase();
  assert.equal(normalized.includes("bullish"), false);
  assert.equal(normalized.includes("bearish"), false);
  assert.equal(normalized.includes("risk-on"), false);
  assert.equal(normalized.includes("risk-off"), false);
});

test("weekly Chicago Fed financial indexes render factual 1W context rather than fake daily delta", () => {
  const weeklyIndexes: CreditFinancialConditionsReadModel = {
    status: "OK",
    reason: null,
    series: [
      {
        ...creditConditions.series[2],
        seriesKey: "NFCI",
        observationId: "nfci-latest",
        value: -0.494,
        observedAt: "2026-10-02",
        change1d: null,
        change1w: change("2026-09-25T00:00:00.000Z", "nfci-prior", -0.51, "2026-09-25", "2026-09-30T13:00:00.000Z", 0.016),
        change4w: null,
      },
      {
        ...creditConditions.series[2],
        seriesKey: "ANFCI",
        observationId: "anfci-latest",
        value: -0.504,
        observedAt: "2026-10-02",
        change1d: null,
        change1w: change("2026-09-25T00:00:00.000Z", "anfci-prior", -0.524, "2026-09-25", "2026-09-30T13:00:00.000Z", 0.02),
        change4w: null,
      },
    ],
  };
  const result = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: AS_OF,
    creditConditions: weeklyIndexes,
  });
  const html = renderToStaticMarkup(createElement(FactualMarketBriefingPanel, { data: result }));
  const section = html.slice(html.indexOf('id="briefing-credit-conditions"'), html.indexOf('id="briefing-macro-background"'));
  assert.match(section, /Chicago Fed NFCI/);
  assert.match(section, /Chicago Fed ANFCI/);
  assert.match(section, /observasi mingguan sebelumnya/);
  assert.match(section, /kondisi finansial AS menjadi relatif lebih ketat/);
  assert.doesNotMatch(section, /observasi harian sebelumnya/);
  assert.doesNotMatch(section, /0,49%|0,50%/);
  assert.doesNotMatch(section, /risk-on|risk-off|bullish|bearish/);
});
