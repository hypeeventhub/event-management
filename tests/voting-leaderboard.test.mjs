import assert from "node:assert/strict";
import test from "node:test";

import { getLeaderboardRefreshInterval, getRankedContestants, getVotingResultsPayload } from "../lib/voting-leaderboard.mjs";

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

test("active visible leaderboard refreshes every three seconds", () => {
  assert.equal(getLeaderboardRefreshInterval({ status: "active", visibilityState: "visible" }), 3000);
});

test("hidden, draft, and closed leaderboards do not poll", () => {
  assert.equal(getLeaderboardRefreshInterval({ status: "active", visibilityState: "hidden" }), 0);
  assert.equal(getLeaderboardRefreshInterval({ status: "draft", visibilityState: "visible" }), 0);
  assert.equal(getLeaderboardRefreshInterval({ status: "closed", visibilityState: "visible" }), 0);
});
