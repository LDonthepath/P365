import type { ProviderResult } from "../data/types";
import type {
  GdeltGalFeedSnapshot,
  GdeltMoveAsset,
} from "../data/gdelt-gal";

export const MOVE_NEWS_CATALYST_METHODOLOGY = "gdelt-gal-current-candidate-catalyst-v1" as const;

export type MoveNewsCatalystEvidence = {
  asset: GdeltMoveAsset;
  retrievedAt: string;
  provider: "gdelt";
  state: "CANDIDATES_AVAILABLE" | "NO_CANDIDATES" | "PROVIDER_UNAVAILABLE";
  coverage: "ROLLING_15_MINUTES" | "UNAVAILABLE";
  feedWindowStartAt: string | null;
  feedLastBuildAt: string | null;
  candidates: GdeltGalFeedSnapshot["candidates"];
  causalAttribution: "NOT_EVALUATED";
  historicalPointInTimeReplay: "NOT_SUPPORTED_WITHOUT_DURABLE_ACQUISITION";
  methodology: typeof MOVE_NEWS_CATALYST_METHODOLOGY;
};

export function buildMoveNewsCatalystEvidence(input: {
  asset: GdeltMoveAsset;
  result: ProviderResult<GdeltGalFeedSnapshot>;
}): MoveNewsCatalystEvidence {
  const retrievedMs = Date.parse(input.result.retrievedAt);
  if (!Number.isFinite(retrievedMs)) {
    throw new Error("Move-news evidence requires valid provider retrievedAt");
  }

  if (input.result.status === "ERROR" || input.result.status === "UNAVAILABLE") {
    return {
      asset: input.asset,
      retrievedAt: new Date(retrievedMs).toISOString(),
      provider: "gdelt",
      state: "PROVIDER_UNAVAILABLE",
      coverage: "UNAVAILABLE",
      feedWindowStartAt: null,
      feedLastBuildAt: null,
      candidates: [],
      causalAttribution: "NOT_EVALUATED",
      historicalPointInTimeReplay: "NOT_SUPPORTED_WITHOUT_DURABLE_ACQUISITION",
      methodology: MOVE_NEWS_CATALYST_METHODOLOGY,
    };
  }

  const snapshot = input.result.data[0];
  if (!snapshot || snapshot.asset !== input.asset) {
    return {
      asset: input.asset,
      retrievedAt: new Date(retrievedMs).toISOString(),
      provider: "gdelt",
      state: "NO_CANDIDATES",
      coverage: "ROLLING_15_MINUTES",
      feedWindowStartAt: null,
      feedLastBuildAt: null,
      candidates: [],
      causalAttribution: "NOT_EVALUATED",
      historicalPointInTimeReplay: "NOT_SUPPORTED_WITHOUT_DURABLE_ACQUISITION",
      methodology: MOVE_NEWS_CATALYST_METHODOLOGY,
    };
  }

  return {
    asset: input.asset,
    retrievedAt: new Date(retrievedMs).toISOString(),
    provider: "gdelt",
    state: snapshot.candidates.length > 0 ? "CANDIDATES_AVAILABLE" : "NO_CANDIDATES",
    coverage: snapshot.coverage,
    feedWindowStartAt: snapshot.feedWindowStartAt,
    feedLastBuildAt: snapshot.feedLastBuildAt,
    candidates: snapshot.candidates,
    causalAttribution: "NOT_EVALUATED",
    historicalPointInTimeReplay: "NOT_SUPPORTED_WITHOUT_DURABLE_ACQUISITION",
    methodology: MOVE_NEWS_CATALYST_METHODOLOGY,
  };
}
