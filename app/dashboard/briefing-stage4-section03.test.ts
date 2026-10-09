import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { composeFactualMarketBriefing, type FactualMarketBriefing } from "@/lib/application/factual-market-briefing";
import { FactualMarketBriefingPanel } from "./factual-market-briefing-panel";

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

test("Bagian 03 menampilkan proxy, pembanding agregat, komponen, dan batas makna", () => {
  const base = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: "2026-10-09T10:00:00.000Z",
  });
  const data = {
    ...base,
    netLiquidity: {
      evidenceStatus: "AVAILABLE",
      reasoningStatus: "NOT_EVALUATED",
      latest: {
        asOf: "2026-10-08T00:00:00.000Z",
        valueBillionsUsd: 1234.5,
        fedAssetsBillionsUsd: 6720.1,
        treasuryCashBillionsUsd: 812.3,
        reverseRepoBillionsUsd: 4673.3,
        quality: "FRESH",
      },
      change1wBillionsUsd: 5.5,
      change1wFrom: "2026-10-01T00:00:00.000Z",
      change4wBillionsUsd: -12.3,
      change4wFrom: "2026-09-10T00:00:00.000Z",
      reason: null,
    },
  } as FactualMarketBriefing;
  const html = renderToStaticMarkup(createElement(FactualMarketBriefingPanel, { data }));
  const start = html.indexOf('id="briefing-usd-liquidity-title"');
  const end = html.indexOf('id="briefing-credit-conditions"', start);
  const section = html.slice(start, end);

  assert.ok(section.includes("03 · Apa yang berubah pada likuiditas dolar AS?"));
  assert.ok(section.includes("Net Liquidity (proxy)"));
  assert.ok(section.includes("5,5 miliar USD"));
  assert.ok(section.includes("1 minggu dibanding data sampai 01 Okt 2026"));
  assert.ok(section.includes("4 minggu: -12,3 miliar USD"));
  assert.ok(section.includes("Aset Federal Reserve"));
  assert.ok(section.includes("Kas Treasury (TGA)"));
  assert.ok(section.includes("Reverse repo (RRP)"));
  assert.ok(section.includes("perubahan tiap komponen tidak tersedia"));
  assert.ok(section.includes("bukan ukuran arus dana langsung ke Bitcoin"));
  assert.equal((section.match(/data-slot="freshness"/g) ?? []).length, 4);
});

test("Bagian 04 memakai formatter id-ID dan hanya membandingkan field kredit yang tersedia", () => {
  const base = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: "2026-10-09T10:00:00.000Z",
  });
  const creditConditions = {
    evidenceStatus: "AVAILABLE",
    reasoningStatus: "NOT_EVALUATED",
    reason: null,
    items: [
      {
        seriesKey: "BAMLH0A0HYM2", observationId: "hy-now", value: 7.23, valueUnit: "PERCENT",
        observedAt: "2026-10-08", retrievedAt: "2026-10-09T10:00:00.000Z", sourceId: "FRED",
        acquisitionQuality: "FRESH", freshness: "FRESH", changeUnit: "BPS",
        change1d: { targetAt: "2026-10-08T00:00:00.000Z", predecessorObservationId: "hy-day", predecessorValue: 7.096, predecessorObservedAt: "2026-10-07", predecessorRetrievedAt: "2026-10-08T10:00:00.000Z", targetGapMs: 86400000, value: 13.4 },
        change1w: { targetAt: "2026-10-08T00:00:00.000Z", predecessorObservationId: "hy-week", predecessorValue: 6.998, predecessorObservedAt: "2026-10-01", predecessorRetrievedAt: "2026-10-02T10:00:00.000Z", targetGapMs: 604800000, value: 23.2 },
        change4w: null,
      },
      {
        seriesKey: "BAMLC0A0CM", observationId: "ig-now", value: 1.19, valueUnit: "PERCENT",
        observedAt: "2026-10-08", retrievedAt: "2026-10-09T10:00:00.000Z", sourceId: "FRED",
        acquisitionQuality: "FRESH", freshness: "FRESH", changeUnit: "BPS",
        change1d: { targetAt: "2026-10-08T00:00:00.000Z", predecessorObservationId: "ig-day", predecessorValue: 1.201, predecessorObservedAt: "2026-10-07", predecessorRetrievedAt: "2026-10-08T10:00:00.000Z", targetGapMs: 86400000, value: -1.1 },
        change1w: null,
        change4w: { targetAt: "2026-10-08T00:00:00.000Z", predecessorObservationId: "ig-month", predecessorValue: 1.22, predecessorObservedAt: "2026-09-10", predecessorRetrievedAt: "2026-09-11T10:00:00.000Z", targetGapMs: 2419200000, value: -3 },
      },
      {
        seriesKey: "VIXCLS", observationId: "vix-now", value: 18.4, valueUnit: "INDEX",
        observedAt: "2026-10-08", retrievedAt: "2026-10-09T10:00:00.000Z", sourceId: "FRED",
        acquisitionQuality: "FRESH", freshness: "FRESH", changeUnit: "INDEX_POINTS",
        change1d: { targetAt: "2026-10-08T00:00:00.000Z", predecessorObservationId: "vix-day", predecessorValue: 17.2, predecessorObservedAt: "2026-10-07", predecessorRetrievedAt: "2026-10-08T10:00:00.000Z", targetGapMs: 86400000, value: 1.2 },
        change1w: { targetAt: "2026-10-08T00:00:00.000Z", predecessorObservationId: "vix-week", predecessorValue: 18.8, predecessorObservedAt: "2026-10-01", predecessorRetrievedAt: "2026-10-02T10:00:00.000Z", targetGapMs: 604800000, value: -0.4 },
        change4w: null,
      },
    ],
  };
  const data = { ...base, creditConditions } as FactualMarketBriefing;
  const html = renderToStaticMarkup(createElement(FactualMarketBriefingPanel, { data }));
  const start = html.indexOf('id="briefing-credit-conditions-title"');
  const end = html.indexOf('id="briefing-macro-background"', start);
  const section = html.slice(start, end);

  assert.ok(section.includes("04 · Apa perubahan pada kredit dan kondisi keuangan?"));
  assert.ok(section.includes("Spread obligasi berperingkat rendah (HY OAS)"));
  assert.ok(section.includes("Spread obligasi investment-grade (IG OAS)"));
  assert.ok(section.includes("VIX · indeks volatilitas saham AS"));
  assert.ok(section.includes("7,23%"));
  assert.ok(section.includes("1,19%"));
  assert.ok(section.includes("18,40"));
  assert.ok(section.includes("+13,4 bps"));
  assert.ok(section.includes("1 hari dibanding observasi 07 Okt 2026"));\n  assert.ok(section.includes("1 minggu: +23,2 bps dibanding observasi 01 Okt 2026"));
  assert.ok(section.includes("4 minggu: -3,0 bps dibanding observasi 10 Sep 2026"));
  assert.equal((section.match(/<details class="briefing-rate-details">/g) ?? []).length, 3);
  assert.doesNotMatch(section, /FRESH|STALE|SEGAR|TERTUNDA|USANG|MOVE/);
  assert.doesNotMatch(section, /<svg|Grafik/);
});
