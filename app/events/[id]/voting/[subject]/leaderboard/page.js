"use client";

import { ArrowLeft, CircleAlert, LoaderCircle, Radio, RotateCw, Settings, Sparkles, Users, Vote } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import useSWR from "swr";

import { RoleGate } from "@/components/auth/role-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LeaderboardRow } from "@/components/voting/leaderboard-row";
import api from "@/lib/api";
import { restoreDialogFocus } from "@/lib/dialog-focus.mjs";
import { DEFAULT_RAFFLE_THEME, getRaffleTheme, RAFFLE_THEMES } from "@/lib/raffle-themes.mjs";
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

const LEADERBOARD_THEME_STORAGE_KEY = "event-voting-leaderboard-theme";

function Leaderboard({ eventSlug, subjectSlug, userId }) {
  const subjectEndpoint = getVotingSubjectUrl(eventSlug, subjectSlug);
  const resultsEndpoint = `${subjectEndpoint}/results`;
  const visibilityState = useSyncExternalStore(subscribeToVisibility, getVisibilityState, getServerVisibilityState);
  const [confirmation, setConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [themeKey, setThemeKey] = useState(DEFAULT_RAFFLE_THEME);
  const [themeReady, setThemeReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const dialogOpenerRef = useRef(null);
  const settingsOpenerRef = useRef(null);
  const managementLinkRef = useRef(null);
  const theme = getRaffleTheme(themeKey);

  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem(LEADERBOARD_THEME_STORAGE_KEY);
      if (savedTheme) setThemeKey(getRaffleTheme(savedTheme).key);
    } catch {
      // Keep the default theme when browser storage is unavailable.
    }
    setThemeReady(true);
  }, []);

  useEffect(() => {
    if (!themeReady) return;
    try {
      window.localStorage.setItem(LEADERBOARD_THEME_STORAGE_KEY, themeKey);
    } catch {
      // Theme selection still works for this page view when storage is unavailable.
    }
  }, [themeKey, themeReady]);

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
    <main className="min-h-screen px-4 py-5 text-white sm:px-8 sm:py-8" style={{ background: `radial-gradient(ellipse at 12% 0%, ${theme.accent}35, transparent 34%), radial-gradient(ellipse at 90% 100%, ${theme.accent}22, transparent 38%), ${theme.background}` }}>
      <div className="mx-auto max-w-5xl space-y-7">
        <header className="space-y-7">
          <div className="flex items-center justify-between gap-3">
            <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/15 hover:text-white"><Link ref={managementLinkRef} href={managementHref}><ArrowLeft /> Voting management</Link></Button>
            <div className="flex items-center gap-2">
              {subject && <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wide" style={{ backgroundColor: subject.status === "active" ? theme.accent : "rgba(255,255,255,.16)", color: subject.status === "active" ? "#2c1644" : theme.text }}>{subject.status === "active" ? "Live" : subject.status}</span>
                {subject.status === "active" && visibilityState === "visible" && <span className="flex items-center gap-1.5 rounded-full border border-white/30 bg-black/10 px-3 py-1 text-xs font-semibold text-white"><Radio className="size-3.5 animate-pulse" style={{ color: theme.accent }} /> Updating live</span>}
              </div>}
              <Button ref={settingsOpenerRef} type="button" variant="ghost" size="icon" aria-label="Leaderboard settings" title="Leaderboard settings" className="rounded-full border border-white/35 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => setSettingsOpen(true)}><Settings className="size-5" /></Button>
            </div>
          </div>
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="flex items-center gap-2 text-xs font-extrabold tracking-[0.2em] text-white/80 uppercase"><Sparkles className="size-4" style={{ color: theme.accent }} /> Leaderboards</p>
            <p className="break-words text-base font-semibold text-white/85 sm:text-xl">{event?.title || "Event voting"}</p>
            <h1 className="break-words text-4xl font-black tracking-tight sm:text-6xl" style={{ textShadow: "0 3px 20px rgba(0,0,0,.16)" }}>{subject?.title || "Voting results"}</h1>
          </div>
        </header>

        {error && results && <p role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950 shadow-lg"><CircleAlert className="mt-0.5 size-4 shrink-0" /> Connection interrupted. Showing the last available results; we will retry automatically.</p>}
        {actionError && !confirmation && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-900 shadow-lg">{actionError}</p>}

        {isLoading && !results && <div role="status" className="flex min-h-64 items-center justify-center gap-3 text-lg font-semibold text-white"><LoaderCircle className="size-7 animate-spin" style={{ color: theme.accent }} /> Loading leaderboard...</div>}
        {error && !results && <div role="alert" className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl bg-white p-8 text-center text-[#25170f] shadow-xl"><CircleAlert className="size-8 text-red-700" /><p className="text-lg font-bold">The leaderboard could not be loaded.</p><Button type="button" variant="secondary" onClick={() => mutate()}><RotateCw /> Try again</Button></div>}

        {results && <>
          <section aria-labelledby="leaderboard-heading" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-extrabold tracking-[0.16em] text-white/75 uppercase">Standings</p><h2 id="leaderboard-heading" className="mt-1 text-3xl font-black">Contestants</h2></div>{lifecycleAction && <Button type="button" className="font-extrabold text-[#2c1644] shadow-lg hover:brightness-95" style={{ backgroundColor: theme.accent }} onClick={(event) => { dialogOpenerRef.current = event.currentTarget; setActionError(""); setConfirmation(lifecycleAction); }}>{lifecycleAction === "activate" ? "Activate voting" : "Close voting"}</Button>}</div>
            {results.total_votes === 0 ? <div className="rounded-2xl border-2 border-dashed border-white/55 bg-white/95 px-6 py-12 text-center text-[#25170f] shadow-xl"><Vote className="mx-auto size-10" style={{ color: theme.background }} aria-hidden="true" /><h3 className="mt-4 text-2xl font-extrabold">No votes yet</h3><p className="mt-2 text-base text-[#554766]">Results will appear here when attendees start voting.</p></div> : <ol className="space-y-3">{contestants.map((contestant) => <LeaderboardRow key={contestant.id} contestant={contestant} theme={theme} />)}</ol>}
          </section>

          <section aria-label="Voting totals" className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/50 bg-white p-5 text-[#25170f] shadow-xl sm:p-6"><div className="flex items-center gap-2 text-base font-bold text-[#554766]"><Vote className="size-5" style={{ color: theme.background }} /> Total votes</div><p className="mt-3 text-5xl font-black tabular-nums sm:text-6xl">{results.total_votes.toLocaleString()}</p></div>
            <div className="rounded-2xl border border-white/50 bg-white p-5 text-[#25170f] shadow-xl sm:p-6"><div className="flex items-center gap-2 text-base font-bold text-[#554766]"><Users className="size-5" style={{ color: theme.background }} /> Registration participation</div><p className="mt-3 text-5xl font-black tabular-nums sm:text-6xl">{results.participation_percentage}%</p><p className="mt-2 text-sm text-[#554766]">Out of {results.total_registrations.toLocaleString()} registered attendees</p></div>
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

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="p-6" onCloseAutoFocus={(event) => restoreDialogFocus(event, settingsOpenerRef.current, managementLinkRef.current)}>
          <DialogHeader className="pr-8"><DialogTitle className="text-2xl font-extrabold">Leaderboard settings</DialogTitle><DialogDescription>Choose a theme color for this stage display. Your choice is saved in this browser.</DialogDescription></DialogHeader>
          <section aria-labelledby="leaderboard-theme-heading">
            <h2 id="leaderboard-theme-heading" className="mb-4 text-sm font-bold text-[#554766]">Theme color</h2>
            <div className="grid grid-cols-5 gap-3 sm:gap-4">
              {RAFFLE_THEMES.map((option) => <button key={option.key} type="button" onClick={() => setThemeKey(option.key)} aria-label={`${option.key} theme`} aria-pressed={themeKey === option.key} className="aspect-square rounded-full border-4 shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2" style={{ backgroundColor: option.background, borderColor: themeKey === option.key ? option.accent : "#ffffff", boxShadow: themeKey === option.key ? `0 0 0 2px ${option.background}` : undefined }} />)}
            </div>
          </section>
          <DialogFooter><Button type="button" onClick={() => setSettingsOpen(false)} className="font-bold text-[#2c1644]" style={{ backgroundColor: theme.accent }}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function VotingLeaderboardPage() {
  const { id, subject } = useParams();
  return <RoleGate>{({ user }) => <Leaderboard key={`${user.id}:${id}:${subject}`} eventSlug={id} subjectSlug={subject} userId={user.id} />}</RoleGate>;
}
