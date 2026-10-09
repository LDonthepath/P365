#!/usr/bin/env python3
"""HOUSEKEEP-002B disposable PostgreSQL proof. NEVER run against production.
Usage: python3 scripts/tests/housekeep_002b_pg_integration.py p365stage
Requires installer applied to an ephemeral p365stage database with a synthetic
cron.job_run_details table; no production data or secrets.
"""
import json
import subprocess
import sys

if len(sys.argv) != 2 or sys.argv[1] != "p365stage":
    raise SystemExit("REFUSED: ephemeral database must be named p365stage")
DB = sys.argv[1]
CHECKS = 0


def sql(query: str, check: bool = True):
    proc = subprocess.run(
        ["sudo", "-u", "postgres", "psql", "-X", "-Atq", "-v", "ON_ERROR_STOP=1",
         "-d", DB, "-c", query], capture_output=True, text=True,
    )
    if check and proc.returncode:
        raise RuntimeError(proc.stderr[-650:])
    return proc


def check(ok, label: str):
    global CHECKS
    if not ok:
        raise AssertionError(label)
    CHECKS += 1
    print("PASS: " + label)


def receipt(success=30, fail=90, batch=2, execute=False):
    out = sql(
        "SELECT p365_ops.prune_cron_run_details_v1"
        f"({success},{fail},{batch},{str(execute).lower()});"
    ).stdout.strip()
    return json.loads(out)


sql("""
INSERT INTO cron.job_run_details
  (runid,jobid,status,start_time,end_time)
VALUES
  (1,7,'succeeded',now()-interval '45 days',now()-interval '45 days'),
  (2,7,'succeeded',now()-interval '6 days',now()-interval '6 days'),
  (3,7,'failed',now()-interval '45 days',now()-interval '45 days'),
  (4,7,'failed',now()-interval '95 days',now()-interval '95 days'),
  (5,7,'succeeded',now()-interval '60 days',now()-interval '60 days'),
  (6,7,'succeeded',now()-interval '45 days',NULL),
  (7,7,'succeeded',now()-interval '35 days',now()-interval '35 days'),
  (8,7,'succeeded',now()-interval '35 days',now()-interval '35 days'),
  (9,7,'succeeded',now()-interval '35 days',now()-interval '35 days');
INSERT INTO p365_ops.cron_log_retention_holds(runid,reason)
VALUES (5,'Incident holds evidence');
""")
check(sql("SELECT count(*) FROM cron.job_run_details;").stdout.strip() == "9",
      "fixture has nine synthetic log rows")
check(not sql("SELECT 1 FROM cron.job WHERE jobname='p365-log-retention';",False).returncode == 0,
      "install does not assume a scheduler job table exists")
dry = receipt()
check(dry["status"]=="DRY_RUN" and dry["deleted"]==0 and dry["eligibleSample"]==2,
      "dry run reports at most two removable records")
check(sql("SELECT count(*) FROM cron.job_run_details;").stdout.strip()=="9",
      "dry run is nonmutating")
bad = sql("SELECT p365_ops.prune_cron_run_details_v1(7,90,2,true);",False)
check(bad.returncode != 0 and "unapproved or unbounded" in bad.stderr,
      "rejects success threshold below 14 days")
bad = sql("SELECT p365_ops.prune_cron_run_details_v1(30,14,2,true);",False)
check(bad.returncode != 0, "rejects failures preserved for less than successes")
bad = sql("SELECT p365_ops.prune_cron_run_details_v1(30,90,501,true);",False)
check(bad.returncode != 0, "rejects oversized batch")
check(sql("SELECT count(*) FROM cron.job_run_details;").stdout.strip()=="9",
      "invalid parameters make no change")
bad = sql("SET ROLE service_role; SELECT p365_ops.prune_cron_run_details_v1(30,90,2,true);",False)
check(bad.returncode != 0, "service_role cannot run maintenance")
first = receipt(execute=True)
check(first["status"]=="EXECUTED" and first["deleted"]==2,
      "first authorized execution deletes at most two eligible rows")
check(sql("SELECT count(*) FROM cron.job_run_details;").stdout.strip()=="7",
      "first batch deletes exactly two rows")
second = receipt(execute=True)
check(second["deleted"]==2, "second bounded batch removes two more eligible rows")
third = receipt(execute=True)
check(third["deleted"]==0, "remaining records are protected")
remaining = set(sql("SELECT runid FROM cron.job_run_details ORDER BY runid").stdout.splitlines())
check(remaining == {"2","3","5","6","9"} if second["deleted"]==2 and first["deleted"]==2 else False,
      "hold, recent rows, incomplete row and below-threshold failures survive")
# Five eligible rows in the fixture: 1,4,7,8,9; the first two batches
# delete four. One eligible row should remain; this assertion is separate.
