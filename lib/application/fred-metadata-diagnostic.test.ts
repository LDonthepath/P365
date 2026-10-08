import assert from "node:assert/strict";
import test from "node:test";
import { createFredMetadataDiagnosticHandler } from "./fred-metadata-diagnostic";

const secret = "test-cron-secret";
const fredKey = "test-fred-api-key";
const path = "https://p365.test/api/internal/fred-metadata";
const series = {
  seriess: [{
    id: "SOFR", title: "Secured Overnight Financing Rate",
    frequency: "Daily", units: "Percent",
    last_updated: "2026-10-08 08:00:00-05",
    observation_start: "2018-04-03", observation_end: "2026-10-07",
  }],
};
const releases = { releases: [{ id: 290, name: "SOFR Data" }] };
const dates = { release_dates: [{ release_id: 290, date: "2026-10-08" }] };
const vintages = { vintage_dates: ["2026-10-08", "2026-10-07"] };

function req(query = "seriesId=SOFR", authorization: string | null = "Bearer " + secret): Request {
  return new Request(path + "?" + query, {
    headers: authorization ? { authorization } : undefined,
  });
}

test("rejects unauthenticated access before FRED API calls", async () => {
  let fetchCount = 0;
  const fetcher = (async () => { fetchCount++; throw Error("should not call FRED"); }) as typeof fetch;
  const handler = createFredMetadataDiagnosticHandler(fetcher, () => secret, () => fredKey);
  assert.equal((await handler(req("seriesId=SOFR", null))).status, 401);
  assert.equal((await handler(req("seriesId=SOFR", "Bearer incorrect"))).status, 401);
  const missingSecret = createFredMetadataDiagnosticHandler(fetcher, () => undefined, () => fredKey);
  assert.equal((await missingSecret(req())).status, 401);
  assert.equal(fetchCount, 0);
});

test("restricts request to one known registry series, GET, and no extra parameters", async () => {
  let calls = 0;
  const fetcher = (async () => { calls++; return new Response(); }) as typeof fetch;
  const handler = createFredMetadataDiagnosticHandler(fetcher, () => secret, () => fredKey);
  for (const query of ["", "seriesId=UNKNOWN", "seriesId=SOFR&seriesId=EFFR",
    "seriesId=SOFR&api_key=leak", "seriesId=sofr", "seriesId=%20SOFR"]) {
    assert.equal((await handler(req(query))).status, 400, query);
  }
  assert.equal((await handler(new Request(path + "?seriesId=SOFR", {
    method: "POST", headers: { authorization: "Bearer " + secret },
  }))).status, 400);
  assert.equal(calls, 0);
});

test("returns unavailable on missing FRED credential without fetching", async () => {
  let calls = 0;
  const fetcher = (async () => { calls++; return new Response(); }) as typeof fetch;
  const handler = createFredMetadataDiagnosticHandler(fetcher, () => secret, () => undefined);
  const response = await handler(req());
  assert.equal(response.status, 503);
  assert.equal(calls, 0);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store, max-age=0");
});

