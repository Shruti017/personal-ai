import test from "node:test";
import assert from "node:assert/strict";
import { calculate, extractPage } from "../src/agent.js";

test("calculator evaluates basic arithmetic", () => {
  assert.equal(calculate("(12 + 8) * 2").result, "40");
});

test("calculator evaluates common math functions", () => {
  assert.equal(Number(calculate("sqrt(81)").result), 9);
});

test("webpage extraction removes script and markup", () => {
  const result = extractPage("<html><head><title>Example</title><script>bad()</script></head><body><h1>Hello</h1><p>Useful text</p></body></html>", "https://example.com");
  assert.equal(result.title, "Example");
  assert.match(result.text, /Hello/);
  assert.match(result.text, /Useful text/);
  assert.doesNotMatch(result.text, /bad\(\)/);
});
