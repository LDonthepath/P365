import assert from "node:assert/strict";
import test from "node:test";
import { fetchBinanceBtcUsdtPerpOrderBook } from "./binance-futures-order-book";

const NOW = "2026-10-04T00:00:05.000Z";

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status });
}

test("Binance USD-M Futures depth preserves transaction/output timestamps and sequence", async () => {
  let requestedUrl = "";
  const result = await fetchBinanceBtcUsdtPerpOrderBook(
    { limit: 500 },
    {
      now: () => new Date(NOW),
      fetch: async (input) => {
        requestedUrl = String(input);
        return json({
          lastUpdateId: 123,
          E: 1791072000100,
          T: 1791072000090,
          bids: [["85000", "2"], ["84999", "1"]],
          asks: [["85001", "3"], ["85002", "1"]],
        });
      },
    },
  );
  assert.equal(result.status, "SUCCESS");
  const url = new URL(requestedUrl);
  assert.equal(url.hostname, "fapi.binance.com");
  assert.equal(url.pathname, "/fapi/v1/depth");
  assert.equal(url.searchParams.get("symbol"), "BTCUSDT");
  assert.equal(result.data[0].transactionTimeMs, 1791072000090);
  assert.equal(result.data[0].messageOutputTimeMs, 1791072000100);
  assert.equal(result.data[0].lastUpdateId, 123);
});

test("Binance USD-M Futures rejects crossed books", async () => {
  const result = await fetchBinanceBtcUsdtPerpOrderBook(
    {},
    {
      now: () => new Date(NOW),
      fetch: async () => json({
        lastUpdateId: 1,
        E: 1791072000100,
        T: 1791072000090,
        bids: [["85001", "1"]],
        asks: [["85000", "1"]],
      }),
    },
  );
  assert.equal(result.status, "ERROR");
  assert.equal(result.errorCode, "MALFORMED_PAYLOAD");
});
