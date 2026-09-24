import type { Observation } from "../domain/types";
import {
  PRICING_BASELINE_SELECTION_POLICY,
  selectPricingBaseline,
  type PricingBaselineRequest,
} from "../domain/pricing-baseline";
import type {
  HistoricalObservationRepository,
  ObservationHistoryQuery,
} from "../repositories/types";
import { buildRepositoryBackedPricingBaseline } from "./pricing-baseline";

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      label
      + ": expected "
      + JSON.stringify(expected)
      + ", got "
      + JSON.stringify(actual),
    );
  }
}

function observation(
  id: string,
  seriesKey: string,
  observedAt: string,
  retrievedAt: string,
  value: string,
  overrides: Partial<Observation> = {},
): Observation {
  return {
    id,
    domain: "ASSET",
    subject: seriesKey,
    value,
    observedAt,
    retrievedAt,
    sourceId: "yahoo-finance",
    quality: "FRESH",
    evidenceId: "evidence-" + id,
    metadata: {
      metricId: seriesKey,
      unit: "Index",
    },
    ...overrides,
  };
}

class StaticRepository implements HistoricalObservationRepository {
  readonly queries: ObservationHistoryQuery[] = [];

  constructor(
    private readonly items: Observation[],
    private readonly fail = false,
  ) {}

  async findHistory(query: ObservationHistoryQuery): Promise<Observation[]> {
    this.queries.push(query);
    if (this.fail) throw new Error("repository unavailable");
    return this.items;
  }
}

const request: PricingBaselineRequest = {
  identity: {
    domain: "ASSET",
    seriesKey: "dxy.index.usd",
  },
  sourceId: "yahoo-finance",
  asOf: "2026-10-15T12:29:59.999Z",
  maxObservationAgeMs: 15 * 60 * 1000,
};

