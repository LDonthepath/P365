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

function identity(domain: ObservationDomain, seriesKey: string): ObservationHistoryIdentity {
  return { domain, seriesKey };
}

async function main(): Promise<void> {
  const repository = new InMemoryObservationRepository();
  await repository.saveMany([
    observation("cpi-june-fred", "2026-06-01T00:00:00.000Z", "2026-07-01T00:00:00.000Z"),
    observation("cpi-july-fred", "2026-07-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z"),
    observation("cpi-july-correction", "2026-07-01T00:00:00.000Z", "2026-09-01T00:00:00.000Z", {
      subject: "Renamed CPI label",
    }),
    observation("cpi-august-alternate", "2026-08-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z", {
      sourceId: "qualified-macro-alternate",
      subject: "Alternate provider CPI label",
    }),
    observation("core-cpi", "2026-08-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z", {
      metadata: { seriesId: "CPILFESL" },
    }),
    observation("btc-coingecko", "2026-08-01T00:00:00.000Z", "2026-08-01T00:01:00.000Z", {
      domain: "ASSET",
      sourceId: "coingecko-market",
      subject: "Bitcoin spot price",
      metadata: { metricId: "btc.spot.usd", symbol: "BTC" },
    }),
    observation("btc-alternate", "2026-08-02T00:00:00.000Z", "2026-08-02T00:01:00.000Z", {
      domain: "ASSET",
      sourceId: "qualified-crypto-alternate",
      subject: "BTC/USD",
      metadata: { metricId: "btc.spot.usd", symbol: "BTC" },
    }),
    observation("eth-coingecko", "2026-08-01T00:00:00.000Z", "2026-08-01T00:01:00.000Z", {
      domain: "ASSET",
      sourceId: "coingecko-market",
      metadata: { metricId: "eth.spot.usd", symbol: "ETH" },
    }),
    observation("gold-yahoo", "2026-08-01T00:00:00.000Z", "2026-08-01T00:01:00.000Z", {
      domain: "ASSET",
      sourceId: "yahoo-finance",
      metadata: { metricId: "gold.futures.usd", symbol: "GC=F" },
    }),
    observation("unkeyed-cpi-subject", "2026-05-01T00:00:00.000Z", "2026-06-01T00:00:00.000Z", {
      metadata: {},
    }),
  ]);

  const cpi = identity("MACRO", "CPIAUCSL");

  assertEqual(
    (await repository.findHistory({ identity: cpi, order: "ASC", limit: 10 })).map((item) => item.id),
    ["cpi-june-fred", "cpi-july-fred", "cpi-july-correction", "cpi-august-alternate"],
    "same semantic series continues across source, subject, and canonical ID changes",
  );
  assertEqual(
    (await repository.findHistory({ identity: cpi, order: "DESC", limit: 3 })).map((item) => item.id),
    ["cpi-august-alternate", "cpi-july-correction", "cpi-july-fred"],
    "descending deterministic ordering",
  );
  assertEqual(
    (await repository.findHistory({
      identity: cpi,
      sourceId: "fred",
      order: "ASC",
      limit: 10,
    })).map((item) => item.id),
    ["cpi-june-fred", "cpi-july-fred", "cpi-july-correction"],
    "optional source filter qualifies provenance without defining identity",
  );
  assertEqual(
    (await repository.findHistory({
      identity: cpi,
      observedAtOnOrAfter: "2026-07-01T00:00:00.000Z",
      observedAtOnOrBefore: "2026-07-01T00:00:00.000Z",
      order: "ASC",
      limit: 10,
    })).map((item) => item.id),
    ["cpi-july-fred", "cpi-july-correction"],
    "inclusive effective-time bounds",
  );
  assertEqual(
    (await repository.findHistory({
      identity: cpi,
      retrievedAtOnOrBefore: "2026-08-31T23:59:59.999Z",
      order: "ASC",
      limit: 10,
    })).map((item) => item.id),
    ["cpi-june-fred", "cpi-july-fred"],
    "as-of excludes later correction and observation",
  );
  assertEqual(
    (await repository.findHistory({
      identity: identity("ASSET", "btc.spot.usd"),
      order: "ASC",
      limit: 10,
    })).map((item) => item.id),
    ["btc-coingecko", "btc-alternate"],
    "CoinGecko metric semantics continue across providers",
  );
  assertEqual(
    (await repository.findHistory({
      identity: identity("ASSET", "gold.futures.usd"),
      order: "ASC",
      limit: 10,
    })).map((item) => item.id),
    ["gold-yahoo"],
    "Yahoo cross-asset metric semantics remain queryable",
  );
  assertEqual(
    (await repository.findHistory({
      identity: identity("MACRO", "CPILFESL"),
      order: "ASC",
      limit: 10,
    })).map((item) => item.id),
    ["core-cpi"],
    "different FRED series remains isolated",
  );
  assertEqual(
    await repository.findHistory({ identity: identity("MACRO", "MISSING"), order: "ASC", limit: 10 }),
    [],
    "missing history returns empty without subject fallback",
  );

  await assertRejects("empty semantic series key", () => repository.findHistory({
    identity: identity("MACRO", " "), order: "ASC", limit: 10,
  }));
  await assertRejects("empty provenance filter", () => repository.findHistory({
    identity: cpi, sourceId: " ", order: "ASC", limit: 10,
  }));
  await assertRejects("invalid order", () => repository.findHistory({
    identity: cpi, order: "SIDEWAYS" as "ASC", limit: 10,
  }));
  await assertRejects("invalid limit", () => repository.findHistory({ identity: cpi, order: "ASC", limit: 0 }));
  await assertRejects("excessive limit", () => repository.findHistory({ identity: cpi, order: "ASC", limit: 501 }));
  await assertRejects("invalid availability cutoff", () => repository.findHistory({
    identity: cpi, retrievedAtOnOrBefore: "not-a-time", order: "ASC", limit: 10,
  }));
  await assertRejects("reversed effective bounds", () => repository.findHistory({
    identity: cpi,
    observedAtOnOrAfter: "2026-08-01T00:00:00.000Z",
    observedAtOnOrBefore: "2026-07-01T00:00:00.000Z",
    order: "ASC",
    limit: 10,
  }));
}

void main();
