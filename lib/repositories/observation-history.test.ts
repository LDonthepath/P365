import type { Observation } from "../domain/types";
import { InMemoryObservationRepository } from "./memory";

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

function observation(id: string, observedAt: string, overrides: Partial<Observation> = {}): Observation {
  return {
    id,
    domain: "MACRO",
    subject: "Consumer Price Index",
    value: id,
    observedAt,
    retrievedAt: "2026-09-18T00:00:00.000Z",
    sourceId: "fred",
    quality: "FRESH",
    evidenceId: `evidence-${id}`,
    metadata: { seriesId: "CPIAUCSL" },
    ...overrides,
  };
}

async function main(): Promise<void> {
  const repository = new InMemoryObservationRepository();
  await repository.saveMany([
    observation("june", "2026-06-01T00:00:00.000Z"),
    observation("july-old", "2026-07-01T00:00:00.000Z", { retrievedAt: "2026-08-01T00:00:00.000Z" }),
    observation("july-correction", "2026-07-01T00:00:00.000Z", { retrievedAt: "2026-09-01T00:00:00.000Z" }),
    observation("august", "2026-08-01T00:00:00.000Z"),
    observation("other-series", "2026-08-01T00:00:00.000Z", { metadata: { seriesId: "CPILFESL" } }),
  ]);

  const identity = { domain: "MACRO" as const, subject: "Consumer Price Index", sourceId: "fred", seriesId: "CPIAUCSL" };

  assertEqual(
    (await repository.findHistory({ identity, order: "DESC", limit: 3 })).map((item) => item.id),
    ["august", "july-correction", "july-old"],
    "descending semantic history with deterministic correction ordering",
  );
  assertEqual(
    (await repository.findHistory({
      identity,
      observedAtOnOrAfter: "2026-07-01T00:00:00.000Z",
      observedAtOnOrBefore: "2026-07-01T00:00:00.000Z",
      order: "ASC",
      limit: 10,
    })).map((item) => item.id),
    ["july-old", "july-correction"],
    "inclusive effective-time bounds",
  );
  assertEqual(
    await repository.findHistory({ identity: { ...identity, seriesId: "MISSING" }, order: "ASC", limit: 10 }),
    [],
    "missing history remains explicit",
  );
  await assertRejects("invalid limit", () => repository.findHistory({ identity, order: "ASC", limit: 0 }));
  await assertRejects("reversed bounds", () => repository.findHistory({
    identity,
    observedAtOnOrAfter: "2026-08-01T00:00:00.000Z",
    observedAtOnOrBefore: "2026-07-01T00:00:00.000Z",
    order: "ASC",
    limit: 10,
  }));
}

void main();
