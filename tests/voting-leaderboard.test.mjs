import assert from "node:assert/strict";
import test from "node:test";

import { getLeaderboardRefreshInterval, getRankedContestants, getVotingResultsPayload, isNominationStatisticsMonotonic, projectNominationStatistics, projectVotingStatistics } from "../lib/voting-leaderboard.mjs";
import * as leaderboard from "../lib/voting-leaderboard.mjs";

test("results fetcher reads the root backend payload from an Axios response", () => {
  const payload = {
    event: { id: 12, slug: "gala", title: "Gala" },
    subject: { id: 5, slug: "best-singer", title: "Best singer", status: "active" },
    total_votes: 3,
    total_registrations: 10,
    participation_percentage: 30,
    contestants: [
      { id: 8, name: "Ava", display_order: 1, votes: 2, percentage: 66.67 },
      { id: 9, name: "Bea", display_order: 2, votes: 1, percentage: 33.33 },
    ],
  };

  assert.deepEqual(getVotingResultsPayload({ data: payload }), payload);
});

test("ranked contestants keep the backend vote order and percentages", () => {
  const rows = getRankedContestants([
    { id: 9, name: "Ava", display_order: 2, votes: 8, percentage: 53.33 },
    { id: 4, name: "Bea", display_order: 1, votes: 5, percentage: 33.33 },
    { id: 7, name: "Cai", display_order: 3, votes: 2, percentage: 13.34 },
  ]);

  assert.deepEqual(rows.map(({ id, votes, percentage, rank }) => ({ id, votes, percentage, rank })), [
    { id: 9, votes: 8, percentage: 53.33, rank: 1 },
    { id: 4, votes: 5, percentage: 33.33, rank: 2 },
    { id: 7, votes: 2, percentage: 13.34, rank: 3 },
  ]);
});

test("equal vote totals share their visible rank without changing backend tie order", () => {
  const rows = getRankedContestants([
    { id: 4, name: "Bea", display_order: 1, votes: 5, percentage: 50 },
    { id: 9, name: "Ava", display_order: 2, votes: 5, percentage: 50 },
    { id: 7, name: "Cai", display_order: 3, votes: 0, percentage: 0 },
  ]);

  assert.deepEqual(rows.map(({ id, rank, podium }) => ({ id, rank, podium })), [
    { id: 4, rank: 1, podium: "first" },
    { id: 9, rank: 1, podium: "first" },
    { id: 7, rank: 3, podium: "third" },
  ]);
});

test("zero vote rows retain backend zero percentages and equal ranking", () => {
  const rows = getRankedContestants([
    { id: 11, name: "Ava", display_order: 1, votes: 0, percentage: 0 },
    { id: 12, name: "Bea", display_order: 2, votes: 0, percentage: 0 },
  ]);

  assert.deepEqual(rows.map(({ rank, percentage, podium }) => ({ rank, percentage, podium })), [
    { rank: 1, percentage: 0, podium: "first" },
    { rank: 1, percentage: 0, podium: "first" },
  ]);
});

test("first, second, and third places receive distinct podium metadata", () => {
  const rows = getRankedContestants([
    { id: 1, votes: 3, percentage: 50 },
    { id: 2, votes: 2, percentage: 33.33 },
    { id: 3, votes: 1, percentage: 16.67 },
    { id: 4, votes: 0, percentage: 0 },
  ]);

  assert.deepEqual(rows.map(({ podium }) => podium), ["first", "second", "third", null]);
});

test("manual leaderboard uses quick polling until Reverb connects and slow reconciliation after", () => {
  assert.equal(getLeaderboardRefreshInterval({ mode: "manual", status: "active", visibilityState: "visible" }), 3000);
  assert.equal(getLeaderboardRefreshInterval({ mode: "manual", status: "active", visibilityState: "visible", connectionStatus: "connecting" }), 3000);
  assert.equal(getLeaderboardRefreshInterval({ mode: "manual", status: "active", visibilityState: "visible", connectionStatus: "connected" }), 30_000);
});

