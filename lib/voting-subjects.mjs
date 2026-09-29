export function normalizeContestants(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => typeof value === "string" ? value.trim() : "")
    .filter(Boolean);
}

export function getContestantPosition(displayOrder) {
  return displayOrder + 1;
}

export function mapVotingSubjectFieldErrors(fieldErrors, rows) {
  const errors = {};
  if (fieldErrors?.title?.[0]) errors.title = fieldErrors.title[0];
  if (fieldErrors?.contestants?.[0]) errors.contestants = fieldErrors.contestants[0];

  const submittedRows = rows.filter((row) => row.name.trim());
  const contestantRows = {};
  for (const [field, messages] of Object.entries(fieldErrors || {})) {
    const match = /^contestants\.(\d+)\.name$/.exec(field);
    const row = match && submittedRows[Number(match[1])];
    if (row && messages?.[0]) contestantRows[row.id] = messages[0];
  }
  if (Object.keys(contestantRows).length) errors.contestantRows = contestantRows;
  return errors;
}

export function validateVotingSubject(input) {
  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const contestants = normalizeContestants(input?.contestants);
  const errors = {};

  if (!title) errors.title = "Enter a subject title.";
  else if (title.length > 255) errors.title = "The subject title must be 255 characters or fewer.";

  if (contestants.length < 2) errors.contestants = "Add at least two contestants.";
  else if (contestants.length > 250) errors.contestants = "Use no more than 250 contestants.";
  else if (contestants.some((name) => name.length > 255)) errors.contestants = "Contestant names must be 255 characters or fewer.";
  else if (new Set(contestants.map((name) => name.toLocaleLowerCase())).size !== contestants.length) errors.contestants = "Contestant names must be unique.";

  return errors;
}

export function getVotingSubjectActions(status) {
  if (status === "draft") return ["edit", "activate", "delete", "qr", "leaderboard"];
  if (status === "active") return ["close", "qr", "leaderboard"];
  if (status === "closed") return ["qr", "leaderboard"];
  return [];
}

export function getVotingSubjectUrl(eventSlug, subjectSlug) {
  return `/api/events/${encodeURIComponent(eventSlug)}/voting-subjects/${encodeURIComponent(subjectSlug)}`;
}

export function toVotingSubjectPayload(input) {
  return {
    title: input.title.trim(),
    contestants: normalizeContestants(input.contestants).map((name) => ({ name })),
  };
}

export function getVotingQrFilename(title) {
  const safeTitle = String(title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${safeTitle || "voting-subject"}-qr.png`;
}

export function shouldRenderVotingQrImage(subject, imageUrl, loading) {
  return Boolean(subject && imageUrl && !loading);
}
