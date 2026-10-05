import assert from "node:assert/strict";
import test from "node:test";
import { fetchGdeltGalCandidateSnapshot, fetchGdeltGalCandidateSnapshots } from "./gdelt-gal";

const NOW = new Date("2026-10-04T12:00:00.000Z");

function rss(items: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0"><channel>
    <title>GDELT Article List RSS Feed</title>
    <lastBuildDate>4 Oct 2026 11:59:00 +0000</lastBuildDate>
    ${items}
  </channel></rss>`;
}


test("GDELT GAL multi-asset acquisition fetches the feed once and returns BTC plus Gold snapshots", async () => {
  let fetchCalls = 0;
  const result = await fetchGdeltGalCandidateSnapshots(
    { assets: ["BTC", "GOLD"], maxCandidates: 10 },
    {
      now: () => NOW,
      fetch: async () => {
        fetchCalls += 1;
        return new Response(rss(`
          <item><title>Bitcoin rises after macro headline</title><link>https://example.com/bitcoin</link><pubDate>4 Oct 2026 11:58:00 +0000</pubDate></item>
          <item><title>Gold price rises as dollar falls</title><link>https://example.com/gold</link><pubDate>4 Oct 2026 11:57:00 +0000</pubDate></item>
        `), { status: 200 });
      },
    },
  );

  assert.equal(fetchCalls, 1);
  assert.equal(result.status, "SUCCESS");
  assert.deepEqual(result.data.map((snapshot) => snapshot.asset), ["BTC", "GOLD"]);
  assert.equal(result.data[0].candidates.length, 1);
  assert.equal(result.data[1].candidates.length, 1);
  assert.equal(result.data[0].feedLastBuildAt, result.data[1].feedLastBuildAt);
});

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

test("GDELT GAL does not treat lowercase xau URL fragments as Gold ticker evidence", async () => {
  const result = await fetchGdeltGalCandidateSnapshot(
    { asset: "GOLD" },
    {
      now: () => NOW,
      fetch: async () => new Response(rss(`
        <item><title>Phương Tây báo tin xấu cho Thủ tướng Đức Merz</title><link>https://kevesko.vn/20261005/phuong-tay-bao-tin-xau-cho-thu-tuong-duc-merz-44401810.html</link><pubDate>4 Oct 2026 11:58:00 +0000</pubDate></item>
        <item><title>XAU/USD climbs as dollar falls</title><link>https://example.com/markets/xauusd</link><pubDate>4 Oct 2026 11:57:00 +0000</pubDate></item>
      `), { status: 200 }),
    },
  );

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.data[0].candidates.length, 1);
  assert.match(result.data[0].candidates[0].title, /XAU\/USD/);
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


test("GDELT GAL marks candidate coverage truncated without losing total match count", async () => {
  const result = await fetchGdeltGalCandidateSnapshot(
    { asset: "BTC", maxCandidates: 1 },
    {
      now: () => NOW,
      fetch: async () => new Response(rss(`
        <item><title>Bitcoin headline one</title><link>https://example.com/btc-1</link><pubDate>4 Oct 2026 11:58:00 +0000</pubDate></item>
        <item><title>Bitcoin headline two</title><link>https://example.com/btc-2</link><pubDate>4 Oct 2026 11:57:00 +0000</pubDate></item>
      `), { status: 200 }),
    },
  );

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.data[0].candidates.length, 1);
  assert.equal(result.data[0].matchingCandidateCount, 2);
  assert.equal(result.data[0].candidateCoverage, "TRUNCATED");
});

test("GDELT GAL maps upstream HTTP failure through ProviderResult", async () => {
  const result = await fetchGdeltGalCandidateSnapshot(
    { asset: "BTC" },
    { now: () => NOW, fetch: async () => new Response("unavailable", { status: 503 }) },
  );

  assert.equal(result.status, "ERROR");
  assert.equal(result.errorCode, "UPSTREAM_UNAVAILABLE");
});


test("GDELT GAL skips malformed individual items without failing the feed", async () => {
  const result = await fetchGdeltGalCandidateSnapshot(
    { asset: "BTC" },
    {
      now: () => NOW,
      fetch: async () => new Response(rss(`
        <item><title></title><link>https://example.com/blank</link></item>
        <item><title>Bitcoin market update</title><link>https://example.com/bitcoin</link><pubDate>4 Oct 2026 11:58:00 +0000</pubDate></item>
      `), { status: 200 }),
    },
  );

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.data[0].invalidItemCount, 1);
  assert.equal(result.data[0].candidates.length, 1);
});


test("generic crypto pages do not qualify as BTC candidates", async () => {
  const result = await fetchGdeltGalCandidateSnapshot(
    { asset: "BTC" },
    {
      now: () => NOW,
      fetch: async () => new Response(rss(`
        <item><title>Crypto markets rise as altcoins rally</title><link>https://example.com/crypto-altcoins</link><pubDate>4 Oct 2026 11:58:00 +0000</pubDate></item>
        <item><title>Bitcoin rises after macro headline</title><link>https://example.com/bitcoin-macro</link><pubDate>4 Oct 2026 11:57:00 +0000</pubDate></item>
      `), { status: 200 }),
    },
  );

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.data[0].candidates.length, 1);
  assert.match(result.data[0].candidates[0].title, /Bitcoin/);
});
