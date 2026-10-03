import assert from "node:assert/strict";
import test from "node:test";
import {
  COINALYZE_MAX_SYMBOLS_PER_REQUEST,
  eligibleCoinalyzeBtcPerpetualMarkets,
  fetchCoinalyzeFundingRateHistory,
  fetchCoinalyzeFutureMarkets,
  fetchCoinalyzeLiquidationHistory,
  fetchCoinalyzeOhlcvHistory,
  fetchCoinalyzeOpenInterestHistory,
} from "./coinalyze-derivatives";

const NOW = "2026-10-04T00:00:00.000Z";
const KEY = "test-secret-key";

function json(payload: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(payload), { status, headers });
}

test("Coinalyze future-markets is credential-gated and filters BTC perpetuals explicitly", async () => {
  const unavailable = await fetchCoinalyzeFutureMarkets({ apiKey: () => undefined, now: () => new Date(NOW) });
  assert.equal(unavailable.status, "UNAVAILABLE");
  assert.equal(unavailable.errorCode, "CONFIGURATION");

  let requestInit: RequestInit | undefined;
  const result = await fetchCoinalyzeFutureMarkets({
    apiKey: () => KEY,
    now: () => new Date(NOW),
    fetch: async (_input, init) => {
      requestInit = init;
      return json([
        {
          symbol: "BTCUSDT_PERP.A",
          exchange: "A",
          symbol_on_exchange: "BTCUSDT",
          base_asset: "BTC",
          quote_asset: "USDT",
          is_perpetual: true,
          margined: "STABLE",
          expire_at: null,
          oi_lq_vol_denominated_in: "BASE_ASSET",
          has_long_short_ratio_data: true,
          has_ohlcv_data: true,
          has_buy_sell_data: true,
        },
        {
          symbol: "ETHUSDT_PERP.A",
          exchange: "A",
          symbol_on_exchange: "ETHUSDT",
          base_asset: "ETH",
          quote_asset: "USDT",
          is_perpetual: true,
          margined: "STABLE",
          expire_at: 0,
          oi_lq_vol_denominated_in: "BASE_ASSET",
          has_long_short_ratio_data: true,
          has_ohlcv_data: true,
          has_buy_sell_data: true,
        },
      ]);
    },
  });

  assert.equal(result.status, "SUCCESS");
  assert.equal((requestInit?.headers as Record<string, string>).api_key, KEY);
  assert.equal((requestInit as { cache?: string }).cache, "no-store");
  const btc = eligibleCoinalyzeBtcPerpetualMarkets(result.data);
  assert.deepEqual(btc.map((market) => market.symbol), ["BTCUSDT_PERP.A"]);
});

test("Coinalyze OI history batches 20 symbols, requests USD conversion and validates ascending rows", async () => {
  const symbols = Array.from({ length: COINALYZE_MAX_SYMBOLS_PER_REQUEST + 1 }, (_, index) => `BTC-${index}`);
  const urls: URL[] = [];
  const result = await fetchCoinalyzeOpenInterestHistory(
    { symbols, from: 1_000, to: 2_000 },
    {
      apiKey: () => KEY,
      now: () => new Date(NOW),
      fetch: async (input) => {
        const url = new URL(String(input));
        urls.push(url);
        const requested = (url.searchParams.get("symbols") ?? "").split(",");
        return json(requested.map((symbol) => ({
          symbol,
          history: [
            { t: 1_000, o: 100, h: 110, l: 90, c: 105 },
            { t: 1_300, o: 105, h: 112, l: 100, c: 110 },
          ],
        })));
      },
    },
  );
  assert.equal(result.status, "SUCCESS");
  assert.equal(urls.length, 2);
  assert.equal(urls[0].searchParams.get("convert_to_usd"), "true");
  assert.equal(urls[0].searchParams.get("interval"), "5min");
  assert.equal(result.data.length, symbols.length);

  const malformed = await fetchCoinalyzeOpenInterestHistory(
    { symbols: ["BTC-A"], from: 1_000, to: 2_000 },
    {
      apiKey: () => KEY,
      now: () => new Date(NOW),
      fetch: async () => json([{ symbol: "BTC-A", history: [
        { t: 1_300, o: 100, h: 110, l: 90, c: 105 },
        { t: 1_000, o: 105, h: 112, l: 100, c: 110 },
      ] }]),
    },
  );
  assert.equal(malformed.status, "ERROR");
  assert.equal(malformed.errorCode, "MALFORMED_PAYLOAD");
});

