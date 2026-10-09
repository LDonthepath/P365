#!/usr/bin/env python3
"""OBS-FRED-001G staging-only PG concurrency contract tests.

Requires a disposable PostgreSQL database with scripts/ops/obs_fred_001g_install_rpc.sql
installed and a service_role with BYPASSRLS. NEVER point at production.
Usage: python3 scripts/tests/obs_fred_001g_pg_integration.py p365stage
"""
from concurrent.futures import ThreadPoolExecutor
import json
import subprocess
import sys
import time

DB = sys.argv[1] if len(sys.argv) > 1 else None
if DB != "p365stage":
    raise SystemExit("Refusing to run outside explicitly named ephemeral p365stage")
C = 0

def sql(statement, role="service_role", check=True):
    full = f"SET ROLE {role}; " + statement if role else statement
    proc = subprocess.run(["sudo", "-u", "postgres", "psql", "-X", "-Atq",
                           "-v", "ON_ERROR_STOP=1", "-d", DB, "-c", full],
                          text=True, capture_output=True)
    if check and proc.returncode:
        raise AssertionError(f"psql failed: {proc.stderr[-600:]}")
    return proc

def row(period, version, value, series="ICSA", domain="MACRO"):
    d = period + "T00:00:00.000Z"
    id = f"observation-v1-staging-{version}"
    return {
        "record_type": "OBSERVATION", "canonical_id": id,
        "effective_at": d, "captured_at": "2026-10-09T01:00:00.000Z",
        "dedupe_key": "OBSERVATION:" + id + ":" + d,
        "payload": {
            "id": id, "domain": domain, "sourceId": "fred",
            "observedAt": d, "retrievedAt": "2026-10-09T00:30:00Z",
            "value": value,
            "identity": {"version":"v1", "seriesKey":series,
                         "measurementId":f"measurement-v1-staging-{domain}-{series}-{period}",
                         "revisionFingerprint":f"revision-v1-staging-{version}"},
            "metadata": {"seriesId":series, "unit":"Number",
                         "frequency":"WEEKLY"},
        },
    }

def do_call(rows, tail=""):
    raw = json.dumps(rows, separators=(",", ":")).replace("'", "''")
    return f"SELECT public.p365_insert_fred_observations_v1('{raw}'::jsonb); {tail}"

def receipt(rows, tail=""):
    p=sql(do_call(rows,tail))
    for line in p.stdout.splitlines():
        if line.startswith("{"):
            return json.loads(line)
    raise AssertionError(f"No JSON receipt: {p.stdout[-500:]}")

def gate(enabled):
    sql(f"UPDATE public.p365_fred_revision_gate SET enforced={'true' if enabled else 'false'} WHERE singleton")

def check(cond, message):
    global C
    assert cond, message
    C += 1

print("OBS-FRED-001G disposable PostgreSQL staged test")
assert sql("SELECT current_database()", role=None).stdout.strip() == "p365stage"
# Disposable local database only; reset fixture state between repeat runs.
sql("UPDATE public.p365_fred_revision_gate SET enforced=false WHERE singleton", role=None)
sql("TRUNCATE TABLE public.market_memory,public.p365_fred_revision_heads", role=None)
sql("UPDATE public.p365_fred_revision_gate SET epoch=0 WHERE singleton", role=None)
raw = row("2026-01-01","off", "100")
r=receipt([raw])
check(r["inserted"]==1 and r["revised"] is None and r["revisionAssessment"]=="NOT_EVALUATED", "disabled gate must not infer revisions")
check(receipt([raw])["revised"]==0 and receipt([raw])["inserted"]==0, "duplicate idempotent")
legacy_a=row("2026-01-02","legacy-a", "100")
legacy_b=row("2026-01-02","legacy-b", "102")
receipt([legacy_a]); receipt([legacy_b])

gate(True)
check(sql("SELECT epoch FROM public.p365_fred_revision_gate").stdout.strip().endswith("1"), "enable increments epoch")
direct = raw.copy()
direct["canonical_id"] = "observation-v1-staging-bypass"
direct["dedupe_key"] = direct["dedupe_key"].replace("-off:", "-bypass:")
direct["payload"] = dict(raw["payload"], id=direct["canonical_id"])
stmt=f"INSERT INTO public.market_memory (record_type,canonical_id,effective_at,captured_at,dedupe_key,payload) VALUES ('OBSERVATION','{direct['canonical_id']}','2026-01-01T00:00:00Z',now(),'{direct['dedupe_key']}','{json.dumps(direct['payload'])}'::jsonb)"
check(sql(stmt,check=False).returncode != 0,"uncoordinated modern FRED insert blocked")
check(sql(do_call([row("2026-01-04","anon", "5")]),role="anon",check=False).returncode != 0,"anon cannot execute RPC")

