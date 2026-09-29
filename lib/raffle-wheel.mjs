const matchesRegistration = (attendee, registrationId) =>
  attendee?.registration_id != null &&
  registrationId != null &&
  String(attendee.registration_id) === String(registrationId);

const segmentLimit = (maxSegments) =>
  Number.isFinite(maxSegments) ? Math.max(1, Math.floor(maxSegments)) : 120;

export function getWheelInputSignature(attendees, selectedRegistrationId = null, maxSegments = 120) {
  return JSON.stringify([
    selectedRegistrationId == null ? null : String(selectedRegistrationId),
    segmentLimit(maxSegments),
    (Array.isArray(attendees) ? attendees : []).map((attendee) => [
      attendee?.registration_id == null ? null : String(attendee.registration_id),
      attendee?.first_name ?? null,
      attendee?.last_name ?? null,
    ]),
  ]);
}

export function createWheelSegmentsCache() {
  let previousSignature;
  let previousSegments;

  return (attendees, selectedRegistrationId = null, maxSegments = 120) => {
    const signature = getWheelInputSignature(attendees, selectedRegistrationId, maxSegments);
    if (signature !== previousSignature) {
      previousSignature = signature;
      previousSegments = buildWheelSegments(attendees, selectedRegistrationId, maxSegments);
    }
    return previousSegments;
  };
}

export function buildWheelSegments(attendees, selectedRegistrationId = null, maxSegments = 120) {
  if (!Array.isArray(attendees) || attendees.length === 0) return [];

  const limit = segmentLimit(maxSegments);
  if (attendees.length <= limit) return attendees.slice();

  const segments = Array.from({ length: limit }, (_, index) =>
    attendees[Math.floor(index * attendees.length / limit)]);

  if (selectedRegistrationId == null || segments.some((attendee) =>
    matchesRegistration(attendee, selectedRegistrationId))) {
    return segments;
  }

  const selectedIndex = attendees.findIndex((attendee) =>
    matchesRegistration(attendee, selectedRegistrationId));
  if (selectedIndex >= 0) {
    const segmentIndex = Math.min(limit - 1, Math.floor(selectedIndex * limit / attendees.length));
    segments[segmentIndex] = attendees[selectedIndex];
  }

  return segments;
}

export function getWinnerRotation(segments, selectedRegistrationId, completedTurns = 6) {
  if (!Array.isArray(segments) || segments.length === 0 || selectedRegistrationId == null) return 0;

  const index = segments.findIndex((attendee) => matchesRegistration(attendee, selectedRegistrationId));
  if (index < 0) return 0;

  const turns = Number.isFinite(completedTurns) ? Math.max(0, Math.floor(completedTurns)) : 6;
  const centerDegrees = (index + 0.5) * 360 / segments.length;
  return (turns + 1) * 360 - centerDegrees;
}

export function formatWheelName(attendee) {
  return [attendee?.first_name, attendee?.last_name]
    .filter((part) => typeof part === "string" && part.trim())
    .map((part) => part.trim())
    .join(" ") || "Guest";
}
