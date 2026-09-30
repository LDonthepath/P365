import { CFTC_GOLD_COT_SERIES_KEYS } from "../domain/observation-semantics";
import type { DataQuality, Observation } from "../domain/types";
import type { HistoricalObservationRepository } from "../repositories/types";

export type GoldPositioningPoint = {
  seriesKey: string;
  value: number;
  observedAt: string;
  retrievedAt: string;
  quality: DataQuality;
};

export type GoldPositioningReadModel =
  | {
      status: "AVAILABLE";
      asOf: string;
      reportDate: string;
      openInterest: GoldPositioningPoint;
      managedMoney: {
        long: GoldPositioningPoint;
        short: GoldPositioningPoint;
        spreading: GoldPositioningPoint;
      };
    }
  | {
      status: "UNAVAILABLE";
      asOf: string;
      reason: string;
    };

async function latestPoint(
  repository: HistoricalObservationRepository,
  seriesKey: string,
  cutoff: string,
): Promise<GoldPositioningPoint | null> {
  const rows = await repository.findHistory({
    identity: { domain: "MARKET", seriesKey },
    sourceId: "cftc-gold-cot",
    observedAtOnOrBefore: cutoff,
    retrievedAtOnOrBefore: cutoff,
    order: "DESC",
    limit: 1,
  });
  const observation = rows[0];
  if (!observation || !observation.value.trim()) return null;
  const value = Number(observation.value);
  if (!Number.isFinite(value)) return null;
  return {
    seriesKey,
    value,
    observedAt: observation.observedAt,
    retrievedAt: observation.retrievedAt,
    quality: observation.quality,
  };
}

/**
 * Builds a compact Gold positioning view from the latest internally coherent
 * CFTC report. It exposes source-reported raw positions only; no net,
 * percentile, z-score, crowding, or directional interpretation is derived.
 */
export async function buildGoldPositioningReadModel(
  repository: HistoricalObservationRepository,
  asOf = new Date(),
): Promise<GoldPositioningReadModel> {
  if (!Number.isFinite(asOf.getTime())) {
    throw new Error("Gold positioning read model requires a valid asOf cutoff.");
  }
  const cutoff = asOf.toISOString();
  try {
    const [openInterest, managedLong, managedShort, managedSpreading] = await Promise.all([
      latestPoint(repository, CFTC_GOLD_COT_SERIES_KEYS.openInterest, cutoff),
      latestPoint(repository, CFTC_GOLD_COT_SERIES_KEYS.managedMoneyLong, cutoff),
      latestPoint(repository, CFTC_GOLD_COT_SERIES_KEYS.managedMoneyShort, cutoff),
      latestPoint(repository, CFTC_GOLD_COT_SERIES_KEYS.managedMoneySpreading, cutoff),
    ]);

    if (!openInterest || !managedLong || !managedShort || !managedSpreading) {
      return {
        status: "UNAVAILABLE",
        asOf: cutoff,
        reason: "Riwayat CFTC Gold belum memiliki set laporan lengkap untuk tampilan posisi.",
      };
    }

    const reportAt = openInterest.observedAt;
    if (![managedLong, managedShort, managedSpreading].every((item) => item.observedAt === reportAt)) {
      return {
        status: "UNAVAILABLE",
        asOf: cutoff,
        reason: "Komponen posisi CFTC terbaru berasal dari tanggal laporan yang berbeda.",
      };
    }

    return {
      status: "AVAILABLE",
      asOf: cutoff,
      reportDate: reportAt.slice(0, 10),
      openInterest,
      managedMoney: {
        long: managedLong,
        short: managedShort,
        spreading: managedSpreading,
      },
    };
  } catch (error) {
    console.error(
      "Gold positioning read failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return {
      status: "UNAVAILABLE",
      asOf: cutoff,
      reason: "Riwayat CFTC Gold sedang tidak dapat dibaca.",
    };
  }
}
