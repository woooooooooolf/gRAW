import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const appStyles = readFileSync(new URL("../src/App.css", import.meta.url), "utf8");
const formControlsSource = readFileSync(
  new URL("../src/components/FormControls.tsx", import.meta.url),
  "utf8",
);

test("test-pattern preview has no visible label or shadow overlay", () => {
  assert.doesNotMatch(appStyles, /\.pattern-banner::after/);
  assert.doesNotMatch(appStyles, /\.pattern-banner\s+span/);
  assert.match(appStyles, /\.pattern-banner\s*\{[^}]*box-shadow:\s*none/s);
  assert.match(appSource, /role="img" aria-label=/);
});

test("test-pattern menu renders native option groups", () => {
  assert.match(appSource, /optionGroups=\{testPatternGroupsFor/);
  assert.match(formControlsSource, /<optgroup key=/);
});

test("compact workspace reserves additional height for storage controls", () => {
  assert.match(appStyles, /grid-template-rows:\s*198px 136px 128px/);
  assert.match(appStyles, /\.storage-card \.card-content\s*\{[^}]*padding-bottom:\s*10px/s);
});

test("generated-size secondary value remains comfortably legible", () => {
  assert.match(appStyles, /\.size-hero strong small\s*\{[^}]*font-size:\s*calc\(11px \* var\(--text-scale\)\)/s);
  assert.match(appStyles, /\.size-hero strong\s*\{[^}]*font-size:\s*calc\(15px \* var\(--text-scale\)\)/s);
});

test("generated metrics remain on one row at larger reading sizes", () => {
  assert.doesNotMatch(
    appStyles,
    /\.metrics-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s,
  );
  assert.match(
    appStyles,
    /\.metrics-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,/s,
  );
});
