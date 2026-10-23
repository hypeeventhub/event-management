export function normalizeNominationCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

function nominationApiUrl(slug, baseUrl, suffix = "") {
  return new URL(`/api/nominations/${encodeURIComponent(slug)}${suffix}`, baseUrl).toString();
}

function safeRequestError(status, body) {
  const field = status === 422 && (body?.errors?.registration_code || /registration code/i.test(body?.message ?? ""))
    ? "registration_code"
    : status === 422 && (body?.errors?.attendee_id || /attendee|candidate|nominee/i.test(body?.message ?? ""))
      ? "attendee_id"
      : undefined;
  const error = new Error("Nomination request failed");
  error.response = { status, data: field ? { errors: { [field]: true } } : undefined };
  return error;
}

async function checkResponse(response) {
  if (response.ok) return;
  const body = response.status === 422 ? await response.json().catch(() => ({})) : {};
  throw safeRequestError(response.status, body);
}

export function getPublicNominationError(error) {
  const status = error?.response?.status;
  if (status === 422) {
    const errors = error.response?.data?.errors;
    return errors?.registration_code
      ? { message: "Check your registration code and try again.", field: "registration_code" }
      : errors?.attendee_id
        ? { message: "Choose a name from the search results before submitting.", field: "attendee_id" }
        : { message: "Check the selected name and registration code, then try again." };
  }
  if (status === 404) return { message: "This nomination is not available. Ask the event organizer for the current link." };
  if (status === 409) return { message: "You have already submitted a nomination for this round." };
  if (status === 429) return { message: "Too many attempts. Wait a moment, then try again." };
  if (!status) return { message: "Could not connect. Check your connection and try again." };
  return { message: "Something went wrong. Please try again." };
}

export async function loadPublicNomination(slug, {
  fetchImpl = globalThis.fetch,
  baseUrl = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:8000",
} = {}) {
  const response = await fetchImpl(nominationApiUrl(slug, baseUrl), {
    headers: { Accept: "application/json" },
    credentials: "omit",
    cache: "no-store",
  });
  await checkResponse(response);
  const body = await response.json();
  const nomination = body?.data;
  if (typeof nomination?.title !== "string" || typeof nomination?.status !== "string") {
    throw new Error("Invalid public nomination response");
  }
  return { title: nomination.title, status: nomination.status };
}

export async function searchPublicNominationCandidates(slug, query, {
  fetchImpl = globalThis.fetch,
  baseUrl = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:8000",
  signal,
} = {}) {
  const response = await fetchImpl(nominationApiUrl(slug, baseUrl, `/candidates?q=${encodeURIComponent(query)}`), {
    headers: { Accept: "application/json" },
    credentials: "omit",
    cache: "no-store",
    signal,
  });
  await checkResponse(response);
  const body = await response.json();
  if (!Array.isArray(body?.data)) throw new Error("Invalid nomination search response");
  return body.data
    .filter((item) => item && (typeof item.id === "number" || typeof item.id === "string") && typeof item.full_name === "string")
    .map(({ id, full_name }) => ({ id, full_name }));
}

export async function submitPublicNomination(slug, { attendeeId, registrationCode }, {
  fetchImpl = globalThis.fetch,
  baseUrl = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:8000",
} = {}) {
  const response = await fetchImpl(nominationApiUrl(slug, baseUrl, "/submit"), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    credentials: "omit",
    body: JSON.stringify({ attendee_id: attendeeId, registration_code: normalizeNominationCode(registrationCode) }),
  });
  await checkResponse(response);
  return response.status === 200 || response.status === 201;
}

export function validatePublicNomination({ selectedAttendee, registrationCode }) {
  if (!selectedAttendee || selectedAttendee.id == null) {
    return { message: "Search for and select the name you want to nominate.", field: "attendee_id" };
  }
  if (!normalizeNominationCode(registrationCode)) {
    return { message: "Enter your registration code to verify your nomination.", field: "registration_code" };
  }
  return null;
}

export function normalizeNomineeSearch(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function nominationSuggestion(query, candidates) {
  const normalizedQuery = normalizeNomineeSearch(query);
  if (!normalizedQuery || !Array.isArray(candidates)) return null;
  if (candidates.some((candidate) => normalizeNomineeSearch(candidate.full_name) === normalizedQuery)) return null;
  return candidates.find((candidate) => normalizeNomineeSearch(candidate.full_name) !== normalizedQuery) || null;
}
