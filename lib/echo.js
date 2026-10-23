import Echo from "laravel-echo";
import Pusher from "pusher-js";
import api from "./api.js";

let echo = null;

export function getNominationChannelName(eventId, subjectId) {
  return `events.${eventId}.nominations.${subjectId}`;
}

export function getVotingChannelName(eventId, subjectId) {
  return `events.${eventId}.voting.${subjectId}`;
}

export function getAttendeesChannelName(eventId) {
  return `events.${eventId}.attendees`;
}

export function getEcho() {
  if (typeof window === "undefined") return null;
  if (echo) return echo;

  // Keep direct env references so Next.js can inline these public build settings.
  const key = process.env.NEXT_PUBLIC_REVERB_APP_KEY;
  const host = process.env.NEXT_PUBLIC_REVERB_HOST;
  const port = process.env.NEXT_PUBLIC_REVERB_PORT;
  const scheme = process.env.NEXT_PUBLIC_REVERB_SCHEME;

  if (!key || !host || !port || !scheme) return null;

  echo = new Echo({
    broadcaster: "reverb",
    Pusher,
    key,
    wsHost: host,
    wsPort: Number(port),
    wssPort: Number(port),
    forceTLS: scheme === "https",
    enabledTransports: ["ws", "wss"],
    authorizer: (channel) => ({
      authorize: (socketId, callback) => {
        api.post("/api/broadcasting/auth", {
          socket_id: socketId,
          channel_name: channel.name,
        }).then(
          (response) => callback(false, response.data),
          (error) => callback(true, error),
        );
      },
    }),
  });

  return echo;
}
