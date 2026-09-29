import assert from "node:assert/strict";
import test from "node:test";
import * as raffle from "../lib/raffle-state.mjs";

import {
  canCancel,
  canConfirm,
  canStartDraw,
  createRaffleRequestTracker,
  createRaffleState,
  getRaffleErrorMessage,
  getWheelAttendees,
  raffleReducer,
} from "../lib/raffle-state.mjs";

const alice = { registration_id: 1, first_name: "Alice", last_name: "Rivera", masked_email: "a***@example.com" };
const bob = { registration_id: 2, first_name: "Bob", last_name: "Santos", masked_email: "b***@example.com" };
const draw = { id: 50, status: "pending", selected_at: "2026-09-29T00:00:00Z", expires_at: "2026-09-29T00:10:00Z" };
const winner = { id: 70, ...alice, won_at: "2026-09-29T00:01:00Z" };

function loaded(overrides = {}) {
  return raffleReducer(createRaffleState(), {
    type: "LOAD_SUCCESS",
    payload: {
      event: { id: 1, slug: "sample", title: "Sample Event" },
      eligible_attendees: [alice, bob],
      eligible_count: 2,
      pending_draw: null,
      winners: [],
      ...overrides,
    },
  });
}

test("load classifies available, empty, exhausted, and reserved raffles", () => {
  assert.equal(loaded().status, "ready");
  assert.equal(loaded({ eligible_attendees: [], eligible_count: 0 }).status, "empty");
  assert.equal(loaded({ eligible_attendees: [], eligible_count: 0, winners: [winner] }).status, "exhausted");
  const reserved = loaded({ eligible_attendees: [bob], eligible_count: 1, pending_draw: { ...draw, ...alice } });
  assert.equal(reserved.status, "pending");
  assert.equal(reserved.selectedAttendee.registration_id, 1);
  assert.equal(reserved.pendingDraw.id, 50);
});

test("reserved winner remains a wheel segment when the backend excludes it from eligibility", () => {
  const reserved = loaded({ eligible_attendees: [bob], eligible_count: 1, pending_draw: { ...draw, ...alice } });
  assert.deepEqual(getWheelAttendees(reserved), [bob, alice]);
  const alreadyIncluded = loaded({ pending_draw: { ...draw, ...alice } });
  assert.deepEqual(getWheelAttendees(alreadyIncluded), [alice, bob]);
});

test("draw stores the server-selected attendee through animation completion", () => {
  const drawing = raffleReducer(loaded(), { type: "DRAW_START" });
  assert.equal(drawing.status, "drawing");
  const spinning = raffleReducer(drawing, { type: "DRAW_SUCCESS", payload: { draw, attendee: bob } });
  assert.equal(spinning.status, "spinning");
  assert.deepEqual(spinning.selectedAttendee, bob);
  assert.equal(spinning.pendingDraw.id, 50);
  assert.equal(raffleReducer(spinning, { type: "SPIN_END" }).status, "pending");
});

test("confirmation removes only the returned winner and prepends server history", () => {
  const pending = raffleReducer(raffleReducer(raffleReducer(loaded(), { type: "DRAW_START" }), { type: "DRAW_SUCCESS", payload: { draw, attendee: alice } }), { type: "SPIN_END" });
  const confirmed = raffleReducer(raffleReducer(pending, { type: "CONFIRM_START" }), {
    type: "CONFIRM_SUCCESS",
    payload: { draw: { ...draw, status: "confirmed" }, attendee: alice, winner },
  });
  assert.equal(confirmed.status, "confirmed");
  assert.deepEqual(confirmed.eligibleAttendees, [bob]);
  assert.equal(confirmed.eligibleCount, 1);
  assert.deepEqual(confirmed.winners, [winner]);
  assert.equal(confirmed.pendingDraw, null);
});

