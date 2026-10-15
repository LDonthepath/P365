import assert from "node:assert/strict";
import { existsSync,readFileSync } from "node:fs";
import test from "node:test";

test("MACRO-CUT-004 legacy manifest retired by MACRO-CUT-FINAL, no executable rollback",()=>{
  for(const p of ["../../scripts/ops/macro_cut_004_inventory_readonly.sql",
    "../../scripts/ops/macro_cut_004_cron_rollback_operator.sql",
    "../../scripts/ops/macro_cut_004_execution_blocked.sql"]) {
    assert.equal(existsSync(new URL(p,import.meta.url)),false,p);
  }
  const verification=readFileSync(new URL("../../scripts/ops/macro_cut_final_verify_readonly.sql",import.meta.url),"utf8");
  assert.match(verification,/PASS_NO_NONMACRO_HISTORY/);
  assert.match(verification,/PASS_NO_INTERNAL_CLEANUP_ARCHIVES/);
  assert.match(verification,/PASS_SNAPSHOT_JOB_PAUSED/);
  const script=verification.replace(/--[^\n]*/g,"");
  assert.doesNotMatch(script,/\b(?:INSERT|DELETE|UPDATE|TRUNCATE|DROP|ALTER|GRANT|REVOKE|CREATE)\s/i);
});

test("MACRO-CUT-FINAL single integrated code/test/cron/history/metadata/docs checkpoint",()=>{
  const docs=["../../README.md","../../docs/P365-ARCHITECTURE.md",
    "../../docs/P365-MARKET-MEMORY-STORAGE-GROWTH-AUDIT-2026-10-04.md",
    "../../docs/OPS-CRON-NAME-001-OPERATOR-RUNBOOK.md",
    "../../docs/P365-CANONICAL-FOUNDATION-INTEGRITY-AUDIT-F0.md"];
  for(const path of docs){
    const s=readFileSync(new URL(path,import.meta.url),"utf8");
    assert.match(s,/MACRO-CUT-FINAL|FINAL MACRO-CUT|Final Macro Cleanup/);
    assert.match(s,/Biquote|biquote/);
    assert.match(s,/103[.,]067/);
  }
});
