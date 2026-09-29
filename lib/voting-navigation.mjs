export function getVotingHref(event) {
  return event?.sourceId
    ? `/events/${encodeURIComponent(event.sourceId)}/voting`
    : null;
}
