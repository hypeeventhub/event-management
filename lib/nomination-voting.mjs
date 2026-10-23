export function validateNomination(input) {
  const errors = {};
  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const topN = Number(input?.top_n);

  if (!title) errors.title = "Enter a nomination title.";
  else if (title.length > 255) errors.title = "The title must be 255 characters or fewer.";

  if (!Number.isInteger(topN) || topN < 2 || topN > 4294967295) {
    errors.top_n = "Enter a whole number from 2 to 4294967295.";
  }

  return errors;
}

export function toNominationPayload(input) {
  return {
    title: input.title.trim(),
    top_n: Number(input.top_n),
  };
}

export function getPublicNominationUrl(slug, origin) {
  if (!slug || !origin) return "";
  return new URL(`/nomination/${encodeURIComponent(slug)}`, origin).toString();
}

export function getNominationActions(status) {
  if (status === "draft") return ["edit", "open", "qr", "leaderboard"];
  if (status === "active") return ["close", "qr", "leaderboard"];
  if (status === "closed") return ["qr", "leaderboard"];
  return [];
}

export function getNominationUrl(eventSlug, subjectSlug) {
  const collection = `/api/events/${encodeURIComponent(eventSlug)}/nominations`;
  return subjectSlug == null ? collection : `${collection}/${encodeURIComponent(subjectSlug)}`;
}