test("failed confirmation retains the provisional winner for retry", () => {
  const pending = raffleReducer(loaded({ eligible_attendees: [bob], eligible_count: 1, pending_draw: { ...draw, ...alice } }), { type: "CONFIRM_START" });
  const failed = raffleReducer(pending, { type: "CONFIRM_FAILURE", error: new Error("network down") });
  assert.equal(failed.status, "pending");
  assert.deepEqual(failed.selectedAttendee, alice);
  assert.equal(failed.pendingDraw.id, 50);
  assert.equal(canConfirm(failed), true);
  assert.match(failed.error, /try again/i);
});

test("cancellation restores a reserved attendee without duplicating an existing one", () => {
  const pending = loaded({ eligible_attendees: [bob], eligible_count: 1, pending_draw: { ...draw, ...alice } });
  const cancelled = raffleReducer(raffleReducer(pending, { type: "CANCEL_START" }), {
    type: "CANCEL_SUCCESS",
    payload: { draw: { ...draw, status: "cancelled" }, attendee: alice },
  });
  assert.equal(cancelled.status, "ready");
  assert.deepEqual(cancelled.eligibleAttendees, [bob, alice]);
  assert.equal(cancelled.eligibleCount, 2);
  assert.equal(cancelled.pendingDraw, null);
  assert.equal(cancelled.selectedAttendee, null);
});

test("failed cancellation preserves the draw and shows a safe retry error", () => {
  const pending = raffleReducer(raffleReducer(loaded(), { type: "DRAW_START" }), { type: "DRAW_SUCCESS", payload: { draw, attendee: alice } });
  const failed = raffleReducer(raffleReducer(raffleReducer(pending, { type: "SPIN_END" }), { type: "CANCEL_START" }), {
    type: "CANCEL_FAILURE",
    error: { response: { data: { message: "SQLSTATE[42S02] missing table" } } },
  });
  assert.equal(failed.status, "pending");
  assert.equal(failed.pendingDraw.id, 50);
  assert.equal(canCancel(failed), true);
  assert.doesNotMatch(failed.error, /SQLSTATE/);
});

test("model lookup details are never shown to users", () => {
  assert.equal(
    getRaffleErrorMessage({ response: { data: { message: "No query results for model [App\\Models\\RaffleDraw] 8" } } }, "Please try again."),
    "Please try again.",
  );
  assert.equal(getRaffleErrorMessage({ response: { data: { message: "Draw is no longer pending." } } }, "Please try again."), "Draw is no longer pending.");
});

test("selectors block duplicate or overlapping lifecycle actions", () => {
  const ready = loaded();
  const pending = raffleReducer(raffleReducer(ready, { type: "DRAW_START" }), { type: "DRAW_SUCCESS", payload: { draw, attendee: alice } });
  const states = [
    raffleReducer(ready, { type: "DRAW_START" }),
    pending,
    raffleReducer(raffleReducer(pending, { type: "SPIN_END" }), { type: "CONFIRM_START" }),
    raffleReducer(raffleReducer(pending, { type: "SPIN_END" }), { type: "CANCEL_START" }),
  ];
  for (const state of states) {
    assert.equal(canStartDraw(state), false);
    assert.equal(canConfirm(state), false);
    assert.equal(canCancel(state), false);
  }
  const settled = raffleReducer(pending, { type: "SPIN_END" });
  assert.equal(canConfirm(settled), true);
  assert.equal(canCancel(settled), true);
  assert.equal(canStartDraw(ready), true);
});

test("a loading snapshot cannot interrupt confirmation or discard its successful result", () => {
  const pending = loaded({ eligible_attendees: [bob], eligible_count: 1, pending_draw: { ...draw, ...alice } });
  const confirming = raffleReducer(pending, { type: "CONFIRM_START" });
  const stale = raffleReducer(confirming, {
    type: "LOAD_SUCCESS",
    payload: { event: pending.event, eligible_attendees: [bob], eligible_count: 1, pending_draw: { ...draw, ...alice }, winners: [] },
  });
  assert.equal(stale, confirming);
  const confirmed = raffleReducer(stale, { type: "CONFIRM_SUCCESS", payload: { draw: { ...draw, status: "confirmed" }, attendee: alice, winner } });
  assert.equal(confirmed.status, "confirmed");
  assert.deepEqual(confirmed.winners, [winner]);
  assert.equal(confirmed.pendingDraw, null);
});

