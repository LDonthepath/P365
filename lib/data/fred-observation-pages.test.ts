import assert from "node:assert/strict";
import { fetchFredSeriesObservations } from "./fred-observation-pages";
import { MACRO_SERIES_REGISTRY } from "./macro-registry";

type FredPage = {
  count?: number;
  offset?: number;
  limit?: number;
  observations?: Array<{ date?: string; value?: string; realtime_start?: string }>;
};

function fetchPages(pages: FredPage[], urls: URL[]): typeof fetch {
  let index = 0;
  return (async (input: URL | RequestInfo) => {
    urls.push(new URL(input instanceof URL ? input : input.toString()));
    const page = pages[index++];
    assert.ok(page, "unexpected additional FRED page request");
    return new Response(JSON.stringify(page), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

async function main(): Promise<void> {
  const series = MACRO_SERIES_REGISTRY[0];
  const bounds = {
    observationStart: "2020-01-01",
    observationEnd: "2020-01-03",
    limit: 2,
    acquisitionMode: "FRESH" as const,
    requireCompleteRange: true,
  };

  const completedUrls: URL[] = [];
  const completed = await fetchFredSeriesObservations(series, "test-api-key", bounds, fetchPages([
    {
      count: 3,
      offset: 0,
      limit: 2,
      observations: [
        { date: "2020-01-03", value: "3" },
        { date: "2020-01-02", value: "2" },
      ],
    },
    {
      count: 3,
      offset: 2,
      limit: 2,
      observations: [{ date: "2020-01-01", value: "1" }],
    },
  ], completedUrls));
  assert.equal(completed.status, "SUCCESS");
  assert.deepEqual(completed.data.map((item) => item.observationDate), [
    "2020-01-03",
    "2020-01-02",
    "2020-01-01",
  ]);
  assert.deepEqual(completed.data[0]?.provenance, {
    version: "v1",
    providerResource: "/fred/series/observations",
    nativeSeriesId: series.seriesId,
    observationDate: "2020-01-03",
  });
  assert.equal(completed.data[0]?.releasedAt, null, "FRED adapter must not fabricate a release timestamp");
  assert.deepEqual(completedUrls.map((url) => url.searchParams.get("offset")), ["0", "2"]);

  const truncated = await fetchFredSeriesObservations(series, "test-api-key", bounds, fetchPages([
    {
      count: 3,
      offset: 0,
      limit: 2,
      observations: [
        { date: "2020-01-03", value: "3" },
        { date: "2020-01-02", value: "2" },
      ],
    },
    { count: 3, offset: 2, limit: 2, observations: [] },
  ], []));
  assert.equal(truncated.status, "ERROR", "provider truncation must not be reported as success");
  assert.match(truncated.message ?? "", /pagination stopped/);

  const outsideRange = await fetchFredSeriesObservations(series, "test-api-key", bounds, fetchPages([
    {
      count: 1,
      offset: 0,
      limit: 2,
      observations: [{ date: "2019-12-31", value: "1" }],
    },
  ], []));
  assert.equal(outsideRange.status, "ERROR");
  assert.equal(outsideRange.data.length, 0);
  assert.match(outsideRange.message ?? "", /outside requested range/);

  const forwardUrls: URL[] = [];
  const forward = await fetchFredSeriesObservations(series, "test-api-key", {
    limit: 2,
    acquisitionMode: "FRESH",
  }, fetchPages([
    {
      count: 100,
      offset: 0,
      limit: 2,
      observations: [{ date: "2020-01-03", value: "3" }],
    },
  ], forwardUrls));
  assert.equal(forward.status, "SUCCESS");
  assert.equal(forwardUrls.length, 1, "FORWARD must retain the existing single-window behavior");
  assert.equal(forwardUrls[0].searchParams.has("offset"), false);

  // Native-currency ECB / BoJ backfills share the existing bounded FRED adapter.
  // Neither an observation-period date nor a FRED vintage is a publication time.
  for (const caseData of [
    { id: "ECBASSETSW", frequency: "WEEKLY", unit: "Millions of Euros",
      latest: "2026-09-25", predecessor: "2026-09-18", value: "5912178.00000", prior: "5915343.00000" },
    { id: "JPNASSETS", frequency: "MONTHLY", unit: "100 Million Yen",
      latest: "2026-09-01", predecessor: "2026-08-01", value: "6446620", prior: "6442957" },
  ] as const) {
    const definition = MACRO_SERIES_REGISTRY.find((item) => item.seriesId === caseData.id);
    assert.ok(definition, caseData.id);
    assert.equal(definition.frequency, caseData.frequency);
    assert.equal(definition.unit, caseData.unit);
    const requests: URL[] = [];
    const native = await fetchFredSeriesObservations(definition, "test-api-key", {
      observationStart: "2026-07-01", observationEnd: "2026-10-09",
      requireCompleteRange: true, limit: 8, acquisitionMode: "FRESH",
    }, fetchPages([
      { count: 2, offset: 0, limit: 8, observations: [
        { date: caseData.latest, value: caseData.value, realtime_start: "2026-10-09" },
        { date: caseData.predecessor, value: caseData.prior, realtime_start: "2026-10-09" },
      ] },
    ], requests));
    assert.equal(native.status, "SUCCESS", caseData.id);
    assert.equal(native.data.length, 2);
    assert.equal(native.data[0].value, caseData.value, "native value must not be converted to USD");
    assert.equal(native.data[0].observationDate, caseData.latest);
    assert.equal(native.data[0].previousValue, caseData.prior);
    assert.equal(native.data[0].vintageDate, "2026-10-09");
    assert.equal(native.data[0].releasedAt, null);
    assert.equal(native.data[0].provenance.nativeSeriesId, caseData.id);
    assert.equal(requests[0].searchParams.get("series_id"), caseData.id);
    assert.equal(requests[0].searchParams.get("observation_start"), "2026-07-01");
    assert.equal(requests[0].searchParams.get("observation_end"), "2026-10-09");
  }
}

void main();
