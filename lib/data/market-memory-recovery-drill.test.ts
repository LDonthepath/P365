import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { Evidence, Observation } from "../domain/types";
import { marketMemoryDedupeKey, marketMemoryEffectiveAt } from "./market-memory-record";

/**
 * DB-BACKUP-001: Synthetic in-memory backup/restore exercise only.
 * No production rows, database credentials, external services, or SQL writes.
 * This tests P365's actual canonical dedupe function and a fail-closed
 * restoration verifier; it does NOT prove a physical Supabase dump is restorable.
 */
type FixtureRecordType = "OBSERVATION" | "EVIDENCE";
type RecordValue = Observation | Evidence;
type RestoredRow = {
  id: string;
  record_type: FixtureRecordType;
  canonical_id: string;
  dedupe_key: string;
  captured_at: string;
  effective_at: string;
  source_id: string;
  supersedes_id: string | null;
  invalidates_id: string | null;
  payload: RecordValue;
};
type FixtureBackup = { rowsJson: string; sha256: string };

const observedAt = "2026-09-01T00:00:00.000Z";
const early = "2026-10-01T12:00:00.000Z";
const late = "2026-10-02T12:00:00.000Z";

function fredRevision(id: string, value: string, retrievedAt: string): Observation {
  return {
    id, domain: "MACRO", subject: "Total Nonfarm Payrolls", sourceId: "fred",
    value, observedAt, retrievedAt, evidenceId: `evidence-${id}`,
    quality: "FRESH",
    metadata: { seriesId: "PAYEMS", unit: "Thousands of Persons", frequency: "Monthly" },
  };
}

function eventEvidence(content: string, retrievedAt: string): Evidence {
  return {
    id: "synthetic-event-evidence", sourceId: "synthetic-provider", kind: "EVENT",
    subject: "Synthetic release", content, retrievedAt, capturedAt: retrievedAt,
    metadata: { eventIdentityKey: "fixture-2026-09-release", status: "RELEASED" },
  };
}

function row(
  id: string, record_type: FixtureRecordType, payload: RecordValue,
  supersedes_id: string | null = null,
): RestoredRow {
  return {
    id, record_type, canonical_id: payload.id,
    dedupe_key: marketMemoryDedupeKey(record_type, payload),
    effective_at: marketMemoryEffectiveAt(record_type, payload),
    captured_at: payload.retrievedAt, source_id: payload.sourceId,
    supersedes_id, invalidates_id: null, payload,
  };
}

function fixture(): RestoredRow[] {
  return [
    row("row-fred-v1", "OBSERVATION", fredRevision("fred-payems-v1", "159075", early)),
    row("row-fred-v2", "OBSERVATION", fredRevision("fred-payems-v2", "159015", late), "row-fred-v1"),
    row("row-event-v1", "EVIDENCE", eventEvidence("estimated", early)),
    row("row-event-v2", "EVIDENCE", eventEvidence("revised", late), "row-event-v1"),
  ];
}

function backup(rows: RestoredRow[]): FixtureBackup {
  const rowsJson = JSON.stringify(rows);
  return { rowsJson, sha256: createHash("sha256").update(rowsJson).digest("hex") };
}

function verifyRestoredRows(rows: RestoredRow[]): void {
  const ids = new Set<string>();
  const dedupeKeys = new Set<string>();

  for (const entry of rows) {
    assert.ok(entry.id && !ids.has(entry.id), "duplicate/empty physical row ID");
    assert.ok(entry.dedupe_key && !dedupeKeys.has(entry.dedupe_key), "duplicate/empty dedupe key");
    ids.add(entry.id);
    dedupeKeys.add(entry.dedupe_key);
    assert.equal(entry.canonical_id, entry.payload.id, "canonical identity drift");
    assert.equal(entry.source_id, entry.payload.sourceId, "source provenance drift");
    assert.equal(entry.effective_at, marketMemoryEffectiveAt(entry.record_type, entry.payload));
    assert.equal(entry.dedupe_key, marketMemoryDedupeKey(entry.record_type, entry.payload));
    assert.ok(Number.isFinite(Date.parse(entry.captured_at)), "invalid capture timestamp");
    assert.equal(entry.captured_at, entry.payload.retrievedAt, "synthetic capture/retrieval drift");
    assert.notEqual(entry.id, entry.supersedes_id, "self-supersession");
    assert.notEqual(entry.id, entry.invalidates_id, "self-invalidation");
  }

  const byId = new Map(rows.map((entry) => [entry.id, entry]));
  for (const entry of rows) {
    for (const priorId of [entry.supersedes_id, entry.invalidates_id]) {
      if (!priorId) continue;
      const previous = byId.get(priorId);
      assert.ok(previous, "missing revision/invalidation link");
      assert.ok(
        Date.parse(previous.captured_at) <= Date.parse(entry.captured_at),
        "revision points to future-captured source",
      );
    }
  }
}

