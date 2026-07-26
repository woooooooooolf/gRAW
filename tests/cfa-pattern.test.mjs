import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CONFIG,
  testPatternsFor,
  validateConfig,
  withCfaPattern,
} from "../src/config.ts";

test("Mono CFA excludes color bars while retaining luminance patterns", () => {
  const patterns = testPatternsFor("mono");

  assert.equal(patterns.includes("colorBars"), false);
  assert.equal(patterns.includes("graySteps"), true);
  assert.equal(patterns.includes("horizontalGradient"), true);
  assert.equal(patterns.length, 8);
});

test("Bayer and Quad Bayer CFA arrays support color bars", () => {
  for (const cfaPattern of [
    "rggb",
    "grbg",
    "gbrg",
    "bggr",
    "quadRggb",
    "quadGrbg",
    "quadGbrg",
    "quadBggr",
  ]) {
    assert.equal(testPatternsFor(cfaPattern).includes("colorBars"), true);
  }
});

test("switching color bars to Mono selects a supported fallback", () => {
  const config = withCfaPattern(
    { ...DEFAULT_CONFIG, testPattern: "colorBars" },
    "mono",
  );

  assert.equal(config.cfaPattern, "mono");
  assert.equal(config.testPattern, "graySteps");
});

test("frontend validation rejects externally supplied Mono color bars", () => {
  const errors = validateConfig({
    ...DEFAULT_CONFIG,
    cfaPattern: "mono",
    testPattern: "colorBars",
  });

  assert.equal(errors.testPattern, "patternCfaMismatch");
});
