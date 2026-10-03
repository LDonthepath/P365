import assert from "node:assert/strict";
import test from "node:test";
import { fetchHyperliquidBtcPerpOrderBook } from "./hyperliquid-perp-order-book";

const NOW = "2026-10-04T00:00:05.000Z";

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status });
}

test("Hyperliquid l2Book fetch is public, native precision and timestamped", async () => {
  let requestBody = "";
  const result = await fetchHyperliquidBtcPerpOrderBook(
    {},
    {
      now: () => new Date(NOW),
      fetch: async (_input, init) => {
        requestBody = String(init?.body ?? "");
        return json({
          coin: "BTC",
          time: 1791072000000,
          levels: [
            [{ px: "85000", sz: "2.5", n: 4 }, { px: "84999", sz: "1", n: 2 }],
            [{ px: "85001", sz: "3", n: 5 }, { px: "85002", sz: "1.5", n: 2 }],
          ],
        });
      },
    },
  );
  assert.equal(result.status, "SUCCESS");
  assert.deepEqual(JSON.parse(requestBody), { type: "l2Book", coin: "BTC" });
  assert.equal(result.data[0].providerTimeMs, 1791072000000);
  assert.equal(result.data[0].bids[0].restingOrderCount, 4);
});

test("Hyperliquid rejects crossed or unsorted books", async () => {
  const result = await fetchHyperliquidBtcPerpOrderBook(
    {},
    {
      now: () => new Date(NOW),
      fetch: async () => json({
        coin: "BTC",
        time: 1791072000000,
        levels: [
          [{ px: "85000", sz: "1", n: 1 }, { px: "85001", sz: "1", n: 1 }],
          [{ px: "85002", sz: "1", n: 1 }],
        ],
      }),
    },
  );
  assert.equal(result.status, "ERROR");
  assert.equal(result.errorCode, "MALFORMED_PAYLOAD");
});

test("Hyperliquid enforces documented maximum 20 levels per side", async () => {
  const bids = Array.from({ length: 21 }, (_, index) => ({
    px: String(85000 - index),
    sz: "1",
    n: 1,
  }));
  const result = await fetchHyperliquidBtcPerpOrderBook(
    {},
    {
      now: () => new Date(NOW),
      fetch: async () => json({
        coin: "BTC",
        time: 1791072000000,
        levels: [bids, [{ px: "85001", sz: "1", n: 1 }]],
      }),
    },
  );
  assert.equal(result.status, "ERROR");
  assert.match(result.message ?? "", /20-level cap/);
});
