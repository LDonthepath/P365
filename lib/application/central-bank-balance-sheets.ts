import type { Observation } from "../domain/types";
import type { HistoricalObservationRepository } from "../repositories/types";
import { MACRO_SERIES_REGISTRY } from "../data/macro-registry";

const DAY = 24 * 60 * 60 * 1000;
const SERIES = [
  { seriesKey: "ECBASSETSW", label: "Neraca Eurosystem (ECB)", nativeUnit: "Millions of Euros", displayUnit: "juta EUR", cadence: "WEEKLY" },
  { seriesKey: "JPNASSETS", label: "Neraca Bank of Japan", nativeUnit: "100 Million Yen", displayUnit: "100 juta JPY", cadence: "MONTHLY" },
] as const;

export type CentralBankBalanceSheetPoint = {
  seriesKey: (typeof SERIES)[number]["seriesKey"];
  label: string;
  displayUnit: string;
  cadence: "WEEKLY" | "MONTHLY";
  status: "AVAILABLE" | "MISSING" | "UNAVAILABLE";
  latest: {
    id: string;
    value: number;
    observedAt: string;
    retrievedAt: string;
    sourceId: "fred";
  } | null;
  previous: { id: string; value: number; observedAt: string } | null;
  changeFromPrevious: number | null;
};

export type CentralBankBalanceSheetReadModel = {
  asOf: string;
  items: CentralBankBalanceSheetPoint[];
};

/** Only factual native-currency levels and distinct prior observation periods.
 * No FX conversion, implied release time, global liquidity or market causality.
 */
export async function buildCentralBankBalanceSheetReadModel(
  repository: HistoricalObservationRepository,
  asOf = new Date(),
): Promise<CentralBankBalanceSheetReadModel> {
  if (!Number.isFinite(asOf.getTime())) throw new Error("Invalid central-bank read cutoff");
  const end = asOf.toISOString();
  const start = new Date(asOf.getTime() - 210 * DAY).toISOString();
  const startMs = Date.parse(start);
  const asOfMs = asOf.getTime();

  const items = await Promise.all(SERIES.map(async (definition): Promise<CentralBankBalanceSheetPoint> => {
    const fallback = (status: "MISSING" | "UNAVAILABLE"): CentralBankBalanceSheetPoint => ({
      ...definition, status, latest: null, previous: null, changeFromPrevious: null,
    });
    const registry = MACRO_SERIES_REGISTRY.find((item) => item.seriesId === definition.seriesKey);
    if (!registry || registry.domain !== "MACRO"
      || registry.frequency !== definition.cadence || registry.unit !== definition.nativeUnit) {
      return fallback("UNAVAILABLE");
    }

    let history: Observation[];
    try {
      history = await repository.findHistory({
        identity: { domain: "MACRO", seriesKey: definition.seriesKey },
        sourceId: "fred",
        observedAtOnOrAfter: start,
        observedAtOnOrBefore: end,
        retrievedAtOnOrBefore: end,
        order: "DESC",
        limit: 120,
      });
    } catch {
      return fallback("UNAVAILABLE");
    }
    const valid = history.filter((item) => {
      const observed = Date.parse(item.observedAt);
      const retrieved = Date.parse(item.retrievedAt);
      return item.domain === "MACRO" && item.sourceId === "fred"
        && item.metadata?.seriesId === definition.seriesKey
        && item.metadata?.frequency === definition.cadence
        && item.metadata?.unit === definition.nativeUnit
        && (!item.identity || item.identity.seriesKey === definition.seriesKey)
        && typeof item.value === "string" && item.value.trim().length > 0
        && Number.isFinite(Number(item.value))
        && Number.isFinite(observed) && Number.isFinite(retrieved)
        && observed >= startMs && observed <= asOfMs && retrieved <= asOfMs;
    }).sort((a, b) =>
      Date.parse(b.observedAt) - Date.parse(a.observedAt)
      || Date.parse(b.retrievedAt) - Date.parse(a.retrievedAt)
      || b.id.localeCompare(a.id)
    );
    if (!valid.length) return fallback("MISSING");

    const recent = valid[0];
    const prior = valid.find((item) => item.observedAt !== recent.observedAt) ?? null;
    const latest = {
      id: recent.id, value: Number(recent.value), observedAt: recent.observedAt,
      retrievedAt: recent.retrievedAt, sourceId: "fred" as const,
    };
    const previous = prior
      ? { id: prior.id, value: Number(prior.value), observedAt: prior.observedAt }
      : null;
    return {
      ...definition, status: "AVAILABLE", latest, previous,
      changeFromPrevious: previous ? latest.value - previous.value : null,
    };
  }));
  return { asOf: end, items };
}
