import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateViewportScale,
  COMPACT_VIEWPORT_HEIGHT,
  COMPACT_VIEWPORT_WIDTH,
} from "../src/viewport.ts";

test("uses the compact viewport as the minimum one-to-one scale", () => {
  assert.equal(
    calculateViewportScale(COMPACT_VIEWPORT_WIDTH, COMPACT_VIEWPORT_HEIGHT),
    1,
  );
  assert.equal(calculateViewportScale(640, 480), 1);
});

test("scales uniformly using the limiting viewport dimension", () => {
  assert.equal(calculateViewportScale(960, 680), 960 / 860);
  assert.equal(calculateViewportScale(860, 900), 1);
  assert.equal(calculateViewportScale(1720, 900), 1.5);
});

test("falls back safely for invalid viewport dimensions", () => {
  assert.equal(calculateViewportScale(Number.NaN, 600), 1);
  assert.equal(calculateViewportScale(860, 0), 1);
});
