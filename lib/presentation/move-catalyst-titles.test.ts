import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FactualMarketBriefingPanel } from "../../app/dashboard/factual-market-briefing-panel";
import { MaterialMoveMonitorPanel } from "../../app/dashboard/material-move-monitor-panel";
import { composeFactualMarketBriefing } from "../application/factual-market-briefing";
import type { MaterialMoveMonitorReadModel } from "../application/material-move-monitor";
import { screenMoveCatalystTitles } from "./move-catalyst-titles";

const AS_OF = "2026-10-06T20:00:00.000Z";
function monitor(titles: string[], coverage: "COMPLETE" | "PARTIAL" = "COMPLETE"): MaterialMoveMonitorReadModel {
  return {
    asOf: AS_OF, status: "OK", causalAttribution: "NOT_EVALUATED",
    assets: [{
      asset: "BTC", seriesKey: "btc.spot.usd", sourceId: "coingecko-market",
      observedAt: AS_OF,
      marketContext: {
        currentValue: 84250,
        valueUnit: "USD",
        changePercent: 3.1,
        changeBasis: "ROLLING_24H",
      },
      status: "MATERIAL_MOVE", hasMaterialMove: true,
      horizons: [{
        horizonMinutes: 120,
        status: "MATERIAL_MOVE",
        signedPercentChange: 1.6,
        materialityThresholdPercent: 1.1,
        targetPercentileRank: 98.2,
        historicalSampleSize: 410,
      }], causalAttribution: "NOT_EVALUATED",
      evidence: {
        evidenceCompleteness: "EVIDENCE_INCOMPLETE",
        investigationWindow: { startAt: "2026-10-06T19:00:00.000Z", endAt: AS_OF },
        synchronousCoverage: "PARTIAL", synchronousFingerprint: [],
        scheduledCatalystCount: 0, scheduledCatalystCoverage: "COMPLETE", scheduledCatalysts: [],
        unscheduledCandidateCount: titles.length, unscheduledCatalystCoverage: coverage,
        unscheduledCandidates: titles.map((title, index) => ({
          title, url: `https://example.com/${index}`, domain: "example.com",
          providerDate: null, providerDateSemantics: "TIMESTAMP_UNAVAILABLE",
          temporalFit: "TIMESTAMP_UNAVAILABLE", firstSeenRetrievedAt: AS_OF,
          firstSnapshotEvidenceId: "snapshot-1",
        })),
        slowBackground: { state: "INSUFFICIENT_DATA", items: [] },
        cryptoMarketStructure: null, btcSpotFlow: null,
        intradayRatesPricing: {
          state: "MISSING_HIGH_VALUE_EVIDENCE", reason: "No approved free source",
          policy: "FREE_ONLY_NO_APPROVED_RUNTIME",
        },
      },
    }],
  };
}

function renderBriefing(data: MaterialMoveMonitorReadModel): string {
  return renderToStaticMarkup(createElement(FactualMarketBriefingPanel, { data: composeFactualMarketBriefing({
    baselines: {}, observations: [], asOf: AS_OF, materialMoveMonitor: data,
  }) }));
}

test("display projection preserves candidate order, timestamps, lineage and raw evidence", () => {
  const candidates = Object.freeze([
    Object.freeze({ title: "Best crypto to buy", retrievedAt: AS_OF, evidenceId: "promo" }),
    Object.freeze({ title: "SEC warns about guaranteed returns", retrievedAt: AS_OF, evidenceId: "risk" }),
    Object.freeze({ title: "Bitcoin ETF inflows rise", retrievedAt: AS_OF, evidenceId: "news" }),
  ]);
  const before = JSON.stringify(candidates);
  const result = screenMoveCatalystTitles(candidates, "BTC");
  assert.equal(result.excludedTitleCount, 1);
  assert.deepEqual(result.items, candidates.slice(1));
  assert.equal(result.items[0], candidates[1]);
  assert.equal(JSON.stringify(candidates), before);
});

test("asset-specific collisions and unknown wording reuse the wire rules", () => {
  assert.equal(screenMoveCatalystTitles([{ title: "Bitcoin Cash price rises" }], "BTC").items.length, 0);
  assert.equal(screenMoveCatalystTitles([{ title: "Gold drilling results" }], "GOLD").items.length, 0);
  assert.equal(screenMoveCatalystTitles([{ title: "Bullion rises as drilling results arrive" }], "GOLD").items.length, 1);
  assert.equal(screenMoveCatalystTitles([{ title: "Harga emas bergerak hari ini" }], "GOLD").items.length, 1);
});

