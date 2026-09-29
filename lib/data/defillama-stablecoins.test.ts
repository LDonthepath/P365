import assert from "node:assert/strict";
import test from "node:test";
import { fetchDefiLlamaStablecoinObservations } from "./defillama-stablecoins";

const RETRIEVED_AT = "2026-09-29T12:00:00.000Z";
const DAY = 24 * 60 * 60;
const retrievedSeconds = Date.parse(RETRIEVED_AT) / 1000;

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status });
}

async function acquire(payload: unknown) {
  return fetchDefiLlamaStablecoinObservations(
    { mode: "FORWARD", acquisitionMode: "FRESH" },
    { fetch: async () => response(payload), now: () => new Date(RETRIEVED_AT) },
  );
}

test("validates DefiLlama schema and enforces bounded FORWARD/BACKFILL selection", async () => {
  let requestInit: RequestInit | undefined;
  const valid = await fetchDefiLlamaStablecoinObservations(
    { mode: "FORWARD", acquisitionMode: "FRESH" },
    {
      fetch: async (_input, init) => {
        requestInit = init;
        return response([
          { date: String(retrievedSeconds - DAY), totalCirculatingUSD: { peggedUSD: 100 } },
          { date: String(retrievedSeconds), totalCirculatingUSD: { peggedUSD: 110 } },
        ]);
      },
      now: () => new Date(RETRIEVED_AT),
    },
  );
  assert.equal(valid.status, "SUCCESS");
  assert.equal(valid.data.length, 1, "FORWARD emits only the latest qualified row");
  assert.equal(valid.data[0]?.value, 110);
  assert.equal(valid.data[0]?.observedAt, RETRIEVED_AT);
  assert.equal(valid.data[0]?.pegType, "peggedUSD");
  assert.equal(valid.data[0]?.unit, "USD");
  assert.deepEqual((requestInit as { cache?: string } | undefined)?.cache, "no-store");

  const zero = await acquire([{ date: retrievedSeconds, totalCirculatingUSD: { peggedUSD: 0 } }]);
  assert.equal(zero.status, "SUCCESS");
  assert.equal(zero.data[0]?.value, 0, "provider-explicit zero remains factual zero");

  for (const payload of [
    [{ date: retrievedSeconds }],
    [{ date: retrievedSeconds, totalCirculatingUSD: {} }],
    [{ date: retrievedSeconds, totalCirculatingUSD: { peggedUSD: "110" } }],
    [{ date: retrievedSeconds, totalCirculatingUSD: { peggedUSD: null } }],
    [{ date: "not-a-date", totalCirculatingUSD: { peggedUSD: 110 } }],
    [{ date: retrievedSeconds + DAY, totalCirculatingUSD: { peggedUSD: 110 } }],
  ]) {
    const invalid = await acquire(payload);
    assert.equal(invalid.status, "ERROR");
    assert.equal(invalid.data.length, 0, "malformed rows fail closed instead of becoming zero or EMPTY");
    assert.equal(invalid.errorCode, "MALFORMED_PAYLOAD");
  }
  for (const nonFinite of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const invalid = await fetchDefiLlamaStablecoinObservations(
      { mode: "FORWARD" },
      {
        fetch: async () => ({
          ok: true,
          json: async () => [{ date: retrievedSeconds, totalCirculatingUSD: { peggedUSD: nonFinite } }],
        }) as Response,
        now: () => new Date(RETRIEVED_AT),
      },
    );
    assert.equal(invalid.status, "ERROR");
    assert.equal(invalid.errorCode, "MALFORMED_PAYLOAD");
  }

  const backfill = await fetchDefiLlamaStablecoinObservations(
    { mode: "BACKFILL", range: { from: "2026-09-01", to: "2026-09-03" } },
    {
      fetch: async () => response([
        { date: Date.parse("2026-08-31T00:00:00.000Z") / 1000, totalCirculatingUSD: { peggedUSD: 90 } },
        { date: Date.parse("2026-09-01T00:00:00.000Z") / 1000, totalCirculatingUSD: { peggedUSD: 100 } },
        { date: Date.parse("2026-09-03T00:00:00.000Z") / 1000, totalCirculatingUSD: { peggedUSD: 103 } },
        { date: Date.parse("2026-09-04T00:00:00.000Z") / 1000, totalCirculatingUSD: { peggedUSD: 104 } },
      ]),
      now: () => new Date(RETRIEVED_AT),
    },
  );
  assert.deepEqual(backfill.data.map((item) => item.observedAt.slice(0, 10)), ["2026-09-01", "2026-09-03"]);

  const httpFailure = await fetchDefiLlamaStablecoinObservations(
    { mode: "FORWARD" },
    { fetch: async () => new Response("unavailable", { status: 503 }), now: () => new Date(RETRIEVED_AT) },
  );
  assert.equal(httpFailure.status, "ERROR");
  assert.equal(httpFailure.errorCode, "UPSTREAM_UNAVAILABLE");
  assert.match(httpFailure.message ?? "", /HTTP 503/);

  const invalidJson = await fetchDefiLlamaStablecoinObservations(
    { mode: "FORWARD" },
    { fetch: async () => new Response("{", { status: 200 }), now: () => new Date(RETRIEVED_AT) },
  );
  assert.equal(invalidJson.status, "ERROR");
  assert.equal(invalidJson.errorCode, "MALFORMED_PAYLOAD");
});
