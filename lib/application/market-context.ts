import type { Observation } from "../domain/types";

export type MaterialMoveMarketContext = {
  currentValue: number | null;
  valueUnit: string | null;
  changePercent: number | null;
  changeBasis: "ROLLING_24H" | "PREVIOUS_CLOSE" | "UNAVAILABLE";
};

function finiteMetadataNumber(
  observation: Observation,
  key: string,
): number | null {
  const value = observation.metadata?.[key];
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function materialMoveMarketContextFromObservation(
  observation: Observation,
): MaterialMoveMarketContext {
  const currentValue = Number(observation.value);
  const rawBasis = observation.metadata?.changeBasis;
  const changeBasis = rawBasis === "24h"
    ? "ROLLING_24H" as const
    : rawBasis === "previous_close"
      ? "PREVIOUS_CLOSE" as const
      : "UNAVAILABLE" as const;

  return {
    currentValue: Number.isFinite(currentValue) ? currentValue : null,
    valueUnit: typeof observation.metadata?.unit === "string"
      ? observation.metadata.unit
      : null,
    changePercent: finiteMetadataNumber(observation, "changePct"),
    changeBasis,
  };
}