async function main(): Promise<void> {
  const earlier = observation(
    "dxy-earlier",
    "dxy.index.usd",
    "2026-10-15T12:10:00.000Z",
    "2026-10-15T12:10:05.000Z",
    "103.2",
  );
  const latest = observation(
    "dxy-latest",
    "dxy.index.usd",
    "2026-10-15T12:25:00.000Z",
    "2026-10-15T12:25:05.000Z",
    "103.1",
  );
  const futureObserved = observation(
    "dxy-future",
    "dxy.index.usd",
    "2026-10-15T12:30:10.000Z",
    "2026-10-15T12:30:11.000Z",
    "102.9",
  );
  const unavailableAtCutoff = observation(
    "dxy-late-retrieval",
    "dxy.index.usd",
    "2026-10-15T12:28:00.000Z",
    "2026-10-15T12:31:00.000Z",
    "103.0",
  );

  const selected = selectPricingBaseline(
    request,
    [futureObserved, unavailableAtCutoff, earlier, latest],
  );
  assertEqual(selected.status, "VALID", "latest available pricing baseline is valid");
  assertEqual(selected.observationId, latest.id, "look-ahead observations are excluded");
  assertEqual(selected.value, 103.1, "pricing value is numeric");
  assertEqual(selected.marketDomain, "FX", "approved pricing market domain is preserved");
  assertEqual(selected.semantics?.informationClass, "PRICING", "pricing semantics are explicit");
  assertEqual(
    selected.selectionPolicy,
    PRICING_BASELINE_SELECTION_POLICY,
    "selection policy is explicit",
  );

  const wrongProvider = observation(
    "wrong-provider",
    "dxy.index.usd",
    "2026-10-15T12:29:00.000Z",
    "2026-10-15T12:29:01.000Z",
    "102.8",
    { sourceId: "other-provider" },
  );
  assertEqual(
    selectPricingBaseline(request, [wrongProvider, latest]).observationId,
    latest.id,
    "provider provenance cannot switch implicitly",
  );

  const tooOld = selectPricingBaseline(
    request,
    [
      observation(
        "dxy-old",
        "dxy.index.usd",
        "2026-10-15T11:00:00.000Z",
        "2026-10-15T11:00:05.000Z",
        "103.5",
      ),
    ],
  );
  assertEqual(tooOld.status, "STALE", "caller-owned age tolerance is enforced");

  const storedStale = selectPricingBaseline(
    request,
    [
      observation(
        "dxy-stored-stale",
        "dxy.index.usd",
        "2026-10-15T12:28:00.000Z",
        "2026-10-15T12:28:01.000Z",
        "103.0",
        { quality: "STALE" },
      ),
    ],
  );
  assertEqual(storedStale.status, "STALE", "stored stale quality is not promoted");

  const partial = selectPricingBaseline(
    request,
    [
      observation(
        "dxy-no-unit",
        "dxy.index.usd",
        "2026-10-15T12:28:00.000Z",
        "2026-10-15T12:28:01.000Z",
        "103.0",
        { metadata: { metricId: "dxy.index.usd" } },
      ),
    ],
  );
  assertEqual(partial.status, "PARTIAL", "missing unit stays explicit");

  const unknown = selectPricingBaseline(
    request,
    [
      observation(
        "dxy-partial-quality",
        "dxy.index.usd",
        "2026-10-15T12:28:00.000Z",
        "2026-10-15T12:28:01.000Z",
        "103.0",
        { quality: "PARTIAL" },
      ),
    ],
  );
  assertEqual(unknown.status, "UNKNOWN", "insufficient data quality cannot produce valid pricing");

  const nonNumeric = selectPricingBaseline(
    request,
    [
      observation(
        "dxy-nonnumeric",
        "dxy.index.usd",
        "2026-10-15T12:28:00.000Z",
        "2026-10-15T12:28:01.000Z",
        "unavailable",
      ),
    ],
  );
  assertEqual(nonNumeric.status, "INCOMPATIBLE", "pricing value must be numeric");

  const emptyValue = selectPricingBaseline(
    request,
    [
      observation(
        "dxy-empty",
        "dxy.index.usd",
        "2026-10-15T12:28:00.000Z",
        "2026-10-15T12:28:01.000Z",
        "   ",
      ),
    ],
  );
  assertEqual(
    emptyValue.status,
    "INCOMPATIBLE",
    "empty pricing value cannot coerce to numeric zero",
  );

  const cpiRequest: PricingBaselineRequest = {
    identity: { domain: "MACRO", seriesKey: "CPIAUCSL" },
    sourceId: "fred",
    asOf: request.asOf,
    maxObservationAgeMs: 90 * 24 * 60 * 60 * 1000,
  };
  const cpi = observation(
    "cpi",
    "CPIAUCSL",
    "2026-09-01T00:00:00.000Z",
    "2026-09-15T12:00:00.000Z",
    "320",
    {
      domain: "MACRO",
      sourceId: "fred",
      metadata: {
        seriesId: "CPIAUCSL",
        unit: "Index",
      },
    },
  );
  assertEqual(
    selectPricingBaseline(cpiRequest, [cpi]).status,
    "INCOMPATIBLE",
    "economic observation cannot be relabeled as pricing",
  );

  const rateRequest: PricingBaselineRequest = {
    identity: { domain: "MACRO", seriesKey: "DGS2" },
    sourceId: "fred",
    asOf: "2026-10-15T12:29:59.999Z",
    maxObservationAgeMs: 7 * 24 * 60 * 60 * 1000,
  };
  const dgs2 = observation(
    "dgs2",
    "DGS2",
    "2026-10-14T00:00:00.000Z",
    "2026-10-15T01:00:00.000Z",
    "3.71",
    {
      domain: "MACRO",
      sourceId: "fred",
      metadata: {
        seriesId: "DGS2",
        unit: "Percent",
      },
    },
  );
  assertEqual(
    selectPricingBaseline(rateRequest, [dgs2]).status,
    "VALID",
    "approved rates pricing series is eligible",
  );

  const queryRepository = new StaticRepository([latest, earlier]);
  const repositoryBaseline = await buildRepositoryBackedPricingBaseline(
    request,
    queryRepository,
  );
  assertEqual(
    repositoryBaseline.observationId,
    latest.id,
    "repository-backed selection uses durable pricing history",
  );
  assertEqual(
    queryRepository.queries[0],
    {
      identity: request.identity,
      sourceId: request.sourceId,
      observedAtOnOrBefore: request.asOf,
      retrievedAtOnOrBefore: request.asOf,
      order: "DESC",
      limit: 500,
    },
    "repository query carries both observation-time and availability cutoffs",
  );

  const failure = await buildRepositoryBackedPricingBaseline(
    request,
    new StaticRepository([], true),
  );
  assertEqual(failure.status, "UNKNOWN", "repository outage degrades safely");
  assertEqual(failure.observationId, null, "repository outage cannot fabricate pricing");

  let rejected = false;
  try {
    selectPricingBaseline(
      { ...request, maxObservationAgeMs: -1 },
      [latest],
    );
  } catch {
    rejected = true;
  }
  assertEqual(rejected, true, "negative age tolerance is rejected");
}

void main();
