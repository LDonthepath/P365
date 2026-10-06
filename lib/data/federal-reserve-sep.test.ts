import assert from "node:assert/strict";
import test from "node:test";
import {
  discoverFederalReserveSepSources,
  federalReserveSepMedianSeriesKey,
  federalReserveSepParticipantSeriesKey,
  parseFederalReserveSepHtml,
} from "./federal-reserve-sep";

const SEP_HTML = `
<html>
<body>
<h3>September 16, 2026: FOMC Projections materials, accessible version</h3>
<p>For release at 2:00 p.m., EDT, September 16, 2026</p>
<h4>Summary of Economic Projections</h4>
<p>In conjunction with the Federal Open Market Committee (FOMC) meeting held on September 15–16, 2026, meeting participants submitted their projections.</p>
<table>
  <tr><th>Variable</th><th colspan="5">Median</th><th colspan="5">Central Tendency</th><th colspan="5">Range</th></tr>
  <tr>
    <th></th><th>2026</th><th>2027</th><th>2028</th><th>2029</th><th>Longer run</th>
    <th>2026</th><th>2027</th><th>2028</th><th>2029</th><th>Longer run</th>
    <th>2026</th><th>2027</th><th>2028</th><th>2029</th><th>Longer run</th>
  </tr>
  <tr>
    <th>Federal funds rate</th>
    <td>4.1</td><td>4.1</td><td>3.9</td><td>3.6</td><td>3.2</td>
    <td>4.1–4.4</td><td>3.6–4.4</td><td>3.1–4.1</td><td>3.1–3.6</td><td>3.0–3.6</td>
    <td>3.9–4.4</td><td>3.1–4.4</td><td>3.1–4.1</td><td>2.9–3.9</td><td>2.9–3.9</td>
  </tr>
</table>
<h4>Figure 2. FOMC participants' assessments of appropriate monetary policy: Midpoint of target range or target level for the federal funds rate</h4>
<table>
  <tr><th>Midpoint of target range or target level (Percent)</th><th>2026</th><th>2027</th><th>2028</th><th>2029</th><th>Longer run</th></tr>
  <tr><th>4.125</th><td>12</td><td>6</td><td>4</td><td></td><td></td></tr>
  <tr><th>3.875</th><td>2</td><td></td><td>5</td><td>3</td><td>2</td></tr>
  <tr><th>3.625</th><td></td><td>3</td><td>3</td><td>7</td><td>2</td></tr>
  <tr><th>3.000</th><td></td><td></td><td></td><td></td><td>6</td></tr>
</table>
<p>Each participant's projections for the federal funds rate are rounded to the nearest 1/8 percentage point.</p>
</body>
</html>
`;

test("discovers the latest published accessible SEP resource without guessing future URLs", () => {
  const calendar = `
    <a href="/monetarypolicy/fomcprojtabl20260617.htm">HTML</a>
    <a href="/monetarypolicy/fomcprojtabl20260916.htm">HTML</a>
    <a href="/monetarypolicy/files/fomcprojtabl20260916.pdf">PDF</a>
  `;
  const sources = discoverFederalReserveSepSources(calendar, new Date("2026-10-06T00:00:00.000Z"));
  assert.deepEqual(sources.map((item) => item.releaseDate), ["2026-09-16", "2026-06-17"]);
  assert.equal(sources[0]?.providerResource, "/monetarypolicy/fomcprojtabl20260916.htm");
});

test("parses source-published medians and nonzero Figure 2 participant buckets", () => {
  const source = {
    sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomcprojtabl20260916.htm",
    providerResource: "/monetarypolicy/fomcprojtabl20260916.htm",
    releaseDate: "2026-09-16",
  };
  const rows = parseFederalReserveSepHtml(SEP_HTML, source, "2026-10-06T13:10:00.000Z");
  const medians = rows.filter((item) => item.factType === "PUBLISHED_MEDIAN");
  const counts = rows.filter((item) => item.factType === "PARTICIPANT_COUNT");

  assert.equal(medians.length, 5);
  assert.deepEqual(medians.map((item) => item.horizon), [
    "YEAR_END_2026",
    "YEAR_END_2027",
    "YEAR_END_2028",
    "YEAR_END_2029",
    "LONGER_RUN",
  ]);
  assert.deepEqual(medians.map((item) => item.value), [4.1, 4.1, 3.9, 3.6, 3.2]);
  assert.ok(counts.length > 0);
  assert.ok(counts.every((item) => Number.isInteger(item.value) && item.value > 0));
  assert.equal(rows[0]?.observedAt, "2026-09-16T18:00:00.000Z");
  assert.equal(rows[0]?.meetingStartDate, "2026-09-15");
  assert.equal(rows[0]?.meetingEndDate, "2026-09-16");

  const median2027 = rows.find((item) =>
    item.metricId === federalReserveSepMedianSeriesKey("YEAR_END_2027"));
  assert.equal(median2027?.value, 4.1);

  const bucket = rows.find((item) =>
    item.metricId === federalReserveSepParticipantSeriesKey("YEAR_END_2026", 4.125));
  assert.equal(bucket?.value, 12);
  assert.equal(bucket?.metadata.midpointPct, 4.125);
  assert.equal(bucket?.metadata.dotRoundingIncrementPct, 0.125);
});

test("fails closed when source schema evidence is incomplete", () => {
  const source = {
    sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomcprojtabl20260916.htm",
    providerResource: "/monetarypolicy/fomcprojtabl20260916.htm",
    releaseDate: "2026-09-16",
  };
  assert.throws(
    () => parseFederalReserveSepHtml(
      SEP_HTML.replace("nearest 1/8 percentage point", "rounded values"),
      source,
      "2026-10-06T13:10:00.000Z",
    ),
    /dot-rounding note is missing/,
  );
});
