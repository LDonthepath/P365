import assert from "node:assert/strict";
import test from "node:test";
import {
  BINANCE_BTC_SPOT_SYMBOL,
  BINANCE_SPOT_FLOW_INTERVAL_MS,
  fetchBinanceBtcSpotKlines,
} from "./binance-spot-flow";

const NOW = "2026-10-04T12:10:00.000Z";

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status });
}

function kline(openTime: number, overrides: Partial<Record<number, unknown>> = {}): unknown[] {
  const row: unknown[] = [
    openTime,
    "100000",
    "101000",
    "99000",
    "100500",
    "10",
    openTime + BINANCE_SPOT_FLOW_INTERVAL_MS - 1,
    "1005000",
    200,
    "6",
    "603000",
    "0",
  ];
  for (const [index, value] of Object.entries(overrides)) row[Number(index)] = value;
  return row;
}

test("Binance Spot uses market-data-only 5m klines without API credentials", async () => {
  let requestedUrl = "";
  let requestInit: RequestInit | undefined;
  const openTime = Date.parse("2026-10-04T12:00:00.000Z");

  const result = await fetchBinanceBtcSpotKlines(
    { limit: 2 },
    {
      now: () => new Date(NOW),
      fetch: async (input, init) => {
        requestedUrl = String(input);
        requestInit = init;
        return json([kline(openTime)]);
      },
    },
  );

  assert.equal(result.status, "SUCCESS");
  const url = new URL(requestedUrl);
  assert.equal(url.hostname, "data-api.binance.vision");
  assert.equal(url.searchParams.get("symbol"), BINANCE_BTC_SPOT_SYMBOL);
  assert.equal(url.searchParams.get("interval"), "5m");
  assert.equal(url.searchParams.get("timeZone"), "0");
  assert.equal(url.searchParams.get("limit"), "2");
  assert.equal((requestInit as { cache?: string }).cache, "no-store");
  assert.equal(result.data[0].takerBuyBaseVolumeBtc, 6);
});

test("Binance Spot excludes the currently forming 5m bar", async () => {
  const complete = Date.parse("2026-10-04T12:00:00.000Z");
  const incomplete = Date.parse("2026-10-04T12:10:00.000Z");

  const result = await fetchBinanceBtcSpotKlines(
    {},
    {
      now: () => new Date("2026-10-04T12:12:00.000Z"),
      fetch: async () => json([kline(complete), kline(incomplete)]),
    },
  );

  assert.equal(result.status, "SUCCESS");
  assert.deepEqual(result.data.map((bar) => bar.providerIntervalStartMs), [complete]);
});

test("Binance Spot fails closed when taker-buy volume exceeds total volume", async () => {
  const openTime = Date.parse("2026-10-04T12:00:00.000Z");
  const result = await fetchBinanceBtcSpotKlines(
    {},
    {
      now: () => new Date(NOW),
      fetch: async () => json([kline(openTime, { 9: "11" })]),
    },
  );
  assert.equal(result.status, "ERROR");
  assert.equal(result.errorCode, "MALFORMED_PAYLOAD");
});

test("Binance Spot fails closed on incompatible 5m close time", async () => {
  const openTime = Date.parse("2026-10-04T12:00:00.000Z");
  const result = await fetchBinanceBtcSpotKlines(
    {},
    {
      now: () => new Date(NOW),
      fetch: async () => json([kline(openTime, { 6: openTime + 1 })]),
    },
  );
  assert.equal(result.status, "ERROR");
  assert.match(result.message ?? "", /close time is incompatible/);
});
