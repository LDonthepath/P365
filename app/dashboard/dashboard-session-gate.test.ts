import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createSession, verifySession } from "../../lib/auth";

const page = readFileSync("app/dashboard/page.tsx", "utf8");
const actions = readFileSync("app/dashboard/actions.ts", "utf8");

test("dashboard verifies session and redirects before any durable query", () => {
  const verifyAt = page.indexOf("await verifySession(");
  const redirectAt = page.indexOf('if (!session) redirect("/login")');
  const readAt = page.indexOf("await getDashboardData()");
  assert.ok(verifyAt >= 0 && redirectAt > verifyAt && readAt > redirectAt);
  assert.match(page, /sessionEmail=\{session\.email\}/);
  assert.doesNotMatch(page, /audit@preview\.local/);
});

test("dashboard Server Actions guard cache invalidation and diagnostic reads", () => {
  assert.match(actions, /async function assertDashboardSession\(\)/);
  assert.match(actions, /await verifySession\(/);
  assert.match(actions, /if \(!session\) redirect\("\/login"\)/);

  const refresh = actions.slice(
    actions.indexOf("export async function refreshDashboardData()"),
    actions.indexOf("export async function loadMaterialMoveCrossAssetDiagnostic("),
  );
  assert.ok(refresh.indexOf("await assertDashboardSession();") >= 0);
  assert.ok(refresh.indexOf("await assertDashboardSession();") < refresh.indexOf("revalidateTag(tag)"));

  const diagnostic = actions.slice(
    actions.indexOf("export async function loadMaterialMoveCrossAssetDiagnostic("),
  );
  assert.ok(diagnostic.indexOf("await assertDashboardSession();") >= 0);
  assert.ok(diagnostic.indexOf("await assertDashboardSession();") < diagnostic.indexOf("historicalObservationRepository,"));
});

test("signed sessions are accepted, absent and tampered sessions rejected", async () => {
  const prior = process.env.DASHBOARD_AUTH_SECRET;
  process.env.DASHBOARD_AUTH_SECRET = "p365-auth-test-only-no-production-secret";
  try {
    const token = await createSession("owner@example.test");
    assert.deepEqual(await verifySession(token), { email: "owner@example.test" });
    assert.equal(await verifySession(undefined), null);
    assert.equal(await verifySession("invalid"), null);
    const [payload, signature] = token.split(".");
    const modified = (signature[0] === "A" ? "B" : "A") + signature.slice(1);
    assert.equal(await verifySession(payload + "." + modified), null);
  } finally {
    if (prior === undefined) delete process.env.DASHBOARD_AUTH_SECRET;
    else process.env.DASHBOARD_AUTH_SECRET = prior;
  }
});
