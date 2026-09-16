import type { FactualBaseline } from "../domain/baseline";
import { factualBaselineChange } from "../domain/baseline";

export type BaselinePresentation = {
  kind: "FACTUAL";
  seriesId: string;
  currentValue: string;
  baselineValue: string | null;
  changeValue: number | null;
  status: FactualBaseline["status"];
  quality: FactualBaseline["quality"];
  currentObservedAt: string;
  baselineObservedAt: string | null;
  sourceId: string;
  reason: string | null;
};

function seriesIdFromKey(seriesId: string): string {
  return seriesId.trim();
}

export function toBaselinePresentation(
  seriesId: string,
  baseline: FactualBaseline,
): BaselinePresentation {
  return {
    kind: "FACTUAL",
    seriesId: seriesIdFromKey(seriesId),
    currentValue: baseline.currentValue,
    baselineValue: baseline.baselineValue,
    changeValue: factualBaselineChange(baseline),
    status: baseline.status,
    quality: baseline.quality,
    currentObservedAt: baseline.currentObservedAt,
    baselineObservedAt: baseline.baselineObservedAt,
    sourceId: baseline.sourceId,
    reason: baseline.reason ?? null,
  };
}

export function buildBaselinePresentations(
  baselines: Record<string, FactualBaseline>,
): BaselinePresentation[] {
  return Object.entries(baselines).map(([seriesId, baseline]) =>
    toBaselinePresentation(seriesId, baseline),
  );
}
