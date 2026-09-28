import { createHash } from "node:crypto";
import type { CrossAssetTransmissionAssessment } from "./cross-asset-transmission";
import type { EventRepricingAssessment } from "./event-repricing";
import type { EventSurpriseAssessment } from "./event-surprise";

export const EVENT_RESPONSE_EVIDENCE_POLICY_V1 =
  "integrated-event-response-evidence-v1" as const;

export type EventResponseEvidenceBundle = {
  id: string;
  version: "v1";
  policy: typeof EVENT_RESPONSE_EVIDENCE_POLICY_V1;
  eventIdentityKey: string;
  windowId: string;
  afterRole: EventRepricingAssessment["afterRole"];
  /** Shared point-in-time cutoff for factual surprise and market response. */
  knowledgeAt: string;
  surpriseAssessmentId: string;
  repricingAssessmentId: string;
  transmissionAssessmentId: string;
  causalAttribution: "NOT_EVALUATED";
  surprise: EventSurpriseAssessment;
  repricing: EventRepricingAssessment;
  transmission: CrossAssetTransmissionAssessment;
};

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Event Response Evidence requires valid " + field + ".");
  }
  return parsed;
}

function stableHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}

function deterministicBundleId(
  bundle: Omit<EventResponseEvidenceBundle, "id">,
): string {
  return "event-response-evidence-v1-" + stableHash({
    version: bundle.version,
    policy: bundle.policy,
    eventIdentityKey: bundle.eventIdentityKey,
    windowId: bundle.windowId,
    afterRole: bundle.afterRole,
    knowledgeAt: bundle.knowledgeAt,
    surpriseAssessmentId: bundle.surpriseAssessmentId,
    repricingAssessmentId: bundle.repricingAssessmentId,
    transmissionAssessmentId: bundle.transmissionAssessmentId,
    causalAttribution: bundle.causalAttribution,
  });
}

/**
 * Binds factual Surprise, Repricing, and Cross-Asset Transmission outputs into
 * one auditable point-in-time evidence chain.
 *
 * EVR-001 adds no new market interpretation. It only verifies that the existing
 * SUR-001 -> RPR-001 -> TRN-001 outputs refer to the same qualified Event,
 * event window, and post-event knowledge cutoff.
 */
export function buildEventResponseEvidenceBundle(input: {
  surprise: EventSurpriseAssessment;
  repricing: EventRepricingAssessment;
  transmission: CrossAssetTransmissionAssessment;
}): EventResponseEvidenceBundle {
  const { surprise, repricing, transmission } = input;

  if (
    !surprise.id.trim()
    || !repricing.id.trim()
    || !transmission.id.trim()
  ) {
    throw new Error(
      "Event Response Evidence requires complete SUR/RPR/TRN assessment identities.",
    );
  }

  if (
    surprise.eventIdentityKey !== repricing.eventIdentityKey
    || repricing.eventIdentityKey !== transmission.eventIdentityKey
  ) {
    throw new Error(
      "Event Response Evidence requires one shared provider-independent Event identity.",
    );
  }

  if (
    repricing.windowId !== transmission.windowId
    || repricing.afterRole !== transmission.afterRole
  ) {
    throw new Error(
      "Event Response Evidence requires one shared event window and post-event role.",
    );
  }

  if (
    transmission.repricingAssessmentId !== repricing.id
    || transmission.comparisonId !== repricing.comparisonId
  ) {
    throw new Error(
      "Event Response Evidence transmission lineage must reference the supplied RPR/CMP chain.",
    );
  }

  if (
    surprise.causalAttribution !== "NOT_EVALUATED"
    || repricing.causalAttribution !== "NOT_EVALUATED"
    || transmission.causalAttribution !== "NOT_EVALUATED"
  ) {
    throw new Error(
      "Event Response Evidence only accepts non-causal SUR/RPR/TRN inputs.",
    );
  }

  const surpriseAsOfMs = timestamp(surprise.asOf, "SUR-001 asOf");
  const afterCapturedAtMs = timestamp(
    repricing.afterCapturedAt,
    "RPR-001 afterCapturedAt",
  );
  if (surpriseAsOfMs !== afterCapturedAtMs) {
    throw new Error(
      "Event Response Evidence requires SUR-001 asOf to equal the post-event Snapshot capturedAt.",
    );
  }

  const releaseAtMs = timestamp(surprise.releaseAt, "SUR-001 releaseAt");
  if (releaseAtMs > surpriseAsOfMs) {
    throw new Error(
      "Event Response Evidence cannot use a knowledge cutoff before the qualified release instant.",
    );
  }

  const withoutId: Omit<EventResponseEvidenceBundle, "id"> = {
    version: "v1",
    policy: EVENT_RESPONSE_EVIDENCE_POLICY_V1,
    eventIdentityKey: repricing.eventIdentityKey,
    windowId: repricing.windowId,
    afterRole: repricing.afterRole,
    knowledgeAt: new Date(afterCapturedAtMs).toISOString(),
    surpriseAssessmentId: surprise.id,
    repricingAssessmentId: repricing.id,
    transmissionAssessmentId: transmission.id,
    causalAttribution: "NOT_EVALUATED",
    surprise,
    repricing,
    transmission,
  };

  return {
    id: deterministicBundleId(withoutId),
    ...withoutId,
  };
}
