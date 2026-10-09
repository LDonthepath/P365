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
