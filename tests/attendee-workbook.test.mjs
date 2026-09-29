import assert from "node:assert/strict";
import test from "node:test";

import { createAttendeeWorkbookSheets } from "../lib/attendee-workbook.mjs";

test("creates workbook data for the three attendee worksheets", () => {
  const sheets = createAttendeeWorkbookSheets({
    columns: [
      { header: "Name", key: "name" },
      { header: "Email", key: "email" },
      { header: "Status", key: "status" },
    ],
    sheets: [
      { name: "Attended", rows: [{ name: "Ana Santos", email: "ana@example.com", status: "confirmed" }] },
      { name: "Not Attended", rows: [{ name: "Ben Cruz", email: "ben@example.com", status: "confirmed" }] },
      { name: "All Registrants", rows: [
        { name: "Ana Santos", email: "ana@example.com", status: "confirmed" },
        { name: "Ben Cruz", email: "ben@example.com", status: "confirmed" },
      ] },
    ],
  });

  assert.deepEqual(sheets.map((sheet) => sheet.sheet), [
    "Attended",
    "Not Attended",
    "All Registrants",
  ]);
  assert.deepEqual(sheets[0].data[0].map((cell) => cell.value), ["Name", "Email", "Status"]);
  assert.equal(sheets[2].data[2][0].value, "Ben Cruz");
});

test("writes registration dates using the event timezone wall time", () => {
  const sheets = createAttendeeWorkbookSheets({
    columns: [{ header: "Date registered", key: "registered_at" }],
    sheets: [
      { name: "Attended", rows: [{ registered_at: "2026-09-24T08:30:00.000Z" }] },
      { name: "Not Attended", rows: [] },
      { name: "All Registrants", rows: [{ registered_at: "2026-09-24T08:30:00.000Z" }] },
    ],
  }, "Asia/Manila");
  const exportedDate = sheets[0].data[1][0].value;

  assert.equal(exportedDate.getUTCFullYear(), 2026);
  assert.equal(exportedDate.getUTCMonth(), 8);
  assert.equal(exportedDate.getUTCDate(), 24);
  assert.equal(exportedDate.getUTCHours(), 16);
  assert.equal(exportedDate.getUTCMinutes(), 30);
});