test("loading snapshots and errors cannot interrupt other busy transitions", () => {
  const ready = loaded();
  const drawing = raffleReducer(ready, { type: "DRAW_START" });
  const spinning = raffleReducer(drawing, { type: "DRAW_SUCCESS", payload: { draw, attendee: alice } });
  const cancelling = raffleReducer(raffleReducer(spinning, { type: "SPIN_END" }), { type: "CANCEL_START" });
  const stalePayload = { event: ready.event, eligible_attendees: [alice, bob], eligible_count: 2, pending_draw: null, winners: [] };
  for (const busy of [drawing, spinning, cancelling]) {
    assert.equal(raffleReducer(busy, { type: "LOAD_SUCCESS", payload: stalePayload }), busy);
    assert.equal(raffleReducer(busy, { type: "LOAD_FAILURE", error: new Error("stale request") }), busy);
  }
});

test("snapshot tokens reject responses started before or during a mutation", () => {
  const tracker = createRaffleRequestTracker();
  const before = tracker.beginRefresh();
  assert.equal(createRaffleRequestTracker().shouldApplySnapshot(before), false);
  assert.equal(tracker.shouldApplySnapshot(before), true);
  assert.equal(tracker.beginRefresh(), null);
  assert.equal(tracker.beginMutation(), true);
  const during = tracker.beginRefresh();
  assert.equal(tracker.shouldApplySnapshot(before), false);
  assert.equal(tracker.shouldApplySnapshot(during), false);
  assert.equal(tracker.beginMutation(), false);
  tracker.settleMutation();
  tracker.settleRefresh();
  assert.equal(tracker.shouldApplySnapshot(before), false);
  assert.equal(tracker.shouldApplySnapshot(during), false);
  const after = tracker.beginRefresh();
  assert.notEqual(after, null);
  assert.equal(tracker.shouldApplySnapshot(after), true);
  tracker.settleRefresh();
});

test("unmount waits for a draw response then cancels its new reservation once", () => {
  const tracker = createRaffleRequestTracker();
  tracker.beginMutation();
  tracker.dispose();
  assert.equal(tracker.takeCleanupDrawId(), null);
  tracker.setPendingDraw(draw.id);
  tracker.settleMutation();
  assert.equal(tracker.takeCleanupDrawId(), draw.id);
  assert.equal(tracker.takeCleanupDrawId(), null);
});

test("unmount after a failed confirm or cancel releases a known pending reservation", () => {
  for (const operation of ["confirm", "cancel"]) {
    const tracker = createRaffleRequestTracker();
    tracker.setPendingDraw(draw.id);
    tracker.beginMutation(operation);
    tracker.dispose();
    assert.equal(tracker.takeCleanupDrawId(), null);
    tracker.settleMutation();
    assert.equal(tracker.takeCleanupDrawId(), draw.id);
  }
});

test("successful confirmation or cancellation leaves no reservation to clean up", () => {
  const tracker = createRaffleRequestTracker();
  tracker.setPendingDraw(draw.id);
  tracker.beginMutation();
  tracker.dispose();
  tracker.setPendingDraw(null);
  tracker.settleMutation();
  assert.equal(tracker.takeCleanupDrawId(), null);
});

test("an effect setup after a development cleanup keeps its reservation and permits requests", () => {
  const tracker = createRaffleRequestTracker();
  tracker.setPendingDraw(draw.id);
  tracker.dispose();
  tracker.resume();
  const token = tracker.beginRefresh();
  assert.notEqual(token, null);
  tracker.settleRefresh();
  assert.equal(tracker.takeCleanupDrawId(), null);
  tracker.dispose();
  assert.equal(tracker.takeCleanupDrawId(), draw.id);
});