test("briefing screens before its detail limit and counts only eligible overflow", () => {
  const data = monitor(["Best crypto to buy", "Bitcoin report A", "Bitcoin report B", "Bitcoin report C", "Bitcoin report D"]);
  const before = JSON.stringify(data);
  const html = renderBriefing(data);
  assert.ok(!html.includes("Best crypto to buy"));
  assert.ok(html.includes("Bitcoin report C"));
  assert.ok(!html.includes("Bitcoin report D"));
  assert.ok(html.includes("5 kandidat berita tercatat"));
  assert.ok(html.includes("1 judul promosi/topik lain tersaring"));
  assert.ok(html.includes("+1 kandidat berita lain untuk ditampilkan"));
  assert.ok(html.includes("waktu publikasi provider tidak tersedia"));
  assert.equal(JSON.stringify(data), before);
});

test("all-screened candidates do not become missing coverage or zero raw candidates", () => {
  for (const coverage of ["COMPLETE", "PARTIAL"] as const) {
    const data = monitor(["Best crypto to buy"], coverage);
    const html = renderBriefing(data);
    assert.ok(html.includes("USD 84.250"));
    assert.ok(html.includes("+3.10% / 24 jam"));
    assert.ok(html.includes("Pergerakan intraday tidak biasa terdeteksi."));
    assert.ok(html.includes("DETAIL PERGERAKAN &amp; EVIDENCE"));
    assert.ok(html.includes("120 menit"));
    assert.ok(html.includes("1 kandidat berita tercatat"));
    assert.ok(html.includes("Tidak ada judul yang ditampilkan setelah penyaringan"));
    assert.ok(!html.includes("+1 kandidat berita lain"));
    assert.ok(html.includes(coverage === "COMPLETE" ? "Catalyst berita: TERSEDIA" : "Catalyst berita: TERSEDIA SEBAGIAN"));
    const card = renderToStaticMarkup(createElement(MaterialMoveMonitorPanel, { data }));
    assert.ok(card.includes("84.250 USD"));
    assert.ok(card.includes("+3.10% / 24 jam"));
    assert.ok(card.includes("Pergerakan intraday tidak biasa terdeteksi."));
    assert.ok(card.includes("Detail detektor intraday"));
    assert.ok(card.includes("120M"));
    assert.ok(card.includes("Kandidat berita tercatat</span><strong>1</strong>"));
    assert.ok(card.includes("1 judul promosi/topik lain tersaring dari tampilan briefing"));
    assert.equal(data.assets[0].evidence?.unscheduledCatalystCoverage, coverage);
    assert.equal(data.assets[0].evidence?.evidenceCompleteness, "EVIDENCE_INCOMPLETE");
    assert.equal(data.causalAttribution, "NOT_EVALUATED");
  }
});


test("Gold uses previous-close market context instead of pretending to have a 24-hour crypto session", () => {
  const data = monitor([]);
  data.assets[0] = {
    ...data.assets[0],
    asset: "GOLD",
    seriesKey: "gold.futures.usd",
    sourceId: "yahoo-finance",
    marketContext: {
      currentValue: 4149.4,
      valueUnit: "USD",
      changePercent: -0.9,
      changeBasis: "PREVIOUS_CLOSE",
    },
    status: "BELOW_MATERIALITY_THRESHOLD",
    hasMaterialMove: false,
    horizons: [{
      horizonMinutes: 120,
      status: "BELOW_MATERIALITY_THRESHOLD",
      signedPercentChange: -0.35,
      materialityThresholdPercent: 0.8,
      targetPercentileRank: 62,
      historicalSampleSize: 405,
    }],
    evidence: null,
  };

  const briefing = renderBriefing(data);
  const card = renderToStaticMarkup(createElement(MaterialMoveMonitorPanel, { data }));

  assert.ok(briefing.includes("USD 4.149,40"));
  assert.ok(briefing.includes("-0.90% vs penutupan sebelumnya"));
  assert.ok(briefing.includes("Tidak ada pergerakan intraday material pada cutoff ini."));
  assert.ok(card.includes("4.149,40 USD"));
  assert.ok(card.includes("-0.90% vs penutupan sebelumnya"));
  assert.ok(card.includes("Detail detektor intraday"));
});
