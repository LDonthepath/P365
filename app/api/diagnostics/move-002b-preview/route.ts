import {
  historicalEventRepository,
  historicalObservationRepository,
} from "../../../../lib/repositories/dashboard-repository";
import { detectContinuousMarketMove } from "../../../../lib/application/continuous-move-detector";
import { buildMoveEvidenceBundle } from "../../../../lib/application/move-evidence-bundle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TARGET_AT = "2026-10-02T04:30:00.000Z";
const AS_OF = "2026-10-02T04:35:00.000Z";

export async function GET(): Promise<Response> {
  if (process.env.VERCEL_ENV !== "preview") {
    return Response.json({ error: "Not Found" }, { status: 404 });
  }

  const targetMs = Date.parse(TARGET_AT);
  const candidates = await historicalObservationRepository.findHistory({
    identity: { domain: "ASSET", seriesKey: "btc.spot.usd" },
    sourceId: "coingecko-market",
    observedAtOnOrAfter: new Date(targetMs - 2 * 60 * 1000).toISOString(),
    observedAtOnOrBefore: new Date(targetMs + 2 * 60 * 1000).toISOString(),
    retrievedAtOnOrBefore: AS_OF,
    order: "ASC",
    limit: 20,
  });

  const target = [...candidates].sort((a, b) => {
    const ea = Math.abs(Date.parse(a.observedAt) - targetMs);
    const eb = Math.abs(Date.parse(b.observedAt) - targetMs);
    return ea - eb
      || Date.parse(b.retrievedAt) - Date.parse(a.retrievedAt)
      || b.id.localeCompare(a.id);
  })[0];

  if (!target) {
    return Response.json({
      status: "NO_TARGET",
      targetAt: TARGET_AT,
      asOf: AS_OF,
      writesPerformed: false,
    });
  }

  const assessment = await detectContinuousMarketMove({
    repository: historicalObservationRepository,
    seriesKey: "btc.spot.usd",
    targetEnd: target,
    asOf: AS_OF,
  });

  const bundle = await buildMoveEvidenceBundle({
    assessment,
    observations: historicalObservationRepository,
    events: historicalEventRepository,
  });

  return Response.json({
    evaluatedAt: new Date().toISOString(),
    target: {
      id: target.id,
      observedAt: target.observedAt,
      retrievedAt: target.retrievedAt,
      value: target.value,
    },
    assessment,
    bundle,
    writesPerformed: false,
  }, {
    headers: {
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
