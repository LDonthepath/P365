import assert from "node:assert/strict";
import test from "node:test";
import { qualifyGdeltGalSharedFeed, fetchGdeltGalCandidateSnapshots } from "../data/gdelt-gal";
import { createGdeltMacroQualificationHandler } from "./gdelt-macro-qualification-http";

const xml = `<rss><channel><lastBuildDate>4 Oct 2026 11:59:00 +0000</lastBuildDate>
<item><title>Federal Reserve raises interest rates</title><link>https://example.com/policy</link></item>
<item><title>Bitcoin rises</title><link>https://example.com/btc</link></item>
<item><title>Gold price rises</title><link>https://example.com/gold</link></item>
<item><title>Invalid</title><link>bad</link></item></channel></rss>`;

test("single shared acquisition preserves legacy asset projections and date semantics", async () => {
  let calls = 0;
  const dependencies = { now: () => new Date("2026-10-04T12:00:00Z"), fetch: async () => {
    calls++; return new Response(xml);
  } };
  const result = await qualifyGdeltGalSharedFeed(dependencies);
  assert.equal(calls, 1);
  assert.equal(result.status, "SUCCESS");
  const report = result.data[0];
  assert.equal(report.writesPerformed, false);
  assert.equal(report.inputRssBytes, new TextEncoder().encode(xml).byteLength);
  assert.equal(report.invalidItemCount, 1);
  assert.equal(report.macro.matchingCandidateCount, 1);
  assert.equal(report.macro.candidates[0].providerDateSemantics, "UNAVAILABLE");
  assert.equal(report.feedWindowStartAt, "2026-10-04T11:44:00.000Z");
  const legacy = await fetchGdeltGalCandidateSnapshots({ assets: ["BTC", "GOLD"] }, dependencies);
  assert.deepEqual(report.assetSnapshots, legacy.data);
});

test("provider failure stays ERROR without fabricated candidates", async () => {
  const result = await qualifyGdeltGalSharedFeed({ fetch: async () => new Response("Unavailable", { status: 503 }) });
  assert.equal(result.status, "ERROR");
  assert.deepEqual(result.data, []);
});

test("qualification HTTP is preview-only, uncached and write-free", async () => {
  let calls = 0;
  const runner = async () => { calls++; return qualifyGdeltGalSharedFeed({ fetch: async () => new Response(xml) }); };
  for (const environment of ["production", "development", undefined]) {
    assert.equal((await createGdeltMacroQualificationHandler(runner, () => environment)()).status, 404);
  }
  assert.equal(calls, 0);
  const response = await createGdeltMacroQualificationHandler(runner, () => "preview")();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).writesPerformed, false);
  const failed = await createGdeltMacroQualificationHandler(async () => { throw new Error("secret"); }, () => "preview")();
  assert.equal(failed.status, 502);
  assert.ok(!(await failed.text()).includes("secret"));
});
