import type {
  HistoricalObservationRepository,
  ObservationHistoryQuery,
} from "../repositories/types";

export function withHistoricalObservationConcurrencyLimit(
  repository: HistoricalObservationRepository,
  maxConcurrent: number,
): HistoricalObservationRepository {
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
    throw new Error("Historical Observation concurrency limit must be a positive integer.");
  }

  let active = 0;
  const waiters: Array<() => void> = [];

  async function acquire(): Promise<void> {
    if (active < maxConcurrent) {
      active += 1;
      return;
    }
    await new Promise<void>((resolve) => {
      waiters.push(resolve);
    });
  }

  function release(): void {
    const next = waiters.shift();
    if (next) {
      next();
      return;
    }
    active -= 1;
  }

  return {
    async findHistory(query: ObservationHistoryQuery) {
      await acquire();
      try {
        return await repository.findHistory(query);
      } finally {
        release();
      }
    },
  };
}
