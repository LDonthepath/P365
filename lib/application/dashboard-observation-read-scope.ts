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

/** Fixed labels; never log series/provider IDs, timestamps, market values or secrets. */
export const DASHBOARD_READ_CONSUMERS = [
  "durable_projection", "macro_baselines", "net_liquidity",
  "central_bank_balances", "dxy_history", "rates_inflation",
  "credit_conditions", "mvp_factual_context", "stablecoin_liquidity",
  "btc_etf_flow", "gold_positioning", "material_move", "unattributed",
] as const;
export type DashboardReadConsumer = (typeof DASHBOARD_READ_CONSUMERS)[number];
export type DashboardConsumerReadFamily = {
  consumer: DashboardReadConsumer;
  logicalReads: number;
  physicalReads: number;
  reusedReads: number;
  failedReads: number;
  /** Accumulated wall time includes limiter queueing, not PostgreSQL execution alone. */
  elapsedMs: number;
};

/**
 * One dashboard GET owns this cache and its counters. Neither data nor promises
 * are shared across requests. An exact semantic + provenance + time-window +
 * retrieval-cutoff + ordering + limit match is required for deduplication.
 */
export type DashboardObservationReadStats = {
  /** Actual projection transport POSTs; null when batch transport is not activated. */
  projectionBatchTransport: { networkRequests: number; sourceRequests: number; failedBatches: number } | null;
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
  /** A physical request belongs to its first model; other models count cache reuse. */
  consumerReads: DashboardConsumerReadFamily[];
};

export function createDashboardObservationReadScope(
  source: HistoricalObservationRepository,
  options: { capacity?: number; now?: () => number } = {},
): {
  repository: HistoricalObservationRepository;
  forConsumer: (consumer: DashboardReadConsumer) => HistoricalObservationRepository;
  stats: () => DashboardObservationReadStats;
  /** Install a GET-local projection-only source before any reads. */
  useProjectionSource: (repository: HistoricalObservationRepository, transportStats: () => { networkRequests: number; sourceRequests: number; failedBatches: number }) => void;
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
  const consumers = new Map<DashboardReadConsumer, DashboardConsumerReadFamily>();
  let projectionSource: HistoricalObservationRepository | undefined;
  let projectionTransportStats: (() => { networkRequests: number; sourceRequests: number; failedBatches: number }) | undefined;
  // One GET-local semaphore protects both legacy and batched projection DB reads.
  // The retained legacy limiter is nested but cannot raise overall concurrency.
  // One GET-local four-slot gate bounds the sum of batch and ordinary reads.
  let active = 0;
  const waiters: Array<() => void> = [];
  async function sharedFind(query: ObservationHistoryQuery, repository: HistoricalObservationRepository): Promise<Observation[]> {
    if (active >= 4) await new Promise<void>((resolve) => { waiters.push(resolve); });
    else active++;
    try {
      return await repository.findHistory(query);
    } finally {
      const next = waiters.shift();
      if (next) next(); else active--;
    }
  }
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

  function consumerFor(name: DashboardReadConsumer): DashboardConsumerReadFamily {
    let consumer = consumers.get(name);
    if (!consumer) {
      consumer = { consumer: name, logicalReads: 0, physicalReads: 0, reusedReads: 0, failedReads: 0, elapsedMs: 0 };
      consumers.set(name, consumer);
    }
    return consumer;
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

  function physicalRead(query: ObservationHistoryQuery, consumer: DashboardConsumerReadFamily, cacheKey?: string): Promise<Observation[]> {
    physicalReads += 1;
    consumer.physicalReads += 1;
    const family = familyFor(query);
    family.physicalReads += 1;
    physicalInFlight += 1;
    maxPhysicalInFlight = Math.max(maxPhysicalInFlight, physicalInFlight);
    const started = now();

    // Keep a promise in the cache before the underlying asynchronous read runs.
    // The consumer is captured synchronously by the route invocation rather than
    // shared mutable state: concurrent callers must not reroute each other.
    const routed = consumer.consumer === "durable_projection" && projectionSource ? projectionSource : source;
    const promise = Promise.resolve().then(() => projectionSource ? sharedFind(query, routed) : routed.findHistory(query));
    void promise.then(
      () => {
        physicalInFlight -= 1;
        const elapsed = Math.max(0, now() - started);
        physicalDurationMs += elapsed;
        family.elapsedMs += elapsed;
        consumer.elapsedMs += elapsed;
        slowestPhysicalMs = Math.max(slowestPhysicalMs, elapsed);
      },
      () => {
        physicalInFlight -= 1;
        failedPhysicalReads += 1;
        family.failedReads += 1;
        consumer.failedReads += 1;
        const elapsed = Math.max(0, now() - started);
        physicalDurationMs += elapsed;
        family.elapsedMs += elapsed;
        consumer.elapsedMs += elapsed;
        slowestPhysicalMs = Math.max(slowestPhysicalMs, elapsed);
        if (cacheKey && cache.get(cacheKey) === promise) cache.delete(cacheKey);
      },
    );
    return promise;
  }

  async function findForConsumer(query: ObservationHistoryQuery, name: DashboardReadConsumer): Promise<Observation[]> {
    logicalReads += 1;
    const consumer = consumerFor(name);
    consumer.logicalReads += 1;
    const k = key(query);
    let pending = cache.get(k);
    if (pending) {
      reusedReads += 1;
      consumer.reusedReads += 1;
    } else if (cache.size < capacity) {
      pending = physicalRead(query, consumer, k);
      cache.set(k, pending);
    } else {
      // A bounded cache must never deny or silently alter an eligible read.
      uncachedCapacityReads += 1;
      pending = physicalRead(query, consumer);
    }
    // Preserve independent consumer-mutable values on every return path.
    return structuredClone(await pending);
  }

  return {
    useProjectionSource: (repository, transportStats) => {
      if (logicalReads !== 0 || projectionSource) throw new Error("Projection transport must be configured once, before dashboard reads.");
      projectionSource = repository;
      projectionTransportStats = transportStats;
    },
    repository: { findHistory: (query) => findForConsumer(query, "unattributed") },
    forConsumer: (consumer) => ({ findHistory: (query) => findForConsumer(query, consumer) }),
    stats: () => ({
      projectionBatchTransport: projectionTransportStats?.() ?? null,
      logicalReads, physicalReads, reusedReads, failedPhysicalReads,
      uncachedCapacityReads,
      physicalDurationMs: Math.round(physicalDurationMs),
      slowestPhysicalMs: Math.round(slowestPhysicalMs),
      maxPhysicalInFlight,
      familyReads: [...families.values()]
        .sort((a, b) => domainOrder.indexOf(a.domain) - domainOrder.indexOf(b.domain)
          || bucketOrder.indexOf(a.limitBucket) - bucketOrder.indexOf(b.limitBucket))
        .map((family) => ({ ...family, elapsedMs: Math.round(family.elapsedMs) })),
      consumerReads: [...consumers.values()]
        .sort((a, b) => DASHBOARD_READ_CONSUMERS.indexOf(a.consumer) - DASHBOARD_READ_CONSUMERS.indexOf(b.consumer))
        .map((consumer) => ({ ...consumer, elapsedMs: Math.round(consumer.elapsedMs) })),
    }),
  };
}
