/**
 * ARCH-IMPORT-001: AST-based import cycle and dependency-boundary audit.
 *
 * Scans production TypeScript modules in app/ and lib/ (excluding tests and
 * generated declarations). Resolves relative and tsconfig path-alias imports
 * through TypeScript's module resolver, including type-only imports, reexports,
 * import-equals, literal dynamic import(), and import("...") type expressions.
 *
 * Existing violations are explicit baseline debt. Any newly forbidden edge,
 * or any newly cyclic edge (even within a pre-existing SCC), fails CI. Never
 * rewrite the baseline automatically during the CI check.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const argv = process.argv.slice(2);
function valueAfter(flag, fallback) {
  const index = argv.indexOf(flag);
  if (index === -1) return fallback;
  if (index === argv.length - 1 || argv[index + 1].startsWith("--")) throw new Error("Missing value for " + flag);
  return argv[index + 1];
}
const root = resolve(valueAfter("--root", defaultRoot));
const baselineArg = valueAfter("--baseline", "tests/architecture/import-boundary-baseline.json");
const baselinePath = isAbsolute(baselineArg) ? baselineArg : resolve(root, baselineArg);
const generate = argv.includes("--write-baseline");

const asPosix = (name) => name.split(sep).join("/");
const relativeName = (absolute) => asPosix(relative(root, absolute));
const sourceExtensions = new Set([".ts", ".tsx"]);
function discover(dir, output) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const filename = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".next") discover(filename, output);
    } else if (entry.isFile() && sourceExtensions.has(extname(entry.name))
      && !/\.test\.tsx?$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
      output.push(filename);
    }
  }
}

const configFile = ts.readConfigFile(join(root, "tsconfig.json"), ts.sys.readFile);
if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
const config = ts.parseJsonConfigFileContent(configFile.config ?? {}, ts.sys, root);
if (config.errors.length) throw new Error(config.errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, "\n")).join("\n"));
const files = [];
discover(join(root, "app"), files);
discover(join(root, "lib"), files);
files.sort();
if (files.length === 0) throw new Error("No production TypeScript source found; failing closed.");
const byAbsolute = new Map(files.map((file) => [resolve(file), relativeName(file)]));
const nodes = new Map([...byAbsolute.values()].map((name) => [name, new Set()]));
const resolutions = new Map();

function literalModuleSpecifiers(source) {
  const result = new Set();
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      result.add(node.moduleSpecifier.text);
    }
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)
      && node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) {
      result.add(node.moduleReference.expression.text);
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)
      && ts.isStringLiteralLike(node.argument.literal)) {
      result.add(node.argument.literal.text);
    }
    if (ts.isCallExpression(node) && node.arguments.length === 1
      && ts.isStringLiteralLike(node.arguments[0])
      && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
      result.add(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return [...result].sort();
}

for (const file of files) {
  const filename = byAbsolute.get(resolve(file));
  const text = readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
    extname(file) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  if (source.parseDiagnostics.length) throw new Error("Invalid TypeScript AST: " + filename);
  for (const specifier of literalModuleSpecifiers(source)) {
    if (!specifier.startsWith(".") && !specifier.startsWith("@/")) continue;
    const cacheKey = file + "\0" + specifier;
    let target = resolutions.get(cacheKey);
    if (target === undefined) {
      target = ts.resolveModuleName(specifier, file, config.options, ts.sys).resolvedModule?.resolvedFileName ?? null;
      resolutions.set(cacheKey, target);
    }
    if (target) {
      const mapped = byAbsolute.get(resolve(target));
      if (mapped) nodes.get(filename).add(mapped);
    }
  }
}
const edges = [...nodes].flatMap(([source, targets]) => [...targets].map((target) => [source, target]))
  .sort(([a, b], [c, d]) => a.localeCompare(c) || b.localeCompare(d));
const edgeName = ([source, target]) => source + " -> " + target;

function isForbidden([source, target]) {
  if (!source.startsWith("lib/domain/")) return false;
  return target.startsWith("app/")
    || ["lib/data/", "lib/ingestion/", "lib/repositories/", "lib/application/", "lib/presentation/"]
      .some((prefix) => target.startsWith(prefix));
}
const forbiddenEdges = edges.filter(isForbidden).map(edgeName).sort();

// Tarjan's SCC, then record EACH internal cyclic edge. Checking individual
// edges prevents a new edge inside an already cyclic component from escaping.
const index = new Map();
const low = new Map();
const stack = [];
const onStack = new Set();
const components = [];
let nextIndex = 0;
function visit(node) {
  index.set(node, nextIndex);
  low.set(node, nextIndex++);
  stack.push(node);
  onStack.add(node);
  for (const adjacent of [...nodes.get(node)].sort()) {
    if (!index.has(adjacent)) {
      visit(adjacent);
      low.set(node, Math.min(low.get(node), low.get(adjacent)));
    } else if (onStack.has(adjacent)) {
      low.set(node, Math.min(low.get(node), index.get(adjacent)));
    }
  }
  if (low.get(node) === index.get(node)) {
    const component = [];
    let popped;
    do {
      popped = stack.pop();
      onStack.delete(popped);
      component.push(popped);
    } while (popped !== node);
    components.push(component.sort());
  }
}
for (const name of [...nodes.keys()].sort()) if (!index.has(name)) visit(name);
const cyclicComponents = components.filter((component) =>
  component.length > 1 || nodes.get(component[0]).has(component[0]));
const componentByFile = new Map(cyclicComponents.flatMap((component, i) => component.map((name) => [name, i])));
const cycleEdges = edges.filter(([source, target]) =>
  componentByFile.has(source) && componentByFile.get(source) === componentByFile.get(target))
  .map(edgeName).sort();
const snapshot = {
  version: 1,
  scope: "production app/**/*.ts(x), lib/**/*.ts(x); excludes *.test.ts(x), *.d.ts",
  forbiddenEdges,
  cycleEdges,
};
console.log("[ARCH-IMPORT-001] modules=" + files.length + " edges=" + edges.length
  + " cyclic-components=" + cyclicComponents.length + " forbidden-edges=" + forbiddenEdges.length
  + " cyclic-edges=" + cycleEdges.length);
