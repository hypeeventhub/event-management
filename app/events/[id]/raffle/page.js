"use client";

import { ArrowLeft, CircleAlert, Dice5, LoaderCircle, RotateCcw, Trophy, UsersRound } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useReducer, useState } from "react";
import useSWR from "swr";

import { RoleGate } from "@/components/auth/role-gate";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopHeader } from "@/components/dashboard/top-header";
import { RaffleWheel } from "@/components/raffle/raffle-wheel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import api from "@/lib/api";
import {
  canCancel,
  canConfirm,
  canStartDraw,
  createRaffleRequestTracker,
  createRaffleState,
  getRaffleCacheKey,
  getRaffleErrorMessage,
  getWheelAttendees,
  isRaffleAccessError,
  raffleReducer,
  runRaffleMutation,
} from "@/lib/raffle-state.mjs";

function attendeeName(attendee) {
  return [attendee?.first_name, attendee?.last_name].filter(Boolean).join(" ");
}

function RaffleShell({ user, logout, eventId }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [state, dispatch] = useReducer(raffleReducer, undefined, createRaffleState);
  const [tracker] = useState(createRaffleRequestTracker);
  const endpoint = `/api/events/${encodeURIComponent(eventId)}/raffle`;
  const { data, error, mutate } = useSWR(
    getRaffleCacheKey(user.id, eventId),
    ([url]) => api.get(url).then((response) => response.data.data),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  useEffect(() => {
    const action = tracker.cachedLoadAction(data, error);
    if (action) {
      dispatch(action);
      if (isRaffleAccessError(error) && data) mutate(undefined, { revalidate: false }).catch(() => {});
    }
  }, [data, error, mutate, tracker]);

  useEffect(() => {
    tracker.resume();
    return () => {
      tracker.dispose();
      // A same-tick effect setup in development can resume before cleanup runs.
      queueMicrotask(() => {
        const drawId = tracker.takeCleanupDrawId();
        if (drawId !== null) api.delete(`${endpoint}/draws/${drawId}`).catch(() => {});
      });
    };
  }, [endpoint, tracker]);

  async function refresh(options) {
    const token = tracker.beginRefresh(options);
    if (!token) return;
    try {
      const response = await api.get(endpoint);
      if (!tracker.shouldApplySnapshot(token)) return;
      const payload = response.data.data;
      tracker.setPendingDraw(payload.pending_draw?.id);
      dispatch({ type: "LOAD_SUCCESS", payload });
      mutate(payload, { revalidate: false }).catch(() => {});
    } catch (requestError) {
      if (tracker.shouldApplySnapshot(token)) {
        if (isRaffleAccessError(requestError)) {
          tracker.setPendingDraw(null);
          mutate(undefined, { revalidate: false }).catch(() => {});
        }
        dispatch({ type: "LOAD_FAILURE", error: requestError });
      }
    } finally {
      tracker.settleRefresh(token);
    }
  }

  function mutateDraw(operation, request) {
    return runRaffleMutation({
      operation,
      tracker,
      dispatch,
      request: async () => {
        try {
          return (await request()).data.data;
        } catch (requestError) {
          if (isRaffleAccessError(requestError)) mutate(undefined, { revalidate: false }).catch(() => {});
          throw requestError;
        }
      },
      refresh: () => refresh({ supersede: true }),
      cleanup: () => {
        const drawId = tracker.takeCleanupDrawId();
        if (drawId !== null) api.delete(`${endpoint}/draws/${drawId}`).catch(() => {});
      },
    });
  }

  async function spin() {
    if (!canStartDraw(state)) return;
    await mutateDraw("DRAW", () => api.post(`${endpoint}/draws`));
  }

  async function confirm() {
    if (!canConfirm(state)) return;
    await mutateDraw("CONFIRM", () => api.post(`${endpoint}/draws/${state.pendingDraw.id}/confirm`));
  }

  async function drawAgain() {
    if (!canCancel(state)) return;
    await mutateDraw("CANCEL", () => api.delete(`${endpoint}/draws/${state.pendingDraw.id}`));
  }

  async function handleLogout() {
    setLogoutError("");
    try {
      await logout();
    } catch (requestError) {
      setLogoutError(getRaffleErrorMessage(requestError, "Could not log out. Please try again."));
    }
  }

  const busy = ["drawing", "confirming", "cancelling", "reconciling"].includes(state.status);
  const selected = state.selectedAttendee;
  const currentWinner = state.status === "spinning" ? null : state.lastWinner || selected;
  const wheelAttendees = getWheelAttendees(state);
  const selectedRegistrationId = selected?.registration_id ?? null;

  return (
    <div className="min-h-screen bg-[#fffaf7] text-[#25170f]">
      <Sidebar role={user.role} activeItem="Dashboard" mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <TopHeader onMenuOpen={() => setSidebarOpen(true)} onLogout={handleLogout} user={user} />

      <div className="xl:pl-72">
        <main className="min-h-screen px-4 pt-[72px] pb-10 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1400px] space-y-6">
            <div className="space-y-4 pt-1">
              <Button asChild variant="ghost" size="sm"><Link href="/"><ArrowLeft />Back to dashboard</Link></Button>
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="text-xs font-bold tracking-[0.08em] text-[#f6671e] uppercase">Event raffle</p>
                  <h1 className="mt-1 text-[28px] leading-9 font-bold tracking-tight sm:text-4xl sm:leading-11">
                    {state.event?.title || "Raffle"}
                  </h1>
                  <p className="mt-1 text-sm text-[#6f625b]">Every confirmed registration gets one chance until it wins.</p>
                </div>
                <div className="inline-flex items-center gap-2 self-start rounded-xl bg-[#fff4ee] px-4 py-3 text-sm font-semibold text-[#9a4a23] sm:self-auto">
                  <UsersRound className="size-5" aria-hidden="true" />
                  <span>{state.eligibleCount.toLocaleString()} remaining eligible</span>
                </div>
              </div>
            </div>

            {(state.error || logoutError) && (
              <div role="alert" className="flex items-start gap-2 rounded-xl bg-[#ffdad6] px-4 py-3 text-sm font-medium text-[#93000a]">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span className="flex-1">{state.error || logoutError}</span>
                {state.error && state.event && (
                  <button type="button" className="shrink-0 font-semibold underline underline-offset-2" disabled={busy} onClick={refresh}>
                    Refresh raffle
                  </button>
                )}
              </div>
            )}

            {state.status === "loading" ? (
              <Card className="flex min-h-80 items-center justify-center gap-3 text-[#f6671e]">
                <LoaderCircle className="size-7 animate-spin" aria-hidden="true" />
                <span>Loading raffle...</span>
              </Card>
            ) : state.status === "error" && !state.event ? (
              <Card className="flex min-h-64 flex-col items-center justify-center gap-4 p-6 text-center">
                <p className="text-sm text-[#6f625b]">The raffle could not be loaded.</p>
                <Button type="button" onClick={refresh}>Try again</Button>
              </Card>
            ) : (
              <>
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
                  <Card className="flex min-w-0 items-center justify-center overflow-hidden border border-[#ffdece] p-4 sm:p-6">
                    <RaffleWheel
                      attendees={wheelAttendees}
                      selectedRegistrationId={selectedRegistrationId}
                      spinning={state.status === "spinning"}
                      onSpinEnd={() => dispatch({ type: "SPIN_END" })}
                    />
                  </Card>

                  <Card className="flex flex-col justify-between gap-6 border border-[#ffdece] p-5 sm:p-7">
                    <div className="space-y-5">
                      <div className="flex size-12 items-center justify-center rounded-xl bg-[#ffdece] text-[#f6671e]"><Dice5 className="size-6" aria-hidden="true" /></div>
                      <div>
                        <h2 className="text-xl font-bold">Draw a winner</h2>
                        <p className="mt-1 text-sm leading-6 text-[#6f625b]">The server selects the attendee. Confirm the result to add it to winner history.</p>
                      </div>

                      {state.status === "empty" && <p className="rounded-xl bg-[#fff4ee] p-4 text-sm text-[#6f625b]">No confirmed registrations are available yet.</p>}
                      {state.status === "exhausted" && <p className="rounded-xl bg-[#fff4ee] p-4 text-sm text-[#6f625b]">All eligible attendees have already won.</p>}
                      {state.status === "drawing" && <p role="status" className="text-sm text-[#6f625b]">Selecting an attendee...</p>}
                      {state.status === "reconciling" && <p role="status" className="text-sm text-[#6f625b]">Updating raffle...</p>}
                      {state.status === "spinning" && <p role="status" className="text-sm text-[#6f625b]">Spinning to the selected attendee...</p>}

                      {currentWinner && (
                        <div className="rounded-2xl bg-[#fff4ee] p-5" aria-live="polite">
                          <p className="text-xs font-bold tracking-[0.08em] text-[#9a4a23] uppercase">
                            {state.status === "confirmed" ? "Confirmed winner" : "Selected attendee"}
                          </p>
                          <p className="mt-2 break-words text-2xl font-bold text-[#25170f]">{attendeeName(currentWinner)}</p>
                          <p className="mt-1 text-sm text-[#6f625b]">{currentWinner.masked_email}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      {canConfirm(state) || state.status === "confirming" || state.status === "cancelling" ? (
                        <>
                          <Button type="button" className="w-full" disabled={!canConfirm(state) || busy} onClick={confirm}>
                            {state.status === "confirming" && <LoaderCircle className="animate-spin" />}
                            {state.status === "confirming" ? "Confirming..." : "Confirm Winner"}
                          </Button>
                          <Button type="button" variant="secondary" className="w-full" disabled={!canCancel(state) || busy} onClick={drawAgain}>
                            {state.status === "cancelling" ? <LoaderCircle className="animate-spin" /> : <RotateCcw />}
                            {state.status === "cancelling" ? "Cancelling..." : "Draw Again"}
                          </Button>
                        </>
                      ) : (
                        <Button type="button" className="w-full" disabled={!canStartDraw(state) || busy} onClick={spin}>
                          {state.status === "drawing" ? <LoaderCircle className="animate-spin" /> : <Dice5 />}
                          {state.status === "drawing" ? "Selecting..." : "Spin Wheel"}
                        </Button>
                      )}
                      {state.status === "pending" && <p className="text-center text-xs text-[#6f625b]">Confirm this attendee or cancel the draw to try again.</p>}
                    </div>
                  </Card>
                </div>

                <Card className="overflow-hidden border border-[#ffdece]">
                  <div className="flex items-center gap-3 border-b border-[#ffdece] px-5 py-4 sm:px-7">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-[#fff4ee] text-[#f6671e]"><Trophy className="size-5" aria-hidden="true" /></span>
                    <div><h2 className="font-bold">Winner history</h2><p className="text-xs text-[#6f625b]">Most recent winners first</p></div>
                  </div>
                  {state.winners.length === 0 ? (
                    <p className="px-5 py-10 text-center text-sm text-[#6f625b]">No winners have been confirmed yet.</p>
                  ) : (
                    <ol className="divide-y divide-[#ffdece]/70">
                      {state.winners.map((winner, index) => (
                        <li key={winner.id} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                          <div className="flex items-center gap-3"><span className="w-7 text-sm font-bold text-[#f6671e]">{index + 1}.</span><span className="font-semibold">{attendeeName(winner)}</span></div>
                          <div className="pl-10 text-xs text-[#6f625b] sm:pl-0 sm:text-right"><span className="block">{winner.masked_email}</span><time dateTime={winner.won_at}>{new Date(winner.won_at).toLocaleString()}</time></div>
                        </li>
                      ))}
                    </ol>
                  )}
                </Card>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function EventRafflePage() {
  const { id } = useParams();
  return <RoleGate>{({ user, logout }) => <RaffleShell key={JSON.stringify(getRaffleCacheKey(user.id, id))} eventId={id} user={user} logout={logout} />}</RoleGate>;
}
