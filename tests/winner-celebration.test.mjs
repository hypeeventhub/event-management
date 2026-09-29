import assert from "node:assert/strict";
import test from "node:test";
import { getWinnerCelebrationState } from "../lib/winner-celebration.mjs";

test("opens an unclosable decision modal after selection and a closable success modal after confirmation", () => {
  assert.deepEqual(getWinnerCelebrationState("pending", { name: "Ana" }, null), { open: true, mode: "decision", name: "Ana", dismissible: false });
  assert.deepEqual(getWinnerCelebrationState("confirming", { name: "Ana" }, null), { open: true, mode: "decision", name: "Ana", dismissible: false });
  assert.deepEqual(getWinnerCelebrationState("confirmed", null, { name: "Ana" }), { open: true, mode: "confirmed", name: "Ana", dismissible: true });
  assert.deepEqual(getWinnerCelebrationState("ready", null, null), { open: false, mode: null, name: "", dismissible: true });
});

test("creates a bounded deterministic confetti field", async () => {
  const { createConfettiPieces } = await import("../lib/winner-celebration.mjs");
  const pieces = createConfettiPieces(48);
  assert.equal(pieces.length, 48);
  assert.deepEqual(pieces[0], createConfettiPieces(48)[0]);
});
