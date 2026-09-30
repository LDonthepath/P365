import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchSoSoValueBtcEtfFlowObservations,
  SOSOVALUE_ETF_FLOW_COMPLETION_BASIS,
  SOSOVALUE_ETF_FLOW_MATURITY_POLICY,
} from "./sosovalue-etf-flow";

const RETRIEVED_AT = "2026-09-30T12:00:00.000Z";
const API_KEY = "test-key-never-persist";

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status });
}

function rows() {
  return [
    { date: "2026-09-30", total_net_inflow: 300, total_value_traded: 900 },
    { date: "2026-09-29", total_net_inflow: 0 },
    { date: "2026-09-28", total_net_inflow: -125.5 },
    { date: "2026-09-26", total_net_inflow: 100 },
  ];
}

async function acquire(payload: unknown) {
  return fetchSoSoValueBtcEtfFlowObservations(
    { mode: "FORWARD", acquisitionMode: "FRESH" },
    { fetch: async () => json(payload), now: () => new Date(RETRIEVED_AT), apiKey: () => API_KEY },
  );
}

test("uses the official credential-safe request and applies provider-date maturity", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const result = await fetchSoSoValueBtcEtfFlowObservations(
    { mode: "FORWARD", acquisitionMode: "FRESH" },
    {
      fetch: async (input, init) => {
        requestUrl = String(input);
        requestInit = init;
        return json(rows());
      },
      now: () => new Date(RETRIEVED_AT),
      apiKey: () => API_KEY,
    },
  );

  const url = new URL(requestUrl);
  assert.equal(url.origin, "https://openapi.sosovalue.com");
  assert.equal(url.pathname, "/openapi/v1/etfs/summary-history");
  assert.equal(url.searchParams.get("symbol"), "BTC");
  assert.equal(url.searchParams.get("country_code"), "US");
  assert.equal(url.searchParams.get("limit"), "50");
  assert.equal(url.toString().includes(API_KEY), false, "API key must not enter the URL");
  assert.equal(new Headers(requestInit?.headers).get("x-soso-api-key"), API_KEY);
  assert.equal((requestInit as { cache?: string }).cache, "no-store");
  assert.ok(requestInit?.signal, "request has a 10-second timeout signal");

  assert.equal(result.status, "SUCCESS");
  assert.deepEqual(result.data.map((item) => item.providerTradingDate), ["2026-09-29", "2026-09-28", "2026-09-26"]);
  assert.deepEqual(result.data.map((item) => item.value), [0, -125.5, 100]);
  assert.equal(result.data.some((item) => item.providerTradingDate === "2026-09-30"), false, "newest row remains provisional");
  assert.equal(result.data[0]?.observedAt, "2026-09-29T00:00:00.000Z");
  assert.equal(result.data[0]?.maturityPolicy, SOSOVALUE_ETF_FLOW_MATURITY_POLICY);
  assert.equal(result.data[0]?.completionBasis, SOSOVALUE_ETF_FLOW_COMPLETION_BASIS);
  assert.doesNotMatch(JSON.stringify(result), /test-key-never-persist/);
});

test("fails explicitly for configuration, HTTP classes, timeout, and invalid JSON", async () => {
  const missing = await fetchSoSoValueBtcEtfFlowObservations(
    { mode: "FORWARD" },
    { apiKey: () => undefined, now: () => new Date(RETRIEVED_AT) },
  );
  assert.equal(missing.status, "UNAVAILABLE");
  assert.equal(missing.errorCode, "CONFIGURATION");

  for (const [status, code] of [[401, "AUTHENTICATION"], [403, "AUTHENTICATION"], [429, "RATE_LIMIT"], [503, "UPSTREAM_UNAVAILABLE"]] as const) {
    const failure = await fetchSoSoValueBtcEtfFlowObservations(
      { mode: "FORWARD" },
      { fetch: async () => new Response("", { status }), apiKey: () => API_KEY, now: () => new Date(RETRIEVED_AT) },
    );
    assert.equal(failure.errorCode, code);
    assert.doesNotMatch(failure.message ?? "", new RegExp(API_KEY));
  }

  const timeout = await fetchSoSoValueBtcEtfFlowObservations(
    { mode: "FORWARD" },
    {
      fetch: async () => { throw new DOMException("The operation was aborted", "AbortError"); },
      apiKey: () => API_KEY,
      now: () => new Date(RETRIEVED_AT),
    },
  );
  assert.equal(timeout.errorCode, "TIMEOUT");

  const secretBearingFailure = await fetchSoSoValueBtcEtfFlowObservations(
    { mode: "FORWARD" },
    {
      fetch: async () => { throw new Error(`request failed for ${API_KEY}`); },
      apiKey: () => API_KEY,
      now: () => new Date(RETRIEVED_AT),
    },
  );
  assert.doesNotMatch(secretBearingFailure.message ?? "", new RegExp(API_KEY));
  assert.match(secretBearingFailure.message ?? "", /REDACTED/);

  const invalidJson = await fetchSoSoValueBtcEtfFlowObservations(
    { mode: "FORWARD" },
    { fetch: async () => new Response("{", { status: 200 }), apiKey: () => API_KEY, now: () => new Date(RETRIEVED_AT) },
  );
  assert.equal(invalidJson.errorCode, "MALFORMED_PAYLOAD");
});

