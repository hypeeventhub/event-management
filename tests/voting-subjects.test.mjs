import assert from "node:assert/strict";
import test from "node:test";

import * as votingSubjects from "../lib/voting-subjects.mjs";

const { getVotingSubjectActions, getVotingSubjectUrl, getVotingQrFilename, normalizeContestants, toVotingSubjectPayload, validateVotingSubject } = votingSubjects;

test("contestant card positions start at one for zero-based stored order", () => {
  assert.equal(votingSubjects.getContestantPosition?.(0), 1);
  assert.equal(votingSubjects.getContestantPosition?.(2), 3);
});

test("backend contestant errors target their submitted rows even when blank rows were omitted", () => {
  const rows = [
    { id: 11, name: "Ava" },
    { id: 12, name: " " },
    { id: 13, name: "Bea" },
  ];
  assert.deepEqual(votingSubjects.mapVotingSubjectFieldErrors?.({
    title: ["A title is required."],
    "contestants.1.name": ["Contestant names must be unique."],
  }, rows), {
    title: "A title is required.",
    contestantRows: { 13: "Contestant names must be unique." },
  });
});

test("normalization trims names and drops blank rows while keeping their order", () => {
  assert.deepEqual(normalizeContestants(["  Ava  ", " ", "Bea", "\t"]), ["Ava", "Bea"]);
});

test("validation requires a nonblank title and at least two contestants", () => {
  assert.deepEqual(validateVotingSubject({ title: "  ", contestants: [" Ava ", " "] }), {
    title: "Enter a subject title.",
    contestants: "Add at least two contestants.",
  });
});

test("validation rejects duplicate contestant names regardless of case or surrounding space", () => {
  assert.match(validateVotingSubject({ title: "Best singer", contestants: ["Ava", " ava "] }).contestants, /unique/i);
});

test("validation accepts the 250 contestant boundary and rejects 251", () => {
  const names = Array.from({ length: 250 }, (_, index) => `Contestant ${index + 1}`);
  assert.deepEqual(validateVotingSubject({ title: "Best singer", contestants: names }), {});
  assert.match(validateVotingSubject({ title: "Best singer", contestants: [...names, "Extra"] }).contestants, /250/);
});

test("validation rejects titles and contestant names longer than 255 characters", () => {
  assert.match(validateVotingSubject({ title: "x".repeat(256), contestants: ["Ava", "Bea"] }).title, /255/);
  assert.match(validateVotingSubject({ title: "Best singer", contestants: ["x".repeat(256), "Bea"] }).contestants, /255/);
  assert.deepEqual(validateVotingSubject({ title: "x".repeat(255), contestants: ["x".repeat(255), "Bea"] }), {});
});

test("draft, active, and closed subjects expose their exact allowed actions", () => {
  assert.deepEqual(getVotingSubjectActions("draft"), ["edit", "activate", "delete", "qr", "leaderboard"]);
  assert.deepEqual(getVotingSubjectActions("active"), ["close", "qr", "leaderboard"]);
  assert.deepEqual(getVotingSubjectActions("closed"), ["qr", "leaderboard"]);
  assert.deepEqual(getVotingSubjectActions("unknown"), []);
});

test("payload trims the title and sends ordered contestant name objects", () => {
  assert.deepEqual(toVotingSubjectPayload({ title: "  Best singer  ", contestants: [" Ava ", " ", " Bea "] }), {
    title: "Best singer",
    contestants: [{ name: "Ava" }, { name: "Bea" }],
  });
});

test("QR download filename removes unsafe title characters and has a fallback", () => {
  assert.equal(getVotingQrFilename(" Best / Singer: 2026! "), "best-singer-2026-qr.png");
  assert.equal(getVotingQrFilename(" ? "), "voting-subject-qr.png");
});

test("a closing QR dialog does not render an image after its subject is cleared", () => {
  assert.equal(votingSubjects.shouldRenderVotingQrImage(null, "data:image/png;base64,qr", false), false);
  assert.equal(votingSubjects.shouldRenderVotingQrImage({ title: "Choice" }, "data:image/png;base64,qr", false), true);
  assert.equal(votingSubjects.shouldRenderVotingQrImage({ title: "Choice" }, "", false), false);
  assert.equal(votingSubjects.shouldRenderVotingQrImage({ title: "Choice" }, "data:image/png;base64,qr", true), false);
});

test("subject mutations address the event and subject by their slugs", () => {
  assert.equal(getVotingSubjectUrl("summer gala", "people's choice"), "/api/events/summer%20gala/voting-subjects/people's%20choice");
});
