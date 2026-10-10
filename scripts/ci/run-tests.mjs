/**
 * Run every repository *.test.ts(x) file with the same pinned tsx runner in
 * CI and local development. This script does not call P365 cron endpoints or
 * touch production infrastructure.
 *
 * Usage: npm test
 *        npm test -- --list
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const roots = ["app", "lib", "tests"];
const tests = [];

function discover(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) discover(absolute);
    else if (entry.isFile() && /\.test\.(?:ts|tsx)$/.test(entry.name)) {
      tests.push(relative(root, absolute).replaceAll("\\", "/"));
    }
  }
}

for (const dir of roots) {
  const absolute = join(root, dir);
  if (existsSync(absolute)) discover(absolute);
}
tests.sort();

if (tests.length === 0) {
  console.error("G0: no *.test.ts(x) files discovered; failing closed.");
  process.exitCode = 1;
} else if (process.argv.includes("--list")) {
  console.log(`G0: discovered ${tests.length} TypeScript test files:`);
  for (const name of tests) console.log(name);
} else {
  console.log(`G0: running all ${tests.length} TypeScript test files with tsx@4.20.6.`);
  // Next.js's server-only marker intentionally throws when imported directly
  // outside a Next.js server bundle. Reuse the existing CI test-only sentinel.
  const temp = mkdtempSync(join(tmpdir(), "p365-g0-tests-"));
  try {
    const marker = join(temp, "node_modules", "server-only");
    mkdirSync(marker, { recursive: true });
    writeFileSync(join(marker, "index.js"), "module.exports = {};\n");
    const environment = {
      ...process.env,
      NODE_PATH: [join(temp, "node_modules"), process.env.NODE_PATH].filter(Boolean).join(delimiter),
    };
    const command = process.platform === "win32" ? "npx.cmd" : "npx";
    const result = spawnSync(command, [
      "--yes", "tsx@4.20.6", "--test", "--test-concurrency=4", ...tests,
    ], {
      cwd: root,
      env: environment,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (result.error) console.error("G0 test runner invocation failed:", result.error.message);
    process.exitCode = result.status ?? 1;
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}
