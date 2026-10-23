import assert from "node:assert/strict";
import test from "node:test";

import {
  getPublicNominationError,
  loadPublicNomination,
  nominationSuggestion,
  normalizeNominationCode,
  normalizeNomineeSearch,
  searchPublicNominationCandidates,
  submitPublicNomination,
  validatePublicNomination,
} from "../lib/public-nomination.mjs";

test("nomination lookup requests only public fields without session credentials", async () => {
  let request;
  const result = await loadPublicNomination("opaque slug", {
    baseUrl: "https://api.example.test",
    fetchImpl: async (...args) => {
      request = args;
      return { ok: true, json: async () => ({ data: { title: "People's Choice", status: "active", registrations: ["private"] } }) };
    },
  });

  assert.deepEqual(result, { title: "People's Choice", status: "active" });
  assert.equal(request[0], "https://api.example.test/api/nominations/opaque%20slug");
  assert.equal(request[1].credentials, "omit");
  assert.equal(request[1].cache, "no-store");
});

test("fuzzy attendee search sends the typed query and projects only id and full name", async () => {
  let request;
  const result = await searchPublicNominationCandidates("nomination slug", "Jeremaya Quintano", {
    baseUrl: "https://api.example.test",
    fetchImpl: async (...args) => {
      request = args;
      return { ok: true, json: async () => ({ data: [
        { id: 12, full_name: "Jeremiah Quintano", email: "private@example.test" },
        { id: 13, full_name: "Jeremiah Quintanilla", email: "private2@example.test" },
      ] }) };
    },
  });

  assert.equal(request[0], "https://api.example.test/api/nominations/nomination%20slug/candidates?q=Jeremaya%20Quintano");
  assert.equal(request[1].credentials, "omit");
  assert.deepEqual(result, [{ id: 12, full_name: "Jeremiah Quintano" }, { id: 13, full_name: "Jeremiah Quintanilla" }]);
  assert.equal(JSON.stringify(result).includes("private@example.test"), false);
});

test("nominee suggestion handles spelling and diacritic differences but ignores exact match", () => {
  assert.equal(normalizeNomineeSearch("José Quintano"), normalizeNomineeSearch("Jose Quintano"));
  const candidates = [{ id: 12, full_name: "Jeremiah Quintano" }, { id: 13, full_name: "Jeremiah Quintanilla" }];
  assert.deepEqual(nominationSuggestion("Jeremaya Quintano", candidates), candidates[0]);
  assert.equal(nominationSuggestion("Jeremiah Quintano", candidates), null);
  assert.deepEqual(nominationSuggestion("Jeremiah Quintnao", candidates.slice(1)), candidates[1]);
  assert.equal(nominationSuggestion(" ", candidates), null);
});

test("public nomination submission requires a selected attendee and registration code", () => {
  assert.deepEqual(validatePublicNomination({ selectedAttendee: null, registrationCode: "REG-ABC" }), {
    message: "Search for and select the name you want to nominate.", field: "attendee_id",
  });
  assert.deepEqual(validatePublicNomination({ selectedAttendee: { id: 12 }, registrationCode: " " }), {
    message: "Enter your registration code to verify your nomination.", field: "registration_code",
  });
  assert.equal(validatePublicNomination({ selectedAttendee: { id: 12 }, registrationCode: " reg-abc " }), null);
});

test("submission posts selected candidate id and normalized registration code without credentials", async () => {
  let request;
  const result = await submitPublicNomination("opaque slug", { attendeeId: 12, registrationCode: " reg-abc " }, {
    baseUrl: "https://api.example.test",
    fetchImpl: async (...args) => {
      request = args;
      return { ok: true, status: 201 };
    },
  });

  assert.equal(result, true);
  assert.equal(request[0], "https://api.example.test/api/nominations/opaque%20slug/submit");
  assert.equal(request[1].method, "POST");
  assert.equal(request[1].credentials, "omit");
  assert.deepEqual(JSON.parse(request[1].body), { attendee_id: 12, registration_code: "REG-ABC" });
  assert.equal(normalizeNominationCode(" \t "), "");
});

test("public verification errors do not reveal backend details", () => {
  assert.deepEqual(getPublicNominationError({ response: { status: 422, data: { errors: { registration_code: true }, message: "SQLSTATE private code" } } }), {
    message: "Check your registration code and try again.", field: "registration_code",
  });
  assert.deepEqual(getPublicNominationError({ response: { status: 409, data: { message: "SQLSTATE attendee secret" } } }), {
    message: "You have already submitted a nomination for this round.",
  });
  assert.equal(JSON.stringify(getPublicNominationError({ response: { status: 500, data: { message: "SQLSTATE private data" } } })).includes("private"), false);
});
