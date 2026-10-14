import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const feature = (name: string) => readFileSync('app/dashboard/dashboard-' + name + '.tsx', "utf8");

test("MACRO-CUT-002: shell keeps refresh, navigation, account and explicit macro/calendar only", () => {
  const shell = feature("shell");
  assert.match(shell, /role="tablist"/);
  assert.match(shell, /aria-selected=\{activeMenu === item\.id\}/);
  assert.match(shell, /setActiveMenu\(item\.id\); setNavOpen\(false\)/);
  assert.match(shell, /onClick=\{\(\) => setNavOpen\(false\)\}/);
  assert.match(shell, /event\.key === "Escape"/);
  assert.match(shell, /refreshDashboardData\(\)/);
  assert.match(shell, /<ContextSection data=\{data\}/);
  assert.match(shell, /<MacroSection data=\{data\}/);
  assert.match(shell, /"macro", label: "Makro"/);
  assert.match(shell, /"calendar", label: "Kalender"/);
  assert.doesNotMatch(shell, /<MarketSection|<CryptoSection|<GoldSection|<OverviewSection|<EvidenceSection/);
  assert.doesNotMatch(shell, /"overview"|"heatmap"|"crypto"|"gold"|"evidence"/);
  assert.match(shell, /sessionEmail/);
  assert.match(shell, /<form action=\{logout\}>/);
});

test("MACRO-CUT-002: rendered views only depend on macro and calendar read paths", () => {
  assert.match(feature("macro-feature"), /<MacroThemeCard/);
  assert.match(feature("macro-feature"), /<NetLiquidityPanel/);
  assert.match(feature("macro-feature"), /<RatesInflationPanel/);
  assert.match(feature("context-feature"), /<EventRiskWindowPanel/);
  for (const name of ["macro-feature", "context-feature"]) {
    assert.doesNotMatch(feature(name), /\bfetch\s*\(|\binsert\s*\(/);
    assert.doesNotMatch(feature(name), /BTC|GoldSection|IntradayEventResponsePanel|MvpFactualContextPanel|BtcEtfFlowPanel/);
  }
  const query = readFileSync("lib/application/dashboard-query.ts", "utf8");
  assert.doesNotMatch(query, /intraday-event-monitor|snapshot|material-move-monitor|btc-etf-flow|stablecoin-liquidity|gold-positioning|mvp-factual-context|readDxyMacroHistory/);
  assert.match(query, /macroOnly: true/);
});
