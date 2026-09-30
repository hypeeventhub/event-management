import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const checkIn = await import("../lib/check-in.mjs").catch(() => ({}));

test("normalizes scanned and manually entered registration codes", () => {
  assert.equal(typeof checkIn.normalizeRegistrationCode, "function");
  assert.equal(checkIn.normalizeRegistrationCode("  reg-checkin01\n"), "REG-CHECKIN01");
});

test("maps check-in API outcomes to scanner feedback", () => {
  assert.equal(typeof checkIn.getCheckInFeedback, "function");
  assert.deepEqual(checkIn.getCheckInFeedback({ status: 201 }), {
    tone: "success",
    title: "Check-in accepted",
  });
  assert.deepEqual(checkIn.getCheckInFeedback({ status: 409 }), {
    tone: "warning",
    title: "Already checked in",
    modal: true,
  });
  assert.deepEqual(checkIn.getCheckInFeedback({ status: 404 }), {
    tone: "error",
    title: "Registration not found",
    modal: true,
  });
});

test("hides Laravel model lookup exceptions from scanner feedback", () => {
  assert.equal(typeof checkIn.getCheckInErrorDetail, "function");
  assert.equal(checkIn.getCheckInErrorDetail({
    response: {
      status: 404,
      data: { message: "No query results for model [App\\Models\\Registration]." },
    },
  }), "");
  assert.equal(checkIn.getCheckInErrorDetail({
    response: {
      status: 409,
      data: { message: "Attendee was already checked in." },
    },
  }), "Attendee was already checked in.");
});

test("keeps the camera paused after decoding until the result is acknowledged", () => {
  assert.equal(typeof checkIn.shouldPauseCamera, "function");
  assert.equal(checkIn.shouldPauseCamera({ submitting: false, scannedCode: "", modalOpen: false }), false);
  assert.equal(checkIn.shouldPauseCamera({ submitting: true, scannedCode: "", modalOpen: false }), true);
  assert.equal(checkIn.shouldPauseCamera({ submitting: false, scannedCode: "REG-123", modalOpen: false }), true);
  assert.equal(checkIn.shouldPauseCamera({ submitting: false, scannedCode: "", modalOpen: true }), true);
});

test("maps camera error kinds to actionable guidance", () => {
  assert.equal(typeof checkIn.getCameraErrorMessage, "function");
  assert.match(checkIn.getCameraErrorMessage({ kind: "permission-denied" }), /allow camera access/i);
  assert.match(checkIn.getCameraErrorMessage({ kind: "no-camera" }), /no camera/i);
  assert.match(checkIn.getCameraErrorMessage({ kind: "in-use" }), /another app or browser tab/i);
  assert.match(checkIn.getCameraErrorMessage({ kind: "insecure-context" }), /https or localhost/i);
  assert.match(checkIn.getCameraErrorMessage({ kind: "unsupported" }), /does not support/i);
});

test("renders the open camera preview above the event selection card", async () => {
  const source = await readFile(new URL("../app/scanner/page.js", import.meta.url), "utf8");
  const cameraCard = source.indexOf("{cameraOpen && (");
  const eventSelection = source.indexOf('<label htmlFor="scanner-event"');

  assert.notEqual(cameraCard, -1);
  assert.notEqual(eventSelection, -1);
  assert.ok(cameraCard < eventSelection, "camera preview should appear before event selection in the page layout");
});
