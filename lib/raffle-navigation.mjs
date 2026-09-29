export function getRaffleHref(event) {
  return event?.sourceId
    ? `/events/${encodeURIComponent(event.sourceId)}/raffle`
    : null;
}
