#!/usr/bin/env python3
"""OBS-FRED-001G: destructive ONLY inside a fixed, local throwaway PostgreSQL DB.

This is NOT a production RPC, migration, cron job or persistence implementation.
Run: /usr/bin/python3 scripts/qualification/obs_fred_001g_transaction_probe.py
Requirements: local PostgreSQL and Python psycopg2; no app package dependencies.
"""
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal

import psycopg2
from psycopg2.extras import Json

DB_NAME = "p365_obs_fred_001g_sandbox"
SCHEMA = "obs_fred_001g"
SOCKET = "/var/run/postgresql"
SERIES = "PAYEMS"
PERIOD = "2026-08-01T00:00:00+00"
LOCK_KEY = "p365:fred:v1:MACRO:PAYEMS:2026-08-01T00:00:00.000Z:fred"
EXPECTED_HOST = "local Unix socket only"


def connection():
    if os.environ.get("P365_001G_ALLOW_LOCAL_DESTRUCTIVE") != "YES":
        raise RuntimeError("Staging-only gate required: P365_001G_ALLOW_LOCAL_DESTRUCTIVE=YES")
    if os.environ.get("PGHOST") or os.environ.get("PGSERVICE") or os.environ.get("DATABASE_URL"):
        raise RuntimeError("External database connection is forbidden for this staging probe")
    db = psycopg2.connect(
        dbname=DB_NAME, user=os.environ.get("USER", "ubuntu"),
        host=SOCKET, connect_timeout=3,
    )
    if db.info.dbname != DB_NAME or db.info.host != SOCKET:
        db.close()
        raise RuntimeError("Refusing to access any non-sandbox database")
    db.autocommit = False
    return db


def prepare():
    with connection() as db:
        with db.cursor() as cur:
            cur.execute("SHOW default_transaction_isolation")
            assert cur.fetchone()[0] == "read committed"
            cur.execute("SELECT current_setting('server_version')")
            version = cur.fetchone()[0]
            # This is a THROWAWAY schema in the hard-coded local sandbox DB only.
            cur.execute("CREATE SCHEMA IF NOT EXISTS obs_fred_001g")
            cur.execute("""
                CREATE TABLE IF NOT EXISTS obs_fred_001g.market_memory (
                    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                    record_type text NOT NULL,
                    canonical_id text NOT NULL,
                    source_id text,
                    effective_at timestamptz NOT NULL,
                    captured_at timestamptz NOT NULL,
                    created_at timestamptz NOT NULL DEFAULT now(),
                    dedupe_key text NOT NULL UNIQUE,
                    payload jsonb NOT NULL
                )
            """)
            cur.execute("TRUNCATE obs_fred_001g.market_memory RESTART IDENTITY")
    return version


def clear():
    with connection() as db:
        with db.cursor() as cur:
            cur.execute("TRUNCATE obs_fred_001g.market_memory RESTART IDENTITY")


def canonical_value(raw):
    return Decimal(str(raw))


def logical_payload(value, *, legacy=False):
    data = {
        "domain": "MACRO",
        "sourceId": "fred",
        "metadata": {"seriesId": SERIES, "unit": "Thousands of Persons", "frequency": "Monthly"},
        "observedAt": "2026-08-01T00:00:00.000Z",
        "value": str(value),
    }
    if not legacy:
        data["identity"] = {"version": "v1", "seriesKey": SERIES, "measurementId": "measurement-v1-qualifier"}
    return data


def direct_insert(name, value, *, legacy=False, captured_at="2026-10-08T09:00:00+00", source_col=None):
    with connection() as db:
        with db.cursor() as cur:
            cur.execute("""
                INSERT INTO obs_fred_001g.market_memory
                    (record_type, canonical_id, source_id, effective_at, captured_at, dedupe_key, payload)
                VALUES ('OBSERVATION', %s, %s, %s::timestamptz, %s::timestamptz, %s, %s)
                ON CONFLICT (dedupe_key) DO NOTHING RETURNING canonical_id
            """, (name, source_col, PERIOD, captured_at,
                  "OBSERVATION:" + name + ":" + PERIOD, Json(logical_payload(value, legacy=legacy))))
            result = cur.fetchone()
    return result is not None


