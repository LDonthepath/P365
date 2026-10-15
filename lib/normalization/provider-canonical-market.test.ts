import assert from "node:assert/strict";
import test from "node:test";
import * as legacy from "./provider-canonical";
import * as market from "./provider-canonical-market";

test("MACRO-CUT-003L: market converter entrypoints stay isolated; source identities and canonical outputs persist", () => {
  assert.strictEqual(legacy.P365_SOURCES, market.P365_SOURCES);
  for (const removed of [
    "cryptoMarketToObservations",
    "stablecoinLiquidityToCanonicalRecords",
    "btcEtfFlowToCanonicalRecords",
    "cftcGoldCotToCanonicalRecords",
  ]) {
    assert.equal(Object.hasOwn(legacy, removed), false, "mixed barrel still exposes " + removed);
    assert.equal(typeof market[removed as keyof typeof market], "function", "market converter missing: " + removed);
  }
  assert.equal(market.P365_SOURCES.coinGeckoMarket.id, "coingecko-market");
  assert.equal(market.P365_SOURCES.defiLlamaStablecoins.id, "defillama-stablecoins");
  assert.equal(market.P365_SOURCES.soSoValueEtfFlow.id, "sosovalue-etf-flow");
  assert.equal(market.P365_SOURCES.cftcGoldCot.id, "cftc-gold-cot");
  assert.deepEqual(market.cryptoMarketToObservations([], market.P365_SOURCES.coinGeckoMarket.id), { observations: [], evidence: [] });
  assert.deepEqual(market.stablecoinLiquidityToCanonicalRecords([]), { observations: [], evidence: [] });
  assert.deepEqual(market.btcEtfFlowToCanonicalRecords([]), { observations: [], evidence: [] });
  assert.deepEqual(market.cftcGoldCotToCanonicalRecords([]), { observations: [], evidence: [] });
});
