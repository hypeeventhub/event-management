import {
  MapPin,
  Dice5,
  Trophy,
  Pencil,
  UsersRound,
  ExternalLink,
  Eye,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getRaffleHref } from "@/lib/raffle-navigation.mjs";

export const liveEvents = [
  {
    id: "EVT-GALA-2026-HQ",
    title: "Annual Corporate Gala 2026",
    location: "Grand Pavilion Hall A & B • 5:00 PM – 11:30 PM (Peak Surge Now)",
    progressLabel: "Live Attendance",
    checkedIn: "1,864 / 2,287 Checked In (81.5%)",
    progress: 81.5,
    actions: [
      { label: "Voting", icon: Trophy, action: "voting", variant: "secondary" },
      { label: "Edit Forms", icon: Pencil, action: "settings", variant: "" },
    ],
  },
  {
    id: "EVT-EXEC-2026-VIP",
    title: "Executive Leadership Reception",
    location: "Skyline Lounge, 48th Floor • 6:30 PM – 10:00 PM",
    progressLabel: "Live Attendance",
    checkedIn: "148 / 180 Checked In (82.2%)",
    progress: 82.2,
    actions: [
      { label: "Voting", icon: Trophy, action: "voting", variant: "secondary" },
      { label: "Edit Forms", icon: Pencil, action: "settings", variant: "" },
    ],
  },
];

export const upcomingEvents = [
  {
    id: "EVT-TECH-2026",
    title: "Global Tech & AI Summit 2026",
    date: "Tomorrow • 09:00 AM",
    location: "Auditorium C & Virtual Livestream",
    registration: "480 / 500 Capacity (96%)",
    progress: 96,
    featured: true,
    category: "tech",
    toast: "Batch reminder sent to 480 confirmed guests.",
  },
  {
    id: "EVT-FIN-2026",
    title: "Annual Investors & Stakeholders Day",
    date: "In 5 Days • Oct 28",
    location: "Conference Center Ballroom",
    registration: "315 / 400 Capacity (78%)",
    progress: 78,
    category: "corporate",
    toast: "Batch reminder sent to 315 confirmed guests.",
  },
  {
    id: "EVT-AWD-2026",
    title: "Q4 Corporate Excellence Awards",
    date: "In 12 Days • Nov 4",
    location: "Grand Westin Banquet Suite",
    registration: "220 / 300 Capacity (73%)",
    progress: 73,
    category: "social",
    toast: "Invite reminders set for Nov 1.",
  },
  {
    id: "EVT-HCK-2026",
    title: "Nexus Internal Hackathon & Expo",
    date: "In 24 Days • Nov 16",
    location: "Innovation Labs & Atrium",
    registration: "195 / 250 Capacity (78%)",
    progress: 78,
    category: "tech",
    toast: "Invite reminders set for Nov 10.",
  },
];

