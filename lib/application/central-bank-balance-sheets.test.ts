import assert from "node:assert/strict";
import test from "node:test";
import type { Observation } from "../domain/types";
import { InMemoryObservationRepository } from "../repositories/memory";
import type { HistoricalObservationRepository, ObservationHistoryQuery } from "../repositories/types";
import { buildCentralBankBalanceSheetReadModel } from "./central-bank-balance-sheets";

const AS_OF = new Date("2026-10-09T12:00:00.000Z");
function fact(
  id: string, key: "ECBASSETSW" | "JPNASSETS", value: string,
  observedAt: string, retrievedAt: string,
  overrides: Partial<Observation> = {},
): Observation {
  return {
    id, domain: "MACRO", subject: key, value, observedAt, retrievedAt,
    sourceId: "fred", quality: "FRESH", evidenceId: `evidence-${id}`,
    metadata: {
      seriesId: key,
      frequency: key === "ECBASSETSW" ? "WEEKLY" : "MONTHLY",
      unit: key === "ECBASSETSW" ? "Millions of Euros" : "100 Million Yen",
    }, ...overrides,
  };
}
class RecordingRepository implements HistoricalObservationRepository {
  queries: ObservationHistoryQuery[] = [];
  constructor(private readonly memory: InMemoryObservationRepository) {}
  async findHistory(query: ObservationHistoryQuery) {
    this.queries.push(query);
    return this.memory.findHistory(query);
  }
}

test("ECB weekly and BoJ monthly facts use only durable native-currency observations at the same cutoff", async () => {
  const memory = new InMemoryObservationRepository();
  await memory.saveMany([
    fact("ecb-prior", "ECBASSETSW", "5915000", "2026-09-25", "2026-09-30T10:00:00Z"),
    fact("ecb-latest", "ECBASSETSW", "5917000", "2026-10-02", "2026-10-07T10:00:00Z"),
    fact("ecb-late-revision", "ECBASSETSW", "9000000", "2026-10-02", "2026-10-11T10:00:00Z"),
    fact("ecb-future", "ECBASSETSW", "9000000", "2026-10-16", "2026-10-08T12:00:00Z"),
    fact("boj-prior", "JPNASSETS", "6442900", "2026-08-01", "2026-09-10T11:00:00Z"),
    fact("boj-latest", "JPNASSETS", "6446600", "2026-09-01", "2026-10-03T11:00:00Z"),
    fact("wrong-unit", "ECBASSETSW", "9999", "2026-10-08", "2026-10-08T10:00:00Z", {
      metadata: { seriesId: "ECBASSETSW", frequency: "WEEKLY", unit: "USD" },
    }),
    fact("wrong-source", "JPNASSETS", "9999", "2026-10-01", "2026-10-08T10:00:00Z", { sourceId: "unknown" }),
  ]);
  const recording = new RecordingRepository(memory);
  const result = await buildCentralBankBalanceSheetReadModel(recording, AS_OF);
  assert.equal(result.asOf, AS_OF.toISOString());
  assert.deepEqual(result.items.map((p) => p.status), ["AVAILABLE", "AVAILABLE"]);
  const [ecb, boj] = result.items;
  assert.equal(ecb.latest?.id, "ecb-latest");
  assert.equal(ecb.latest?.value, 5917000);
  assert.equal(ecb.previous?.id, "ecb-prior");
  assert.equal(ecb.changeFromPrevious, 2000);
  assert.equal(ecb.displayUnit, "juta EUR");
  assert.equal(ecb.cadence, "WEEKLY");
  assert.equal(boj.latest?.id, "boj-latest");
  assert.equal(boj.previous?.id, "boj-prior");
  assert.equal(boj.changeFromPrevious, 3700);
  assert.equal(boj.displayUnit, "100 juta JPY");
  assert.equal(boj.cadence, "MONTHLY");
  assert.deepEqual(recording.queries.map((q) => q.identity.seriesKey), ["ECBASSETSW", "JPNASSETS"]);
  assert.ok(recording.queries.every((q) => q.identity.domain === "MACRO"
    && q.sourceId === "fred" && q.retrievedAtOnOrBefore === AS_OF.toISOString()
    && q.observedAtOnOrBefore === AS_OF.toISOString() && q.limit === 120));
});

test("only one known version per observation period and no fabricated predecessor", async () => {
  const memory = new InMemoryObservationRepository();
  await memory.saveMany([
    fact("first", "ECBASSETSW", "100", "2026-10-02", "2026-10-03T00:00:00Z"),
    fact("revision", "ECBASSETSW", "101", "2026-10-02", "2026-10-08T00:00:00Z"),
  ]);
  const model = await buildCentralBankBalanceSheetReadModel(memory, AS_OF);
  assert.equal(model.items[0].latest?.id, "revision");
  assert.equal(model.items[0].previous, null);
  assert.equal(model.items[0].changeFromPrevious, null);
  assert.equal(model.items[1].status, "MISSING");
  assert.equal(model.items[1].latest, null);
});

test("one failed durable query does not mask the other series and remains explicitly unavailable", async () => {
  const memory = new InMemoryObservationRepository();
  await memory.save(fact("boj-only", "JPNASSETS", "6446600", "2026-09-01", "2026-10-03T11:00:00Z"));
  const history: HistoricalObservationRepository = {
    async findHistory(query) {
      if (query.identity.seriesKey === "ECBASSETSW") throw new Error("upstream unavailable");
      return memory.findHistory(query);
    },
  };
  const model = await buildCentralBankBalanceSheetReadModel(history, AS_OF);
  assert.equal(model.items[0].status, "UNAVAILABLE");
  assert.equal(model.items[0].latest, null);
  assert.equal(model.items[1].status, "AVAILABLE");
  assert.equal(model.items[1].changeFromPrevious, null);
});
