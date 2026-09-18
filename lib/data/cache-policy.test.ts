import { cacheTagForRevalidate } from "./cache-policy";

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(label + ": expected " + String(expected) + ", got " + String(actual));
  }
}

function assertThrows(label: string, fn: () => unknown): void {
  try {
    fn();
  } catch {
    return;
  }
  throw new Error(label + ": expected function to throw");
}

assertEqual(cacheTagForRevalidate(300), "p365-fast", "300s");
assertEqual(cacheTagForRevalidate(21600), "p365-fast", "21600s");
assertEqual(cacheTagForRevalidate(43200), "p365-medium", "43200s");
assertEqual(cacheTagForRevalidate(86400), "p365-slow", "86400s");
assertThrows("28800s", () => cacheTagForRevalidate(28800));