def coordinated_insert(name, value, *, acquired=None, proceed=None, attempting=None,
                       rollback=False, captured_at="2026-10-08T09:00:00+00"):
    db = connection()
    try:
        with db:
            with db.cursor() as cur:
                cur.execute("SET LOCAL lock_timeout = '4s'")
                cur.execute("SET LOCAL statement_timeout = '6s'")
                if attempting:
                    attempting.set()
                # The lock is TRANSACTION-scoped and voluntarily respected.
                cur.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (LOCK_KEY,))
                # CRITICAL: Fresh READ COMMITTED statement AFTER lock acquisition.
                cur.execute("""
                    SELECT canonical_id, payload->>'value',
                           payload->'metadata'->>'unit', payload->'metadata'->>'frequency'
                    FROM obs_fred_001g.market_memory
                    WHERE record_type = 'OBSERVATION'
                      AND payload->>'domain' = 'MACRO'
                      AND payload #>> '{metadata,seriesId}' = %s
                      AND effective_at = %s::timestamptz
                      AND payload->>'sourceId' = 'fred'
                    LIMIT 65
                """, (SERIES, PERIOD))
                prior = cur.fetchall()
                prior_ids = [r[0] for r in prior]
                if len(prior) >= 65:
                    status = "NOT_EVALUATED"
                elif len(prior) == 0:
                    status = "PROVEN_NEW_MEASUREMENT"
                elif len(prior) == 1 and prior[0][2:] == ("Thousands of Persons", "Monthly"):
                    status = ("IDENTITY_ONLY_OR_EQUIVALENT"
                              if canonical_value(value) == canonical_value(prior[0][1])
                              else "PROVEN_FACTUAL_REVISION")
                else:
                    status = "NOT_EVALUATED"
                cur.execute("""
                    INSERT INTO obs_fred_001g.market_memory
                        (record_type, canonical_id, source_id, effective_at, captured_at, dedupe_key, payload)
                    VALUES ('OBSERVATION', %s, NULL, %s::timestamptz, %s::timestamptz, %s, %s)
                    ON CONFLICT (dedupe_key) DO NOTHING RETURNING canonical_id
                """, (name, PERIOD, captured_at,
                      "OBSERVATION:" + name + ":" + PERIOD, Json(logical_payload(value))))
                new = cur.fetchone()
                if new is None:
                    status = "DUPLICATE_NOT_INSERTED"
                if acquired:
                    acquired.set()
                if proceed:
                    assert proceed.wait(timeout=5), "interleaving test timed out"
                if rollback:
                    raise RuntimeError("intentional sandbox transaction rollback")
                result = {"name": name, "inserted": new is not None,
                          "status": status, "prior_ids": prior_ids}
        return result
    finally:
        db.close()


def count_rows():
    with connection() as db:
        with db.cursor() as cur:
            cur.execute("SELECT count(*) FROM obs_fred_001g.market_memory")
            return cur.fetchone()[0]


def test_concurrent_distinct_versions():
    clear()
    held = threading.Event()
    release = threading.Event()
    trying = threading.Event()
    with ThreadPoolExecutor(max_workers=2) as pool:
        a = pool.submit(coordinated_insert, "modern-v1", "159075",
                        acquired=held, proceed=release,
                        captured_at="2026-10-08T11:00:00+00")
        assert held.wait(timeout=4)
        b = pool.submit(coordinated_insert, "modern-v2", "159015",
                        attempting=trying,
                        captured_at="2026-10-08T08:00:00+00")
        assert trying.wait(timeout=4)
        time.sleep(0.2)
        assert not b.done(), "writer B bypassed the per-measurement transaction lock"
        release.set()
        x, y = a.result(timeout=5), b.result(timeout=5)
    assert x["inserted"] and x["status"] == "PROVEN_NEW_MEASUREMENT", x
    assert y["inserted"] and y["status"] == "PROVEN_FACTUAL_REVISION", y
    assert y["prior_ids"] == ["modern-v1"], y
    assert count_rows() == 2
    # App-captured timestamps intentionally rank committed versions backwards.
    return "PASS distinct-version concurrency: A=NEW, B=REVISION, B saw A after lock; captured_at misleading"


def test_duplicate_parallel():
    clear()
    held, release = threading.Event(), threading.Event()
    with ThreadPoolExecutor(max_workers=2) as pool:
        a = pool.submit(coordinated_insert, "same-id", "159075", acquired=held, proceed=release)
        assert held.wait(timeout=4)
        b = pool.submit(coordinated_insert, "same-id", "159075")
        time.sleep(0.15)
        assert not b.done()
        release.set()
        x, y = a.result(timeout=5), b.result(timeout=5)
    assert x["inserted"] is True and y["inserted"] is False, (x, y)
    assert y["status"] == "DUPLICATE_NOT_INSERTED" and count_rows() == 1
    return "PASS duplicate concurrent retry: 1 inserted / 1 ignored"


def test_rollback_competing_writer():
    clear()
    held, release = threading.Event(), threading.Event()
    with ThreadPoolExecutor(max_workers=2) as pool:
        a = pool.submit(coordinated_insert, "rolled-back", "159075",
                        acquired=held, proceed=release, rollback=True)
        assert held.wait(timeout=4)
        b = pool.submit(coordinated_insert, "survivor", "159015")
        time.sleep(0.15)
        assert not b.done()
        release.set()
        try:
            a.result(timeout=5)
            raise AssertionError("expected deliberate rollback")
        except RuntimeError as err:
            assert "intentional" in str(err)
        result = b.result(timeout=5)
    assert result["inserted"] and result["status"] == "PROVEN_NEW_MEASUREMENT"
    assert count_rows() == 1
    return "PASS transaction rollback: competing writer sees no rolled-back predecessor"


