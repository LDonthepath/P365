import { createHash } from "node:crypto";
import type { MarketSnapshot } from "./market-snapshot";
import type { Event } from "./types";

const MINUTE_MS = 60_000;

export const EVENT_WINDOW_POLICY_V1 = {
  version: "v1",
  requiredImportance: "HIGH",
  snapshotScope: "MVP_MACRO_CRYPTO_GOLD_EVENT",
  toleranceMs: 150_000,
  slots: [
    { role: "PRE", phase: "BASELINE", offsetMs: -5 * MINUTE_MS },
    { role: "T_PLUS_5", phase: "INITIAL_REACTION", offsetMs: 5 * MINUTE_MS },
    { role: "T_PLUS_15", phase: "EARLY_CONFIRMATION", offsetMs: 15 * MINUTE_MS },
    { role: "T_PLUS_30", phase: "FOLLOW_THROUGH", offsetMs: 30 * MINUTE_MS },
    { role: "T_PLUS_60", phase: "PERSISTENCE", offsetMs: 60 * MINUTE_MS },
  ],
} as const;

export type EventWindowRole = typeof EVENT_WINDOW_POLICY_V1.slots[number]["role"];
export type EventWindowPhase = typeof EVENT_WINDOW_POLICY_V1.slots[number]["phase"];
export type EventWindowT0Source = "RELEASED_AT" | "SCHEDULED_AT";

export type QualifiedEventWindowSlot = {
  role: EventWindowRole;
  phase: EventWindowPhase;
  offsetMs: number;
  targetAt: string;
  opensAt: string;
  closesAt: string;
  toleranceMs: number;
};

export type QualifiedEventWindow = {
  id: string;
  version: "v1";
  eventId: string;
  eventIdentityKey: string;
  semanticKey: string;
  subject: string;
  jurisdiction: string;
  sourceId: string;
  t0: string;
  t0Source: EventWindowT0Source;
  snapshotScope: typeof EVENT_WINDOW_POLICY_V1.snapshotScope;
  slots: QualifiedEventWindowSlot[];
};

export type EventWindowRejectionCode =
  | "IMPORTANCE_NOT_HIGH"
  | "IDENTITY_UNQUALIFIED"
  | "SCHEDULE_MISSING"
  | "SCHEDULE_INVALID"
  | "IDENTITY_SCHEDULE_MISMATCH"
  | "DURATION_EVENT_UNSUPPORTED"
  | "RELEASE_TIME_INVALID";

export type EventWindowQualification =
  | { eligible: true; window: QualifiedEventWindow }
  | {
      eligible: false;
      eventId: string;
      code: EventWindowRejectionCode;
      reason: string;
    };

export type EventWindowSnapshotMatchStatus =
  | "QUALIFIED"
  | "DEGRADED"
  | "OUTSIDE_WINDOW"
  | "INCOMPATIBLE_SCOPE";

export type EventWindowSnapshotMatch = {
  status: EventWindowSnapshotMatchStatus;
  role: EventWindowRole | null;
  phase: EventWindowPhase | null;
  targetAt: string | null;
  timingErrorMs: number | null;
  snapshotQuality: MarketSnapshot["quality"];
  reason?: string;
};

export type EventWindowContaminant = {
  eventId: string;
  eventIdentityKey: string;
  subject: string;
  t0: string;
  t0Source: EventWindowT0Source;
};

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Event Window requires valid " + field + ".");
  }
  return parsed;
}

function iso(valueMs: number): string {
  return new Date(valueMs).toISOString();
}

function deterministicWindowId(input: {
  eventIdentityKey: string;
  t0: string;
}): string {
  const hash = createHash("sha256")
    .update(JSON.stringify([
      EVENT_WINDOW_POLICY_V1.version,
      input.eventIdentityKey,
      input.t0,
      EVENT_WINDOW_POLICY_V1.snapshotScope,
    ]), "utf8")
    .digest("hex");
  return "event-window-v1-" + hash;
}

