import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const feature = (name: string) => readFileSync(`app/dashboard/dashboard-${name}.tsx`, "utf8");

test("G4 dashboard shell retains navigation, refresh and dismiss interactions", () => {
  const shell = feature("shell");
  assert.match(shell, /role="tablist"/);
  assert.match(shell, /aria-selected=\{activeMenu === item\.id\}/);
  assert.match(shell, /setActiveMenu\(item\.id\); setNavOpen\(false\)/);
  assert.match(shell, /onClick=\{\(\) => setNavOpen\(false\)\}/);
  assert.match(shell, /event\.key === "Escape"/);
  assert.match(shell, /refreshDashboardData\(\)/);
  assert.match(shell, /<ContextSection data=\{data\}/);
});

test("G4 feature boundaries preserve market, macro, crypto, gold and evidence surfaces", () => {
  assert.match(feature("market-feature"), /<FinancialMarketOverviewPanel data=/);
  assert.match(feature("macro-feature"), /<MacroThemeCard/);
  assert.match(feature("crypto-feature"), /<BtcEtfFlowPanel/);
  assert.match(feature("gold-feature"), /<GoldPositioningPanel/);
  assert.match(feature("context-feature"), /<IntradayEventResponsePanel/);
  assert.match(feature("evidence-feature"), /Jejak sumber data/);
  for (const name of ["market-feature", "macro-feature", "crypto-feature", "gold-feature", "context-feature", "evidence-feature"]) {
    assert.doesNotMatch(feature(name), /\bfetch\s*\(|\binsert\s*\(/);
  }
});
