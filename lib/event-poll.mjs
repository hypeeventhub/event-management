import { normalizeRegistrationCode } from "./public-voting.mjs";

export const TOPIC_CATEGORIES = [
  { key: "female", label: "Female" },
  { key: "male", label: "Male" },
];

const activeStages = ["nomination_active", "voting_active"];
const idleStages = ["open", "waiting", "closed", "empty"];
const baseUrl = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:8000";
const acceptJson = { Accept: "application/json" };

function pollUrl(eventSlug, suffix) {
  return new URL(`/api/public/events/${encodeURIComponent(eventSlug)}${suffix}`, baseUrl);
}

function invalidPollResponse() {
  return new Error("Invalid public event poll response");
}

function isPublicText(value) {
  return typeof value === "string" && value.trim() !== "";
}

function parseSubjectLinks(items) {
  if (!Array.isArray(items)) throw invalidPollResponse();

  return items.map((item) => {
    if (!isPublicText(item?.title) || !isPublicText(item?.slug)) throw invalidPollResponse();
    return { title: item.title, slug: item.slug };
  });
}

function parseTopic(topic) {
  if (!Number.isSafeInteger(topic?.id) || topic.id < 1 || !isPublicText(topic?.title)) throw invalidPollResponse();

  const subjectSlugs = {};
  for (const { key } of TOPIC_CATEGORIES) {
    if (!isPublicText(topic.subject_slugs?.[key])) throw invalidPollResponse();
    subjectSlugs[key] = topic.subject_slugs[key];
  }

  return { id: topic.id, title: topic.title, subjectSlugs };
}

export async function loadPublicEventPoll(eventSlug) {
  const response = await fetch(pollUrl(eventSlug, "/poll"), {
    headers: acceptJson,
    credentials: "omit",
    cache: "no-store",
  });
  if (!response.ok) {
    throw Object.assign(new Error("Could not load event poll"), { status: response.status });
  }

  const { data } = await response.json();
  if (!isPublicText(data?.title) || ![...activeStages, ...idleStages].includes(data?.stage)) throw invalidPollResponse();
  const { title, stage } = data;
  if (!activeStages.includes(stage) && data.topic !== null) throw invalidPollResponse();

  return {
    title,
    stage,
    topic: activeStages.includes(stage) ? parseTopic(data.topic) : null,
    manualBallots: parseSubjectLinks(data.manual_ballots),
    standaloneNominations: parseSubjectLinks(data.standalone_nominations),
  };
}

export async function submitPublicTopicPair(eventSlug, topicId, kind, rawChoices) {
  const nomination = kind === "nominations";
  const choiceField = nomination ? "attendee" : "contestant";
  const payload = {
    registration_code: normalizeRegistrationCode(rawChoices.get("registration_code")),
  };
  const fields = {};

  if (!payload.registration_code || payload.registration_code.length > 255) {
    fields.registration_code = "Enter your registration code.";
  }

  for (const { key, label } of TOPIC_CATEGORIES) {
    const field = `${key}_${choiceField}_id`;
    const id = Number(rawChoices.get(field));
    if (!Number.isSafeInteger(id) || id < 1) {
      fields[field] = `Choose a ${label} ${nomination ? "nominee" : "finalist"}.`;
    } else {
      payload[field] = id;
    }
  }
  if (Object.keys(fields).length > 0) return { fields };

  const response = await fetch(pollUrl(eventSlug, `/topics/${topicId}/${kind}`), {
    method: "POST",
    headers: { ...acceptJson, "Content-Type": "application/json" },
    credentials: "omit",
    body: JSON.stringify(payload),
  });
  if (response.status === 201) return null;

  if (response.status === 422) {
    const body = await response.json().catch(() => ({}));
    if (body?.errors?.registration_code || /registration code/i.test(body?.message ?? "")) {
      fields.registration_code = "Check your registration code and try again.";
    }
    for (const { key, label } of TOPIC_CATEGORIES) {
      const field = `${key}_${choiceField}_id`;
      if (body?.errors?.[field]) fields[field] = `Choose a ${label} ${nomination ? "nominee" : "finalist"}.`;
    }

    if (Object.keys(fields).length > 0) return { fields };
    return { message: nomination
      ? "Check both selected nominees and try again."
      : "Check both selected finalists and try again." };
  }

  if (response.status === 403) return { message: "You must check in at the event before submitting." };
  if (response.status === 404) return { message: "This round has closed. Refresh the poll for the current round.", closed: true };
  if (response.status === 409) return { message: `You have already submitted ${nomination ? "nominations" : "votes"} for this topic.` };
  if (response.status === 429) return { message: "Too many attempts. Wait a moment, then try again." };
  return { message: "Could not submit your choices. Try again." };
}