first = receipt([row("2026-01-03","first", "100")])
check(first["inserted"]==1 and first["revised"]==0 and first["revisionAssessment"]=="COMPLETE","empty measurement is proven first write")
second = receipt([row("2026-01-03","second", "105")])
check(second["inserted"]==1 and second["revised"]==1,"difference to coordinated committed head is factual revision")
equivalent = receipt([row("2026-01-03","equiv", "105.000")])
check(equivalent["revised"]==0 and equivalent["revisionAssessment"]=="COMPLETE","numeric equivalent is not a revision")
check(receipt([row("2026-01-03","second", "105")])["duplicates"]==1, "same fingerprint retries do not advance head")

ambiguous = receipt([row("2026-01-02","ambiguous", "108")])
check(ambiguous["inserted"]==1 and ambiguous["revised"] is None and ambiguous["revisionAssessment"]=="NOT_EVALUATED", "mixed historical values have unknown last writer")
qualified_next = receipt([row("2026-01-02","qualified-next", "110")])
check(qualified_next["revised"]==1 and qualified_next["revisionAssessment"]=="COMPLETE", "next locked write has provable head")

pre_count=int(sql("SELECT count(*) FROM public.market_memory").stdout.strip())
dupes=sql(do_call([row("2026-02-01","dup1","200"),row("2026-02-01","dup2","201")]),check=False)
check(dupes.returncode != 0 and int(sql("SELECT count(*) FROM public.market_memory").stdout.strip())==pre_count, "ambiguous same-period batch rejects all writes")

# Both sessions hold the same measurement lock across RPC and commit.
one=row("2026-03-01","racer1","200")
two=row("2026-03-01","racer2","220")
def transaction(rows, sleep_seconds=0, rollback=False):
    stmt="BEGIN; "+do_call(rows, f"SELECT pg_sleep({sleep_seconds}); " if sleep_seconds else "")
    stmt+= " ROLLBACK;" if rollback else " COMMIT;"
    return sql(stmt)

with ThreadPoolExecutor(max_workers=2) as pool:
    f1=pool.submit(transaction,[one],1.1)
    time.sleep(0.2)
    f2=pool.submit(transaction,[two])
    p1,p2=f1.result(),f2.result()
j1=next(json.loads(x) for x in p1.stdout.splitlines() if x.startswith("{"))
j2=next(json.loads(x) for x in p2.stdout.splitlines() if x.startswith("{"))
check(j1["revised"]==0 and j2["revised"]==1, "parallel sessions serialize first-write then factual revision")
check(int(sql("SELECT count(*) FROM public.market_memory WHERE effective_at='2026-03-01T00:00:00Z' AND record_type='OBSERVATION'").stdout.strip())==2,"both distinct versions appended")

with ThreadPoolExecutor(max_workers=2) as pool:
    f1=pool.submit(transaction,[row("2026-03-02","rolled-back","300")],1.1,True)
    time.sleep(0.2)
    f2=pool.submit(transaction,[row("2026-03-02","committed","310")])
    p1,p2=f1.result(),f2.result()
j2=next(json.loads(x) for x in p2.stdout.splitlines() if x.startswith("{"))
check(j2["revised"]==0 and j2["inserted"]==1, "rollback does not create phantom predecessor")
check(int(sql("SELECT count(*) FROM public.market_memory WHERE effective_at='2026-03-02T00:00:00Z' AND record_type='OBSERVATION'").stdout.strip())==1,"rollback leaves no durable row")

# Concurrent identical canonical IDs must produce one physical row and no revision.
with ThreadPoolExecutor(max_workers=2) as pool:
    f1=pool.submit(transaction,[row("2026-03-03","idempotent","123")],0.9)
    time.sleep(0.15)
    f2=pool.submit(transaction,[row("2026-03-03","idempotent","123")])
    p1,p2=f1.result(),f2.result()
