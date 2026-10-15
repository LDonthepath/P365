import assert from "node:assert/strict";
import test from "node:test";
import * as legacy from "./provider-canonical";
import * as market from "./provider-canonical-market";

test("MACRO-CUT-003K: market provider canonical exports retain strict identity and source registry", () => {
  assert.strictEqual(legacy.P365_SOURCES, market.P365_SOURCES);
  assert.strictEqual(legacy.cryptoMarketToObservations, market.cryptoMarketToObservations);
  assert.strictEqual(legacy.stablecoinLiquidityToCanonicalRecords, market.stablecoinLiquidityToCanonicalRecords);
  assert.strictEqual(legacy.btcEtfFlowToCanonicalRecords, market.btcEtfFlowToCanonicalRecords);
  assert.strictEqual(legacy.cftcGoldCotToCanonicalRecords, market.cftcGoldCotToCanonicalRecords);
  assert.equal(market.P365_SOURCES.coinGeckoMarket.id, "coingecko-market");
  assert.equal(market.P365_SOURCES.defiLlamaStablecoins.id, "defillama-stablecoins");
  assert.equal(market.P365_SOURCES.soSoValueEtfFlow.id, "sosovalue-etf-flow");
  assert.equal(market.P365_SOURCES.cftcGoldCot.id, "cftc-gold-cot");
  assert.deepEqual(market.cryptoMarketToObservations([], market.P365_SOURCES.coinGeckoMarket.id), { observations: [], evidence: [] });
  assert.deepEqual(market.stablecoinLiquidityToCanonicalRecords([]), { observations: [], evidence: [] });
  assert.deepEqual(market.btcEtfFlowToCanonicalRecords([]), { observations: [], evidence: [] });
  assert.deepEqual(market.cftcGoldCotToCanonicalRecords([]), { observations: [], evidence: [] });
});
