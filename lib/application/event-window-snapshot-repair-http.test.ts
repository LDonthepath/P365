import {
  createEventWindowSnapshotRepairHandler,
} from "./event-window-snapshot-repair-http";
import type { EventWindowCaptureReport } from "./event-window-snapshot-capture";

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      label
      + ": expected "
      + JSON.stringify(expected)
      + ", got "
      + JSON.stringify(actual),
    );
  }
}

const report: EventWindowCaptureReport = {
  status: "SUCCESS",
  evaluatedAt: "2026-10-15T15:30:00.000Z",
  candidateEvents: 1,
  qualifiedWindows: 1,
  dueSlots: 2,
  captured: 0,
  corrected: 2,
  alreadyCaptured: 0,
  unavailableEventSlots: 0,
  failed: 0,
  slots: [],
};

async function main(): Promise<void> {
  const calls: string[] = [];
  const handler = createEventWindowSnapshotRepairHandler(
    async (eventIdentityKey) => {
      calls.push(eventIdentityKey);
      return report;
    },
    () => "secret",
  );

  const unauthorized = await handler(
    new Request(
      "https://example.test/api/cron/snapshot-repair?eventIdentityKey=event-key",
      { method: "POST" },
    ),
  );
  assertEqual(unauthorized.status, 401, "repair requires bearer auth");
  assertEqual(calls.length, 0, "unauthorized repair does not execute");

  const missingIdentity = await handler(
    new Request(
      "https://example.test/api/cron/snapshot-repair",
      {
        method: "POST",
        headers: { Authorization: "Bearer secret" },
      },
    ),
  );
  assertEqual(missingIdentity.status, 400, "repair requires explicit Event identity");
  assertEqual(calls.length, 0, "missing identity does not execute repair");

  const authorized = await handler(
    new Request(
      "https://example.test/api/cron/snapshot-repair?eventIdentityKey=event%3Av1%3AUS%3Aexample",
      {
        method: "POST",
        headers: { Authorization: "Bearer secret" },
      },
    ),
  );
  assertEqual(authorized.status, 200, "authorized repair returns HTTP 200");
  assertEqual(calls, ["event:v1:US:example"], "repair receives decoded explicit Event identity");
  assertEqual(await authorized.json(), report, "repair returns report unchanged");
}

void main();