test("a revisited page initializes from unchanged cached raffle data", () => {
  const payload = { event: { id: 1, slug: "sample", title: "Sample Event" }, eligible_attendees: [alice, bob], eligible_count: 2, pending_draw: null, winners: [] };
  const previousPage = createRaffleRequestTracker();
  assert.equal(previousPage.cachedLoadAction(payload).payload, payload);
  previousPage.beginMutation();
  previousPage.settleMutation();
  previousPage.dispose();

  const nextPage = createRaffleRequestTracker();
  const action = nextPage.cachedLoadAction(payload);
  assert.equal(action.payload, payload);
  assert.equal(raffleReducer(createRaffleState(), action).status, "ready");
});

test("cached raffle data is ignored after a local request and an overlapping refresh becomes stale", () => {
  const tracker = createRaffleRequestTracker();
  const payload = { event: { id: 1, slug: "sample", title: "Sample Event" }, eligible_attendees: [alice], eligible_count: 1, pending_draw: null, winners: [] };
  const refreshToken = tracker.beginRefresh();
  assert.equal(tracker.cachedLoadAction(payload), null);
  assert.equal(tracker.beginRefresh(), null);
  assert.equal(tracker.beginMutation(), true);
  assert.equal(tracker.shouldApplySnapshot(refreshToken), false);
  tracker.settleMutation();
  tracker.settleRefresh();
  assert.equal(tracker.shouldApplySnapshot(refreshToken), false);
  assert.equal(tracker.cachedLoadAction(payload), null);
  assert.notEqual(tracker.beginRefresh(), null);
});

test("account switching cannot load another admin's cached event, attendees, or winner history", () => {
  const cache = new Map();
  const payload = { event: { id: 1, title: "Admin A private event" }, eligible_attendees: [bob], eligible_count: 1, pending_draw: null, winners: [winner] };
  const ownerKey = raffle.getRaffleCacheKey(10, "sample");
  const otherKey = raffle.getRaffleCacheKey(20, "sample");
  cache.set(JSON.stringify(ownerKey), payload);
  const owner = createRaffleRequestTracker();
  const ownerState = raffleReducer(createRaffleState(), owner.cachedLoadAction(payload));
  assert.equal(ownerState.winners.length, 1);
  owner.dispose();
  const other = createRaffleRequestTracker();
  const cachedAction = other.cachedLoadAction(cache.get(JSON.stringify(otherKey)));
  assert.equal(cachedAction, null);
  const denied = raffleReducer(createRaffleState(), other.cachedLoadAction(undefined, { response: { status: 404 } }));
  assert.deepEqual(denied.eligibleAttendees, []);
  assert.deepEqual(denied.winners, []);
  assert.equal(denied.event, null);
  assert.equal(raffle.getRaffleCacheKey(undefined, "sample"), null);
});

test("authorization errors erase every protected raffle field even during a mutation", () => {
  for (const status of [401, 403, 404]) {
    for (const type of ["LOAD_FAILURE", "DRAW_FAILURE", "CONFIRM_FAILURE", "CANCEL_FAILURE"]) {
      const state = { ...loaded({ winners: [winner], pending_draw: { ...draw, ...alice } }), status: "confirming", lastWinner: winner };
      const denied = raffleReducer(state, { type, error: { response: { status } } });
      assert.equal(denied.event, null);
      assert.deepEqual(denied.eligibleAttendees, []);
      assert.deepEqual(denied.winners, []);
      assert.equal(denied.pendingDraw, null);
      assert.equal(denied.selectedAttendee, null);
      assert.equal(denied.lastWinner, null);
      assert.equal(denied.eligibleCount, 0);
    }
  }
});

