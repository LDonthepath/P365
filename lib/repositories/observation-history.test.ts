import type { Observation, ObservationDomain } from "../domain/types";
import { InMemoryObservationRepository } from "./memory";
import type { ObservationHistoryIdentity } from "./types";

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function assertRejects(label: string, action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch {
    return;
  }
  throw new Error(`${label}: expected promise to reject`);
}

function observation(
  id: string,
  observedAt: string,
  retrievedAt: string,
  overrides: Partial<Observation> = {},
): Observation {
  return {
    id,
    domain: "MACRO",
    subject: "A descriptive label that may change",
    value: id,
    observedAt,
    retrievedAt,
    sourceId: "fred",
    quality: "FRESH",
    evidenceId: `evidence-${id}`,
    metadata: { seriesId: "CPIAUCSL" },
    ...overrides,
  };
}

function identity(domain: ObservationDomain, sourceId: string, seriesKey: string): ObservationHistoryIdentity {
  return { domain, sourceId, seriesKey };
}

async function main(): Promise<void> {
  const repository = new InMemoryObservationRepository();
  await repository.saveMany([
    observation("june", "2026-06-01T00:00:00.000Z", "2026-07-01T00:00:00.000Z"),
    observation("july-old", "2026-07-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z"),
    observation("july-correction", "2026-07-01T00:00:00.000Z", "2026-09-01T00:00:00.000Z", {
      subject: "Renamed CPI label",
    }),
    observation("august", "2026-08-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z"),
    observation("other-fred-series", "2026-08-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z", {
      metadata: { seriesId: "CPILFESL" },
    }),
    observation("coingecko-btc", "2026-08-01T00:00:00.000Z", "2026-08-01T00:01:00.000Z", {
      domain: "ASSET",
      sourceId: "coingecko-market",
      subject: "Bitcoin spot price",
      metadata: { metricId: "btc.spot.usd", symbol: "BTC" },
    }),
    observation("coingecko-eth", "2026-08-01T00:00:00.000Z", "2026-08-01T00:01:00.000Z", {
      domain: "ASSET",
      sourceId: "coingecko-market",
      metadata: { metricId: "eth.spot.usd", symbol: "ETH" },
    }),
  ]);

  const cpi = identity("MACRO", "fred", "CPIAUCSL");

  assertEqual(
    (await repository.findHistory({ identity: cpi, order: "ASC", limit: 10 })).map((item) => item.id),
    ["june", "july-old", "july-correction", "august"],
    "ascending deterministic ordering and correction order",
  );
  assertEqual(
    (await repository.findHistory({ identity: cpi, order: "DESC", limit: 3 })).map((item) => item.id),
    ["august", "july-correction", "july-old"],
    "descending deterministic ordering",
  );
  assertEqual(
    (await repository.findHistory({
      identity: cpi,
      observedAtOnOrAfter: "2026-07-01T00:00:00.000Z",
      observedAtOnOrBefore: "2026-07-01T00:00:00.000Z",
      order: "ASC",
      limit: 10,
    })).map((item) => item.id),
    ["july-old", "july-correction"],
    "inclusive effective-time bounds",
  );
  assertEqual(
    (await repository.findHistory({
      identity: cpi,
      retrievedAtOnOrBefore: "2026-08-31T23:59:59.999Z",
      order: "ASC",
      limit: 10,
    })).map((item) => item.id),
    ["june", "july-old"],
    "as-of excludes later correction and later measurement",
  );
  assertEqual(
    (await repository.findHistory({
      identity: identity("ASSET", "coingecko-market", "btc.spot.usd"),
      order: "ASC",
      limit: 10,
    })).map((item) => item.id),
    ["coingecko-btc"],
    "stable metric identity excludes unrelated series",
  );
  assertEqual(
    await repository.findHistory({ identity: identity("MACRO", "fred", "MISSING"), order: "ASC", limit: 10 }),
    [],
    "missing history remains explicit",
  );

  await assertRejects("empty series key", () => repository.findHistory({
    identity: identity("MACRO", "fred", " "), order: "ASC", limit: 10,
  }));
  await assertRejects("invalid limit", () => repository.findHistory({ identity: cpi, order: "ASC", limit: 0 }));
  await assertRejects("excessive limit", () => repository.findHistory({ identity: cpi, order: "ASC", limit: 501 }));
  await assertRejects("invalid availability cutoff", () => repository.findHistory({
    identity: cpi, retrievedAtOnOrBefore: "not-a-time", order: "ASC", limit: 10,
  }));
  await assertRejects("reversed bounds", () => repository.findHistory({
    identity: cpi,
    observedAtOnOrAfter: "2026-08-01T00:00:00.000Z",
    observedAtOnOrBefore: "2026-07-01T00:00:00.000Z",
    order: "ASC",
    limit: 10,
  }));
}

void main();