test("hidden, draft, and closed leaderboards do not poll", () => {
  for (const mode of ["manual", "nomination"]) {
    assert.equal(getLeaderboardRefreshInterval({ mode, status: "active", visibilityState: "hidden" }), 0);
    assert.equal(getLeaderboardRefreshInterval({ mode, status: "draft", visibilityState: "visible" }), 0);
    assert.equal(getLeaderboardRefreshInterval({ mode, status: "closed", visibilityState: "visible" }), 0);
  }
});

test("active nominations and unknown subject modes never use interval polling", () => {
  assert.equal(getLeaderboardRefreshInterval({ mode: "nomination", status: "active", visibilityState: "visible" }), 0);
  assert.equal(getLeaderboardRefreshInterval({ status: "active", visibilityState: "visible" }), 0);
});

const nominationSnapshot = {
  event: { id: 12, slug: "gala", title: "Gala" },
  subject: { id: 5, slug: "best-singer", title: "Best singer", status: "active" },
  total_votes: 2,
  total_registrations: 10,
  participation_percentage: 20,
  contestants: [{ id: 8, name: "Ava", display_order: 0, votes: 2, rank: 1, percentage: 100 }],
};

const compactNominationUpdate = {
  event_id: 12,
  subject_id: 5,
  status: "active",
  total_votes: 2,
  total_registrations: 10,
  contestant_votes: [2],
};

test("compact broadcast projects a REST-shaped ranked snapshot from the stable roster", () => {
  const base = {
    ...nominationSnapshot,
    total_votes: 0,
    participation_percentage: 0,
    contestants: [
      { id: 8, name: "Ava", display_order: 1, votes: 0, rank: 1, percentage: 0 },
      { id: 9, name: "Bea", display_order: 0, votes: 0, rank: 1, percentage: 0 },
      { id: 10, name: "Cam", display_order: 2, votes: 0, rank: 1, percentage: 0 },
    ],
  };
  const update = { ...compactNominationUpdate, total_votes: 5, total_registrations: 6, contestant_votes: [2, 2, 1] };

  assert.deepEqual(projectNominationStatistics(base, update, 12, 5), {
    ...base,
    total_votes: 5,
    total_registrations: 6,
    participation_percentage: 83.33,
    contestants: [
      { id: 9, name: "Bea", display_order: 0, votes: 2, rank: 1, percentage: 40 },
      { id: 8, name: "Ava", display_order: 1, votes: 2, rank: 1, percentage: 40 },
      { id: 10, name: "Cam", display_order: 2, votes: 1, rank: 3, percentage: 20 },
    ],
  });
});

test("manual voting statistics use the same compact REST projection", () => {
  const base = {
    ...nominationSnapshot,
    total_votes: 0,
    participation_percentage: 0,
    contestants: [
      { id: 8, name: "Ava", display_order: 1, votes: 0, rank: 1, percentage: 0 },
      { id: 9, name: "Bea", display_order: 0, votes: 0, rank: 1, percentage: 0 },
    ],
  };
  const update = { ...compactNominationUpdate, total_votes: 3, total_registrations: 10, contestant_votes: [1, 2] };
  const result = projectVotingStatistics(base, update, 12, 5);

  assert.equal(result.total_votes, 3);
  assert.equal(result.participation_percentage, 30);
  assert.deepEqual(result.contestants.map(({ name, votes, rank }) => ({ name, votes, rank })), [
    { name: "Bea", votes: 2, rank: 1 },
    { name: "Ava", votes: 1, rank: 2 },
  ]);
});

test("compact update rejects missing rosters, mismatched counts, and inconsistent totals", () => {
  assert.equal(projectNominationStatistics(null, compactNominationUpdate, 12, 5), null);
  for (const update of [
    { ...compactNominationUpdate, contestant_votes: [] },
    { ...compactNominationUpdate, contestant_votes: [1] },
    { ...compactNominationUpdate, contestant_votes: [Number.MAX_SAFE_INTEGER] },
    { ...compactNominationUpdate, subject_id: 99 },
    { ...compactNominationUpdate, status: "closed" },
  ]) assert.equal(projectNominationStatistics(nominationSnapshot, update, 12, 5), null);
});

