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

  assert.match(html, /USD LIQUIDITY/);
  assert.match(html, /Net Liquidity AS/);
  assert.match(html, /03 · Apa yang berubah pada likuiditas dolar AS\?/);
  assert.match(html, /aria-label="Net Liquidity AS \(proxy\)"/);
  assert.match(html, /data-slot="freshness"/);
  assert.match(html, /Observasi gabungan sampai 01 Okt 2026/);
  assert.match(html, /<details class="briefing-rate-details">/);
  assert.match(html, /6\.225,4 miliar USD/);
  assert.match(html, /Dibanding sekitar 1 minggu \+42,6 miliar USD/);
  assert.match(html, /Konteks sekitar 4 minggu: -18,4 miliar USD/);
  assert.match(html, /Apa artinya: Proxy Net Liquidity meningkat/);
  assert.match(html, /bukan bukti dana langsung masuk ke Bitcoin/);
  assert.match(html, /kualitas komponen saat diperoleh: TERBARU SAAT DIPEROLEH/);
  assert.match(html, /aset Fed 6\.587,2 miliar USD/);
  assert.match(html, /kas Treasury 350,1 miliar USD/);
  assert.match(html, /reverse repo 11,7 miliar USD/);

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