function restoreSyntheticExport(exported: FixtureBackup): RestoredRow[] {
  assert.equal(
    createHash("sha256").update(exported.rowsJson).digest("hex"),
    exported.sha256,
    "backup artifact checksum mismatch",
  );
  const parsed: unknown = JSON.parse(exported.rowsJson);
  assert.ok(Array.isArray(parsed), "backup row list missing");
  const restored = parsed as RestoredRow[];
  verifyRestoredRows(restored);
  return restored;
}

function visibleAsOf(rows: RestoredRow[], cutoff: string): RestoredRow[] {
  return rows.filter((entry) =>
    Date.parse(entry.captured_at) <= Date.parse(cutoff)
    && Date.parse(entry.payload.retrievedAt) <= Date.parse(cutoff));
}

test("DB-BACKUP-001 synthetic export/restore preserves revision history, keys and provenance", () => {
  const before = fixture();
  const after = restoreSyntheticExport(backup(before));
  assert.deepEqual(after, before);
  assert.equal(after.length, 4);
  assert.equal(after[1].supersedes_id, after[0].id);
  assert.notEqual(after[0].dedupe_key, after[1].dedupe_key);
  assert.notEqual(after[2].dedupe_key, after[3].dedupe_key);
});

test("DB-BACKUP-001 as-of reads use capture and retrieval, not an old effective timestamp", () => {
  const restored = restoreSyntheticExport(backup(fixture()));
  const first = visibleAsOf(restored, "2026-10-01T23:59:59.000Z");
  assert.deepEqual(first.map((entry) => entry.id), ["row-fred-v1", "row-event-v1"]);
  assert.equal(restored[1].effective_at, observedAt);
  assert.equal(first.some((entry) => entry.id === "row-fred-v2"), false);
  assert.equal(visibleAsOf(restored, late).length, 4);
});

test("DB-BACKUP-001 same-content EVENT evidence refetch is not a new canonical version", () => {
  const earlier = eventEvidence("estimated", early);
  const again = eventEvidence("estimated", late);
  const changed = eventEvidence("revised", late);
  assert.equal(marketMemoryDedupeKey("EVIDENCE", earlier),
    marketMemoryDedupeKey("EVIDENCE", again));
  assert.notEqual(marketMemoryDedupeKey("EVIDENCE", again),
    marketMemoryDedupeKey("EVIDENCE", changed));
});

test("DB-BACKUP-001 duplicate canonical dedupe or row IDs fail closed", () => {
  const originals = fixture();
  assert.throws(() => restoreSyntheticExport(backup([...originals, { ...originals[0], id: "different-row" }])),
    /duplicate\/empty dedupe key/);
  assert.throws(() => restoreSyntheticExport(backup([...originals, { ...originals[0], dedupe_key: "new-key" }])),
    /duplicate\/empty physical row ID/);
});

test("DB-BACKUP-001 checksum rejects data corruption before restore", () => {
  const exportFile = backup(fixture());
  assert.throws(() => restoreSyntheticExport({ ...exportFile,
    rowsJson: exportFile.rowsJson.replace("159075", "159000") }), /checksum mismatch/);
});

test("DB-BACKUP-001 missing parent or backwards revision chronology fails even with valid checksum", () => {
  const absentParent = fixture().filter((entry) => entry.id !== "row-fred-v1");
  assert.throws(() => restoreSyntheticExport(backup(absentParent)), /missing revision/);

  const backwards = fixture();
  backwards[1] = { ...backwards[1], captured_at: "2026-09-30T00:00:00.000Z",
    payload: { ...backwards[1].payload, retrievedAt: "2026-09-30T00:00:00.000Z" } };
  assert.throws(() => restoreSyntheticExport(backup(backwards)), /future-captured source/);
});

test("DB-BACKUP-001 metadata or payload tampering fails even if attacker recomputes checksum", () => {
  const wrongCanonical = fixture();
  wrongCanonical[0] = { ...wrongCanonical[0], canonical_id: "different-canonical-id" };
  assert.throws(() => restoreSyntheticExport(backup(wrongCanonical)), /canonical identity drift/);
  const wrongValue = fixture();
  wrongValue[0] = { ...wrongValue[0],
    payload: { ...wrongValue[0].payload, value: "0" } as Observation };
  // An identity-preserving value correction without a new canonical revision is
  // not detected by the historical market-memory dedupe key alone. The SHA-256
  // manifest DOES detect changes against the original trusted backup artifact.
  const trusted = backup(fixture());
  assert.notEqual(backup(wrongValue).sha256, trusted.sha256);
});