for (const component of cyclicComponents) console.log("  [CYCLE SCC] " + component.join(", "));
if (generate) {
  mkdirSync(dirname(baselinePath), { recursive: true });
  writeFileSync(baselinePath, JSON.stringify(snapshot, null, 2) + "\n");
  console.log("[ARCH-IMPORT-001] WROTE BASELINE (review this diff): " + relativeName(baselinePath));
} else {
  if (!existsSync(baselinePath)) throw new Error("Missing committed architecture baseline: " + baselinePath);
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  if (baseline.version !== 1 || !Array.isArray(baseline.forbiddenEdges) || !Array.isArray(baseline.cycleEdges)) {
    throw new Error("Invalid baseline schema/version");
  }
  let regressions = 0;
  for (const key of ["forbiddenEdges", "cycleEdges"]) {
    const prior = new Set(baseline[key]);
    const current = new Set(snapshot[key]);
    for (const violation of snapshot[key]) {
      if (prior.has(violation)) console.log("  [LEGACY " + key + "] " + violation);
      else {
        regressions++;
        console.error("  [NEW " + key + "] " + violation);
      }
    }
    for (const resolved of baseline[key]) if (!current.has(resolved)) {
      console.log("  [RESOLVED " + key + "] " + resolved);
    }
  }
  if (regressions > 0) {
    console.error("[ARCH-IMPORT-001] FAIL: " + regressions + " new architectural violations; do not silently refresh baseline.");
    process.exitCode = 1;
  } else {
    console.log("[ARCH-IMPORT-001] PASS: zero new architectural violations (legacy debt remains visible).");
  }
}
