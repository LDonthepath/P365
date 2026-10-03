import assert from "node:assert/strict";
import test from "node:test";
import { fetchGdeltGalCandidateSnapshot } from "./gdelt-gal";

const NOW = new Date("2026-10-04T12:00:00.000Z");

function rss(items: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0"><channel>
    <title>GDELT Article List RSS Feed</title>
    <lastBuildDate>4 Oct 2026 11:59:00 +0000</lastBuildDate>
    ${items}
  </channel></rss>`;
}

test("GDELT GAL parses rolling feed and locally filters BTC candidates", async () => {
  const result = await fetchGdeltGalCandidateSnapshot(
    { asset: "BTC", maxCandidates: 10 },
    {
      now: () => NOW,
      fetch: async () => new Response(rss(`
        <item><title>Bitcoin jumps after surprise policy headline</title><link>https://example.com/bitcoin-jump</link><pubDate>4 Oct 2026 11:58:00 +0000</pubDate></item>
        <item><title>Local weather update</title><link>https://example.com/weather</link><pubDate>4 Oct 2026 11:58:00 +0000</pubDate></item>
      `), { status: 200 }),
    },
  );

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].coverage, "ROLLING_15_MINUTES");
  assert.equal(result.data[0].feedWindowStartAt, "2026-10-04T11:44:00.000Z");
  assert.equal(result.data[0].totalFeedItems, 2);
  assert.equal(result.data[0].candidates.length, 1);
  assert.equal(result.data[0].candidates[0].domain, "example.com");
  assert.equal(result.data[0].candidates[0].providerDateSemantics, "PUBLICATION_OR_FIRST_SEEN");
});

test("GDELT GAL requires market context for generic gold titles", async () => {
  const result = await fetchGdeltGalCandidateSnapshot(
    { asset: "GOLD" },
    {
      now: () => NOW,
      fetch: async () => new Response(rss(`
        <item><title>Team wins gold medal</title><link>https://example.com/sports-gold</link><pubDate>4 Oct 2026 11:58:00 +0000</pubDate></item>
        <item><title>Gold price rises as dollar falls</title><link>https://example.com/gold-price</link><pubDate>4 Oct 2026 11:57:00 +0000</pubDate></item>
      `), { status: 200 }),
    },
  );

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.data[0].candidates.length, 1);
  assert.match(result.data[0].candidates[0].title, /Gold price/);
});

test("GDELT GAL allows missing item pubDate but marks date semantics unavailable", async () => {
  const result = await fetchGdeltGalCandidateSnapshot(
    { asset: "BTC" },
    {
      now: () => NOW,
      fetch: async () => new Response(rss(`
        <item><title>BTC market update</title><link>https://example.com/btc</link></item>
      `), { status: 200 }),
    },
  );

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.data[0].candidates[0].providerDate, null);
  assert.equal(result.data[0].candidates[0].providerDateSemantics, "UNAVAILABLE");
});

test("GDELT GAL de-duplicates exact URLs", async () => {
  const result = await fetchGdeltGalCandidateSnapshot(
    { asset: "BTC" },
    {
      now: () => NOW,
      fetch: async () => new Response(rss(`
        <item><title>Bitcoin update</title><link>https://example.com/btc</link><pubDate>4 Oct 2026 11:58:00 +0000</pubDate></item>
        <item><title>Bitcoin update duplicate</title><link>https://example.com/btc</link><pubDate>4 Oct 2026 11:58:00 +0000</pubDate></item>
      `), { status: 200 }),
    },
  );

  assert.equal(result.data[0].candidates.length, 1);
});

test("GDELT GAL maps upstream HTTP failure through ProviderResult", async () => {
  const result = await fetchGdeltGalCandidateSnapshot(
    { asset: "BTC" },
    { now: () => NOW, fetch: async () => new Response("unavailable", { status: 503 }) },
  );

  assert.equal(result.status, "ERROR");
  assert.equal(result.errorCode, "UPSTREAM_UNAVAILABLE");
});
