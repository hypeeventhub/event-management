import assert from "node:assert/strict";
import test from "node:test";

const wheel = await import("../lib/raffle-wheel.mjs").catch(() => ({}));

const attendee = (registrationId) => ({
  registration_id: registrationId,
  first_name: `Guest${registrationId}`,
  last_name: "Rivera",
  masked_email: "g***@example.com",
});

test("keeps small pools in their original order", () => {
  const attendees = [attendee(5), attendee(2), attendee(9)];
  assert.equal(typeof wheel.buildWheelSegments, "function");
  assert.deepEqual(wheel.buildWheelSegments(attendees), attendees);
});

test("samples 1,005 attendees into 120 evenly spaced unique segments", () => {
  const attendees = Array.from({ length: 1005 }, (_, index) => attendee(index + 1));
  const segments = wheel.buildWheelSegments(attendees);
  const ids = segments.map((segment) => segment.registration_id);

  assert.equal(segments.length, 120);
  assert.equal(new Set(ids).size, 120);
  assert.deepEqual(ids.slice(0, 5), [1, 9, 17, 26, 34]);
  assert.equal(ids.at(-1), 997);
  const gaps = ids.slice(1).map((id, index) => id - ids[index]);
  assert.ok(gaps.every((gap) => gap === 8 || gap === 9));
});

test("includes an unsampled selected registration exactly once", () => {
  const attendees = Array.from({ length: 1005 }, (_, index) => attendee(index + 1));
  const segments = wheel.buildWheelSegments(attendees, 1005);
  const ids = segments.map((segment) => segment.registration_id);

  assert.equal(segments.length, 120);
  assert.equal(ids.filter((id) => id === 1005).length, 1);
  assert.equal(new Set(ids).size, 120);
  assert.deepEqual(ids.slice(0, 3), [1, 9, 17]);
  assert.equal(ids.at(-1), 1005);
});

test("rotates the selected segment center to the top after six full turns", () => {
  const segments = [attendee(1), attendee(2), attendee(3), attendee(4)];
  assert.equal(typeof wheel.getWinnerRotation, "function");
  const rotation = wheel.getWinnerRotation(segments, 2);

  assert.ok(rotation >= 6 * 360);
  assert.equal(((rotation + 135) % 360 + 360) % 360, 0);
});

test("returns zero for unknown or missing selected registrations", () => {
  const segments = [attendee(1), attendee(2)];
  assert.equal(wheel.getWinnerRotation(segments, 99), 0);
  assert.equal(wheel.getWinnerRotation([], 1), 0);
  assert.equal(wheel.getWinnerRotation(segments, null), 0);
});

test("formats first and last names without exposing masked or full email", () => {
  assert.equal(typeof wheel.formatWheelName, "function");
  assert.equal(wheel.formatWheelName({
    first_name: " Jamie ",
    last_name: " Rivera ",
    masked_email: "j***@example.com",
    email: "jamie@example.com",
  }), "Jamie Rivera");
});

test("wheel input signature is stable across equivalent attendee references", () => {
  assert.equal(typeof wheel.getWheelInputSignature, "function");
  const original = [attendee(1), attendee(2)];
  const equivalent = original.map((person) => ({ ...person }));

  assert.equal(
    wheel.getWheelInputSignature(original, 2),
    wheel.getWheelInputSignature(equivalent, "2"),
  );
});

test("wheel input signature changes for pool, name, or selected-result changes", () => {
  const original = [attendee(1), attendee(2)];
  const signature = wheel.getWheelInputSignature(original, 2);

  assert.notEqual(wheel.getWheelInputSignature([attendee(1), attendee(3)], 2), signature);
  assert.notEqual(wheel.getWheelInputSignature([attendee(2), attendee(1)], 2), signature);
  assert.notEqual(wheel.getWheelInputSignature([{ ...attendee(1), first_name: "Renamed" }, attendee(2)], 2), signature);
  assert.notEqual(wheel.getWheelInputSignature(original, 1), signature);
});

test("wheel segment cache preserves segment identity for equivalent rerenders", () => {
  assert.equal(typeof wheel.createWheelSegmentsCache, "function");
  const getSegments = wheel.createWheelSegmentsCache();
  const original = [attendee(1), attendee(2)];
  const segments = getSegments(original, 2);

  assert.strictEqual(getSegments(original.map((person) => ({ ...person })), 2), segments);
  assert.notStrictEqual(getSegments(original, 1), segments);
});
