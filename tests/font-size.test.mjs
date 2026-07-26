import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FONT_SIZES, normalizeFontSize } from "../src/fontSize.ts";

const appStyles = readFileSync(new URL("../src/App.css", import.meta.url), "utf8");

test("provides text-only reading size choices", () => {
  assert.deepEqual(FONT_SIZES, ["standard", "comfortable", "large"]);
});

test("preserves supported reading size preferences", () => {
  assert.equal(normalizeFontSize("standard"), "standard");
  assert.equal(normalizeFontSize("comfortable"), "comfortable");
  assert.equal(normalizeFontSize("large"), "large");
});

test("migrates the former small size and unknown values to standard", () => {
  assert.equal(normalizeFontSize("small"), "standard");
  assert.equal(normalizeFontSize("oversized"), "standard");
  assert.equal(normalizeFontSize(null), "standard");
});

test("keeps reading size preferences independent from workspace geometry", () => {
  assert.equal(appStyles.includes('data-font-size="comfortable"] .app-shell'), false);
  assert.equal(appStyles.includes('data-font-size="large"] .app-shell'), false);
  assert.equal(appStyles.includes('data-font-size="large"] .workspace'), false);
  assert.match(appStyles, /--text-scale:\s*1\.1/);
  assert.match(appStyles, /--text-scale:\s*1\.2/);
});
