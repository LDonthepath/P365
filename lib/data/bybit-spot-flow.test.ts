import assert from "node:assert/strict";
import test from "node:test";
import {
  BYBIT_BTC_SPOT_SYMBOL,
  fetchBybitRecentBtcSpotTrades,
} from "./bybit-spot-flow";

const NOW = "2026-10-04T12:10:00.000Z";

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status });
}

test("Bybit Spot reads public recent trades and preserves documented taker side", async () => {
  let requestedUrl = "";
  const result = await fetchBybitRecentBtcSpotTrades(
    { limit: 2 },
    {
      now: () => new Date(NOW),
      fetch: async (input) => {
        requestedUrl = String(input);
        return json({
          retCode: 0,
          retMsg: "OK",
          result: {
            category: "spot",
            list: [
              {
                execId: "2",
                symbol: BYBIT_BTC_SPOT_SYMBOL,
                price: "100100",
                size: "0.2",
                side: "Sell",
                time: "1791101402000",
                isBlockTrade: false,
                isRPITrade: false,
                seq: "12",
              },
              {
                execId: "1",
                symbol: BYBIT_BTC_SPOT_SYMBOL,
                price: "100000",
                size: "0.1",
                side: "Buy",
                time: "1791101401000",
                isBlockTrade: false,
                isRPITrade: true,
                seq: "11",
              },
            ],
          },
          time: 1791101403000,
        });
      },
    },
  );

  assert.equal(result.status, "SUCCESS");
  const url = new URL(requestedUrl);
  assert.equal(url.pathname, "/v5/market/recent-trade");
  assert.equal(url.searchParams.get("category"), "spot");
  assert.equal(url.searchParams.get("symbol"), BYBIT_BTC_SPOT_SYMBOL);
  assert.equal(result.data[0].takerSide, "BUY");
  assert.equal(result.data[1].takerSide, "SELL");
});

test("Bybit Spot rejects non-success provider envelope", async () => {
  const result = await fetchBybitRecentBtcSpotTrades(
    {},
    {
      now: () => new Date(NOW),
      fetch: async () => json({ retCode: 10006, retMsg: "Too many visits", result: { category: "spot", list: [] } }),
    },
  );
  assert.equal(result.status, "ERROR");
  assert.match(result.message ?? "", /retCode=10006/);
});

test("Bybit Spot enforces documented 60-trade spot REST ceiling", async () => {
  const result = await fetchBybitRecentBtcSpotTrades(
    { limit: 61 },
    { now: () => new Date(NOW), fetch: async () => json({}) },
  );
  assert.equal(result.status, "ERROR");
  assert.match(result.message ?? "", /between 1 and 60/);
});


test("Bybit Spot maps deployment-region geoblock to UNAVAILABLE instead of authentication failure", async () => {
  const result = await fetchBybitRecentBtcSpotTrades(
    {},
    {
      now: () => new Date(NOW),
      fetch: async () => new Response(
        "{ error:The Amazon CloudFront distribution is configured to block access from your country }",
        { status: 403 },
      ),
    },
  );
  assert.equal(result.status, "UNAVAILABLE");
  assert.equal(result.errorCode, "UPSTREAM_UNAVAILABLE");
  assert.match(result.message ?? "", /unavailable from deployment region/);
});