test("strictly validates documented rows and accepts only finite numeric facts", async () => {
  const invalidPayloads: unknown[] = [
    {},
    { data: {} },
    { code: 0, data: {} },
    { code: 2, message: "provider rejected request", data: rows() },
    { data: [], arbitrary: true },
    { code: 0, message: "success", data: [], arbitrary: true },
    { code: 0, msg: "success", data: [] },
    { code: 0, success: true, data: [] },
    [{ total_net_inflow: 1 }],
    [{ date: "09/29/2026", total_net_inflow: 1 }],
    [{ date: "2026-02-30", total_net_inflow: 1 }],
    [{ date: "2026-09-29" }],
    [{ date: "2026-09-29", total_net_inflow: null }],
    [{ date: "2026-09-29", total_net_inflow: "0" }],
    [{ date: "2026-09-29", total_net_inflow: 1 }, { date: "2026-09-29", total_net_inflow: 2 }],
    [{ date: "2026-09-28", total_net_inflow: 1 }, { date: "2026-09-29", total_net_inflow: 2 }],
  ];
  for (const payload of invalidPayloads) {
    const result = await acquire(payload);
    assert.equal(result.status, "ERROR");
    assert.equal(result.errorCode, "MALFORMED_PAYLOAD");
    assert.equal(result.data.length, 0);
  }
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const result = await fetchSoSoValueBtcEtfFlowObservations(
      { mode: "FORWARD" },
      {
        fetch: async () => ({ ok: true, json: async () => [{ date: "2026-09-29", total_net_inflow: value }] }) as Response,
        apiKey: () => API_KEY,
        now: () => new Date(RETRIEVED_AT),
      },
    );
    assert.equal(result.errorCode, "MALFORMED_PAYLOAD");
  }
});

test("requires a later row in the same response and never uses wall-clock finality", async () => {
  const oneRow = await acquire([{ date: "2020-01-02", total_net_inflow: 100 }]);
  assert.equal(oneRow.status, "EMPTY");
  assert.equal(oneRow.data.length, 0, "even a years-old sole/latest row is provisional");

  const envelope = await acquire({ code: 0, message: "success", data: [
    { date: "2020-01-03", total_net_inflow: 101 },
    { date: "2020-01-02", total_net_inflow: 100 },
  ] });
  assert.equal(envelope.status, "SUCCESS");
  assert.deepEqual(envelope.data.map((item) => item.providerTradingDate), ["2020-01-02"]);
});

test("accepts only documented successful envelopes and rejects provider-level failure", async () => {
  const bare = await acquire(rows());
  assert.equal(bare.status, "SUCCESS", "endpoint-specific bare arrays remain supported");

  const wrapped = await acquire({ code: 0, message: "success", data: rows() });
  assert.equal(wrapped.status, "SUCCESS");
  assert.deepEqual(wrapped.data.map((item) => item.providerTradingDate), ["2026-09-29", "2026-09-28", "2026-09-26"]);

  const unsuccessful = await acquire({ code: 1001, message: "entitlement denied", data: rows() });
  assert.equal(unsuccessful.status, "ERROR");
  assert.equal(unsuccessful.errorCode, "MALFORMED_PAYLOAD");
  assert.equal(unsuccessful.data.length, 0, "unsuccessful envelope cannot emit canonical candidates");

  const nonArrayData = await acquire({ code: 0, data: { rows: rows() } });
  assert.equal(nonArrayData.status, "ERROR");

  const unknownField = await acquire({ code: 0, message: "success", data: rows(), success: true });
  assert.equal(unknownField.status, "ERROR");
});

test("future provider dates fail closed and cannot become maturity witnesses", async () => {
  const result = await acquire([
    { date: "2026-10-01", total_net_inflow: 101 },
    { date: "2026-09-30", total_net_inflow: 100 },
  ]);
  assert.equal(result.status, "ERROR");
  assert.equal(result.errorCode, "MALFORMED_PAYLOAD");
  assert.equal(result.data.length, 0, "an impossible future row cannot mature the current UTC date");
  assert.match(result.message ?? "", /later than the UTC retrieval date/);
});

test("BACKFILL proves witness and returned coverage without synthesizing sessions", async () => {
  const fetcher = async () => json(rows());
  const dependencies = { fetch: fetcher, apiKey: () => API_KEY, now: () => new Date(RETRIEVED_AT) };
  const valid = await fetchSoSoValueBtcEtfFlowObservations(
    { mode: "BACKFILL", range: { from: "2026-09-26", to: "2026-09-29" } },
    dependencies,
  );
  assert.deepEqual(valid.data.map((item) => item.providerTradingDate), ["2026-09-29", "2026-09-28", "2026-09-26"]);

  const noWitness = await fetchSoSoValueBtcEtfFlowObservations(
    { mode: "BACKFILL", range: { from: "2026-09-29", to: "2026-09-30" } },
    dependencies,
  );
  assert.equal(noWitness.status, "ERROR");
  assert.match(noWitness.message ?? "", /strictly earlier/);

  const beyondCoverage = await fetchSoSoValueBtcEtfFlowObservations(
    { mode: "BACKFILL", range: { from: "2026-09-01", to: "2026-09-05" } },
    dependencies,
  );
  assert.equal(beyondCoverage.status, "ERROR");
  assert.match(beyondCoverage.message ?? "", /coverage/);

  const nonSessions = await fetchSoSoValueBtcEtfFlowObservations(
    { mode: "BACKFILL", range: { from: "2026-09-27", to: "2026-09-27" } },
    dependencies,
  );
  assert.equal(nonSessions.status, "EMPTY");
  assert.deepEqual(nonSessions.data, [], "weekends and holidays are not synthesized");
});