test("out-of-order compact snapshots trigger REST recovery instead of rolling totals backwards", async () => {
  const lowerVotes = { ...compactNominationUpdate, total_votes: 1, contestant_votes: [1] };
  const fewerRegistrations = { ...compactNominationUpdate, total_registrations: 9 };

  assert.equal(projectNominationStatistics(nominationSnapshot, lowerVotes, 12, 5), null);
  assert.equal(projectNominationStatistics(nominationSnapshot, fewerRegistrations, 12, 5), null);

  for (const update of [lowerVotes, fewerRegistrations]) {
    const fixture = subscriptionFixture();
    fixture.emit(update);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(fixture.snapshots, []);
    assert.equal(fixture.refreshes, 1);
    fixture.stop();
  }
});

test("the SWR cache guard accepts 5 after 3, then rejects 4 before the React ref effect runs", () => {
  const base = {
    ...nominationSnapshot,
    total_votes: 3,
    total_registrations: 10,
    contestants: [{ ...nominationSnapshot.contestants[0], votes: 3 }],
  };
  let current = base;
  const resultsRef = { current };
  // Both callbacks project against the same old render/ref before the effect can sync it.
  const candidate5 = projectNominationStatistics(base, { ...compactNominationUpdate, total_votes: 5, contestant_votes: [5] }, 12, 5);
  const candidate4 = projectNominationStatistics(base, { ...compactNominationUpdate, total_votes: 4, contestant_votes: [4] }, 12, 5);
  assert.equal(candidate5.total_votes, 5);
  assert.equal(candidate4.total_votes, 4);

  for (const candidate of [candidate5, candidate4]) {
    if (isNominationStatisticsMonotonic(candidate, current)) {
      current = candidate;
      resultsRef.current = candidate;
    }
  }

  assert.equal(current.total_votes, 5);
  assert.equal(resultsRef.current.total_votes, 5);
  assert.equal(isNominationStatisticsMonotonic(candidate4, current), false);
});

test("lifecycle routes preserve manual activate/close and use nomination open/close", () => {
  assert.equal(typeof leaderboard.getLeaderboardLifecycle, "function");
  const get = (mode, status) => leaderboard.getLeaderboardLifecycle({ eventSlug: "gala", subjectSlug: "singer", mode, status });
  assert.deepEqual(get("manual", "draft"), { action: "activate", url: "/api/events/gala/voting-subjects/singer/activate", label: "Activate voting" });
  assert.deepEqual(get("manual", "active"), { action: "close", url: "/api/events/gala/voting-subjects/singer/close", label: "Close voting" });
  assert.deepEqual(get("nomination", "draft"), { action: "open", url: "/api/events/gala/nominations/singer/open", label: "Open nominations" });
  assert.deepEqual(get("nomination", "active"), { action: "close", url: "/api/events/gala/nominations/singer/close", label: "Close nominations" });
  assert.equal(get("nomination", "closed"), null);
  assert.equal(get(undefined, "active"), null);
});

function subscriptionFixture(overrides = {}) {
  assert.equal(typeof leaderboard.subscribeToNominationLeaderboard, "function");
  const listeners = new Map();
  const states = [];
  const left = [];
  let subscribed;
  let failed;
  let connectionChanged;
  let snapshots = [];
  let refreshes = 0;
  const channel = {
    listen(event, callback) { listeners.set(event, callback); return this; },
    subscribed(callback) { subscribed = callback; return this; },
    error(callback) { failed = callback; return this; },
    stopListening(event, callback) { assert.equal(listeners.get(event), callback); listeners.delete(event); return this; },
  };
  const echo = {
    private(name) { assert.equal(name, "events.12.nominations.5"); return channel; },
    leave(name) { left.push(name); },
    connector: {
      onConnectionChange(callback) { connectionChanged = callback; return () => { connectionChanged = null; }; },
    },
  };
  const stop = leaderboard.subscribeToNominationLeaderboard({
    echo, channelName: "events.12.nominations.5", eventId: 12, subjectId: 5,
    mode: "nomination", status: "active",
    onSnapshot: (value) => { snapshots.push(value); },
    getBaseSnapshot: () => overrides.getBaseSnapshot ? overrides.getBaseSnapshot() : nominationSnapshot,
    revalidate: async () => { refreshes++; return nominationSnapshot; },
    onStatus: (value) => states.push(value),
    ...overrides,
  });
  return {
    stop, states, left, listeners,
    get snapshots() { return snapshots; },
    get refreshes() { return refreshes; },
    get connectionChanged() { return connectionChanged; },
    subscribe: () => subscribed(), fail: () => failed(),
    emit: (value) => listeners.get(".App\\Events\\NominationStatisticsUpdated")?.(value),
    emitClosed: (value) => listeners.get(".App\\Events\\NominationClosed")?.(value),
  };
}

