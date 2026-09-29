import assert from "node:assert/strict";
import test from "node:test";
import { shouldReconcileRaffleError } from "../lib/raffle-client.mjs";

test("reconciles stale terminal draw responses but keeps transient failures retryable", () => {
  assert.equal(shouldReconcileRaffleError({ response: { status: 404 } }), true);
  assert.equal(shouldReconcileRaffleError({ response: { status: 409 } }), true);
  assert.equal(shouldReconcileRaffleError({ response: { status: 500 } }), false);
  assert.equal(shouldReconcileRaffleError(new Error("offline")), false);
});