test("Coinalyze funding accepts negative rates but fails closed on missing requested symbols", async () => {
  const result = await fetchCoinalyzeFundingRateHistory(
    { symbols: ["BTC-A"], from: 1_000, to: 2_000 },
    {
      apiKey: () => KEY,
      now: () => new Date(NOW),
      fetch: async () => json([{ symbol: "BTC-A", history: [
        { t: 1_000, o: -0.001, h: 0.001, l: -0.002, c: -0.0005 },
      ] }]),
    },
  );
  assert.equal(result.status, "SUCCESS");
  assert.equal(result.data[0].history[0].close, -0.0005);

  const missing = await fetchCoinalyzeFundingRateHistory(
    { symbols: ["BTC-A", "BTC-B"], from: 1_000, to: 2_000 },
    { apiKey: () => KEY, now: () => new Date(NOW), fetch: async () => json([{ symbol: "BTC-A", history: [] }]) },
  );
  assert.equal(missing.status, "ERROR");
  assert.match(missing.message ?? "", /missing funding-rate symbols/);
});

test("Coinalyze liquidation retains provider L/S fields and requests USD conversion", async () => {
  let requestedUrl = "";
  const result = await fetchCoinalyzeLiquidationHistory(
    { symbols: ["BTC-A"], from: 1_000, to: 2_000 },
    {
      apiKey: () => KEY,
      now: () => new Date(NOW),
      fetch: async (input) => {
        requestedUrl = String(input);
        return json([{ symbol: "BTC-A", history: [{ t: 1_000, l: 25, s: 75 }] }]);
      },
    },
  );
  assert.equal(result.status, "SUCCESS");
  assert.equal(new URL(requestedUrl).searchParams.get("convert_to_usd"), "true");
  assert.deepEqual(result.data[0].history[0], {
    providerTimestamp: 1_000,
    providerFieldL: 25,
    providerFieldS: 75,
  });
});

test("Coinalyze OHLCV preserves per-contract volume without cross-venue normalization", async () => {
  const result = await fetchCoinalyzeOhlcvHistory(
    { symbols: ["BTC-A"], from: 1_000, to: 2_000 },
    {
      apiKey: () => KEY,
      now: () => new Date(NOW),
      fetch: async () => json([{ symbol: "BTC-A", history: [{
        t: 1_000, o: 100, h: 110, l: 90, c: 105, v: 20, bv: 12, tx: 10, btx: 6,
      }] }]),
    },
  );
  assert.equal(result.status, "SUCCESS");
  assert.equal(result.data[0].history[0].buyVolume, 12);
  assert.equal(result.data[0].history[0].volume, 20);
});

test("Coinalyze maps 401/429/provider failures without leaking the API key", async () => {
  const auth = await fetchCoinalyzeOpenInterestHistory(
    { symbols: ["BTC-A"], from: 1_000, to: 2_000 },
    { apiKey: () => KEY, now: () => new Date(NOW), fetch: async () => new Response("bad key", { status: 401 }) },
  );
  assert.equal(auth.status, "ERROR");
  assert.equal(auth.errorCode, "AUTHENTICATION");
  assert.doesNotMatch(auth.message ?? "", new RegExp(KEY));

  const limited = await fetchCoinalyzeOpenInterestHistory(
    { symbols: ["BTC-A"], from: 1_000, to: 2_000 },
    {
      apiKey: () => KEY,
      now: () => new Date(NOW),
      fetch: async () => new Response("slow down", { status: 429, headers: { "Retry-After": "12" } }),
    },
  );
  assert.equal(limited.status, "ERROR");
  assert.equal(limited.errorCode, "RATE_LIMIT");
  assert.match(limited.message ?? "", /Retry-After=12/);
});


test("Coinalyze accepts live null expire_at for perpetual markets and rejects invalid expiry semantics", async () => {
  const valid = await fetchCoinalyzeFutureMarkets({
    apiKey: () => KEY,
    now: () => new Date(NOW),
    fetch: async () => json([{
      symbol: "BTCUSDT_PERP.A",
      exchange: "A",
      symbol_on_exchange: "BTCUSDT",
      base_asset: "BTC",
      quote_asset: "USDT",
      is_perpetual: true,
      margined: "STABLE",
      expire_at: null,
      oi_lq_vol_denominated_in: "BASE_ASSET",
      has_long_short_ratio_data: true,
      has_ohlcv_data: true,
      has_buy_sell_data: true,
    }]),
  });
  assert.equal(valid.status, "SUCCESS");
  assert.equal(valid.data[0].expireAt, null);

  const invalidPerpetual = await fetchCoinalyzeFutureMarkets({
    apiKey: () => KEY,
    now: () => new Date(NOW),
    fetch: async () => json([{
      symbol: "BTCUSDT_PERP.A",
      exchange: "A",
      symbol_on_exchange: "BTCUSDT",
      base_asset: "BTC",
      quote_asset: "USDT",
      is_perpetual: true,
      margined: "STABLE",
      expire_at: 123,
      oi_lq_vol_denominated_in: "BASE_ASSET",
      has_long_short_ratio_data: true,
      has_ohlcv_data: true,
      has_buy_sell_data: true,
    }]),
  });
  assert.equal(invalidPerpetual.status, "ERROR");
});
