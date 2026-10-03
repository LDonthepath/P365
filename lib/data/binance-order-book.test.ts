import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchBinanceBtcOrderBook,
} from "./binance-order-book";

const NOW = "2026-10-04T12:00:00.000Z";

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status });
}

test("Binance order book uses public market-data-only depth endpoint", async () => {
  let requestedUrl = "";
  let requestInit: RequestInit | undefined;

  const result = await fetchBinanceBtcOrderBook(
    { limit: 500 },
    {
      now: () => new Date(NOW),
      fetch: async (input, init) => {
        requestedUrl = String(input);
        requestInit = init;
        return json({
          lastUpdateId: 123,
          bids: [["100000", "1.5"], ["99999", "2"]],
          asks: [["100001", "1"], ["100002", "3"]],
        });
      },
    },
  );

  assert.equal(result.status, "SUCCESS");
  const url = new URL(requestedUrl);
  assert.equal(url.hostname, "data-api.binance.vision");
  assert.equal(url.pathname, "/api/v3/depth");
  assert.equal(url.searchParams.get("symbol"), "BTCUSDT");
  assert.equal(url.searchParams.get("limit"), "500");
  assert.equal((requestInit as { cache?: string }).cache, "no-store");
  assert.equal(result.data[0].lastUpdateId, 123);
});

test("Binance order book rejects crossed books", async () => {
  const result = await fetchBinanceBtcOrderBook(
    {},
    {
      now: () => new Date(NOW),
      fetch: async () => json({
        lastUpdateId: 1,
        bids: [["100001", "1"]],
        asks: [["100000", "1"]],
      }),
    },
  );
  assert.equal(result.status, "ERROR");
  assert.equal(result.errorCode, "MALFORMED_PAYLOAD");
});

test("Binance order book rejects unsorted depth levels", async () => {
  const result = await fetchBinanceBtcOrderBook(
    {},
    {
      now: () => new Date(NOW),
      fetch: async () => json({
        lastUpdateId: 1,
        bids: [["100000", "1"], ["100001", "1"]],
        asks: [["100002", "1"], ["100003", "1"]],
      }),
    },
  );
  assert.equal(result.status, "ERROR");
  assert.match(result.message ?? "", /bid prices must be strictly descending/);
});

test("Binance order book rejects unsupported depth limit", async () => {
  const result = await fetchBinanceBtcOrderBook(
    { limit: 250 as 100 },
    { now: () => new Date(NOW), fetch: async () => json({}) },
  );
  assert.equal(result.status, "ERROR");
  assert.match(result.message ?? "", /limit must be one of/);
});
