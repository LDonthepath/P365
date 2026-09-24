import {
  createEventWindowSnapshotCaptureHandler,
} from "./event-window-snapshot-capture-http";
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
  evaluatedAt: "2026-10-15T12:36:00.000Z",
  candidateEvents: 1,
  qualifiedWindows: 1,
  dueSlots: 2,
  captured: 2,
  corrected: 0,
  alreadyCaptured: 0,
  unavailableEventSlots: 0,
  failed: 0,
  slots: [],
};

async function main(): Promise<void> {
  let calls = 0;
  const handler = createEventWindowSnapshotCaptureHandler(
    async () => {
      calls += 1;
      return report;
    },
    () => "secret",
  );

  const unauthorized = await handler(
    new Request("https://example.test/api/cron/snapshot-capture"),
  );
  assertEqual(unauthorized.status, 401, "missing auth is rejected");
  assertEqual(calls, 0, "unauthorized request does not run capture");

  const authorized = await handler(
    new Request(
      "https://example.test/api/cron/snapshot-capture",
      { headers: { Authorization: "Bearer secret" } },
    ),
  );
  assertEqual(authorized.status, 200, "authorized success returns HTTP 200");
  assertEqual(calls, 1, "authorized request runs capture exactly once");
  assertEqual(await authorized.json(), report, "handler returns capture report");

  const failedHandler = createEventWindowSnapshotCaptureHandler(
    async () => ({ ...report, status: "FAILED", failed: 1 }),
    () => "secret",
  );
  const failed = await failedHandler(
    new Request(
      "https://example.test/api/cron/snapshot-capture",
      { headers: { Authorization: "Bearer secret" } },
    ),
  );
  assertEqual(failed.status, 500, "failed capture report returns HTTP 500");
}

void main();
