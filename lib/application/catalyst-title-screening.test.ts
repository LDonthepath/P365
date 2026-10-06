import assert from "node:assert/strict";
import test from "node:test";
import { catalystTitleExclusion } from "./catalyst-title-screening";

test("screens the observed token ROI promotion without blocking ordinary market reports", () => {
  const observed = "BTC News: Bitcoin Leaves Bear Market as Apeing's 1,566% Potential ROI Ending in 24 Hours - Best Crypto to Invest In";
  assert.equal(catalystTitleExclusion(observed, "BTC"), "PROMOTIONAL_TITLE");
  for (const title of [
    "Bitcoin falls as Treasury yields rise",
    "Bitcoin gains 20% as ETF inflows accelerate",
    "Gold falls on stronger dollar",
    "BoJ raises rates as yen strengthens",
    "SEC warns investors about Bitcoin presale fraud and guaranteed returns",
    "Exchange hacked; Bitcoin withdrawals suspended",
    "PBoC reports new gold purchases",
    "क्या सोने में अभी लंबी अवधि के लिए निवेश करना सही रहेगा?",
  ]) assert.equal(catalystTitleExclusion(title, "BTC"), null, title);
});

test("presale sales pitches are screened across media and discovery scopes", () => {
  for (const scope of ["BTC", "CRYPTO", "GOLD", "MAKRO"] as const) {
    assert.equal(catalystTitleExclusion("Join token presale before it ends", scope), "PROMOTIONAL_TITLE");
    assert.equal(catalystTitleExclusion("TOP 5 CRYPTO TO BUY", scope), "PROMOTIONAL_TITLE");
  }
});

test("Bitcoin Cash-only title is separate from BTC while cross-asset reporting remains visible", () => {
  assert.equal(catalystTitleExclusion("Bitcoin Cash price climbs", "BTC"), "OTHER_ASSET_ONLY");
  assert.equal(catalystTitleExclusion("Bitcoin Cash price climbs", "CRYPTO"), null);
  assert.equal(catalystTitleExclusion("BCH rises against BTC", "BTC"), null);
  assert.equal(catalystTitleExclusion("Bitcoin and Bitcoin Cash fall after exchange outage", "BTC"), null);
});

test("company resource reports are distinct from bullion price headlines", () => {
  assert.equal(catalystTitleExclusion("Omai Gold announces NI 43-101 resource report", "GOLD"), "GOLD_RESOURCE_REPORT");
  assert.equal(catalystTitleExclusion("Gold miner publishes drilling results", "GOLD"), "GOLD_RESOURCE_REPORT");
  assert.equal(catalystTitleExclusion("Gold prices rise amid mine supply disruption", "GOLD"), null);
  assert.equal(catalystTitleExclusion("Bullion prices rise as miner issues NI 43-101 report", "GOLD"), null);
});