function ProgressBar({ value }) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-[#fff4ee]"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <div
        className="h-full rounded-full bg-[#f6671e] transition-all duration-700"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export function LiveEventCard({ event, onVoting, onView }) {
  const raffleHref = getRaffleHref(event);

  return (
    <Card className="rounded-xl border border-[#ffdece]/45 p-4 shadow-[0_2px_8px_rgba(101,66,45,0.05)] hover:shadow-[0_8px_22px_rgba(101,66,45,0.09)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#ffdece] px-2 py-0.5 text-[10px] leading-4 font-semibold text-[#f6671e]">
              <span className="size-1.5 animate-pulse rounded-full bg-[#f6671e]" />
              Live
            </span>
            <span className="font-mono text-[9px] leading-4 text-[#b5a69e]" title={event.id}>ID: {event.displayId || event.id}</span>
          </div>

          <h3 className="truncate text-base leading-5 font-bold text-[#25170f] sm:text-lg sm:leading-6">
            {event.title}
          </h3>
          <p className="mt-0.5 truncate text-[11px] leading-4 text-[#96877f]">
            {event.location}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {event.sourceId && (
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-lg text-[#25170f] transition-colors hover:bg-[#ffdece] hover:text-[#f6671e] focus-visible:ring-2 focus-visible:ring-[#f6671e]/30 focus-visible:outline-none"
              onClick={onView}
              aria-label="View event"
              title="View event"
            >
              <Eye className="size-4" />
            </button>
          )}
          {raffleHref && (
            <Link
              href={raffleHref}
              className="flex size-8 items-center justify-center rounded-lg text-[#25170f] transition-colors hover:bg-[#ffdece] hover:text-[#f6671e] focus-visible:ring-2 focus-visible:ring-[#f6671e]/30 focus-visible:outline-none"
              aria-label="Open raffle"
              title="Raffle"
            >
              <Dice5 className="size-4" />
            </Link>
          )}
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-lg text-[#25170f] transition-colors hover:bg-[#ffdece] hover:text-[#f6671e] focus-visible:ring-2 focus-visible:ring-[#f6671e]/30 focus-visible:outline-none"
            onClick={onVoting}
            aria-label="Open voting"
            title="Voting"
          >
            <Trophy className="size-4" />
          </button>
          {event.sourceId && (
            <a
              href={`/events/${event.sourceId}/attendees`}
              className="flex size-8 items-center justify-center rounded-lg text-[#25170f] transition-colors hover:bg-[#ffdece] hover:text-[#f6671e] focus-visible:ring-2 focus-visible:ring-[#f6671e]/30 focus-visible:outline-none"
              aria-label="View attendees"
              title="View attendees"
            >
              <UsersRound className="size-4" />
            </a>
          )}
          <a
            href={`/register/${event.id}`}
            target="_blank"
            rel="noreferrer"
            className="flex size-8 items-center justify-center rounded-lg text-[#25170f] transition-colors hover:bg-[#ffdece] hover:text-[#f6671e] focus-visible:ring-2 focus-visible:ring-[#f6671e]/30 focus-visible:outline-none"
            aria-label="Open registration form"
            title="Open registration form"
          >
            <ExternalLink className="size-4" />
          </a>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] leading-4 sm:text-[11px]">
          <span className="text-[#96877f]">{event.progressLabel}</span>
          <span className="font-semibold text-[#f6671e]">{event.checkedIn}</span>
        </div>
        <ProgressBar value={event.progress} />
      </div>
    </Card>
  );
}

export function UpcomingEventCard({ event, onEdit, onView }) {
  return (
    <Card className="flex min-h-60 flex-col justify-between space-y-4 p-4 sm:p-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant={event.featured ? "default" : "neutral"}>{event.date}</Badge>
          <span className="font-mono text-[11px] leading-4 text-[#96877f]" title={event.id}>{event.displayId || event.id}</span>
        </div>
        <h3 className="text-lg leading-6 font-bold text-[#25170f] sm:text-xl sm:leading-7">
          {event.title}
        </h3>
        <p className="flex items-center gap-1 text-xs leading-4 text-[#6f625b]">
          <MapPin className="size-4 shrink-0" />
          <span>{event.location}</span>
        </p>
        <div className="space-y-1 pt-2">
          <div className="flex flex-col justify-between gap-1 text-[11px] leading-4 min-[420px]:flex-row">
            <span className="text-[#6f625b]">Registered Attendees</span>
            <span className="font-semibold text-[#25170f]">{event.registration}</span>
          </div>
          <ProgressBar value={event.progress} />
        </div>
      </div>

      <div className="flex flex-col justify-between gap-2 border-t border-[#ffdece]/60 pt-3 min-[420px]:flex-row min-[420px]:items-center">
        <div className="flex flex-wrap items-center gap-1.5">
          {event.sourceId && (
            <Button asChild variant="secondary" size="sm">
              <a href={`/register/${event.id}`} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4 text-[#f6671e]" />
                Registration Form
              </a>
            </Button>
          )}
          {event.sourceId && (
            <Button asChild variant="secondary" size="sm">
              <a href={`/events/${event.sourceId}/attendees`}>
                <UsersRound className="size-4 text-[#f6671e]" />
                Attendees
              </a>
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={onView}
            aria-label="View event"
            title="View event"
          >
            <Eye />
          </Button>
          <Button type="button" size="sm" onClick={onEdit}>
            Edit Event
          </Button>
        </div>
      </div>
    </Card>
  );
}
