import assert from "node:assert/strict";
import {
  compareObservationHistory,
  observationHistoryTimestamp,
  observationSemanticSeriesKey,
  type ObservationHistoryIdentity,
} from "./observation-history";
import {
  compareObservationHistory as repositoryCompareObservationHistory,
  observationHistoryTimestamp as repositoryObservationHistoryTimestamp,
  observationSemanticSeriesKey as repositoryObservationSemanticSeriesKey,
} from "../repositories/observation-history";
import type { Observation } from "./types";
import type { ObservationHistoryIdentity as RepositoryObservationHistoryIdentity } from "../repositories/types";

function observation(
  id: string,
  observedAt: string,
  retrievedAt: string,
  metadata?: Observation["metadata"],
): Observation {
  return {
    id,
    domain: "ASSET",
    subject: "Renamable BTC label",
    value: "100",
    observedAt,
    retrievedAt,
    sourceId: "coingecko",
    evidenceId: "evidence-" + id,
    quality: "FRESH",
    ...(metadata === undefined ? {} : { metadata }),
  };
}

// Golden ordering: effective time, availability/revision time, then stable ID.
const older = observation("older", "2026-10-09T00:00:00.000Z", "2026-10-10T06:00:00.000Z");
const revision1 = observation("revision-1", "2026-10-10T00:00:00.000Z", "2026-10-10T12:00:00.000Z");
const revision2 = observation("revision-2", "2026-10-10T00:00:00.000Z", "2026-10-10T13:00:00.000Z");
const revision3 = observation("revision-3", "2026-10-10T00:00:00.000Z", "2026-10-10T13:00:00.000Z");
const input = [revision3, revision2, older, revision1];
const ascending = [...input].sort(compareObservationHistory).map((item) => item.id);
assert.deepEqual(ascending, ["older", "revision-1", "revision-2", "revision-3"]);
assert.deepEqual(
  [...input].sort((a, b) => compareObservationHistory(b, a)).map((item) => item.id),
  ["revision-3", "revision-2", "revision-1", "older"],
);
assert.equal(compareObservationHistory(revision2, revision2), 0);
assert.deepEqual([...input].sort(repositoryCompareObservationHistory).map((item) => item.id), ascending);

// Golden semantic series identity: repository compatibility must retain metadata
// priority (seriesId > metricId) and missing behavior, without new fallback.
const dual = observation("dual", older.observedAt, older.retrievedAt, {
  seriesId: "DGS10",
  metricId: "btc.spot.usd",
});
const market = observation("market", older.observedAt, older.retrievedAt, {
  seriesId: " ",
  metricId: "btc.spot.usd",
});
const missing = observation("missing", older.observedAt, older.retrievedAt);
assert.equal(observationSemanticSeriesKey(dual), "DGS10");
assert.equal(observationSemanticSeriesKey(market), "btc.spot.usd");
assert.equal(observationSemanticSeriesKey(missing), null);
assert.equal(repositoryObservationSemanticSeriesKey(dual), "DGS10");
assert.equal(repositoryObservationSemanticSeriesKey(market), "btc.spot.usd");
assert.equal(repositoryObservationSemanticSeriesKey(missing), null);

assert.equal(observationHistoryTimestamp("2026-10-10T13:00:00.000Z", "asOf"), 1791637200000);
assert.equal(repositoryObservationHistoryTimestamp("2026-10-10T13:00:00.000Z", "asOf"), 1791637200000);
assert.throws(
  () => observationHistoryTimestamp("invalid-clock", "retrievedAtOnOrBefore"),
  /Invalid retrievedAtOnOrBefore timestamp: invalid-clock/,
);
assert.throws(
  () => compareObservationHistory(
    { ...older, observedAt: "bad" },
    revision1,
  ),
  /Invalid Observation.observedAt timestamp: bad/,
);

// Compile-time compatibility: callers with repository-owned imports still see
// precisely the same structural identity contract after ownership is moved.
const domainIdentity: ObservationHistoryIdentity = { domain: "ASSET", seriesKey: "btc.spot.usd" };
const repositoryIdentity: RepositoryObservationHistoryIdentity = domainIdentity;
assert.deepEqual(repositoryIdentity, { domain: "ASSET", seriesKey: "btc.spot.usd" });

console.log("Domain historical identity and comparator golden fixtures passed.");
