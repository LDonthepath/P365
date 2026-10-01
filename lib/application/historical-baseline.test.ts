import assert from "node:assert/strict";
import test from "node:test";
import { measureRepositoryBackedHistoricalBaseline } from "./historical-baseline";
import type { DataQuality, Observation } from "../domain/types";
import type { HistoricalObservationRepository, ObservationHistoryQuery } from "../repositories/types";

function observation(input: {
  id: string;
  observedAt: string;
  retrievedAt: string;
  value: string;
  quality?: DataQuality;
  sourceId?: string;
  seriesKey?: string;
  unit?: string;
  frequency?: string;
}): Observation {
  const seriesKey = input.seriesKey ?? "btc.spot.usd";
  return {
    id: input.id,
    domain: "ASSET",
    subject: seriesKey,
    value: input.value,
    observedAt: input.observedAt,
    retrievedAt: input.retrievedAt,
    sourceId: input.sourceId ?? "test",
    quality: input.quality ?? "FRESH",
    evidenceId: "e-" + input.id,
    identity: {
      version: "v1",
      seriesKey,
      measurementId: "m-" + input.id,
      revisionFingerprint: "r-" + input.id,
    },
    metadata: {
      metricId: seriesKey,
      unit: input.unit ?? "USD",
      frequency: input.frequency ?? "5m",
    },
  };
}

class MemoryHistory implements HistoricalObservationRepository {
  constructor(
    private readonly rows: Observation[],
    private readonly fail = false,
  ) {}

  async findHistory(query: ObservationHistoryQuery): Promise<Observation[]> {
    if (this.fail) throw new Error("synthetic repository failure");
    const rows = this.rows
      .filter((o) =>
        o.domain === query.identity.domain
        && o.identity?.seriesKey === query.identity.seriesKey
        && (!query.sourceId || o.sourceId === query.sourceId)
        && (!query.retrievedAtOnOrBefore || o.retrievedAt <= query.retrievedAtOnOrBefore)
        && (!query.observedAtOnOrAfter || o.observedAt >= query.observedAtOnOrAfter)
        && (!query.observedAtOnOrBefore || o.observedAt <= query.observedAtOnOrBefore))
      .sort((a, b) => {
        const sign = query.order === "ASC" ? 1 : -1;
        return sign * (
          a.observedAt.localeCompare(b.observedAt)
          || a.retrievedAt.localeCompare(b.retrievedAt)
          || a.id.localeCompare(b.id)
        );
      });
    return rows.slice(0, query.limit);
  }
}

const levelMethodology = {
  methodologyId: "hist-level-test",
  methodologyVersion: "v1",
  identity: { domain: "ASSET" as const, seriesKey: "btc.spot.usd" },
  sourceId: "test",
  transformation: "LEVEL" as const,
  observedAtOnOrAfter: "2026-01-01T00:00:00.000Z",
  observedAtOnOrBefore: "2026-01-03T00:00:00.000Z",
  asOf: "2026-01-04T12:00:00.000Z",
  minimumSampleSize: 3,
};

test("HIST-001B builds a point-in-time LEVEL distribution and excludes later-known revisions", async () => {
  const repo = new MemoryHistory([
    observation({ id: "h1", observedAt: "2026-01-01T00:00:00.000Z", retrievedAt: "2026-01-01T01:00:00.000Z", value: "1" }),
    observation({ id: "h2", observedAt: "2026-01-02T00:00:00.000Z", retrievedAt: "2026-01-02T01:00:00.000Z", value: "2" }),
    observation({ id: "h2-late", observedAt: "2026-01-02T00:00:00.000Z", retrievedAt: "2026-01-05T01:00:00.000Z", value: "200" }),
    observation({ id: "h3", observedAt: "2026-01-03T00:00:00.000Z", retrievedAt: "2026-01-03T01:00:00.000Z", value: "3" }),
  ]);
  const target = observation({
    id: "target",
    observedAt: "2026-01-04T00:00:00.000Z",
    retrievedAt: "2026-01-04T01:00:00.000Z",
    value: "2",
  });

  const result = await measureRepositoryBackedHistoricalBaseline({
    methodology: levelMethodology,
    repository: repo,
    targetEnd: target,
  });

  assert.equal(result.status, "VALID");
  assert.equal(result.sampleSize, 3);
  assert.equal(result.minimum, 1);
  assert.equal(result.maximum, 3);
  assert.equal(result.median, 2);
  assert.equal(result.percentileRank, 50);
  assert.deepEqual(result.samples.map((sample) => sample.endObservationId), ["h1", "h2", "h3"]);
});

