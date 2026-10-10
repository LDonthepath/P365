import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UnifiedMacroView } from "./unified-macro-view";
import { RatesInflationPanel } from "./rates-inflation-panel";
import { FactualMarketBriefingPanel } from "./factual-market-briefing-panel";
import { composeFactualMarketBriefing } from "@/lib/application/factual-market-briefing";
import { buildRatesInflationReadModel, type RatesInflationReadModel } from "@/lib/application/rates-inflation";
import { InMemoryObservationRepository } from "@/lib/repositories/memory";
import type { Observation } from "@/lib/domain/types";

(globalThis as typeof globalThis & { React?: typeof React }).React = React;
const asOf = "2026-10-10T01:35:00Z";
async function fixture(): Promise<RatesInflationReadModel> {
  const memory = new InMemoryObservationRepository();
  const rows: Observation[] = [];
  for (const key of ["dxy.index.usd", "DGS2", "DFII10"]) {
    const dxy = key === "dxy.index.usd";
    for (const previous of [false, true]) rows.push({
      id: `${key}-${previous}`, domain: dxy ? "ASSET" : "MACRO", sourceId: dxy ? "yahoo-finance" : "fred",
      subject: key, value: dxy ? previous ? "102.230" : "102.231" : previous ? "4.77" : "4.75",
      observedAt: dxy ? previous ? "2026-10-09T20:56:58Z" : "2026-10-09T20:59:59Z" : previous ? "2026-10-07" : "2026-10-08",
      retrievedAt: "2026-10-09T21:12:00Z", quality: "FRESH", evidenceId: "fixture", metadata: dxy
        ? { metricId: key, symbol: "DX-Y.NYB", unit: "Index", freshnessCalendar: "ICE_USDX" }
        : { seriesId: key, unit: "Percent", frequency: "DAILY" },
    });
  }
  await memory.saveMany(rows);
  return buildRatesInflationReadModel(memory, new Date(asOf));
}

test("three indicators appear together with true sources, units, individual times, values and dates of comparison", async () => {
  const rates = await fixture();
  const html = renderToStaticMarkup(createElement(UnifiedMacroView, { points: rates.unifiedMacro }));
  for (const label of ["Dolar AS (DXY · ICE)", "Treasury AS 2 tahun", "Real yield AS 10 tahun", "Yahoo Finance · DX-Y.NYB", "FRED · DGS2", "FRED · DFII10"]) assert.ok(html.includes(label));
  assert.match(html, /102,231 poin indeks/);
  assert.match(html, /\+0,001 poin indeks/);
  assert.match(html, /102,230 poin indeks/);
  assert.match(html, /4,75%/);
  assert.match(html, /-2,00 bps/);
  assert.match(html, /4,77% · 2026-10-07/);
  assert.match(html, /20\.59\.59 UTC/);
  assert.match(html, /2026-10-08 · tanggal harian FRED/);
  assert.match(html, /Data harian, bukan yield intraday/);
  assert.match(html, /endpoint chart tidak resmi/);
  assert.match(html, /kalender hari libur dan penutupan lebih awal belum dimodelkan/);
  assert.equal((html.match(/data-slot="freshness"[^>]*><\/span>/g) ?? []).length, 3);
  assert.doesNotMatch(html, /-0,42%|bullish|bearish|asOf/);
});

test("Macro and Briefing reuse the shared view without duplicate DFII10 or DGS2 cards within each area", async () => {
  const rates = await fixture();
  const macro = renderToStaticMarkup(createElement(RatesInflationPanel, { data: rates }));
  const briefing = renderToStaticMarkup(createElement(FactualMarketBriefingPanel, { data: composeFactualMarketBriefing({
    baselines: {}, observations: [], asOf, ratesPolicy: rates,
  }) }));
  for (const html of [macro, briefing]) {
    for (const label of ["Dolar AS (DXY · ICE)", "Treasury AS 2 tahun", "Real yield AS 10 tahun"]) {
      assert.equal(html.split(`aria-label="${label}"`).length - 1, 1);
    }
  }
});

test("missing series and predecessor unavailable retain all three slots and explicit gaps", async () => {
  const missing = renderToStaticMarkup(createElement(UnifiedMacroView));
  assert.equal((missing.match(/TIDAK TERSEDIA \/ BELUM TERKUALIFIKASI/g) ?? []).length, 3);
  assert.doesNotMatch(missing, />0,00/);
  const rates = await fixture();
  const points = rates.unifiedMacro!.map((point) => ({ ...point, previous: null, change: null,
    reason: "Observasi valid sebelumnya belum tersedia dalam riwayat yang dibaca." }));
  const html = renderToStaticMarkup(createElement(UnifiedMacroView, { points }));
  assert.equal((html.match(/Perubahan belum tersedia/g) ?? []).length, 3);
  assert.match(html, /Observasi valid sebelumnya belum tersedia/);
});

test("adding unified macro data leaves sections 03–05 markup and navigation anchors unchanged", async () => {
  const base = { baselines: {}, observations: [], asOf };
  const render = (ratesPolicy?: RatesInflationReadModel) => renderToStaticMarkup(createElement(FactualMarketBriefingPanel, {
    data: composeFactualMarketBriefing({ ...base, ratesPolicy }),
  }));
  const without = render(); const withMacro = render(await fixture());
  const suffix = (html: string) => html.slice(html.indexOf('id="briefing-usd-liquidity"'));
  assert.equal(suffix(withMacro), suffix(without));
  for (const anchor of ["briefing-market-state-title", "briefing-rates-policy", "briefing-usd-liquidity", "briefing-credit-conditions", "briefing-macro-background"]) assert.ok(withMacro.includes(`href="#${anchor}"`));
  assert.match(withMacro, /<details class="briefing-rate-details"><summary>Baca metode dan keterbatasan data<\/summary>/);
});
