import assert from "node:assert/strict";
import test from "node:test";

import { getPublicVoteError, loadPublicBallot, normalizeRegistrationCode, publicVoteReducer, submitPublicVote, validatePublicVote } from "../lib/public-voting.mjs";

test("registration codes are trimmed and uppercased before submission", () => {
  assert.equal(normalizeRegistrationCode("  ab-123 \n"), "AB-123");
  assert.equal(normalizeRegistrationCode("\t\n"), "");
});

test("invalid registration errors target the code field without revealing eligibility", () => {
  assert.deepEqual(getPublicVoteError({ response: { status: 422, data: { message: "Invalid registration code." } } }), {
    message: "Check your registration code and try again.",
    field: "registration_code",
  });
});

test("invalid contestant errors target the contestant field", () => {
  assert.deepEqual(getPublicVoteError({ response: { status: 422, data: { message: "Invalid contestant." } } }), {
    message: "Choose a contestant and try again.",
    field: "contestant_id",
  });
});

test("duplicate votes have a distinct, safe response", () => {
  assert.deepEqual(getPublicVoteError({ response: { status: 409, data: { message: "Duplicate vote for registration #42" } } }), {
    message: "A vote has already been submitted for this ballot. Ask the organizer if you need help.",
  });
});

test("inactive and unknown ballots share a response", () => {
  assert.deepEqual(getPublicVoteError({ response: { status: 404, data: { message: "VotingSubject model not found" } } }), {
    message: "This ballot is unavailable. Check the link or ask the organizer.",
  });
});

test("rate limits ask voters to wait without relaying backend details", () => {
  assert.deepEqual(getPublicVoteError({ response: { status: 429, data: { message: "SQLSTATE 40001" } } }), {
    message: "Too many attempts. Wait a moment, then try again.",
  });
});

test("network failures offer a retry and never show server text", () => {
  assert.deepEqual(getPublicVoteError(new TypeError("Failed to fetch: SQLSTATE registration exists")), {
    message: "Could not connect. Check your connection and try again.",
  });
});

test("unexpected server errors do not expose response details", () => {
  const result = getPublicVoteError({ response: { status: 500, data: { message: "SQLSTATE: voter totals = 10" } } });
  assert.deepEqual(result, { message: "Something went wrong. Please try again." });
});

test("public lookup accepts the bare backend ballot and projects only title and choices", async () => {
  let request;
  const ballot = await loadPublicBallot("opaque slug", {
    baseUrl: "https://api.example.test",
    fetchImpl: async (...args) => {
      request = args;
      return { ok: true, json: async () => ({
        title: "Best performer",
        contestants: [{ id: 7, name: "Ava", votes: 42, rank: 1 }, { id: 8, name: "Bea" }],
        total_votes: 42,
        registrations: [{ code: "SECRET" }],
      }) };
    },
  });

  assert.deepEqual(ballot, { title: "Best performer", contestants: [{ id: 7, name: "Ava" }, { id: 8, name: "Bea" }] });
  assert.equal(request[0], "https://api.example.test/api/voting/opaque%20slug");
  assert.equal(request[1].credentials, "omit");
  assert.equal(request[1].headers.Accept, "application/json");
});

test("submission sends one normalized choice without session credentials", async () => {
  let request;
  const result = await submitPublicVote("opaque slug", { registrationCode: " ab-123 ", contestantId: "7" }, {
    baseUrl: "https://api.example.test",
    fetchImpl: async (...args) => {
      request = args;
      return { ok: true, status: 201 };
    },
  });

  assert.equal(result, true);
  assert.equal(request[0], "https://api.example.test/api/voting/opaque%20slug/votes");
  assert.equal(request[1].method, "POST");
  assert.equal(request[1].credentials, "omit");
  assert.deepEqual(JSON.parse(request[1].body), { registration_code: "AB-123", contestant_id: 7 });
});

test("public request failures expose only status for safe UI mapping", async () => {
  await assert.rejects(
    loadPublicBallot("slug", { baseUrl: "https://api.example.test", fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({ message: "SQLSTATE registrations exist" }) }) }),
    (error) => error.response?.status === 404 && !JSON.stringify(error).includes("SQLSTATE"),
  );
});

test("client validation identifies a missing code before submission", () => {
  assert.deepEqual(validatePublicVote({ registrationCode: " \n ", contestantId: "7" }), {
    message: "Enter your registration code.", field: "registration_code",
  });
  assert.deepEqual(validatePublicVote({ registrationCode: " ab-123 ", contestantId: "" }), {
    message: "Choose a contestant.", field: "contestant_id",
  });
  assert.equal(validatePublicVote({ registrationCode: " ab-123 ", contestantId: "7" }), null);
});

test("a recoverable submission error keeps the voter's entries and enables retry", () => {
  const state = { phase: "ready", ballot: { title: "Best performer" }, registrationCode: "ab-123", contestantId: "7", busy: true, error: null };
  assert.deepEqual(publicVoteReducer(state, { type: "submit_error", error: { message: "Check your registration code and try again.", field: "registration_code" } }), {
    ...state, busy: false, error: { message: "Check your registration code and try again.", field: "registration_code" },
  });
});

test("a successful vote enters a form-free success state", () => {
  const state = { phase: "ready", ballot: { title: "Best performer" }, registrationCode: "ab-123", contestantId: "7", busy: true, error: null };
  assert.equal(publicVoteReducer(state, { type: "submit_success" }).phase, "success");
});
