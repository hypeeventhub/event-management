import assert from "node:assert/strict";
import test from "node:test";

import { getNominationActions, getNominationUrl, getPublicNominationUrl, toNominationPayload, validateNomination } from "../lib/nomination-voting.mjs";

const valid = { title: "People's Choice", top_n: 2 };

test("nomination validation requires only a title and top N", () => {
  const errors = validateNomination({ title: "   " });
  assert.ok(errors.title);
  assert.ok(errors.top_n);
  assert.deepEqual(validateNomination(valid), {});
});

test("nomination titles accept 255 characters and reject 256", () => {
  assert.deepEqual(validateNomination({ ...valid, title: "x".repeat(255) }), {});
  assert.ok(validateNomination({ ...valid, title: "x".repeat(256) }).title);
});

test("top N must be an integer of at least two within the API storage range", () => {
  for (const top_n of [undefined, "", " ", 0, 1, 2.5, "two", Infinity, 4294967296]) {
    assert.ok(validateNomination({ ...valid, top_n }).top_n, `Reject ${String(top_n)}`);
  }
  assert.deepEqual(validateNomination({ ...valid, top_n: "3" }), {});
  assert.deepEqual(validateNomination({ ...valid, top_n: 4294967295 }), {});
});

test("nomination creation payload contains only the trimmed title and numeric top N", () => {
  const input = { title: "  People's Choice  ", top_n: "3", attendee_ids: ["22", 11], contestants: [{ name: "Private extra" }] };
  assert.deepEqual(toNominationPayload(input), {
    title: "People's Choice", top_n: 3,
  });
  assert.deepEqual(input.attendee_ids, ["22", 11]);
});

test("nomination actions only permit draft edits/opening and active closure", () => {
  assert.deepEqual(getNominationActions("draft"), ["edit", "open", "qr", "leaderboard"]);
  assert.deepEqual(getNominationActions("active"), ["close", "qr", "leaderboard"]);
  assert.deepEqual(getNominationActions("closed"), ["qr", "leaderboard"]);
  assert.deepEqual(getNominationActions("unknown"), []);
});

test("nomination mutations use event and nomination slugs on their distinct route", () => {
  assert.equal(getNominationUrl("summer gala"), "/api/events/summer%20gala/nominations");
  assert.equal(getNominationUrl("summer gala", "people choice"), "/api/events/summer%20gala/nominations/people%20choice");
});

test("public nomination QR link uses the standalone attendee page and encoded slug", () => {
  assert.equal(getPublicNominationUrl("people choice", "https://events.example.test"), "https://events.example.test/nomination/people%20choice");
  assert.equal(getPublicNominationUrl("", "https://events.example.test"), "");
});
