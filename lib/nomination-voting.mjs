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

export const MAX_NOMINATION_TOPICS = 30;
export const MAX_TOPIC_FINALISTS = 2147483647;

export function getNominationTopicsUrl(eventSlug, topicId) {
  const collection = `/api/events/${encodeURIComponent(eventSlug)}/nomination-topics`;
  return topicId == null ? collection : `${collection}/${encodeURIComponent(topicId)}`;
}

export function toNominationTopicsPayload(rows) {
  return {
    topics: rows.map((row) => ({
      title: row.title.trim(),
      female_top_n: Number(row.female_top_n),
      male_top_n: Number(row.male_top_n),
    })),
  };
}

export function validateNominationTopics(topics) {
  const errors = {};
  if (topics.length < 1 || topics.length > MAX_NOMINATION_TOPICS) {
    errors.topics = `Add 1 to ${MAX_NOMINATION_TOPICS} topics.`;
  }

  topics.forEach((topic, index) => {
    const field = `topics.${index}`;
    const title = topic.title;
    if (!title) errors[`${field}.title`] = "Enter a topic title.";
    else if ([...title].length > 255) errors[`${field}.title`] = "The title must be 255 characters or fewer.";
    else {
      const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const sameTitle = new RegExp(`^${escapedTitle}$`, "iu");
      if (topics.some((other, otherIndex) => otherIndex !== index && sameTitle.test(other.title))) {
        errors[`${field}.title`] = "Topic titles must be unique within this set.";
      }
    }

    for (const count of ["female_top_n", "male_top_n"]) {
      const value = topic[count];
      if (!Number.isInteger(value) || value < 2 || value > MAX_TOPIC_FINALISTS) {
        errors[`${field}.${count}`] = `Enter a whole number from 2 to ${MAX_TOPIC_FINALISTS}.`;
      }
    }
  });

  return errors;
}