test("HIST-001B historical fitness keeps STALE facts and excludes UNKNOWN/PARTIAL", async () => {
  const repo = new MemoryHistory([
    observation({ id: "stale", observedAt: "2026-01-01T00:00:00.000Z", retrievedAt: "2026-01-01T01:00:00.000Z", value: "1", quality: "STALE" }),
    observation({ id: "unknown", observedAt: "2026-01-02T00:00:00.000Z", retrievedAt: "2026-01-02T01:00:00.000Z", value: "2", quality: "UNKNOWN" }),
    observation({ id: "partial", observedAt: "2026-01-03T00:00:00.000Z", retrievedAt: "2026-01-03T01:00:00.000Z", value: "3", quality: "PARTIAL" }),
    observation({ id: "fresh", observedAt: "2026-01-03T12:00:00.000Z", retrievedAt: "2026-01-03T13:00:00.000Z", value: "4" }),
  ]);
  const target = observation({
    id: "target",
    observedAt: "2026-01-04T00:00:00.000Z",
    retrievedAt: "2026-01-04T01:00:00.000Z",
    value: "2",
  });

  const result = await measureRepositoryBackedHistoricalBaseline({
    methodology: {
      ...levelMethodology,
      observedAtOnOrBefore: "2026-01-03T12:00:00.000Z",
      minimumSampleSize: 2,
    },
    repository: repo,
    targetEnd: target,
  });

  assert.equal(result.status, "VALID");
  assert.deepEqual(result.samples.map((sample) => sample.endObservationId), ["stale", "fresh"]);
});

test("HIST-001B PERCENT_CHANGE uses exact horizon pairs and does not interpolate", async () => {
  const methodology = {
    methodologyId: "hist-5m-return",
    methodologyVersion: "v1",
    identity: { domain: "ASSET" as const, seriesKey: "btc.spot.usd" },
    sourceId: "test",
    transformation: "PERCENT_CHANGE" as const,
    observedAtOnOrAfter: "2026-01-01T00:05:00.000Z",
    observedAtOnOrBefore: "2026-01-01T00:10:00.000Z",
    asOf: "2026-01-01T00:21:00.000Z",
    minimumSampleSize: 2,
    comparisonHorizonMs: 5 * 60 * 1000,
  };
  const repo = new MemoryHistory([
    observation({ id: "p0", observedAt: "2026-01-01T00:00:00.000Z", retrievedAt: "2026-01-01T00:01:00.000Z", value: "100" }),
    observation({ id: "p1", observedAt: "2026-01-01T00:05:00.000Z", retrievedAt: "2026-01-01T00:06:00.000Z", value: "101" }),
    observation({ id: "off-grid", observedAt: "2026-01-01T00:07:00.000Z", retrievedAt: "2026-01-01T00:08:00.000Z", value: "500" }),
    observation({ id: "p2", observedAt: "2026-01-01T00:10:00.000Z", retrievedAt: "2026-01-01T00:11:00.000Z", value: "103" }),
  ]);
  const targetStart = observation({
    id: "target-start",
    observedAt: "2026-01-01T00:15:00.000Z",
    retrievedAt: "2026-01-01T00:16:00.000Z",
    value: "104",
  });
  const targetEnd = observation({
    id: "target-end",
    observedAt: "2026-01-01T00:20:00.000Z",
    retrievedAt: "2026-01-01T00:21:00.000Z",
    value: "106",
  });

  const result = await measureRepositoryBackedHistoricalBaseline({
    methodology,
    repository: repo,
    targetStart,
    targetEnd,
  });

  assert.equal(result.status, "VALID");
  assert.equal(result.sampleSize, 2);
  assert.deepEqual(result.samples.map((sample) => [sample.startObservationId, sample.endObservationId]), [
    ["p0", "p1"],
    ["p1", "p2"],
  ]);
  assert.equal(result.targetObservationIds[0], "target-start");
  assert.equal(result.targetObservationIds[1], "target-end");
});

