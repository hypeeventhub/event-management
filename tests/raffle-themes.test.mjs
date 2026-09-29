import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_RAFFLE_SPEED, DEFAULT_RAFFLE_THEME, getRaffleTheme, getSpinDuration } from "../lib/raffle-themes.mjs";

test("uses the purple reference theme and bounded speed defaults", () => {
  assert.equal(DEFAULT_RAFFLE_THEME, "purple");
  assert.equal(DEFAULT_RAFFLE_SPEED, 3);
  assert.equal(getRaffleTheme("unknown").key, "purple");
  assert.equal(getSpinDuration(1), 7000);
  assert.equal(getSpinDuration(5), 1800);
});
