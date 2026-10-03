import type { ProviderResult } from "../data/types";
import type {
  GdeltCandidateArticle,
  GdeltMoveAsset,
} from "../data/gdelt-doc";

export const MOVE_NEWS_CATALYST_METHODOLOGY = "gdelt-move-window-candidate-catalyst-v1" as const;

export type MoveNewsCatalystEvidence = {
  asset: GdeltMoveAsset;
  windowStart: string;
  windowEnd: string;
  retrievedAt: string;
  provider: "gdelt";
  state: "CANDIDATES_AVAILABLE" | "NO_CANDIDATES" | "PROVIDER_UNAVAILABLE";
  candidates: GdeltCandidateArticle[];
  causalAttribution: "NOT_EVALUATED";
  historicalPointInTimeReplay: "NOT_SUPPORTED_WITHOUT_DURABLE_ACQUISITION";
  methodology: typeof MOVE_NEWS_CATALYST_METHODOLOGY;
};

export function buildMoveNewsCatalystEvidence(input: {
  asset: GdeltMoveAsset;
  windowStart: string;
  windowEnd: string;
  result: ProviderResult<GdeltCandidateArticle>;
}): MoveNewsCatalystEvidence {
  const startMs = Date.parse(input.windowStart);
  const endMs = Date.parse(input.windowEnd);
  const retrievedMs = Date.parse(input.result.retrievedAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
    throw new Error("Move-news evidence requires a valid bounded window");
  }
  if (!Number.isFinite(retrievedMs)) {
    throw new Error("Move-news evidence requires valid provider retrievedAt");
  }

  if (input.result.status === "ERROR" || input.result.status === "UNAVAILABLE") {
    return {
      asset: input.asset,
      windowStart: new Date(startMs).toISOString(),
      windowEnd: new Date(endMs).toISOString(),
      retrievedAt: new Date(retrievedMs).toISOString(),
      provider: "gdelt",
      state: "PROVIDER_UNAVAILABLE",
      candidates: [],
      causalAttribution: "NOT_EVALUATED",
      historicalPointInTimeReplay: "NOT_SUPPORTED_WITHOUT_DURABLE_ACQUISITION",
      methodology: MOVE_NEWS_CATALYST_METHODOLOGY,
    };
  }

  const candidates = input.result.data.filter((article) =>
    article.asset === input.asset
    && Date.parse(article.providerDate) >= startMs
    && Date.parse(article.providerDate) <= endMs,
  );

  return {
    asset: input.asset,
    windowStart: new Date(startMs).toISOString(),
    windowEnd: new Date(endMs).toISOString(),
    retrievedAt: new Date(retrievedMs).toISOString(),
    provider: "gdelt",
    state: candidates.length > 0 ? "CANDIDATES_AVAILABLE" : "NO_CANDIDATES",
    candidates,
    causalAttribution: "NOT_EVALUATED",
    historicalPointInTimeReplay: "NOT_SUPPORTED_WITHOUT_DURABLE_ACQUISITION",
    methodology: MOVE_NEWS_CATALYST_METHODOLOGY,
  };
}