test("HIST-001B skips zero-denominator percentage samples and fails closed below minimum", async () => {
  const methodology = {
    methodologyId: "hist-zero-denominator",
    methodologyVersion: "v1",
    identity: { domain: "ASSET" as const, seriesKey: "btc.spot.usd" },
    sourceId: "test",
    transformation: "PERCENT_CHANGE" as const,
    observedAtOnOrAfter: "2026-01-01T00:05:00.000Z",
    observedAtOnOrBefore: "2026-01-01T00:10:00.000Z",
    asOf: "2026-01-01T00:21:00.000Z",
    minimumSampleSize: 2,
    comparisonHorizonMs: 5 * 60 * 1000,
  };
  const repo = new MemoryHistory([
    observation({ id: "z0", observedAt: "2026-01-01T00:00:00.000Z", retrievedAt: "2026-01-01T00:01:00.000Z", value: "0" }),
    observation({ id: "z1", observedAt: "2026-01-01T00:05:00.000Z", retrievedAt: "2026-01-01T00:06:00.000Z", value: "10" }),
    observation({ id: "z2", observedAt: "2026-01-01T00:10:00.000Z", retrievedAt: "2026-01-01T00:11:00.000Z", value: "20" }),
  ]);
  const targetStart = observation({ id: "ts", observedAt: "2026-01-01T00:15:00.000Z", retrievedAt: "2026-01-01T00:16:00.000Z", value: "20" });
  const targetEnd = observation({ id: "te", observedAt: "2026-01-01T00:20:00.000Z", retrievedAt: "2026-01-01T00:21:00.000Z", value: "30" });

  const result = await measureRepositoryBackedHistoricalBaseline({
    methodology,
    repository: repo,
    targetStart,
    targetEnd,
  });

  assert.equal(result.status, "INSUFFICIENT_DATA");
  assert.equal(result.sampleSize, 1);
  assert.equal(result.samples[0].startObservationId, "z1");
  assert.equal(result.samples[0].endObservationId, "z2");
});

test("HIST-001B returns UNKNOWN on repository failure", async () => {
  const target = observation({
    id: "target",
    observedAt: "2026-01-04T00:00:00.000Z",
    retrievedAt: "2026-01-04T01:00:00.000Z",
    value: "2",
  });
  const result = await measureRepositoryBackedHistoricalBaseline({
    methodology: levelMethodology,
    repository: new MemoryHistory([], true),
    targetEnd: target,
  });
  assert.equal(result.status, "UNKNOWN");
  assert.match(result.reason ?? "", /repository read failed/);
});

test("HIST-001B rejects incompatible target source instead of silently mixing providers", async () => {
  const target = observation({
    id: "target-other-source",
    observedAt: "2026-01-04T00:00:00.000Z",
    retrievedAt: "2026-01-04T01:00:00.000Z",
    value: "2",
    sourceId: "other",
  });
  const result = await measureRepositoryBackedHistoricalBaseline({
    methodology: levelMethodology,
    repository: new MemoryHistory([]),
    targetEnd: target,
  });
  assert.equal(result.status, "INCOMPATIBLE");
});

test("HIST-001B fails closed when the bounded history query reaches 500 rows", async () => {
  const rows = Array.from({ length: 500 }, (_, index) => observation({
    id: "row-" + index,
    observedAt: new Date(Date.UTC(2026, 0, 1, 0, index, 0)).toISOString(),
    retrievedAt: new Date(Date.UTC(2026, 0, 1, 0, index, 30)).toISOString(),
    value: String(index + 1),
  }));
  const target = observation({
    id: "target",
    observedAt: "2026-01-02T00:00:00.000Z",
    retrievedAt: "2026-01-02T01:00:00.000Z",
    value: "100",
  });
  const result = await measureRepositoryBackedHistoricalBaseline({
    methodology: {
      ...levelMethodology,
      observedAtOnOrAfter: rows[0].observedAt,
      observedAtOnOrBefore: rows[rows.length - 1].observedAt,
      asOf: "2026-01-02T02:00:00.000Z",
      minimumSampleSize: 20,
    },
    repository: new MemoryHistory(rows),
    targetEnd: target,
  });
  assert.equal(result.status, "UNKNOWN");
  assert.match(result.reason ?? "", /bounded repository limit/);
});

test("HIST-001B identity is deterministic across repository candidate ordering", async () => {
  const rows = [
    observation({ id: "h1", observedAt: "2026-01-01T00:00:00.000Z", retrievedAt: "2026-01-01T01:00:00.000Z", value: "1" }),
    observation({ id: "h2", observedAt: "2026-01-02T00:00:00.000Z", retrievedAt: "2026-01-02T01:00:00.000Z", value: "2" }),
    observation({ id: "h3", observedAt: "2026-01-03T00:00:00.000Z", retrievedAt: "2026-01-03T01:00:00.000Z", value: "3" }),
  ];
  const target = observation({
    id: "target",
    observedAt: "2026-01-04T00:00:00.000Z",
    retrievedAt: "2026-01-04T01:00:00.000Z",
    value: "4",
  });

  const a = await measureRepositoryBackedHistoricalBaseline({
    methodology: levelMethodology,
    repository: new MemoryHistory(rows),
    targetEnd: target,
  });
  const b = await measureRepositoryBackedHistoricalBaseline({
    methodology: levelMethodology,
    repository: new MemoryHistory([...rows].reverse()),
    targetEnd: target,
  });

  assert.equal(a.id, b.id);
  assert.deepEqual(a.samples, b.samples);
});
