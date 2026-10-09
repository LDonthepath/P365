import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FactualMarketBriefingPanel } from "./factual-market-briefing-panel";
import { composeFactualMarketBriefing } from "@/lib/application/factual-market-briefing";
import type { RatesInflationReadModel, RatesSeriesPoint } from "@/lib/application/rates-inflation";

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

const point = (overrides: Partial<RatesSeriesPoint>): RatesSeriesPoint => ({
  seriesKey: "DFII10",
  value: 2.92,
  valueUnit: "PERCENT",
  observedAt: "2026-10-08",
  retrievedAt: "2026-10-09T10:00:00.000Z",
  quality: "FRESH",
  cadence: "DAILY",
  change1d: 2.3,
  change1dFrom: "2026-10-07",
  change1w: 5,
  change1wFrom: "2026-10-01",
  changeUnit: "BPS",
  ...overrides,
});

test("Bagian 02 menampilkan empat kartu faktual, pembanding, tanggal, dan penjelasan lipat", () => {
  const ratesPolicy: RatesInflationReadModel = {
    status: "OK",
    sep: { status: "UNAVAILABLE", reason: "Tidak ada data SEP pada fixture." },
    series: [
      point({ seriesKey: "DFII10" }),
      point({ seriesKey: "DTWEXBGS", value: 121.3848, valueUnit: "INDEX", change1d: -0.61, change1w: 0.73, changeUnit: "PERCENT" }),
      point({ seriesKey: "WRESBAL", value: 2948.1, valueUnit: "USD_BILLIONS", cadence: "WEEKLY", change1d: null, change1dFrom: null, change1w: 48.1, change1wFrom: "2026-10-01", changeUnit: "USD_BILLIONS" }),
      point({ seriesKey: "SOFR_IORB_SPREAD", value: -2, valueUnit: "BPS", change1d: 0.5, change1w: -1.2, changeUnit: "BPS", quality: "PARTIAL" }),
    ],
  };
  const data = composeFactualMarketBriefing({
    baselines: {}, observations: [], asOf: "2026-10-09T10:00:00.000Z", ratesPolicy,
  });
  const html = renderToStaticMarkup(createElement(FactualMarketBriefingPanel, { data }));
  assert.ok(html.includes("02 · Apa konteks suku bunga dan kebijakan untuk Gold dan Bitcoin?"));
  const start = html.indexOf('id="briefing-rates-policy"');
  const end = html.indexOf('id="briefing-usd-liquidity"');
  const section = html.slice(start, end);

  for (const label of ["Real yield AS 10 tahun", "Broad USD Index", "Reserve balances", "Spread SOFR−IORB"]) {
    assert.ok(section.includes(label), `${label} tampil di Bagian 02`);
  }
  assert.match(section, /2,92%/);
  assert.match(section, /\+2,3 bps/);
  assert.match(section, /-0,61%/);
  assert.match(section, /2.948,1 miliar USD/);
  assert.match(section, /Observasi 08 Okt 2026/);
  assert.doesNotMatch(section, /TERBARU SAAT DIPEROLEH|SUDAH LAMA SAAT DIPEROLEH|SEGAR|TERTUNDA|USANG/);
  assert.match(section, /Data sebagian/);
  assert.match(section, /Apa artinya:/);
  assert.match(section, /<details class="briefing-rate-details">/);
  assert.match(section, /Biaya funding overnight berjaminan/);
  assert.doesNotMatch(section, /SEGAR|TERTUNDA|USANG|<svg|Grafik/);
});
