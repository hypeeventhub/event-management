"use client";

import { ArrowLeft, CircleAlert, LoaderCircle, Radio, RotateCw, Users, Vote } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import useSWR from "swr";

import { RoleGate } from "@/components/auth/role-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LeaderboardRow } from "@/components/voting/leaderboard-row";
import api from "@/lib/api";
import { restoreDialogFocus } from "@/lib/dialog-focus.mjs";
import { getLeaderboardRefreshInterval, getRankedContestants, getVotingResultsPayload } from "@/lib/voting-leaderboard.mjs";
import { getVotingSubjectUrl } from "@/lib/voting-subjects.mjs";

function subscribeToVisibility(onChange) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function getVisibilityState() {
  return document.visibilityState;
}

function getServerVisibilityState() {
  return "visible";
}

function Leaderboard({ eventSlug, subjectSlug, userId }) {
  const subjectEndpoint = getVotingSubjectUrl(eventSlug, subjectSlug);
  const resultsEndpoint = `${subjectEndpoint}/results`;
  const visibilityState = useSyncExternalStore(subscribeToVisibility, getVisibilityState, getServerVisibilityState);
  const [confirmation, setConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const dialogOpenerRef = useRef(null);
  const managementLinkRef = useRef(null);

  const { data: results, error, isLoading, mutate } = useSWR(
    [resultsEndpoint, String(userId)],
    ([url]) => api.get(url).then(getVotingResultsPayload),
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      refreshWhenHidden: false,
      refreshInterval: (latest) => getLeaderboardRefreshInterval({ status: latest?.subject?.status, visibilityState }),
      errorRetryInterval: 3000,
      isPaused: () => visibilityState !== "visible",
    },
  );

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") mutate();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [mutate]);

  const subject = results?.subject;
  const event = results?.event;
  const contestants = getRankedContestants(results?.contestants);
  const lifecycleAction = subject?.status === "draft" ? "activate" : subject?.status === "active" ? "close" : null;
  const managementHref = `/events/${encodeURIComponent(eventSlug)}/voting`;

  async function confirmLifecycleAction() {
    if (!confirmation || busy || confirmation !== lifecycleAction) return;
    setBusy(true);
    setActionError("");
    let statusChanged = false;
    try {
      await api.post(`${subjectEndpoint}/${confirmation}`);
      statusChanged = true;
      const nextStatus = confirmation === "activate" ? "active" : "closed";
      await mutate((current) => current ? { ...current, subject: { ...current.subject, status: nextStatus } } : current, { revalidate: false });
      setConfirmation(null);
      await mutate();
    } catch (requestError) {
      if (statusChanged) setConfirmation(null);
      setActionError(statusChanged ? "The voting status changed, but the results could not be refreshed. Try again shortly." : requestError.response?.data?.message || "The voting status could not be changed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fffaf7] px-4 py-5 text-[#25170f] sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl space-y-7">
        <header className="space-y-6">
          <Button asChild variant="ghost" size="sm"><Link ref={managementLinkRef} href={managementHref}><ArrowLeft /> Voting management</Link></Button>
          <div className="flex flex-col gap-5 ">
            <p className="text-xs font-bold tracking-[0.14em] text-[#f6671e] uppercase">Leaderboards</p>
            <div className="flex justify-end">
              {subject && <div className="flex flex-wrap items-center gap-2"><Badge variant={subject.status === "active" ? "success" : "neutral"} className="capitalize">{subject.status}</Badge>{subject.status === "active" && visibilityState === "visible" && <span className="flex items-center gap-1.5 text-xs font-medium text-[#006c49]"><Radio className="size-3.5" /> Updating live</span>}</div>}
            </div>
            <div className="w-full text-center flex flex-col gap-5">
              <p className="mt-3 break-words text-sm font-medium text-[#6f625b] sm:text-xl">{event?.title || "Event voting"}</p>
              <h1 className="mt-1 break-words text-3xl font-bold sm:text-5xl">{subject?.title || "Voting results"}</h1>
            </div>

          </div>
        </header>

        {error && results && <p role="alert" className="flex items-start gap-2 rounded-xl border border-[#e9ba5e] bg-[#fff6dd] px-4 py-3 text-sm text-[#694500]"><CircleAlert className="mt-0.5 size-4 shrink-0" /> Connection interrupted. Showing the last available results; we will retry automatically.</p>}
        {actionError && !confirmation && <p role="alert" className="rounded-xl bg-[#ffdad6] px-4 py-3 text-sm text-[#93000a]">{actionError}</p>}

        {isLoading && !results && <div role="status" className="flex min-h-64 items-center justify-center gap-3 text-sm text-[#6f625b]"><LoaderCircle className="size-6 animate-spin text-[#f6671e]" /> Loading leaderboard...</div>}
        {error && !results && <div role="alert" className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-[#ffdece] bg-white p-8 text-center"><CircleAlert className="size-8 text-[#ba1a1a]" /><p>The leaderboard could not be loaded.</p><Button type="button" variant="secondary" onClick={() => mutate()}><RotateCw /> Try again</Button></div>}

        {results && <>
          <section aria-labelledby="leaderboard-heading" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold tracking-[0.12em] text-[#f6671e] uppercase">Standings</p><h2 id="leaderboard-heading" className="mt-1 text-2xl font-bold">Contestants</h2></div>{lifecycleAction && <Button type="button" onClick={(event) => { dialogOpenerRef.current = event.currentTarget; setActionError(""); setConfirmation(lifecycleAction); }}>{lifecycleAction === "activate" ? "Activate voting" : "Close voting"}</Button>}</div>
            {results.total_votes === 0 ? <div className="rounded-2xl border-2 border-dashed border-[#f3c7b2] bg-white px-6 py-12 text-center"><Vote className="mx-auto size-10 text-[#f6671e]" aria-hidden="true" /><h3 className="mt-4 text-xl font-bold">No votes yet</h3><p className="mt-2 text-sm text-[#6f625b]">Results will appear here when attendees start voting.</p></div> : <ol className="space-y-3">{contestants.map((contestant) => <LeaderboardRow key={contestant.id} contestant={contestant} />)}</ol>}
          </section>

          <section aria-label="Voting totals" className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#ffdece] bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2 text-sm font-semibold text-[#6f625b]"><Vote className="size-4 text-[#f6671e]" /> Total votes</div><p className="mt-3 text-4xl font-bold tabular-nums sm:text-5xl">{results.total_votes.toLocaleString()}</p></div>
            <div className="rounded-2xl border border-[#ffdece] bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2 text-sm font-semibold text-[#6f625b]"><Users className="size-4 text-[#f6671e]" /> Registration participation</div><p className="mt-3 text-4xl font-bold tabular-nums sm:text-5xl">{results.participation_percentage}%</p><p className="mt-2 text-xs text-[#6f625b]">Out of {results.total_registrations.toLocaleString()} registered attendees</p></div>
          </section>
        </>}
      </div>

      <Dialog open={Boolean(confirmation)} onOpenChange={(open) => { if (!open && !busy) { setConfirmation(null); setActionError(""); } }}>
        <DialogContent className="p-6" onCloseAutoFocus={(event) => restoreDialogFocus(event, dialogOpenerRef.current, managementLinkRef.current)}>
          <DialogHeader className="pr-8"><DialogTitle>{confirmation === "activate" ? "Activate voting?" : "Close voting?"}</DialogTitle><DialogDescription>{confirmation === "activate" ? "This ballot will become available to voters. Its title and contestants can no longer be edited." : "Voters will no longer be able to cast votes for this subject."}</DialogDescription></DialogHeader>
          {actionError && <p role="alert" className="rounded-xl bg-[#ffdad6] px-4 py-3 text-sm text-[#93000a]">{actionError}</p>}
          <DialogFooter><Button type="button" variant="secondary" disabled={busy} onClick={() => { setConfirmation(null); setActionError(""); }}>Cancel</Button><Button type="button" disabled={busy} onClick={confirmLifecycleAction}>{busy ? "Working..." : confirmation === "activate" ? "Activate voting" : "Close voting"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function VotingLeaderboardPage() {
  const { id, subject } = useParams();
  return <RoleGate>{({ user }) => <Leaderboard key={`${user.id}:${id}:${subject}`} eventSlug={id} subjectSlug={subject} userId={user.id} />}</RoleGate>;
}
