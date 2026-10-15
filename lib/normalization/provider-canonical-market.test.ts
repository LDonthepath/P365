import assert from "node:assert/strict";
import test from "node:test";
import { P365_SOURCES as domainSources } from "../domain/normalize";
import * as market from "./provider-canonical-market";

test("MACRO-CUT-003M: market adapter retains source registry and outputs without mixed barrel", () => {
  assert.strictEqual(domainSources, market.P365_SOURCES);
  for (const removed of [
    "cryptoMarketToObservations",
    "stablecoinLiquidityToCanonicalRecords",
    "btcEtfFlowToCanonicalRecords",
    "cftcGoldCotToCanonicalRecords",
  ]) {
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