test("a valid compact broadcast updates the REST-shaped leaderboard without a REST poll", () => {
  const fixture = subscriptionFixture();
  fixture.emit(compactNominationUpdate);
  assert.deepEqual(fixture.snapshots, [nominationSnapshot]);
  assert.equal(fixture.refreshes, 0);
  fixture.stop();
});

test("malformed compact broadcasts trigger REST recovery instead of replacing cached results", async () => {
  const invalidPayloads = [null, {}, { ...compactNominationUpdate, event_id: 13 },
    { ...compactNominationUpdate, subject_id: 6 },
    { ...compactNominationUpdate, contestant_votes: [] },
    { ...compactNominationUpdate, contestant_votes: [1] }];
  for (const payload of invalidPayloads) {
    const fixture = subscriptionFixture();
    fixture.emit(payload);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(fixture.snapshots, []);
    assert.equal(fixture.refreshes, 1);
    fixture.stop();
  }

  const fixture = subscriptionFixture({ getBaseSnapshot: () => null });
  fixture.emit(compactNominationUpdate);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fixture.refreshes, 1);
  assert.deepEqual(fixture.snapshots, []);
  fixture.stop();
});

test("subscription and reconnect re-fetch REST results before reporting current stats", async () => {
  const fixture = subscriptionFixture();
  assert.deepEqual(fixture.states, ["connecting"]);
  await fixture.subscribe();
  assert.equal(fixture.refreshes, 1);
  assert.equal(fixture.states.at(-1), "connected");
  fixture.connectionChanged("disconnected");
  assert.equal(fixture.states.at(-1), "disconnected");
  fixture.connectionChanged("connected");
  assert.equal(fixture.states.at(-1), "connecting");
  await fixture.subscribe();
  assert.equal(fixture.refreshes, 2);
  assert.equal(fixture.states.at(-1), "connected");
  fixture.stop();
});

test("failed channel authorization or recovery never claims stats are current", async () => {
  const fixture = subscriptionFixture({ revalidate: async () => { throw new Error("offline"); } });
  await fixture.subscribe();
  assert.equal(fixture.states.at(-1), "disconnected");
  fixture.fail();
  assert.equal(fixture.states.at(-1), "disconnected");
  fixture.stop();
});

test("rejected reauthorization recovers closed REST results and leaves the stale active channel", async () => {
  let currentResults = nominationSnapshot;
  let refreshes = 0;
  const fixture = subscriptionFixture({
    revalidate: async () => {
      refreshes++;
      if (refreshes > 1) {
        currentResults = { ...nominationSnapshot, subject: { ...nominationSnapshot.subject, status: "closed" } };
      }
      return currentResults;
    },
  });
  await fixture.subscribe();
  assert.equal(currentResults.subject.status, "active");
  fixture.connectionChanged("disconnected");
  fixture.connectionChanged("connected");
  // A closed subject is no longer authorized to subscribe. No subscription-success event follows.
  await fixture.fail();
  assert.equal(refreshes, 2);
  assert.equal(currentResults.subject.status, "closed");
  assert.deepEqual(fixture.left, ["events.12.nominations.5"]);
  assert.equal(fixture.listeners.size, 0);
  assert.equal(fixture.connectionChanged, null);
  assert.equal(fixture.states.at(-1), "disconnected");
  fixture.stop();
  assert.deepEqual(fixture.left, ["events.12.nominations.5"]);
});