function unsupportedDurationSemanticKey(semanticKey: string): boolean {
  const normalized = semanticKey.toLowerCase();
  return normalized.includes("speech")
    || normalized.includes("press-conference")
    || normalized.includes("testimony")
    || normalized.includes("meeting");
}

function reject(
  event: Event,
  code: EventWindowRejectionCode,
  reason: string,
): EventWindowQualification {
  return {
    eligible: false,
    eventId: event.id,
    code,
    reason,
  };
}

/**
 * Qualifies one canonical Event for the first exact-timing event-window policy.
 *
 * Identity is the clock-qualification gate in v1:
 * - Biquote only creates identity for timeMode=exact;
 * - official FOMC date anchors do not carry identity;
 * - provider-independent identity preserves cross-provider ownership.
 *
 * Duration-like events are deliberately excluded until they have a separate
 * lifecycle policy; EVW-001 is for point releases, not speeches/meetings.
 */
export function qualifyEventWindow(event: Event): EventWindowQualification {
  if (event.importance !== EVENT_WINDOW_POLICY_V1.requiredImportance) {
    return reject(
      event,
      "IMPORTANCE_NOT_HIGH",
      "EVW-001 is limited to HIGH-importance events.",
    );
  }

  if (!event.identity || event.identity.version !== "v1") {
    return reject(
      event,
      "IDENTITY_UNQUALIFIED",
      "Event has no qualified provider-independent v1 identity.",
    );
  }

  if (!event.scheduledAt) {
    return reject(
      event,
      "SCHEDULE_MISSING",
      "Qualified event window requires scheduledAt.",
    );
  }

  const scheduledAtMs = Date.parse(event.scheduledAt);
  if (!Number.isFinite(scheduledAtMs)) {
    return reject(
      event,
      "SCHEDULE_INVALID",
      "Event scheduledAt is invalid.",
    );
  }

  const identityScheduledAtMs = Date.parse(event.identity.scheduledAt);
  if (
    !Number.isFinite(identityScheduledAtMs)
    || identityScheduledAtMs !== scheduledAtMs
  ) {
    return reject(
      event,
      "IDENTITY_SCHEDULE_MISMATCH",
      "Event scheduledAt does not match its qualified identity schedule.",
    );
  }

  if (unsupportedDurationSemanticKey(event.identity.semanticKey)) {
    return reject(
      event,
      "DURATION_EVENT_UNSUPPORTED",
      "Duration-like event requires a separate timing lifecycle.",
    );
  }

  let t0Source: EventWindowT0Source = "SCHEDULED_AT";
  let t0Ms = scheduledAtMs;

  if (event.releasedAt !== undefined) {
    const releasedAtMs = Date.parse(event.releasedAt);
    if (!Number.isFinite(releasedAtMs)) {
      return reject(
        event,
        "RELEASE_TIME_INVALID",
        "Event releasedAt is present but invalid.",
      );
    }
    t0Source = "RELEASED_AT";
    t0Ms = releasedAtMs;
  }

  const t0 = iso(t0Ms);
  const slots = EVENT_WINDOW_POLICY_V1.slots.map(
    (definition): QualifiedEventWindowSlot => {
      const targetMs = t0Ms + definition.offsetMs;
      return {
        role: definition.role,
        phase: definition.phase,
        offsetMs: definition.offsetMs,
        targetAt: iso(targetMs),
        opensAt: iso(targetMs - EVENT_WINDOW_POLICY_V1.toleranceMs),
        closesAt: iso(targetMs + EVENT_WINDOW_POLICY_V1.toleranceMs),
        toleranceMs: EVENT_WINDOW_POLICY_V1.toleranceMs,
      };
    },
  );

  return {
    eligible: true,
    window: {
      id: deterministicWindowId({
        eventIdentityKey: event.identity.key,
        t0,
      }),
      version: "v1",
      eventId: event.id,
      eventIdentityKey: event.identity.key,
      semanticKey: event.identity.semanticKey,
      subject: event.subject,
      jurisdiction: event.identity.jurisdiction,
      sourceId: event.sourceId,
      t0,
      t0Source,
      snapshotScope: EVENT_WINDOW_POLICY_V1.snapshotScope,
      slots,
    },
  };
}