test("a newly reserved draw has the same remaining count as its reloaded pending snapshot", () => {
  const reserved = raffleReducer(raffleReducer(loaded(), { type: "DRAW_START" }), { type: "DRAW_SUCCESS", payload: { draw, attendee: alice } });
  const reloaded = loaded({ eligible_attendees: [bob], eligible_count: 1, pending_draw: { ...draw, ...alice } });
  assert.equal(reserved.eligibleCount, 1);
  assert.deepEqual(reserved.eligibleAttendees, [bob]);
  assert.equal(reserved.eligibleCount, reloaded.eligibleCount);
  assert.deepEqual(getWheelAttendees(reserved), [bob, alice]);
});

for (const operation of ["CONFIRM", "CANCEL"]) {
  test(`${operation} conflicts disable stale controls until authoritative state is applied`, () => {
    const pending = loaded({ eligible_attendees: [bob], eligible_count: 1, pending_draw: { ...draw, ...alice } });
    const failed = raffleReducer(raffleReducer(pending, { type: `${operation}_START` }), { type: `${operation}_FAILURE`, error: { response: { status: 409 } } });
    assert.equal(canConfirm(failed), false);
    assert.equal(canCancel(failed), false);
    assert.equal(canStartDraw(failed), false);
    assert.equal(failed.pendingDraw, null);
    assert.equal(failed.selectedAttendee, null);
    const offline = raffleReducer(failed, { type: "LOAD_FAILURE", error: new Error("offline") });
    assert.equal(canStartDraw(offline), false);
  });

  for (const outcome of ["confirmed", "cancelled", "expired"]) {
    test(`${operation} recovers automatically when another tab or a lost response already ${outcome} the draw`, async () => {
      let state = loaded({ eligible_attendees: [bob], eligible_count: 1, pending_draw: { ...draw, ...alice } });
      const tracker = createRaffleRequestTracker();
      tracker.setPendingDraw(draw.id);
      const staleToken = tracker.beginRefresh();
      const payload = { event: state.event, eligible_attendees: outcome === "confirmed" ? [bob] : [alice, bob], eligible_count: outcome === "confirmed" ? 1 : 2, pending_draw: null, winners: outcome === "confirmed" ? [winner] : [] };
      await raffle.runRaffleMutation({
        operation, tracker,
        dispatch: (action) => { state = raffleReducer(state, action); },
        request: async () => { throw { response: { status: 409, data: { message: "Draw is no longer pending." } } }; },
        refresh: async () => {
          const token = tracker.beginRefresh({ supersede: true });
          assert.notEqual(token, null, "reconciliation must start after releasing the mutation guard");
          tracker.settleRefresh(staleToken);
          assert.equal(tracker.beginRefresh(), null, "old request completion cannot release the current refresh");
          assert.equal(tracker.shouldApplySnapshot(staleToken), false);
          if (tracker.shouldApplySnapshot(token)) state = raffleReducer(state, { type: "LOAD_SUCCESS", payload });
          tracker.settleRefresh(token);
        },
        cleanup: () => {},
      });
      assert.equal(state.pendingDraw, null);
      assert.equal(state.selectedAttendee, null);
      assert.equal(state.eligibleCount, outcome === "confirmed" ? 1 : 2);
      assert.deepEqual(state.winners, outcome === "confirmed" ? [winner] : []);
      assert.equal(canStartDraw(state), true);
    });
  }
}

test("a transient lost response keeps the reservation retryable until the retry reports a conflict", async () => {
  for (const operation of ["CONFIRM", "CANCEL"]) {
    let state = loaded({ eligible_attendees: [bob], eligible_count: 1, pending_draw: { ...draw, ...alice } });
    await raffle.runRaffleMutation({
      operation, tracker: createRaffleRequestTracker(),
      dispatch: (action) => { state = raffleReducer(state, action); },
      request: async () => { throw new Error("response lost"); },
      refresh: () => assert.fail("transient failure should preserve the provisional draw"),
      cleanup: () => {},
    });
    assert.equal(state.status, "pending");
    assert.equal(state.pendingDraw.id, 50);
    assert.equal(canConfirm(state), true);
  }
});
