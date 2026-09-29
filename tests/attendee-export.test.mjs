import assert from "node:assert/strict";
import test from "node:test";

import { buildAttendeeExportData } from "../lib/attendee-export.mjs";

const registrations = [
  {
    id: 1,
    attendee: { first_name: "Ana", last_name: "Santos", email: "ana@example.com" },
    answers: [
      { answer: "Ana", field: { id: 1, key: "first-name", system_key: "first_name", label: "First name", position: 0 } },
      { answer: "Santos", field: { id: 2, key: "last-name", system_key: "last_name", label: "Last name", position: 1 } },
      { answer: "ana@example.com", field: { id: 3, key: "work-email", system_key: "email", label: "Work email", position: 2 } },
      { answer: "Vegetarian", field: { id: 4, key: "meal", system_key: null, label: "Meal preference", position: 3 } },
    ],
    check_ins: [{ result: "accepted" }],
    status: "confirmed",
    registered_at: "2026-09-24T08:30:00.000Z",
  },
  {
    id: 2,
    attendee: { first_name: "Ben", last_name: "Cruz", email: "ben@example.com" },
    answers: [
      { answer: "Regular", field: { id: 8, key: "meal", system_key: null, label: "Meal preference", position: 3 } },
      { answer: ["Email", "SMS"], field: { id: 9, key: "contact-methods", system_key: null, label: "Contact methods", position: 4 } },
    ],
    check_ins: [],
    status: "confirmed",
    registered_at: "2026-09-24T09:00:00.000Z",
  },
];

test("builds separate attended, not attended, and all attendee worksheet rows", () => {
  const result = buildAttendeeExportData(registrations);

  assert.deepEqual(result.columns.map((column) => column.header), [
    "Name",
    "Email",
    "Meal preference",
    "Contact methods",
    "Status",
    "Check-in",
    "Date registered",
  ]);
  assert.equal(result.sheets[0].name, "Attended");
  assert.deepEqual(result.sheets[0].rows.map((row) => row.name), ["Ana Santos"]);
  assert.equal(result.sheets[1].name, "Not Attended");
  assert.deepEqual(result.sheets[1].rows.map((row) => row.name), ["Ben Cruz"]);
  assert.equal(result.sheets[2].name, "All Registrants");
  assert.deepEqual(result.sheets[2].rows.map((row) => row.name), ["Ana Santos", "Ben Cruz"]);
});

test("exports each custom form answer in its own column", () => {
  const result = buildAttendeeExportData(registrations);
  const secondRow = result.sheets[2].rows[1];

  assert.equal(secondRow.answer_meal, "Regular");
  assert.equal(secondRow["answer_contact-methods"], "Email, SMS");
  assert.equal(secondRow.check_in, "Not attended");
});

test("includes current custom questions that no attendee has answered yet", () => {
  const result = buildAttendeeExportData(registrations, [
    { id: 10, key: "shirt-size", system_key: null, label: "T-shirt size", position: 5 },
  ]);

  assert.deepEqual(result.columns.map((column) => column.header), [
    "Name",
    "Email",
    "Meal preference",
    "Contact methods",
    "T-shirt size",
    "Status",
    "Check-in",
    "Date registered",
  ]);
  assert.equal(result.sheets[2].rows[0]["answer_shirt-size"], undefined);
});
