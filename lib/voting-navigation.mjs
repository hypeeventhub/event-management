export function getVotingHref(event) {
  return event?.sourceId
    ? `/events/${encodeURIComponent(event.sourceId)}/voting`
    : null;
}

export function getEventLeaderboardHref(eventSlug) {
  const votingHref = getVotingHref({ sourceId: eventSlug });
  return votingHref ? `${votingHref}/leaderboard` : null;
}
