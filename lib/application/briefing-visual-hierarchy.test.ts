import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

import { FactualMarketBriefingPanel } from "../../app/dashboard/factual-market-briefing-panel";
import { composeFactualMarketBriefing } from "./factual-market-briefing";

test("briefing exposes an explicit market-to-macro reading order", () => {
  const data = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: "2026-10-07T15:00:00.000Z",
  });

  const html = renderToStaticMarkup(
    createElement(FactualMarketBriefingPanel, { data }),
  );

  assert.match(html, /aria-label="Urutan baca Ringkasan Pasar"/);
  assert.match(html, /href="#briefing-market-state-title"/);
  assert.match(html, /01 · PASAR SEKARANG/);
  assert.match(html, /href="#briefing-rates-policy"/);
  assert.match(html, /02 · RATES &amp; POLICY/);
  assert.match(html, /href="#briefing-usd-liquidity"/);
  assert.match(html, /03 · USD LIQUIDITY/);
  assert.match(html, /href="#briefing-credit-conditions"/);
  assert.match(html, /04 · CREDIT/);
  assert.match(html, /href="#briefing-macro-background"/);
  assert.match(html, /05 · LATAR MAKRO/);

  const market = html.indexOf('id="briefing-market-state-title"');
  const rates = html.indexOf('id="briefing-rates-policy"');
  const liquidity = html.indexOf('id="briefing-usd-liquidity"');
  const credit = html.indexOf('id="briefing-credit-conditions"');
  const macro = html.indexOf('id="briefing-macro-background"');

  assert.ok(market >= 0);
  assert.ok(rates > market);
  assert.ok(liquidity > rates);
  assert.ok(credit > liquidity);
  assert.ok(macro > credit);
  assert.match(html, /01 · Apa yang bergerak sekarang\?/);
  assert.match(html, /02 · Rates &amp; Policy/);

  const styles = readFileSync(new URL("../../app/dashboard/overview-layout.module.css", import.meta.url), "utf8");
  const dashboard = readFileSync(new URL("../../app/dashboard/dashboard-view.tsx", import.meta.url), "utf8");
  assert.match(styles, /font:700 12px\/1\.35 'DM Mono'/);
  assert.match(styles, /@media\(max-width:380px\)[\s\S]*?overflow-x:auto/);
  assert.match(dashboard, /<h1>Ringkasan Pasar<\/h1>/);
});