def test_legacy_same_value():
    clear()
    assert direct_insert("legacy", "159075", legacy=True, source_col=None)
    result = coordinated_insert("modern", "159075.000")
    assert result["status"] == "IDENTITY_ONLY_OR_EQUIVALENT"
    assert result["prior_ids"] == ["legacy"]
    return "PASS legacy NULL source column + equal value: IDENTITY_ONLY, not revised"


def test_legacy_changed_value():
    clear()
    assert direct_insert("legacy", "159075", legacy=True, source_col="fred")
    result = coordinated_insert("modern", "159015")
    assert result["status"] == "PROVEN_FACTUAL_REVISION"
    return "PASS legacy source column fred + changed value: FACTUAL_REVISION"


def test_ambiguous_history():
    clear()
    assert direct_insert("legacy-a", "159075", legacy=True)
    assert direct_insert("legacy-b", "159017", legacy=True)
    result = coordinated_insert("modern", "159015")
    assert result["status"] == "NOT_EVALUATED" and result["inserted"]
    return "PASS ambiguous prior version order: NOT_EVALUATED but append succeeds"


def test_noncooperating_bypass():
    clear()
    held, release = threading.Event(), threading.Event()
    with ThreadPoolExecutor(max_workers=1) as pool:
        a = pool.submit(coordinated_insert, "cooperating", "159075",
                        acquired=held, proceed=release)
        assert held.wait(timeout=4)
        # A second writer that DOES NOT take advisory lock can insert during A's hold.
        assert direct_insert("rogue", "159015"), "noncooperating writer unexpectedly blocked"
        release.set()
        a.result(timeout=5)
    assert count_rows() == 2
    return "PASS exposure: advisory locks are VOLUNTARY; unsafe bypass reproduced"


def test_65_row_cap():
    clear()
    for n in range(65):
        assert direct_insert("legacy-"+str(n), str(158000+n), legacy=True)
    result = coordinated_insert("candidate", "159015")
    assert result["inserted"] and result["status"] == "NOT_EVALUATED"
    return "PASS 65+ prior rows: fail closed NOT_EVALUATED"


def test_multi_key_sorted_lock_order():
    """Two batches give reverse keys but acquire a total ordered lock set."""
    first = threading.Event()
    release = threading.Event()
    keys = ["p365:fred:v1:MACRO:PAYEMS:2026-08-01:fred",
            "p365:fred:v1:MACRO:CPIAUCSL:2026-08-01:fred"]

    def acquire(sequence, *, mark=None, pause=None):
        db = connection()
        try:
            with db:
                with db.cursor() as cur:
                    cur.execute("SET LOCAL lock_timeout='4s'")
                    # Sort by canonical key, not numeric hash, on every writer.
                    for key in sorted(set(sequence)):
                        cur.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (key,))
                    if mark:
                        mark.set()
                    if pause:
                        assert pause.wait(timeout=4)
            return True
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as pool:
        a = pool.submit(acquire, keys, mark=first, pause=release)
        assert first.wait(timeout=4)
        b = pool.submit(acquire, list(reversed(keys)))
        time.sleep(0.15)
        assert not b.done(), "writer B did not observe ordered batch lock"
        release.set()
        assert a.result(timeout=5) and b.result(timeout=5)
    return "PASS inverse batch-key order: sorted transaction advisory locks avoid deadlock"


def test_local_destructive_gate():
    original = os.environ.pop("P365_001G_ALLOW_LOCAL_DESTRUCTIVE", None)
    try:
        try:
            connection()
            raise AssertionError("connection without staging gate must fail")
        except RuntimeError as error:
            assert "Staging-only gate" in str(error)
    finally:
        if original is not None:
            os.environ["P365_001G_ALLOW_LOCAL_DESTRUCTIVE"] = original
    return "PASS destructive safety gate: refuse without explicit local staging authorization"


def main():
    version = prepare()
    assert version.split(".")[0] == os.environ.get("P365_001G_EXPECT_MAJOR", "17"), "unexpected staging PostgreSQL major version"
    print("ENV LOCAL-ONLY: PostgreSQL", version, "|", DB_NAME, "|", EXPECTED_HOST, flush=True)
    tests = [
        test_concurrent_distinct_versions, test_duplicate_parallel,
        test_rollback_competing_writer, test_legacy_same_value,
        test_legacy_changed_value, test_ambiguous_history,
        test_noncooperating_bypass, test_65_row_cap,
        test_multi_key_sorted_lock_order, test_local_destructive_gate,
    ]
    for test in tests:
        print(test(), flush=True)
    print("SUMMARY: 10/10 PostgreSQL " + version.split(".")[0] + " local staging transaction scenarios passed")
    print("GATE: production 17.6 exact-minor and actual schema/RPC EQUIVALENCE NOT VERIFIED.")
    print("GATE: writer exclusivity, grants, latency, realistic SQL/trigger compatibility NOT VERIFIED.")


if __name__ == "__main__":
    main()
