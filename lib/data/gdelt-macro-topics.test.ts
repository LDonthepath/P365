import assert from "node:assert/strict";
import test from "node:test";
import { extractGdeltMacroCandidates, gdeltMacroTopics, GDELT_MACRO_TOPICS } from "./gdelt-macro-topics";

const titles = [
  "Federal Reserve raises interest rates", "Japan CPI inflation report",
  "PBoC cuts reserve requirement for bank funding", "China announces new trade tariffs",
  "US Treasury yields surge", "Iran missile conflict disrupts shipping",
];
function article(title: string, index = 0) {
  return { title, url: `https://example.com/${index}`, domain: "example.com", providerDate: null,
    providerDateSemantics: "UNAVAILABLE" as const };
}

test("six macro families match without BTC or Gold, while broad lexical collisions stay out", () => {
  titles.forEach((title, i) => assert.ok(gdeltMacroTopics(title).includes(GDELT_MACRO_TOPICS[i])));
  for (const title of ["Tips for lower mortgage rates", "Fed up after ten minutes", "Japan wins gold medal", "China weather report", "Interest rates guide", "Bitcoin price rises"]) {
    assert.deepEqual(gdeltMacroTopics(title), [], title);
  }
});

test("topic round robin prevents one abundant family starving other families", () => {
  const items = Array.from({ length: 40 }, (_, i) => article(titles[0], i));
  items.push(...titles.slice(1).map((title, i) => article(title, i + 40)));
  const result = extractGdeltMacroCandidates(items, 6);
  assert.equal(result.matchingCandidateCount, 45);
  assert.equal(result.candidateCoverage, "TRUNCATED");
  for (const topic of GDELT_MACRO_TOPICS) assert.ok(result.candidates.some((item) => item.topics.includes(topic)));
  assert.deepEqual(result.candidates.map((item) => item.url), [0, 40, 41, 42, 43, 44].map((i) => `https://example.com/${i}`));
});

test("dedupe retains multiple topic labels and counts before bounds", () => {
  const multi = article("China sanctions Iran shipping", 1);
  const result = extractGdeltMacroCandidates([multi, multi, article("Weather", 2), article(titles[0] + " " + "x".repeat(1025), 3)]);
  assert.equal(result.duplicateUrlCount, 1);
  assert.equal(result.unmatchedCount, 1);
  assert.equal(result.overlargeMatchedCount, 1);
  assert.equal(result.matchingCandidateCount, 2);
  assert.deepEqual(result.candidates[0].topics, ["FISCAL_TRADE", "GEOPOLITICAL_SUPPLY"]);
  assert.equal(result.candidates[0].providerDate, null);
  assert.equal(result.candidateBytes, new TextEncoder().encode(JSON.stringify(result.candidates)).byteLength);
});

test("candidate JSON bytes stay bounded even with multibyte titles and maximum count", () => {
  const items = Array.from({ length: 100 }, (_, i) => article(titles[0] + " 文".repeat(400), i));
  const result = extractGdeltMacroCandidates(items, 100);
  assert.ok(result.candidateBytes <= result.candidateByteLimit);
  assert.ok(result.byteExcludedCount > 0);
  assert.equal(result.matchingCandidateCount, 100);
  assert.equal(result.candidateCoverage, "TRUNCATED");
  for (const limit of [0, 101, 1.5]) assert.throws(() => extractGdeltMacroCandidates([], limit));
});
