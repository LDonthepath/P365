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
}

void main();
