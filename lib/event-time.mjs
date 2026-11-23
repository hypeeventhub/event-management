export function isEventFinished(endsAt, now = Date.now()) {
  const endTimestamp = new Date(endsAt).getTime();
  return Number.isFinite(endTimestamp) && endTimestamp < now;
}