export function matchSnapshotToEventWindow(
  window: QualifiedEventWindow,
  snapshot: MarketSnapshot,
): EventWindowSnapshotMatch {
  if (snapshot.scope !== window.snapshotScope) {
    return {
      status: "INCOMPATIBLE_SCOPE",
      role: null,
      phase: null,
      targetAt: null,
      timingErrorMs: null,
      snapshotQuality: snapshot.quality,
      reason: "Snapshot scope does not match the event-window policy scope.",
    };
  }

  const capturedAtMs = timestamp(snapshot.capturedAt, "Snapshot.capturedAt");
  const matches = window.slots.filter((slot) => {
    const opensAtMs = timestamp(slot.opensAt, "EventWindowSlot.opensAt");
    const closesAtMs = timestamp(slot.closesAt, "EventWindowSlot.closesAt");
    return capturedAtMs >= opensAtMs && capturedAtMs <= closesAtMs;
  });

  if (matches.length === 0) {
    return {
      status: "OUTSIDE_WINDOW",
      role: null,
      phase: null,
      targetAt: null,
      timingErrorMs: null,
      snapshotQuality: snapshot.quality,
      reason: "Snapshot capturedAt does not fall inside any EVW-001 capture window.",
    };
  }

  if (matches.length > 1) {
    throw new Error("EVW-001 capture windows must not overlap.");
  }

  const slot = matches[0];
  const targetAtMs = timestamp(slot.targetAt, "EventWindowSlot.targetAt");
  const degraded = snapshot.quality !== "COMPLETE";

  return {
    status: degraded ? "DEGRADED" : "QUALIFIED",
    role: slot.role,
    phase: slot.phase,
    targetAt: slot.targetAt,
    timingErrorMs: capturedAtMs - targetAtMs,
    snapshotQuality: snapshot.quality,
    ...(degraded
      ? {
          reason:
            "Snapshot timing is eligible, but Snapshot quality is "
            + snapshot.quality
            + ".",
        }
      : {}),
  };
}

/**
 * Returns other qualified HIGH point-events that occurred after a baseline
 * capture and no later than the evaluated capture. The primary event itself is
 * excluded by provider-independent identity.
 *
 * This is contamination metadata only. It does not infer causality or compute
 * repricing/transmission.
 */
export function findEventWindowContaminants(input: {
  primary: QualifiedEventWindow;
  baselineCapturedAt: string;
  evaluatedCapturedAt: string;
  events: Event[];
}): EventWindowContaminant[] {
  const baselineMs = timestamp(
    input.baselineCapturedAt,
    "baselineCapturedAt",
  );
  const evaluatedMs = timestamp(
    input.evaluatedCapturedAt,
    "evaluatedCapturedAt",
  );

  if (evaluatedMs < baselineMs) {
    throw new Error(
      "Event Window contamination interval must end at or after its baseline.",
    );
  }

  const contaminants = new Map<string, EventWindowContaminant>();

  for (const event of input.events) {
    const qualification = qualifyEventWindow(event);
    if (!qualification.eligible) continue;
    const candidate = qualification.window;
    if (candidate.eventIdentityKey === input.primary.eventIdentityKey) continue;

    const candidateT0Ms = timestamp(candidate.t0, "candidate EventWindow.t0");
    if (candidateT0Ms <= baselineMs || candidateT0Ms > evaluatedMs) continue;

    const existing = contaminants.get(candidate.eventIdentityKey);
    if (!existing || candidate.eventId.localeCompare(existing.eventId) < 0) {
      contaminants.set(candidate.eventIdentityKey, {
        eventId: candidate.eventId,
        eventIdentityKey: candidate.eventIdentityKey,
        subject: candidate.subject,
        t0: candidate.t0,
        t0Source: candidate.t0Source,
      });
    }
  }

  return [...contaminants.values()].sort(
    (a, b) => a.t0.localeCompare(b.t0)
      || a.eventIdentityKey.localeCompare(b.eventIdentityKey),
  );
}
