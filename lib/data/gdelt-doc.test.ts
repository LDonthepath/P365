import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchGdeltMoveWindowArticles,
  gdeltQueryForAsset,
} from "./gdelt-doc";

const NOW = new Date("2026-10-04T12:00:00.000Z");

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status });
}

test("GDELT builds an exact BTC move-window ArticleList query without credentials", async () => {
  let requestedUrl = "";
  const result = await fetchGdeltMoveWindowArticles(
    {
      asset: "BTC",
      startAt: "2026-10-04T10:00:00.000Z",
      endAt: "2026-10-04T11:00:00.000Z",
      maxRecords: 25,
    },
    {
      now: () => NOW,
      fetch: async (input) => {
        requestedUrl = String(input);
        return json({
          articles: [{
            url: "https://example.com/story",
            title: "Bitcoin moves after unexpected announcement",
            seendate: "20261004T103000Z",
            domain: "example.com",
            language: "English",
            sourcecountry: "United States",
          }],
        });
      },
    },
  );

  assert.equal(result.status, "SUCCESS");
  const url = new URL(requestedUrl);
  assert.equal(url.hostname, "api.gdeltproject.org");
  assert.equal(url.searchParams.get("mode"), "artlist");
  assert.equal(url.searchParams.get("format"), "json");
  assert.equal(url.searchParams.get("sort"), "datedesc");
  assert.equal(url.searchParams.get("maxrecords"), "25");
  assert.equal(url.searchParams.get("startdatetime"), "20261004100000");
  assert.equal(url.searchParams.get("enddatetime"), "20261004110000");
  assert.equal(url.searchParams.get("query"), gdeltQueryForAsset("BTC"));
  assert.equal(result.data[0].providerDateSemantics, "PUBLICATION_OR_FIRST_SEEN");
  assert.equal(result.data[0].providerDate, "2026-10-04T10:30:00.000Z");
});

test("GDELT de-duplicates exact article URLs and derives domain when absent", async () => {
  const payload = {
    articles: [
      {
        url: "https://news.example.com/a",
        title: "Gold headline",
        seendate: "20261004T103000Z",
        language: "English",
        sourcecountry: "United Kingdom",
      },
      {
        url: "https://news.example.com/a",
        title: "Gold headline duplicate",
        seendate: "20261004T103000Z",
        language: "English",
        sourcecountry: "United Kingdom",
      },
    ],
  };
  const result = await fetchGdeltMoveWindowArticles(
    { asset: "GOLD", startAt: "2026-10-04T10:00:00Z", endAt: "2026-10-04T11:00:00Z" },
    { now: () => NOW, fetch: async () => json(payload) },
  );
  assert.equal(result.status, "SUCCESS");
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].domain, "news.example.com");
});

test("GDELT fails closed when providerDate falls outside requested move window", async () => {
  const result = await fetchGdeltMoveWindowArticles(
    { asset: "BTC", startAt: "2026-10-04T10:00:00Z", endAt: "2026-10-04T11:00:00Z" },
    {
      now: () => NOW,
      fetch: async () => json({
        articles: [{
          url: "https://example.com/late",
          title: "Late story",
          seendate: "20261004T113000Z",
          domain: "example.com",
        }],
      }),
    },
  );
  assert.equal(result.status, "ERROR");
  assert.equal(result.errorCode, "MALFORMED_PAYLOAD");
});

test("GDELT enforces a bounded maximum six-hour query window", async () => {
  const result = await fetchGdeltMoveWindowArticles(
    { asset: "BTC", startAt: "2026-10-04T00:00:00Z", endAt: "2026-10-04T07:00:00Z" },
    { now: () => NOW, fetch: async () => json({ articles: [] }) },
  );
  assert.equal(result.status, "ERROR");
  assert.match(result.message ?? "", /must not exceed 6 hours/);
});

test("GDELT maps HTTP 429 through existing ProviderResult rate-limit semantics", async () => {
  const result = await fetchGdeltMoveWindowArticles(
    { asset: "BTC", startAt: "2026-10-04T10:00:00Z", endAt: "2026-10-04T11:00:00Z" },
    { now: () => NOW, fetch: async () => new Response("rate limited", { status: 429 }) },
  );
  assert.equal(result.status, "ERROR");
  assert.equal(result.errorCode, "RATE_LIMIT");
});
