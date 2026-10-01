import assert from "node:assert/strict";
import test from "node:test";
import type { HistoricalObservationRepository, ObservationHistoryQuery } from "../repositories/types";
import { withHistoricalObservationConcurrencyLimit } from "./historical-observation-concurrency";

const QUERY: ObservationHistoryQuery = {
  identity: { domain: "MACRO", seriesKey: "DGS2" },
  order: "DESC",
  limit: 1,
};

test("historical observation concurrency wrapper never exceeds its configured limit", async () => {
  let active = 0;
  let maxActive = 0;
  const releases: Array<() => void> = [];

  const repository: HistoricalObservationRepository = {
    async findHistory() {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((resolve) => {
        releases.push(resolve);
      });
      active -= 1;
      return [];
    },
  };

  const limited = withHistoricalObservationConcurrencyLimit(repository, 2);
  const pending = Array.from({ length: 5 }, () => limited.findHistory(QUERY));

  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(active, 2);
  assert.equal(maxActive, 2);
  assert.equal(releases.length, 2);

  while (releases.length) {
    releases.shift()?.();
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  await Promise.all(pending);
  assert.equal(maxActive, 2);
  assert.equal(active, 0);
});

test("historical observation concurrency wrapper rejects invalid limits", () => {
  const repository: HistoricalObservationRepository = {
    async findHistory() {
      return [];
    },
  };

  assert.throws(
    () => withHistoricalObservationConcurrencyLimit(repository, 0),
    /positive integer/,
  );
});
