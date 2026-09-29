export function normalizeRegistrationCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

export function getPublicVoteError(error) {
  const status = error?.response?.status;

  if (status === 422) {
    const details = error.response?.data;
    const contestantError = Boolean(details?.errors?.contestant_id) || /contestant/i.test(details?.message ?? "");
    return contestantError
      ? { message: "Choose a contestant and try again.", field: "contestant_id" }
      : { message: "Check your registration code and try again.", field: "registration_code" };
  }

  if (status === 409) return { message: "A vote has already been submitted for this ballot. Ask the organizer if you need help." };
  if (status === 404) return { message: "This ballot is unavailable. Check the link or ask the organizer." };
  if (status === 429) return { message: "Too many attempts. Wait a moment, then try again." };
  if (!status) return { message: "Could not connect. Check your connection and try again." };
  return { message: "Something went wrong. Please try again." };
}

function publicVotingUrl(slug, baseUrl, suffix = "") {
  return new URL(`/api/voting/${encodeURIComponent(slug)}${suffix}`, baseUrl).toString();
}

async function assertPublicResponse(response) {
  if (response.ok) return;

  const error = new Error("Public voting request failed");
  let category;
  if (response.status === 422) {
    const body = await response.json().catch(() => ({}));
    category = body?.errors?.contestant_id || /contestant/i.test(body?.message ?? "")
      ? "Invalid contestant."
      : "Invalid registration code.";
  }
  error.response = { status: response.status, data: category ? { message: category } : undefined };
  throw error;
}

export async function loadPublicBallot(slug, { fetchImpl = globalThis.fetch, baseUrl = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:8000" } = {}) {
  const response = await fetchImpl(publicVotingUrl(slug, baseUrl), {
    headers: { Accept: "application/json" },
    credentials: "omit",
    cache: "no-store",
  });
  await assertPublicResponse(response);
  const body = await response.json();
  if (typeof body?.title !== "string" || !Array.isArray(body?.contestants)) {
    throw new Error("Invalid public ballot response");
  }
  return {
    title: body.title,
    contestants: body.contestants.map(({ id, name }) => ({ id, name })),
  };
}

export async function submitPublicVote(slug, { registrationCode, contestantId }, { fetchImpl = globalThis.fetch, baseUrl = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:8000" } = {}) {
  const response = await fetchImpl(publicVotingUrl(slug, baseUrl, "/votes"), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    credentials: "omit",
    body: JSON.stringify({ registration_code: normalizeRegistrationCode(registrationCode), contestant_id: Number(contestantId) }),
  });
  await assertPublicResponse(response);
  return response.status === 201;
}

export function validatePublicVote({ registrationCode, contestantId }) {
  if (!normalizeRegistrationCode(registrationCode)) {
    return { message: "Enter your registration code.", field: "registration_code" };
  }
  if (!String(contestantId ?? "").trim()) {
    return { message: "Choose a contestant.", field: "contestant_id" };
  }
  return null;
}

export function publicVoteReducer(state, action) {
  switch (action.type) {
    case "load_start": return { ...state, phase: "loading", error: null };
    case "load_success": return { ...state, phase: "ready", ballot: action.ballot, error: null };
    case "load_error": return { ...state, phase: action.unavailable ? "unavailable" : "error", busy: false, error: action.error };
    case "code_change": return { ...state, registrationCode: action.value, error: state.error?.field === "registration_code" ? null : state.error };
    case "contestant_change": return { ...state, contestantId: action.value, error: state.error?.field === "contestant_id" ? null : state.error };
    case "submit_start": return { ...state, busy: true, error: null };
    case "submit_error": return { ...state, busy: false, error: action.error };
    case "submit_success": return { ...state, phase: "success", busy: false, error: null };
    default: return state;
  }
}
