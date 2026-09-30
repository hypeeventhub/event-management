"use client";

import { BarChart3, Check, Pencil, QrCode, Radio, Trash2 } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getContestantPosition, getVotingSubjectActions } from "@/lib/voting-subjects.mjs";

export function VotingSubjectCard({ subject, eventSlug, busyAction, onEdit, onConfirm, onQr }) {
  const actions = getVotingSubjectActions(subject.status);
  const busy = Boolean(busyAction);
  const leaderboardHref = `/events/${encodeURIComponent(eventSlug)}/voting/${encodeURIComponent(subject.slug)}/leaderboard`;

  return (
    <Card className="flex flex-col overflow-hidden border border-[#ffdece] bg-white shadow-sm">
      <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="text-xs font-semibold tracking-widest text-[#f6671e] uppercase">Voting subject</p><h2 className="mt-2 break-words text-xl font-bold text-[#25170f]">{subject.title}</h2></div>
          <Badge variant={subject.status === "active" ? "success" : "neutral"} className="shrink-0 capitalize">{subject.status}</Badge>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-[#6f625b]"><span>{subject.contestant_count} contestant{subject.contestant_count === 1 ? "" : "s"}</span><span>{subject.total_votes} vote{subject.total_votes === 1 ? "" : "s"}</span></div>
        <ol className="max-h-32 space-y-1 overflow-auto rounded-xl bg-[#fffaf7] px-4 py-3 text-sm text-[#6f625b]">
          {subject.contestants.map((contestant) => <li key={contestant.id} className="truncate">{getContestantPosition(contestant.display_order)}. {contestant.name}</li>)}
        </ol>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-[#ffdece] bg-[#fffaf7] p-4 sm:px-6">
        {actions.includes("edit") && <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={(event) => onEdit(subject, event.currentTarget)}><Pencil /> Edit</Button>}
        {actions.includes("activate") && <Button type="button" size="sm" disabled={busy} onClick={(event) => onConfirm(subject, "activate", event.currentTarget)}><Radio /> {busyAction === "activate" ? "Activating..." : "Activate"}</Button>}
        {actions.includes("close") && <Button type="button" size="sm" disabled={busy} onClick={(event) => onConfirm(subject, "close", event.currentTarget)}><Check /> {busyAction === "close" ? "Closing..." : "Close voting"}</Button>}
        {actions.includes("delete") && <Button type="button" size="sm" variant="ghost" className="text-[#ba1a1a]" disabled={busy} onClick={(event) => onConfirm(subject, "delete", event.currentTarget)}><Trash2 /> {busyAction === "delete" ? "Deleting..." : "Delete"}</Button>}
        {actions.includes("qr") && <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={(event) => onQr(subject, event.currentTarget)}><QrCode /> QR code</Button>}
        {actions.includes("leaderboard") && <Button asChild size="sm" variant="ghost"><Link href={leaderboardHref}><BarChart3 /> Leaderboard</Link></Button>}
      </div>
    </Card>
  );
}