test("a close notice forces REST recovery and leaves the channel after closed status is confirmed", async () => {
  const closedResults = { ...nominationSnapshot, subject: { ...nominationSnapshot.subject, status: "closed" } };
  let recovered;
  let refreshes = 0;
  const fixture = subscriptionFixture({
    revalidate: async () => {
      refreshes++;
      recovered = closedResults;
      return recovered;
    },
  });

  fixture.emitClosed({ event_id: 12, subject_id: 5, status: "closed" });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(refreshes, 1);
  assert.equal(recovered.subject.status, "closed");
  assert.deepEqual(fixture.left, ["events.12.nominations.5"]);
  assert.equal(fixture.listeners.size, 0);
  assert.equal(fixture.connectionChanged, null);
  fixture.stop();
  assert.deepEqual(fixture.left, ["events.12.nominations.5"]);
});

test("a close notice during an older REST recovery forces a second post-close read", async () => {
  const closedResults = { ...nominationSnapshot, subject: { ...nominationSnapshot.subject, status: "closed" } };
  let releaseFirst;
  let calls = 0;
  let resolveClosedRead;
  const closedRead = new Promise((resolve) => { resolveClosedRead = resolve; });
  const fixture = subscriptionFixture({
    revalidate: () => {
      calls++;
      if (calls === 1) return new Promise((resolve) => { releaseFirst = resolve; });
      resolveClosedRead();
      return Promise.resolve(closedResults);
    },
  });

  const firstRecovery = fixture.subscribe();
  await new Promise((resolve) => setImmediate(resolve));
  fixture.emitClosed({ event_id: 12, subject_id: 5, status: "closed" });
  releaseFirst(nominationSnapshot);
  await firstRecovery;
  await closedRead;

  assert.equal(calls, 2);
  assert.deepEqual(fixture.left, ["events.12.nominations.5"]);
  assert.equal(fixture.listeners.size, 0);
  fixture.stop();
});

test("failed authorization still recovers REST without claiming an active channel is live", async () => {
  const fixture = subscriptionFixture();
  await fixture.fail();
  assert.equal(fixture.refreshes, 1);
  assert.equal(fixture.states.at(-1), "disconnected");
  assert.equal(fixture.states.includes("connected"), false);
  assert.deepEqual(fixture.left, []);
  fixture.stop();
});

test("missing Reverb configuration reports unavailable and does not subscribe", () => {
  const fixture = subscriptionFixture({ echo: null });
  assert.deepEqual(fixture.states, ["unavailable"]);
  assert.equal(fixture.listeners.size, 0);
  fixture.stop();
});

test("manual, draft, and closed subjects do not subscribe", () => {
  for (const overrides of [{ mode: "manual" }, { mode: undefined }, { status: "draft" }, { status: "closed" }]) {
    const fixture = subscriptionFixture(overrides);
    assert.equal(fixture.listeners.size, 0);
    fixture.stop();
  }
});

test("close, subject change, and unmount cleanup leaves the channel and ignores queued callbacks", async () => {
  for (const reason of ["close", "subject change", "unmount"]) {
    const fixture = subscriptionFixture();
    const queuedSnapshot = fixture.listeners.get(".App\\Events\\NominationStatisticsUpdated");
    const queuedConnection = fixture.connectionChanged;
    const beforeStop = [...fixture.states];
    fixture.stop();
    fixture.stop();
    queuedSnapshot(nominationSnapshot);
    queuedConnection("connected");
    await fixture.subscribe();
    assert.deepEqual(fixture.left, ["events.12.nominations.5"], reason);
    assert.equal(fixture.listeners.size, 0);
    assert.equal(fixture.connectionChanged, null);
    assert.deepEqual(fixture.snapshots, []);
    assert.equal(fixture.refreshes, 0);
    assert.deepEqual(fixture.states, beforeStop);
  }
});
