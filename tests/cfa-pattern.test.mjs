import assert from "node:assert/strict";
import test from "node:test";

import {
  COLOR_TEST_PATTERNS,
  DEFAULT_CONFIG,
  MONOCHROME_TEST_PATTERNS,
  testPatternGroupsFor,
  testPatternsFor,
  validateConfig,
  withCfaPattern,
} from "../src/config.ts";

test("Mono CFA exposes only monochrome-compatible patterns", () => {
  const patterns = testPatternsFor("mono");

  assert.deepEqual(patterns, MONOCHROME_TEST_PATTERNS);
  for (const pattern of COLOR_TEST_PATTERNS) {
    assert.equal(patterns.includes(pattern), false);
  }
  assert.equal(patterns.includes("graySteps"), true);
  assert.equal(patterns.includes("horizontalGradient"), true);
  assert.equal(patterns.length, 8);
});

test("Bayer and Quad Bayer CFA arrays support every pattern group", () => {
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
    const patterns = testPatternsFor(cfaPattern);
    for (const pattern of COLOR_TEST_PATTERNS) {
      assert.equal(patterns.includes(pattern), true);
    }
    assert.deepEqual(
      testPatternGroupsFor(cfaPattern).map((group) => group.id),
      ["monochrome", "color"],
    );
  }
});

test("Mono menu contains only the monochrome group", () => {
  const groups = testPatternGroupsFor("mono");

  assert.equal(groups.length, 1);
  assert.equal(groups[0].id, "monochrome");
  assert.deepEqual(groups[0].patterns, MONOCHROME_TEST_PATTERNS);
});

test("switching any color pattern to Mono selects a supported fallback", () => {
  for (const testPattern of COLOR_TEST_PATTERNS) {
    const config = withCfaPattern(
      { ...DEFAULT_CONFIG, testPattern },
      "mono",
    );

    assert.equal(config.cfaPattern, "mono");
    assert.equal(config.testPattern, "graySteps");
  }
});

test("frontend validation rejects externally supplied Mono color patterns", () => {
  for (const testPattern of COLOR_TEST_PATTERNS) {
    const errors = validateConfig({
      ...DEFAULT_CONFIG,
      cfaPattern: "mono",
      testPattern,
    });

    assert.equal(errors.testPattern, "patternCfaMismatch");
  }
});
