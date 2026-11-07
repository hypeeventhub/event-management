import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAnsweredFormRows,
  buildEditableAnswerValues,
  buildRegistrationAnswerPayload,
  formatRegistrationAnswer,
} from "../lib/registration-answers.mjs";

test("buildAnsweredFormRows orders questions and formats attendee answers", () => {
  const registration = {
    answers: [
      {
        answer: ["Email", "SMS"],
        field: { id: 3, label: "Contact methods", position: 2 },
      },
      {
        answer: "Ana",
        field: { id: 1, label: "First name", position: 0 },
      },
      {
        answer: null,
        field: { id: 2, label: "Department", position: 1 },
      },
    ],
  };

  assert.deepEqual(buildAnsweredFormRows(registration), [
    { id: 1, label: "First name", answer: "Ana" },
    { id: 2, label: "Department", answer: "No answer provided" },
    { id: 3, label: "Contact methods", answer: "Email, SMS" },
  ]);
});

test("buildAnsweredFormRows handles empty and structured answers", () => {
  const registration = {
    answers: [
      {
        answer: [],
        field: { id: 1, label: "Interests", position: 0 },
      },
      {
        answer: { organization: "Acme" },
        field: { id: 2, label: "Company details", position: 1 },
      },
    ],
  };

  assert.deepEqual(buildAnsweredFormRows(registration), [
    { id: 1, label: "Interests", answer: "No answer provided" },
    { id: 2, label: "Company details", answer: '{"organization":"Acme"}' },
  ]);
});

test("formatRegistrationAnswer preserves structured values as JSON", () => {
  assert.equal(formatRegistrationAnswer({ organization: "Acme" }), '{"organization":"Acme"}');
});

test("buildEditableAnswerValues keeps raw custom values and omits system fields", () => {
  const registration = {
    answers: [
      {
        answer: "Jeremiah",
        field: { id: 1, system_key: "first_name", type: "short" },
      },
      {
        answer: "jeremiah@example.com",
        field: { id: 2, system_key: "email", type: "short" },
      },
      {
        answer: ["morning-1", "evening-2"],
        field: { id: 8, system_key: null, type: "checkboxes", position: 5 },
      },
      {
        answer: "vegetarian-2",
        field: { id: 4, system_key: null, type: "dropdown", position: 3 },
      },
      {
        answer: "2026-11-08",
        field: { id: 6, system_key: null, type: "date", position: 4 },
      },
    ],
  };

  assert.deepEqual(buildEditableAnswerValues(registration), {
    4: "vegetarian-2",
    6: "2026-11-08",
    8: ["morning-1", "evening-2"],
  });
});

test("buildRegistrationAnswerPayload returns stable numeric IDs and keeps empty values", () => {
  assert.deepEqual(buildRegistrationAnswerPayload({
    21: [],
    4: "",
    9: null,
  }), {
    answers: [
      { form_field_id: 4, answer: "" },
      { form_field_id: 9, answer: null },
      { form_field_id: 21, answer: [] },
    ],
  });
});
