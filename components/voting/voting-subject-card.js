"use client";

import { BarChart3, Check, Pencil, Radio, Trash2 } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getNominationActions } from "@/lib/nomination-voting.mjs";
import { getContestantPosition, getVotingSubjectActions } from "@/lib/voting-subjects.mjs";

export function VotingSubjectCard({ subject, eventSlug, busyAction, onEdit, onConfirm, readOnly = false }) {
  const nomination = subject.mode === "nomination";
  const transitioned = nomination && subject.status === "closed" && subject.generated_subject;
  const cardSubject = transitioned ? subject.generated_subject : subject;
  const nominationStage = nomination && !transitioned;
  const actions = nominationStage ? getNominationActions(subject.status) : getVotingSubjectActions(cardSubject.status);
  const busy = Boolean(busyAction);
  const leaderboardHref = `/events/${encodeURIComponent(eventSlug)}/voting/${encodeURIComponent(cardSubject.slug)}/leaderboard`;
  const typeLabel = transitioned ? "Voting" : nomination ? "Nomination" : "Voting subject";
  const showLeaderboard = actions.includes("leaderboard");
  const showActions = !readOnly || showLeaderboard;

  return (
    <Card className="flex flex-col overflow-hidden border border-[#ffdece] bg-white shadow-sm">
      <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="text-xs font-semibold tracking-widest text-[#f6671e] uppercase">{typeLabel}</p><h2 className="mt-2 break-words text-xl font-bold text-[#25170f]">{cardSubject.title}</h2></div>
          <Badge variant={cardSubject.status === "active" ? "success" : "neutral"} className="shrink-0 capitalize">{cardSubject.status}</Badge>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-[#6f625b]"><span>{cardSubject.contestant_count} {nominationStage ? `nominee${cardSubject.contestant_count === 1 ? "" : "s"}` : `finalist${cardSubject.contestant_count === 1 ? "" : "s"}`}</span><span>{cardSubject.total_votes} {nominationStage ? `nomination${cardSubject.total_votes === 1 ? "" : "s"}` : `vote${cardSubject.total_votes === 1 ? "" : "s"}`}</span>{nominationStage && <span>Top {subject.top_n}, including cutoff ties</span>}</div>
        {cardSubject.generated_from_subject_id && <p className="text-xs text-[#6f625b]">Finalists were selected from nominations.</p>}
        <ol className="max-h-32 space-y-1 overflow-auto rounded-xl bg-[#fffaf7] px-4 py-3 text-sm text-[#6f625b]">
          {cardSubject.contestants.map((contestant) => <li key={contestant.id} className="truncate">{getContestantPosition(contestant.display_order)}. {contestant.name}</li>)}
        </ol>
      </div>
      {showActions && <div className="flex flex-wrap gap-2 border-t border-[#ffdece] bg-[#fffaf7] p-4 sm:px-6">
        {!readOnly && actions.includes("edit") && <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={(event) => onEdit(cardSubject, event.currentTarget)}><Pencil /> {nominationStage ? "Edit nomination" : "Edit"}</Button>}
        {!readOnly && actions.includes("open") && <Button type="button" size="sm" disabled={busy} onClick={(event) => onConfirm(subject, "open", event.currentTarget)}><Radio /> {busyAction === "open" ? "Opening..." : "Open nomination"}</Button>}
        {!readOnly && actions.includes("activate") && <Button type="button" size="sm" disabled={busy} onClick={(event) => onConfirm(cardSubject, "activate", event.currentTarget)}><Radio /> {busyAction === "activate" ? "Activating..." : "Activate voting"}</Button>}
        {!readOnly && actions.includes("close") && <Button type="button" size="sm" disabled={busy} onClick={(event) => onConfirm(cardSubject, "close", event.currentTarget)}><Check /> {busyAction === "close" ? "Closing..." : nominationStage ? "Close nomination" : "Close voting"}</Button>}
        {!readOnly && actions.includes("delete") && <Button type="button" size="sm" variant="ghost" className="text-[#ba1a1a]" disabled={busy} onClick={(event) => onConfirm(cardSubject, "delete", event.currentTarget)}><Trash2 /> {busyAction === "delete" ? "Deleting..." : "Delete"}</Button>}
        {showLeaderboard && <Button asChild size="sm" variant="ghost"><Link href={leaderboardHref}><BarChart3 /> Leaderboard</Link></Button>}
      </div>}
    </Card>
  );
}
