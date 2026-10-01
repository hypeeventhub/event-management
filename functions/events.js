"use client";

import useSWR from "swr";

import api from "@/lib/api";

function formatDate(value) {
  if (!value) return "Schedule pending";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function toDateTimeLocal(value) {
  if (!value) return "";

  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function systemKeyForQuestion(question) {
  if (question.id === "first-name") return "first_name";
  if (question.id === "last-name") return "last_name";
  if (question.id === "work-email") return "email";

  const normalizedLabel = question.label.trim().toLowerCase();
  if (normalizedLabel === "phone" || normalizedLabel === "phone number") return "phone";
  if (normalizedLabel === "company" || normalizedLabel === "organization") return "company";

  return null;
}

function toApiPayload({ details, registrationForm }) {
  const venueIsUrl = /^https?:\/\//i.test(details.venue.trim());

  return {
    title: details.title.trim(),
    description: details.description.trim() || null,
    category: details.category || null,
    capacity: details.capacity ? Number(details.capacity) : null,
    venue: venueIsUrl ? null : details.venue.trim() || null,
    meeting_url: venueIsUrl ? details.venue.trim() : null,
    starts_at: new Date(details.startsAt).toISOString(),
    ends_at: new Date(details.endsAt).toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    status: "published",
    registration_form: registrationForm.map((question) => ({
      key: question.id,
      system_key: systemKeyForQuestion(question),
      type: question.type,
      label: question.label.trim(),
      description: question.description.trim() || null,
      required: question.required,
      options: question.options,
    })),
  };
}

function toEventCard(event) {
  const registered = event.registrations_count || 0;
  const checkedIn = event.accepted_check_ins_count || 0;
  const capacity = event.capacity || 0;
  const registrationProgress = capacity ? Math.min(100, (registered / capacity) * 100) : 0;
  const attendanceProgress = registered ? Math.min(100, (checkedIn / registered) * 100) : 0;
  const now = Date.now();
  const startsAt = new Date(event.starts_at).getTime();
  const endsAt = new Date(event.ends_at).getTime();
  const isLive = event.status === "live" || (
    event.status === "published" && startsAt <= now && endsAt >= now
  );

  return {
    sourceId: event.slug,
    id: event.slug,
    displayId: `${event.slug.slice(0, 12)}…`,
    title: event.title,
    category: event.category || "event",
    location: event.venue || event.meeting_url || "Venue pending",
    date: formatDate(event.starts_at),
    registration: capacity
      ? `${registered} / ${capacity} Capacity (${Math.round(registrationProgress)}%)`
      : `${registered} Registered`,
    progress: isLive ? attendanceProgress : registrationProgress,
    progressLabel: "Live Attendance",
    checkedIn: `${checkedIn} / ${registered} Checked In (${Math.round(attendanceProgress)}%)`,
    isLive,
    registrationIsOpen: event.registration_is_open !== false,
    registrationForm: event.active_registration_form,
    editData: {
      details: {
        title: event.title,
        description: event.description || "",
        category: event.category || "Corporate Gala",
        capacity: event.capacity ? String(event.capacity) : "",
        startsAt: toDateTimeLocal(event.starts_at),
        endsAt: toDateTimeLocal(event.ends_at),
        venue: event.venue || event.meeting_url || "",
      },
      registrationForm: (event.active_registration_form?.fields || []).map((field) => ({
        id: field.key,
        type: field.type,
        label: field.label,
        description: field.description || "",
        required: field.is_required,
        options: field.options.map((option) => option.label),
      })),
    },
  };
}

export function useEvents() {
  const { data, error, isLoading, mutate } = useSWR(
    "/api/events",
    () => api.get("/api/events").then((response) => response.data.data),
    { revalidateOnFocus: true,
      refreshInterval: 10000,
      refreshWhenHidden: false

    },
  );

  const createEvent = async (event) => {
    const { data: response } = await api.post("/api/events", toApiPayload(event));
    const createdEvent = response.data;

    await mutate((current = []) => [createdEvent, ...current], { revalidate: false });

    return toEventCard(createdEvent);
  };

  const updateEvent = async (eventId, event) => {
    const { data: response } = await api.put(`/api/events/${eventId}`, toApiPayload(event));
    const updatedEvent = response.data;

    await mutate(
      (current = []) => current.map((item) => item.id === updatedEvent.id ? updatedEvent : item),
      { revalidate: false },
    );

    return toEventCard(updatedEvent);
  };

  const updateRegistrationOpen = async (eventSlug, isOpen) => {
    const { data: response } = await api.patch(`/api/events/${eventSlug}/registration`, { is_open: isOpen });
    const updatedEvent = response.data;

    await mutate(
      (current = []) => current.map((item) => item.slug === updatedEvent.slug ? updatedEvent : item),
      { revalidate: false },
    );

    return toEventCard(updatedEvent);
  };

  return {
    events: (data || []).map(toEventCard),
    error,
    isLoading,
    createEvent,
    updateEvent,
    updateRegistrationOpen,
    refresh: mutate,
  };
}

function eventMatchesCategory(event, category) {
  if (category === "all") return true;

  const eventCategory = (event.category || "").toLowerCase();

  if (category === "corporate") {
    return eventCategory.includes("corporate") || event.id.includes("FIN");
  }

  return eventCategory.includes(category);
}

export function filterEvents(events, category, searchQuery) {
  const normalizedSearch = searchQuery.trim().toLowerCase();

  return events.filter((event) => {
    if (!eventMatchesCategory(event, category)) return false;
    if (!normalizedSearch) return true;

    const searchableText = `${event.title} ${event.location} ${event.id}`.toLowerCase();

    return searchableText.includes(normalizedSearch);
  });
}