j1=next(json.loads(x) for x in p1.stdout.splitlines() if x.startswith("{"))
j2=next(json.loads(x) for x in p2.stdout.splitlines() if x.startswith("{"))
check(j1["inserted"]==1 and j2["inserted"]==0 and j2["revised"]==0, "simultaneous idempotent retry remains duplicate")
check(int(sql("SELECT count(*) FROM public.market_memory WHERE effective_at='2026-03-03T00:00:00Z' AND record_type='OBSERVATION'").stdout.strip())==1, "concurrent identical rows only insert once")

# Two locks in opposite input order: globally sorted acquisition must avoid deadlock.
with ThreadPoolExecutor(max_workers=2) as pool:
    f1=pool.submit(transaction,[row("2026-03-04","deadlock-a","100"),
                                row("2026-03-05","deadlock-b","100")],0.8)
    time.sleep(0.15)
    f2=pool.submit(transaction,[row("2026-03-05","deadlock-c","101"),
                                row("2026-03-04","deadlock-d","101")])
    p1,p2=f1.result(),f2.result()
j2=next(json.loads(x) for x in p2.stdout.splitlines() if x.startswith("{"))
check(j2["inserted"]==2 and j2["revised"]==2 and j2["revisionAssessment"]=="COMPLETE", "reordered batches serialize without deadlock")

# Only canonical registered FRED series are admitted; rejection precedes writes.
invalid=sql(do_call([row("2026-03-06","unregistered","8",series="UNKNOWN_SERIES")]),check=False)
check(invalid.returncode!=0, "unregistered FRED series is rejected before INSERT")
unqualified=receipt([row("2026-03-07","wrong-unit-base","110",series="DTWEXBGS",domain="ASSET")])
check(unqualified["inserted"]==1 and unqualified["revised"] is None, "DTWEXBGS remains unqualified even under coordinated gate")
# Legacy source column alone must not bypass the guarded writer.
legacy_only = raw.copy()
legacy_only["canonical_id"]="observation-v1-staging-legacy-bypass"
legacy_only["payload"]=dict(raw["payload"], id=legacy_only["canonical_id"], sourceId="not-fred")
legacy_only["dedupe_key"]="OBSERVATION:"+legacy_only["canonical_id"]+":2026-01-01T00:00:00.000Z"
stmt=f"INSERT INTO public.market_memory (record_type,source_id,canonical_id,effective_at,captured_at,dedupe_key,payload) VALUES ('OBSERVATION','fred','{legacy_only['canonical_id']}','2026-01-01T00:00:00Z',now(),'{legacy_only['dedupe_key']}','{json.dumps(legacy_only['payload'])}'::jsonb)"
check(sql(stmt,check=False).returncode!=0, "legacy SQL source_id writer cannot bypass enforcement")

# Switching enforcement OFF and ON invalidates prior head generations.
gate(False);gate(True)
check(sql("SELECT epoch FROM public.p365_fred_revision_gate").stdout.strip().endswith("3"),"re-enable advances provenance epoch")
res=receipt([row("2026-01-03","after-reenable","109")])
check(res["revised"] is None and res["revisionAssessment"]=="NOT_EVALUATED", "old epoch head cannot be treated as current write-order proof")

# Cap sentinel and missing predecessor numeric payload must never produce
# a falsely proven "revised" count.
gate(False)
history=[row("2026-05-01",f"over-cap-{i}","200") for i in range(65)]
missing_prior=row("2026-05-02","legacy-missing-value","200")
del missing_prior["payload"]["value"]
history.append(missing_prior)
seed=json.dumps(history,separators=(",",":")).replace("'", "''")
sql("INSERT INTO public.market_memory(record_type,canonical_id,effective_at,captured_at,dedupe_key,payload) "
    "SELECT record_type,canonical_id,effective_at,captured_at,dedupe_key,payload "
    f"FROM jsonb_to_recordset('{seed}'::jsonb) AS x(record_type text,canonical_id text,"
    "effective_at timestamptz,captured_at timestamptz,dedupe_key text,payload jsonb)")
gate(True)
bounded=receipt([row("2026-05-01","over-cap-candidate","201")])
check(bounded["revised"] is None and bounded["revisionAssessment"]=="NOT_EVALUATED",
      "65 prior versions exceed complete-history bound")
missing=receipt([row("2026-05-02","missing-value-candidate","201")])
check(missing["revised"] is None and missing["revisionAssessment"]=="NOT_EVALUATED",
      "missing predecessor value must never fabricate a factual revision")

print(f"PASS: {C} assertions; real PostgreSQL concurrent sessions, retry, rollback, gate, ACL and epoch invariants")
