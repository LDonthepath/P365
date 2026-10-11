import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const script = resolve(dirname(fileURLToPath(import.meta.url)), "../../scripts/ci/check-import-boundaries.mjs");

function fixture(t: { after: (cleanup: () => void) => void }) {
  const root = mkdtempSync(join(tmpdir(), "p365-arch-import-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      baseUrl: ".",
      paths: { "@/*": ["./*"] },
      target: "ES2017",
      module: "esnext",
      moduleResolution: "bundler",
    },
  }));
  function write(name: string, contents: string) {
    const dest = join(root, name);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, contents);
  }
  function run(...args: string[]) {
    const result = spawnSync(process.execPath, [script, "--root", root, "--baseline", "baseline.json", ...args], {
      encoding: "utf8",
    });
    return { status: result.status, output: result.stdout + result.stderr };
  }
  function baseline() {
    const generated = run("--write-baseline");
    assert.equal(generated.status, 0, generated.output);
    return JSON.parse(readFileSync(join(root, "baseline.json"), "utf8")) as {
      forbiddenEdges: string[];
      cycleEdges: string[];
    };
  }
  return { root, write, run, baseline };
}

test("ARCH-IMPORT-001: type-only, alias, reexport and import-type all enter the AST graph", (t) => {
  const env = fixture(t);
  env.write("lib/data/provider.ts", "export interface Fact { value: number }\n");
  env.write("lib/domain/mapper.ts", [
    'import type { Fact } from "../data/provider";',
    'export type Alias = import("@/lib/data/provider").Fact;',
    'export type { Fact as PublicFact } from "@/lib/data/provider";',
    "export const a = 1;",
  ].join("\n"));
  const recorded = env.baseline();
  assert.deepEqual(recorded.forbiddenEdges, ["lib/domain/mapper.ts -> lib/data/provider.ts"]);
  assert.deepEqual(recorded.cycleEdges, []);
  const verified = env.run();
  assert.equal(verified.status, 0, verified.output);
  assert.match(verified.output, /\[LEGACY forbiddenEdges\]/);
});

test("ARCH-IMPORT-001: new domain-to-provider edge fails even with explicit legacy debt", (t) => {
  const env = fixture(t);
  env.write("lib/data/legacy.ts", "export interface Legacy {}\n");
  env.write("lib/data/new-provider.ts", "export interface NewProvider {}\n");
  env.write("lib/domain/domain.ts", 'import type { Legacy } from "../data/legacy";\nexport type Old = Legacy;\n');
  assert.equal(env.baseline().forbiddenEdges.length, 1);
  env.write("lib/domain/domain.ts", [
    'import type { Legacy } from "../data/legacy";',
    'import type { NewProvider } from "../data/new-provider";',
    'export type Old = Legacy;',
    'export type New = NewProvider;',
  ].join("\n"));
  const checked = env.run();
  assert.equal(checked.status, 1, checked.output);
  assert.match(checked.output, /\[NEW forbiddenEdges\] lib\/domain\/domain\.ts -> lib\/data\/new-provider\.ts/);
  assert.match(checked.output, /\[LEGACY forbiddenEdges\] lib\/domain\/domain\.ts -> lib\/data\/legacy\.ts/);
});

test("ARCH-IMPORT-001: new reexport/type-only cycle fails; removing it passes", (t) => {
  const env = fixture(t);
  env.write("lib/application/a.ts", 'export { valueB } from "./b";\nexport interface A { id: string }\n');
  env.write("lib/application/b.ts", "export const valueB = 1;\n");
  assert.deepEqual(env.baseline().cycleEdges, []);
  env.write("lib/application/b.ts", 'import type { A } from "./a";\nexport type FromA = A;\nexport const valueB = 1;\n');
  const rejected = env.run();
  assert.equal(rejected.status, 1, rejected.output);
  assert.match(rejected.output, /\[NEW cycleEdges\]/);
  assert.match(rejected.output, /\[CYCLE SCC\]/);
  env.write("lib/application/b.ts", "export const valueB = 1;\n");
  assert.equal(env.run().status, 0);
});

test("ARCH-IMPORT-001: adding an edge inside a legacy SCC still counts as regression", (t) => {
  const env = fixture(t);
  env.write("lib/application/a.ts", 'import { b } from "./b";\nexport const a = b;\n');
  env.write("lib/application/b.ts", 'import { c } from "./c";\nexport const b = c;\n');
  env.write("lib/application/c.ts", 'import type { A } from "./a";\nexport interface A { id: string }\nexport const c = 1;\n');
  // Node/TypeScript AST only: these are deliberately symbolic fixture imports.
  const recorded = env.baseline();
  assert.equal(recorded.cycleEdges.length, 3);
  assert.equal(env.run().status, 0);
  env.write("lib/application/a.ts", 'import { b } from "./b";\nimport { c } from "./c";\nexport const a = b + c;\n');
  const rejected = env.run();
  assert.equal(rejected.status, 1, rejected.output);
  assert.match(rejected.output, /\[NEW cycleEdges\] lib\/application\/a\.ts -> lib\/application\/c\.ts/);
});
