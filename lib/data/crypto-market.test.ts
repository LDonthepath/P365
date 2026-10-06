import assert from "node:assert/strict";
import test from "node:test";
import { fetchCryptoMarketObservations } from "./crypto-market";

test("dashboard CoinGecko acquisition retains all eight metrics and existing cache policy", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: URL; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    const payload = url.pathname.endsWith("/simple/price")
      ? {
        bitcoin: { usd: 100000, usd_market_cap: 2000000, usd_24h_change: 1, last_updated_at: 1791288000 },
        ethereum: { usd: 4000, usd_market_cap: 500000, usd_24h_change: 2, last_updated_at: 1791288000 },
      }
      : { data: {
        total_market_cap: { usd: 3000000 }, total_volume: { usd: 50000 },
        market_cap_percentage: { btc: 60, eth: 20 }, updated_at: 1791288000,
      } };
    return Response.json(payload);
  };
  try {
    const result = await fetchCryptoMarketObservations();
    assert.equal(result.providerId, "coingecko");
    assert.equal(result.status, "SUCCESS");
    assert.deepEqual(result.data.map((row) => row.metricId), [
      "btc.spot.usd", "btc.market_cap.usd", "eth.spot.usd", "eth.market_cap.usd",
      "crypto.total_market_cap.usd", "crypto.total_volume_24h.usd",
      "crypto.btc_dominance.pct", "crypto.eth_dominance.pct",
    ]);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url.searchParams.get("include_market_cap"), "true");
    assert.equal((calls[0].init as { next?: { revalidate: number } }).next?.revalidate, 300);
    calls.length = 0;
    const fresh = await fetchCryptoMarketObservations(["BTC", "ETH"], "FRESH");
    assert.deepEqual(fresh.data.map((row) => row.metricId), result.data.map((row) => row.metricId));
    assert.ok(calls.every((call) => call.init?.cache === "no-store"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
