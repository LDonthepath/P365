import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Observation } from "../domain/types";
import { buildMaterialMoveMonitor, type MaterialMoveAssetReadModel } from "./material-move-monitor";
import { composeFactualMarketBriefing } from "./factual-market-briefing";
import { dominantMaterialMove, marketCurrentSummary } from "../../app/dashboard/briefing-market-current-display";
import { FactualMarketBriefingPanel } from "../../app/dashboard/factual-market-briefing-panel";

(globalThis as typeof globalThis & { React?: typeof React }).React = React;
const END = "2026-10-10T08:00:30Z";
function asset(kind: "BTC" | "GOLD", change: number): MaterialMoveAssetReadModel {
  return {
    asset: kind, seriesKey: kind === "BTC" ? "btc.spot.usd" : "gold.futures.usd",
    sourceId: kind === "BTC" ? "coingecko-market" : "yahoo-finance",
    observedAt: END, observationQuality: "FRESH", marketContext: null,
    status: "MATERIAL_MOVE", hasMaterialMove: true, evidence: null,
    horizons: [{ horizonMinutes: 60, status: "MATERIAL_MOVE", signedPercentChange: change,
      targetStartObservedAt: "2026-10-10T07:00:20Z", targetEndObservedAt: END,
      materialityThresholdPercent: 0.5, targetPercentileRank: 99, historicalSampleSize: 400 }],
    causalAttribution: "NOT_EVALUATED",
  };
}
function briefing(assets: MaterialMoveAssetReadModel[]) {
  return composeFactualMarketBriefing({ observations: [], baselines: {}, asOf: END,
    materialMoveMonitor: { asOf: END, assets, status: "OK", causalAttribution: "NOT_EVALUATED" } });
}
function html(assets: MaterialMoveAssetReadModel[]) {
  return renderToStaticMarkup(React.createElement(FactualMarketBriefingPanel, { data: briefing(assets) }));
}
test("BTC material without a scheduled event produces one signed headline with actual timestamps", () => {
  const data = briefing([asset("BTC", 2.15)]);
  assert.equal(data.nextCatalyst.slot, null);
  assert.match(marketCurrentSummary(data.marketMoves), /BTC naik \+2,15% pada horizon 60 menit/);
  assert.match(marketCurrentSummary(data.marketMoves), /14\.00\.20–10 Okt 2026, 15\.00\.30 WIB/);
  const rendered = html([asset("BTC", 2.15)]);
  assert.equal((rendered.match(/data-testid="dominant-material-move"/g) ?? []).length, 1);
  assert.match(rendered, /Kualitas observasi: terbaru saat diperoleh/);
  assert.match(rendered, /Penyebab belum dinilai/);
});
test("Gold Futures can dominate BTC with accurate identity and negative return", () => {
  const assets = [asset("BTC", 2), asset("GOLD", -3)];
  assert.equal(dominantMaterialMove(briefing(assets).marketMoves)?.item.asset, "GOLD");
  const rendered = html(assets);
  assert.match(rendered, /Emas berjangka COMEX \(GC=F\) turun -3,00% pada horizon 60 menit/);
  assert.match(rendered, /Yahoo Finance · GC=F/);
  assert.match(briefing(assets).resolution.statement, /Emas berjangka COMEX \\(GC=F\\) mengalami pergerakan material/);
  assert.doesNotMatch(rendered, /XAU\/USD Spot|Gold Spot/);
  assert.equal((rendered.match(/data-testid="dominant-material-move"/g) ?? []).length, 1);
});
test("horizon selection uses material absolute return; equal returns prefer longer horizon then BTC", () => {
  const btc = asset("BTC", 2);
  btc.horizons.push({ ...btc.horizons[0], horizonMinutes: 120, targetStartObservedAt: "2026-10-10T06:00:25Z", signedPercentChange: -2 });
  btc.horizons.push({ ...btc.horizons[0], horizonMinutes: 15, status: "BELOW_MATERIALITY_THRESHOLD", signedPercentChange: 99 });
  const gold = asset("GOLD", -2);
  gold.horizons = [{ ...gold.horizons[0], horizonMinutes: 120, targetStartObservedAt: "2026-10-10T06:00:20Z" }];
  for (const assets of [[gold, btc], [btc, gold]]) {
    const selected = dominantMaterialMove(briefing(assets).marketMoves)!;
    assert.equal(selected.item.asset, "BTC");
    assert.equal(selected.horizon.horizonMinutes, 120);
    assert.equal(selected.signedPercentChange, -2);
    assert.equal(selected.startAt, "2026-10-10T06:00:25Z");
  }
  btc.horizons.reverse();
  assert.equal(dominantMaterialMove(briefing([btc, gold]).marketMoves)?.horizon.horizonMinutes, 120);
});
test("missing/invalid start timestamp cannot be fabricated from horizon or investigation window", () => {
  for (const start of [undefined, "invalid", END]) {
    const btc = asset("BTC", 2);
    btc.horizons[0].targetStartObservedAt = start;
    assert.equal(dominantMaterialMove(briefing([btc]).marketMoves), null);
    assert.match(marketCurrentSummary(briefing([btc]).marketMoves), /rincian pengukuran belum lengkap/);
  }
});
test("non-material assessments preserve insufficient, unknown, unavailable and below threshold distinctly", () => {
  for (const [status, expected] of [
    ["INSUFFICIENT_DATA", "data belum cukup"], ["UNKNOWN", "belum dapat dipastikan"],
    ["UNAVAILABLE", "observasi tidak tersedia"], ["INCOMPATIBLE", "tidak kompatibel"],
    ["BELOW_MATERIALITY_THRESHOLD", "di bawah ambang materialitas"],
  ] as const) {
    const btc = { ...asset("BTC", 2), status, hasMaterialMove: false };
    const summary = marketCurrentSummary(briefing([btc]).marketMoves);
    assert.match(summary, new RegExp(expected));
    assert.doesNotMatch(summary, /normal|Tidak ada pergerakan/);
    assert.equal(dominantMaterialMove(briefing([btc]).marketMoves), null);
  }
  const below = [asset("BTC", 0.1), asset("GOLD", 0.1)].map(a => ({ ...a, status: "BELOW_MATERIALITY_THRESHOLD" as const, hasMaterialMove: false }));
  assert.match(marketCurrentSummary(briefing(below).marketMoves), /Tidak ada pergerakan intraday material/);
  assert.match(marketCurrentSummary(briefing([]).marketMoves), /belum tersedia/);
});
test("eligible BTC survives unavailable Gold; evidence completeness stays factual", () => {
  const btc = asset("BTC", 1);
  const gold = { ...asset("GOLD", 3), status: "UNAVAILABLE" as const, hasMaterialMove: false };
  assert.equal(dominantMaterialMove(briefing([gold, btc]).marketMoves)?.item.asset, "BTC");
  for (const [state, label] of [["EVIDENCE_INCOMPLETE", "Bukti pendukung belum lengkap"], ["EVIDENCE_COMPLETE", "Bukti lengkap"]] as const) {
    btc.evidence = { evidenceCompleteness: state } as NonNullable<typeof btc.evidence>;
    assert.match(marketCurrentSummary(briefing([btc]).marketMoves), new RegExp(label));
    assert.match(marketCurrentSummary(briefing([btc]).marketMoves), /Penyebab belum dinilai/);
  }
});
test("partial non-material assessments cannot become a negative conclusion for both markets", () => {
  const btc = { ...asset("BTC", 0.1), status: "BELOW_MATERIALITY_THRESHOLD" as const, hasMaterialMove: false };
  for (const status of ["INSUFFICIENT_DATA", "UNKNOWN", "UNAVAILABLE", "INCOMPATIBLE"] as const) {
    const gold = { ...asset("GOLD", 0), status, hasMaterialMove: false };
    assert.equal(briefing([btc, gold]).resolution.status, "MARKET_DATA_INSUFFICIENT");
    assert.doesNotMatch(briefing([btc, gold]).resolution.statement, /Belum ada pergerakan material Bitcoin atau Emas berjangka COMEX/);
  }
  assert.equal(briefing([btc]).resolution.status, "MARKET_DATA_INSUFFICIENT");
});
test("real detector → monitor → briefing keeps exact endpoints and introduces no reads in composition/render", async () => {
  const end = Date.parse(END);
  const rows: Observation[] = Array.from({ length: 481 }, (_, i) => {
    const at = new Date(end - (480 - i) * 300_000).toISOString();
    return { id: `btc-${i}`, domain: "ASSET", subject: "BTC", value: String(i === 480 ? 110 : 100 + i * 0.001),
      observedAt: at, retrievedAt: at, sourceId: "coingecko-market", quality: "FRESH", evidenceId: `e-${i}`,
      metadata: { metricId: "btc.spot.usd", unit: "USD", frequency: "5m" } };
  });
  const reads: number[] = [];
  let targetReads = 0;
  let eventReads = 0;
  const monitor = await buildMaterialMoveMonitor({ asOf: END,
    observations: { async findHistory(query) {
      reads.push(query.limit ?? 0);
      if (query.limit === 1 && ["btc.spot.usd", "gold.futures.usd"].includes(query.identity.seriesKey)) targetReads++;
      if (query.identity.seriesKey !== "btc.spot.usd") return [];
      return rows.filter(row => (!query.observedAtOnOrBefore || row.observedAt <= query.observedAtOnOrBefore)
        && (!query.observedAtOnOrAfter || row.observedAt >= query.observedAtOnOrAfter))
        .sort((a,b) => query.order === "ASC" ? a.observedAt.localeCompare(b.observedAt) : b.observedAt.localeCompare(a.observedAt)).slice(0, query.limit);
    } }, events: { async findHistory() { eventReads++; return []; } }, evidence: { async findHistory() { return []; } },
  });
  const btc = monitor.assets[0];
  assert.equal(btc.status, "MATERIAL_MOVE");
  assert.equal(btc.observationQuality, "FRESH");
  assert.equal(btc.horizons[3].targetStartObservedAt, rows[456].observedAt);
  assert.equal(btc.horizons[3].targetEndObservedAt, rows[480].observedAt);
  // Existing ownership: two latest-target reads, four detector history reads, bundle reads unchanged.
  assert.equal(targetReads, 2);
  const priorReads = reads.length;
  const data = composeFactualMarketBriefing({ observations: [], baselines: {}, asOf: END, materialMoveMonitor: monitor });
  const selected = dominantMaterialMove(data.marketMoves)!;
  assert.equal(selected.startAt, btc.horizons.find(h => h.horizonMinutes === selected.horizon.horizonMinutes)!.targetStartObservedAt);
  renderToStaticMarkup(React.createElement(FactualMarketBriefingPanel, { data }));
  assert.equal(reads.length, priorReads);
  assert.equal(eventReads, 1);
  assert.equal(monitor.assets[1].status, "UNAVAILABLE");
});
test("sections 02–05 and existing details remain identical when dominant headline changes", () => {
  const material = html([asset("BTC", 2)]);
  const insufficient = html([{ ...asset("BTC", 2), status: "INSUFFICIENT_DATA", hasMaterialMove: false }]);
  const suffix = (s: string) => s.slice(s.indexOf('<div class="briefing-analysis-section briefing-primary-step"'), s.indexOf('<details class="briefing-analysis-details"', s.indexOf('<div class="briefing-analysis-section briefing-primary-step"')));
  assert.equal(suffix(material), suffix(insufficient));
  assert.match(material, /<details class="briefing-analysis-details"><summary>/);
  assert.match(material, /Buka rincian/);
});
