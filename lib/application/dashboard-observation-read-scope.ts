import type { Observation } from "../domain/types";
import type { HistoricalObservationRepository, ObservationHistoryQuery } from "../repositories/types";

/** Bounded aggregate diagnostic dimensions. These are not user-driven keys. */
export type DashboardHistoryLimitBucket = "1_TO_8" | "9_TO_100" | "101_TO_500";
export type DashboardHistoryReadFamily = {
  domain: Observation["domain"];
  limitBucket: DashboardHistoryLimitBucket;
  physicalReads: number;
  failedReads: number;
  /** Sum of individual wall elapsed incl. the existing limiter queue, not SQL execution time. */
  elapsedMs: number;
};

function limitBucket(limit: number): DashboardHistoryLimitBucket {
  return limit <= 8 ? "1_TO_8" : limit <= 100 ? "9_TO_100" : "101_TO_500";
}

/**
 * One dashboard GET owns this cache and its counters. Neither data nor promises
 * are shared across requests. An exact semantic + provenance + time-window +
 * retrieval-cutoff + ordering + limit match is required for deduplication.
 */
export type DashboardObservationReadStats = {
  logicalReads: number;
  physicalReads: number;
  reusedReads: number;
  failedPhysicalReads: number;
  uncachedCapacityReads: number;
  physicalDurationMs: number;
  slowestPhysicalMs: number;
  maxPhysicalInFlight: number;
  /** At most 12 coarse domain × limit buckets. No series/source IDs, dates or values. */
  familyReads: DashboardHistoryReadFamily[];
};

export function createDashboardObservationReadScope(
  source: HistoricalObservationRepository,
  options: { capacity?: number; now?: () => number } = {},
): {
  repository: HistoricalObservationRepository;
  stats: () => DashboardObservationReadStats;
} {
  const capacity = options.capacity ?? 256;
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new Error("Dashboard request read-cache capacity must be positive.");
  }
  const now = options.now ?? (() => performance.now());
  const cache = new Map<string, Promise<Observation[]>>();
  let logicalReads = 0;
  let physicalReads = 0;
  let reusedReads = 0;
  let failedPhysicalReads = 0;
  let uncachedCapacityReads = 0;
  let physicalDurationMs = 0;
  let slowestPhysicalMs = 0;
  let physicalInFlight = 0;
  let maxPhysicalInFlight = 0;
  const families = new Map<string, DashboardHistoryReadFamily>();
  const domainOrder = ["MACRO", "ASSET", "MARKET", "OTHER"] as const;
  const bucketOrder: DashboardHistoryLimitBucket[] = ["1_TO_8", "9_TO_100", "101_TO_500"];

  function familyFor(query: ObservationHistoryQuery): DashboardHistoryReadFamily {
    const domain = domainOrder.includes(query.identity.domain) ? query.identity.domain : "OTHER";
    const bucket = limitBucket(query.limit);
    const key = domain + ":" + bucket;
    let family = families.get(key);
    if (!family) {
      family = { domain, limitBucket: bucket, physicalReads: 0, failedReads: 0, elapsedMs: 0 };
      families.set(key, family);
    }
    return family;
  }

  function key(query: ObservationHistoryQuery): string {
    return JSON.stringify([
      query.identity.domain, query.identity.seriesKey,
      query.sourceId ?? null,
      query.observedAtOnOrAfter ?? null,
      query.observedAtOnOrBefore ?? null,
      query.retrievedAtOnOrBefore ?? null,
      query.order, query.limit,
    ]);
  }

  function physicalRead(query: ObservationHistoryQuery, cacheKey?: string): Promise<Observation[]> {
    physicalReads += 1;
    const family = familyFor(query);
    family.physicalReads += 1;
    physicalInFlight += 1;
    maxPhysicalInFlight = Math.max(maxPhysicalInFlight, physicalInFlight);
    const started = now();

    // Keep a promise in the cache before the underlying asynchronous read runs.
    const promise = Promise.resolve().then(() => source.findHistory(query));
    void promise.then(
      () => {
        physicalInFlight -= 1;
        const elapsed = Math.max(0, now() - started);
        physicalDurationMs += elapsed;
        family.elapsedMs += elapsed;
        slowestPhysicalMs = Math.max(slowestPhysicalMs, elapsed);
      },
      () => {
        physicalInFlight -= 1;
        failedPhysicalReads += 1;
        family.failedReads += 1;
        const elapsed = Math.max(0, now() - started);
        physicalDurationMs += elapsed;
        family.elapsedMs += elapsed;
        slowestPhysicalMs = Math.max(slowestPhysicalMs, elapsed);
        if (cacheKey && cache.get(cacheKey) === promise) cache.delete(cacheKey);
      },
    );
    return promise;
  }

  return {
    repository: {
      async findHistory(query) {
        logicalReads += 1;
        const k = key(query);
        let pending = cache.get(k);
        if (pending) {
          reusedReads += 1;
        } else if (cache.size < capacity) {
          pending = physicalRead(query, k);
          cache.set(k, pending);
        } else {
          // A bounded cache must never deny or silently alter an eligible read.
          uncachedCapacityReads += 1;
          pending = physicalRead(query);
        }
        // Each consumer receives an independent value, like the original
        // repository; a caller cannot mutate another consumer's cached rows.
        return structuredClone(await pending);
      },
    },
    stats: () => ({
      logicalReads, physicalReads, reusedReads, failedPhysicalReads,
      uncachedCapacityReads,
      physicalDurationMs: Math.round(physicalDurationMs),
      slowestPhysicalMs: Math.round(slowestPhysicalMs),
      maxPhysicalInFlight,
      familyReads: [...families.values()]
        .sort((a, b) => domainOrder.indexOf(a.domain) - domainOrder.indexOf(b.domain)
          || bucketOrder.indexOf(a.limitBucket) - bucketOrder.indexOf(b.limitBucket))
        .map((family) => ({ ...family, elapsedMs: Math.round(family.elapsedMs) })),
    }),
  };
}