test("reads official metadata fields without returning credentials or conflating publication with availability", async () => {
  const requested: string[] = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    requested.push(url.pathname);
    assert.equal(url.origin, "https://api.stlouisfed.org");
    assert.equal(url.searchParams.get("api_key"), fredKey);
    assert.equal(url.searchParams.get("file_type"), "json");
    assert.equal(init?.cache, "no-store");
    if (url.pathname === "/fred/series") return Response.json(series);
    if (url.pathname === "/fred/series/release") return Response.json(releases);
    if (url.pathname === "/fred/release/dates") {
      assert.equal(url.searchParams.get("release_id"), "290");
      assert.equal(url.searchParams.get("limit"), "20");
      assert.equal(url.searchParams.get("sort_order"), "desc");
      assert.equal(url.searchParams.get("include_release_dates_with_no_data"), "false");
      return Response.json(dates);
    }
    assert.equal(url.pathname, "/fred/series/vintagedates");
    assert.equal(url.searchParams.get("limit"), "20");
    return Response.json(vintages);
  }) as typeof fetch;
  const handler = createFredMetadataDiagnosticHandler(fetcher, () => secret, () => fredKey);
  const response = await handler(req());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store, max-age=0");
  const report = await response.json();
  assert.equal(report.status, "COMPLETE");
  assert.equal(report.series.value.lastUpdated, "2026-10-08 08:00:00-05");
  assert.equal(report.release.value.releaseId, 290);
  assert.deepEqual(report.publisherReleaseDates.value, ["2026-10-08"]);
  assert.deepEqual(report.valueChangeVintageDates.value, ["2026-10-08", "2026-10-07"]);
  assert.equal(report.firstAvailableInFredAt, null);
  assert.equal(report.availabilityEvidence, "TIDAK TERVERIFIKASI");
  assert.equal(report.warning, "PUBLISHER_RELEASE_DATE_IS_NOT_FRED_AVAILABILITY");
  assert.equal(requested.length, 4);
  assert.ok(!JSON.stringify(report).includes(fredKey));
  assert.ok(!JSON.stringify(report).includes(secret));
  assert.ok(!JSON.stringify(report).includes("api_key"));
});

test("reports partial upstream failures without exposing error strings, URLs or credentials", async () => {
  const fetcher = (async (input: string | URL | Request) => {
    const endpoint = new URL(String(input)).pathname;
    if (endpoint === "/fred/series") return Response.json(series);
    if (endpoint === "/fred/series/release") return Response.json(releases);
    if (endpoint === "/fred/release/dates") throw Error("private path api_key=" + fredKey);
    return new Response("api_key=" + fredKey, { status: 403 });
  }) as typeof fetch;
  const handler = createFredMetadataDiagnosticHandler(fetcher, () => secret, () => fredKey);
  const response = await handler(req());
  assert.equal(response.status, 200);
  const report = await response.json();
  assert.equal(report.status, "PARTIAL");
  assert.equal(report.publisherReleaseDates.provenance, "TIDAK TERVERIFIKASI");
  assert.equal(report.valueChangeVintageDates.provenance, "TIDAK TERVERIFIKASI");
  assert.ok(!JSON.stringify(report).includes(fredKey));
  assert.ok(!JSON.stringify(report).includes("private path"));
});

test("fails safe when every metadata endpoint fails and never requests unknown release IDs", async () => {
  let calls = 0;
  const fetcher = (async () => { calls++; return new Response("err", { status: 429 }); }) as typeof fetch;
  const handler = createFredMetadataDiagnosticHandler(fetcher, () => secret, () => fredKey);
  const response = await handler(req());
  assert.equal(response.status, 502);
  assert.equal((await response.json()).status, "UNAVAILABLE");
  assert.equal(calls, 3, "release dates require a qualified release_id first");
});

test("rejects malformed metadata and mixed release IDs instead of inferring provenance", async () => {
  const fetcher = (async (input: string | URL | Request) => {
    const endpoint = new URL(String(input)).pathname;
    if (endpoint === "/fred/series") return Response.json({ seriess: [{ ...series.seriess[0], id: "EFFR" }] });
    if (endpoint === "/fred/series/release") return Response.json(releases);
    if (endpoint === "/fred/release/dates") return Response.json({ release_dates: [{ release_id: 123, date: "2026-10-08" }] });
    return Response.json({ vintage_dates: ["not a date"] });
  }) as typeof fetch;
  const handler = createFredMetadataDiagnosticHandler(fetcher, () => secret, () => fredKey);
  const response = await handler(req());
  assert.equal(response.status, 200);
  const report = await response.json();
  assert.equal(report.status, "PARTIAL");
  assert.equal(report.series.value, null);
  assert.equal(report.publisherReleaseDates.value, null);
  assert.equal(report.valueChangeVintageDates.value, null);
  assert.equal(report.release.value.releaseId, 290);
});
