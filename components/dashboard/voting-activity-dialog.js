"use client";

import { Check, CircleDashed, ListChecks, Mail, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function VotingActivityDialog({ registration, subjects = [], open, onOpenChange }) {
  const attendee = registration?.attendee;
  const attendeeName = attendee
    ? `${attendee.first_name || ""} ${attendee.last_name || ""}`.trim()
    : "Attendee";
  const activityBySubject = new Map(
    (registration?.voting_activity || []).map((activity) => [Number(activity.subject_id), activity]),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <div className="border-b border-[#ffdece] bg-[#fff4ee] px-6 py-5 pr-14">
          <DialogHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-[#f6671e] text-white">
              <ListChecks className="size-5" />
            </div>
            <DialogTitle>Voting activity</DialogTitle>
            <DialogDescription>
              See which subjects this attendee voted in and the nominee they selected.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 p-6">
          <div className="flex flex-col gap-3 rounded-xl border border-[#ffdece] bg-[#fffaf7] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 font-semibold text-[#25170f]">
                <UserRound className="size-4 text-[#f6671e]" />
                {attendeeName}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-[#6f625b]">
                <Mail className="size-3.5" />
                {attendee?.email || "No email address"}
              </div>
            </div>
            <Badge variant={registration?.has_voted ? "success" : "neutral"}>
              {registration?.has_voted ? "Voted in a subject" : "No votes yet"}
            </Badge>
          </div>

          {subjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#f3c7b2] px-5 py-8 text-center text-sm text-[#6f625b]">
              This event has no voting subjects yet.
            </div>
          ) : (
            <ol className="max-h-[min(55vh,32rem)] space-y-3 overflow-y-auto pr-1">
              {subjects.map((subject) => {
                const activity = activityBySubject.get(Number(subject.id));
                const hasVoted = Boolean(activity);
                const modeLabel = subject.mode === "nomination" ? "Nomination" : "Voting";
                const choiceLabel = subject.mode === "nomination" ? "Nominated" : "Voted for";

                return (
                  <li key={subject.id} className="rounded-xl border border-[#ffdece] p-4">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-words font-semibold text-[#25170f]">{subject.title}</p>
                          <Badge variant="default">{modeLabel}</Badge>
                          <Badge variant="neutral">{subject.status}</Badge>
                        </div>
                        {hasVoted && activity.nominee_name && (
                          <p className="mt-2 text-sm text-[#6f625b]">
                            {choiceLabel}: <span className="font-semibold text-[#25170f]">{activity.nominee_name}</span>
                          </p>
                        )}
                      </div>
                      <Badge variant={hasVoted ? "success" : "neutral"} className="self-start">
                        {hasVoted ? <Check aria-hidden="true" /> : <CircleDashed aria-hidden="true" />}
                        {hasVoted ? "Voted" : "Not voted"}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
