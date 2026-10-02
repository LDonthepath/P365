import { createHash } from "node:crypto";
import {
  calibrateTransmissionDirection,
  type TransmissionDirectionCalibrationEvidence,
  type TransmissionDirectionCalibrationSampleInput,
} from "../domain/transmission-direction-calibration";
import type { EventWindowRole } from "../domain/event-window";
import type { SnapshotObservationChange } from "../domain/snapshot-comparison";
import type { EventWindowSnapshotComparison } from "./snapshot-comparison";

export const INTRADAY_TRANSMISSION_DIRECTION_CALIBRATION_V1 = {
  methodologyId: "intraday-event-window-directional-relationship-v1",
  methodologyVersion: "v1",
} as const;

export type TransmissionDirectionCalibrationAudit = {
  inputComparisonCount: number;
  matchingRoleComparisonCount: number;
  completeComparisonCount: number;
  directionalComparisonCount: number;
  uniqueCohortCount: number;
  duplicateCohortComparisonCount: number;
  excludedQualityCount: number;
  excludedDirectionalCount: number;
};

export type TransmissionDirectionCalibrationResult = {
  evidence: TransmissionDirectionCalibrationEvidence;
  audit: TransmissionDirectionCalibrationAudit;
};

function stableHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}

function changeFor(
  comparison: EventWindowSnapshotComparison,
  observationKey: string,
): SnapshotObservationChange | undefined {
  return comparison.comparison.observationChanges.find(
    (change) => change.key === observationKey,
  );
}

function qualifiedSignedPercentChange(
  change: SnapshotObservationChange | undefined,
): number | null {
  if (!change) return null;
  if (change.status !== "CHANGED" && change.status !== "UNCHANGED") return null;
  if (change.percentDelta === null || !Number.isFinite(change.percentDelta)) return null;
  if (change.percentDelta === 0) return null;
  if (!change.beforeObservationId || !change.afterObservationId) return null;
  return change.percentDelta;
}

function lineageKey(input: {
  afterRole: Exclude<EventWindowRole, "PRE">;
  driver: SnapshotObservationChange;
  response: SnapshotObservationChange;
}): string {
  return stableHash([
    input.afterRole,
    input.driver.beforeObservationId,
    input.driver.afterObservationId,
    input.response.beforeObservationId,
    input.response.afterObservationId,
  ]);
}

/**
 * Builds TRN-002A directional calibration samples from already-qualified
 * PRE->post CMP-001 comparisons.
 *
 * Simultaneous releases that reference the same driver/response Observation
 * lineage collapse into one market cohort, so a cluster of event identities
 * cannot multiply the statistical sample size.
 *
 * This builder performs no repository/provider I/O and does not produce a
 * production TRN-001 rule.
 */
export function buildTransmissionDirectionCalibration(input: {
  driverObservationKey: string;
  responseObservationKey: string;
  afterRole: Exclude<EventWindowRole, "PRE">;
  comparisons: EventWindowSnapshotComparison[];
}): TransmissionDirectionCalibrationResult {
  const cohorts = new Map<string, TransmissionDirectionCalibrationSampleInput>();
  let matchingRoleComparisonCount = 0;
  let completeComparisonCount = 0;
  let directionalComparisonCount = 0;
  let duplicateCohortComparisonCount = 0;
  let excludedQualityCount = 0;
  let excludedDirectionalCount = 0;

  for (const comparison of input.comparisons) {
    if (comparison.afterRole !== input.afterRole) continue;
    matchingRoleComparisonCount += 1;

    if (comparison.comparison.quality !== "COMPLETE") {
      excludedQualityCount += 1;
      continue;
    }
    completeComparisonCount += 1;

    const driver = changeFor(comparison, input.driverObservationKey);
    const response = changeFor(comparison, input.responseObservationKey);
    const driverPercentChange = qualifiedSignedPercentChange(driver);
    const responsePercentChange = qualifiedSignedPercentChange(response);

    if (
      !driver
      || !response
      || driverPercentChange === null
      || responsePercentChange === null
    ) {
      excludedDirectionalCount += 1;
      continue;
    }
    directionalComparisonCount += 1;

    const cohortKey = lineageKey({
      afterRole: input.afterRole,
      driver,
      response,
    });
    const sampleId = "transmission-direction-cohort-v1-" + cohortKey;
    const current = cohorts.get(sampleId);

    if (!current) {
      cohorts.set(sampleId, {
        sampleId,
        driverPercentChange,
        responsePercentChange,
        comparisonIds: [comparison.comparison.id],
        eventIdentityKeys: [comparison.eventIdentityKey],
      });
      continue;
    }

    if (
      current.driverPercentChange !== driverPercentChange
      || current.responsePercentChange !== responsePercentChange
    ) {
      throw new Error(
        "TRN-002A duplicate cohort lineage contains inconsistent percentage changes.",
      );
    }

    duplicateCohortComparisonCount += 1;
    current.comparisonIds.push(comparison.comparison.id);
    current.eventIdentityKeys.push(comparison.eventIdentityKey);
  }

  const samples = [...cohorts.values()];
  const evidence = calibrateTransmissionDirection({
    driverObservationKey: input.driverObservationKey,
    responseObservationKey: input.responseObservationKey,
    afterRole: input.afterRole,
    methodologyId:
      INTRADAY_TRANSMISSION_DIRECTION_CALIBRATION_V1.methodologyId,
    methodologyVersion:
      INTRADAY_TRANSMISSION_DIRECTION_CALIBRATION_V1.methodologyVersion,
    samples,
  });

  return {
    evidence,
    audit: {
      inputComparisonCount: input.comparisons.length,
      matchingRoleComparisonCount,
      completeComparisonCount,
      directionalComparisonCount,
      uniqueCohortCount: samples.length,
      duplicateCohortComparisonCount,
      excludedQualityCount,
      excludedDirectionalCount,
    },
  };
}
