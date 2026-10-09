import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

import { FactualMarketBriefingPanel } from "../../app/dashboard/factual-market-briefing-panel";
import { composeFactualMarketBriefing } from "./factual-market-briefing";
import type { NetLiquidityReadModel } from "./net-liquidity";

const AS_OF = "2026-10-07T14:30:00.000Z";

const netLiquidity: NetLiquidityReadModel = {
  status: "OK",
  latest: {
    asOf: "2026-10-01T00:00:00.000Z",
    valueBillionsUsd: 6225.4,
    fedAssetsBillionsUsd: 6587.2,
    treasuryCashBillionsUsd: 350.1,
    reverseRepoBillionsUsd: 11.7,
    quality: "FRESH",
  },
  change1wBillionsUsd: 42.6,
  change1wFrom: "2026-09-24T00:00:00.000Z",
  change4wBillionsUsd: -18.4,
  change4wFrom: "2026-09-03T00:00:00.000Z",
  history: [],
};

test("briefing explains Net Liquidity with weekly primary comparison and four-week context", () => {
  const result = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: AS_OF,
    netLiquidity,
  });

  assert.equal(result.netLiquidity.evidenceStatus, "AVAILABLE");
  assert.equal(result.netLiquidity.latest?.valueBillionsUsd, 6225.4);
  assert.equal(result.netLiquidity.change1wBillionsUsd, 42.6);
  assert.equal(result.netLiquidity.change4wBillionsUsd, -18.4);

  const html = renderToStaticMarkup(
    createElement(FactualMarketBriefingPanel, { data: result }),
  );

  assert.match(html, /03 · Apa yang berubah pada likuiditas dolar AS\?/);
  assert.match(html, /Net Liquidity \(proxy\)/);
  assert.match(html, /6\.225,4 miliar USD/);
  assert.match(html, /\+42,6 miliar USD/);
  assert.match(html, /1 minggu dibanding data sampai/);
  assert.match(html, /4 minggu: -18,4 miliar USD/);
  assert.match(html, /Proxy Net Liquidity meningkat/);
  assert.match(html, /bukan bukti dana langsung masuk ke Bitcoin/);
  assert.doesNotMatch(html, /TERBARU SAAT DIPEROLEH|FRESH|STALE/);
  assert.match(html, /perubahan tiap komponen tidak tersedia/);
  assert.match(html, /Aset Federal Reserve/);
  assert.match(html, /6\.587,2 miliar USD/);
  assert.match(html, /Kas Treasury \(TGA\)/);
  assert.match(html, /350,1 miliar USD/);
  assert.match(html, /Reverse repo \(RRP\)/);
  assert.match(html, /11,7 miliar USD/);

  const normalized = html.toLowerCase();
  assert.equal(normalized.includes("bullish"), false);
  assert.equal(normalized.includes("bearish"), false);
  assert.equal(normalized.includes("risk-on"), false);
  assert.equal(normalized.includes("risk-off"), false);
  assert.equal(result.netLiquidity.reason, null);
});

test("briefing keeps Net Liquidity insufficient when no read model is available", () => {
  const result = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: AS_OF,
  });

  assert.equal(result.netLiquidity.evidenceStatus, "INSUFFICIENT");
  assert.equal(result.netLiquidity.latest, null);

  const html = renderToStaticMarkup(
    createElement(FactualMarketBriefingPanel, { data: result }),
  );
  assert.match(html, /Net Liquidity belum cukup/);
  assert.match(html, /Proxy Net Liquidity belum tersedia pada cutoff briefing/);
});
