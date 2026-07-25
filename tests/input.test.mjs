import assert from "node:assert/strict";
import test from "node:test";
import { normalizeUnsignedInteger } from "../src/input.ts";

test("allows a temporarily empty integer input", () => {
  assert.equal(normalizeUnsignedInteger(""), "");
});

test("removes redundant leading zeroes", () => {
  assert.equal(normalizeUnsignedInteger("00042"), "42");
  assert.equal(normalizeUnsignedInteger("001024"), "1024");
});

test("preserves a single zero and canonical values", () => {
  assert.equal(normalizeUnsignedInteger("0"), "0");
  assert.equal(normalizeUnsignedInteger("42"), "42");
});
