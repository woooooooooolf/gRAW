import assert from "node:assert/strict";
import test from "node:test";

import {
  CONFIG_LIMITS,
  DEFAULT_CONFIG,
  validateConfig,
} from "../src/config.ts";

test("accepts values at the configured frontend resource limits", () => {
  const errors = validateConfig({
    ...DEFAULT_CONFIG,
    width: CONFIG_LIMITS.dimension,
    height: CONFIG_LIMITS.dimension,
    frameCount: CONFIG_LIMITS.frameCount,
    rowAlignment: CONFIG_LIMITS.rowAlignment,
    frameAlignment: CONFIG_LIMITS.frameAlignment,
    fileOffset: CONFIG_LIMITS.fileOffset,
  });

  assert.deepEqual(errors, {});
});

test("rejects values above the frontend resource limits", () => {
  for (const [key, value] of [
    ["width", CONFIG_LIMITS.dimension + 1],
    ["height", CONFIG_LIMITS.dimension + 1],
    ["frameCount", CONFIG_LIMITS.frameCount + 1],
    ["rowAlignment", CONFIG_LIMITS.rowAlignment + 1],
    ["frameAlignment", CONFIG_LIMITS.frameAlignment + 1],
    ["fileOffset", CONFIG_LIMITS.fileOffset + 1],
  ]) {
    const errors = validateConfig({ ...DEFAULT_CONFIG, [key]: value });
    assert.ok(errors[key], `${key} should be rejected`);
  }
});

test("validates active pattern parameters as exactly representable integers", () => {
  assert.equal(
    validateConfig({
      ...DEFAULT_CONFIG,
      testPattern: "checkerboard",
      checkerSize: CONFIG_LIMITS.checkerSize + 1,
    }).checkerSize,
    "positiveInteger",
  );
  assert.equal(
    validateConfig({
      ...DEFAULT_CONFIG,
      testPattern: "randomNoise",
      noiseSeed: CONFIG_LIMITS.noiseSeed + 1,
    }).noiseSeed,
    "nonNegativeInteger",
  );
  assert.equal(
    validateConfig({
      ...DEFAULT_CONFIG,
      testPattern: "randomNoise",
      noiseSeed: Number.POSITIVE_INFINITY,
    }).noiseSeed,
    "nonNegativeInteger",
  );
});
