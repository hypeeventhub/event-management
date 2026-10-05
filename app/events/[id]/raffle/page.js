"use client";

import { ArrowLeft, CircleAlert, LoaderCircle, Play, Settings } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import useSWR from "swr";

import { RoleGate } from "@/components/auth/role-gate";
import { NamePicker } from "@/components/raffle/name-picker";
import { RaffleSettings } from "@/components/raffle/raffle-settings";
import { WinnerCelebrationDialog } from "@/components/raffle/winner-celebration-dialog";
import api from "@/lib/api";
import { shouldReconcileRaffleError } from "@/lib/raffle-client.mjs";
import { getRaffleTheme } from "@/lib/raffle-themes.mjs";
import { getWinnerCelebrationState } from "@/lib/winner-celebration.mjs";

function RafflePage({ eventSlug, userId }) {
  const endpoint = `/api/events/${encodeURIComponent(eventSlug)}/raffle`;
  const { data, error, isLoading, mutate } = useSWR([endpoint, String(userId)], ([url]) => api.get(url).then((response) => response.data.data), { revalidateOnFocus: false });
  const [view, setView] = useState("raffle");
  const [status, setStatus] = useState("ready");
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [pendingDraw, setPendingDraw] = useState(null);
  const [lastWinner, setLastWinner] = useState(null);
  const [actionError, setActionError] = useState("");

  const finishAnimation = useCallback(() => setStatus("pending"), []);

  async function startDraw() {
    if (!data?.entries.length || ["drawing", "spinning"].includes(status)) return;
    setActionError(""); setLastWinner(null); setStatus("drawing");
    try {
      const payload = (await api.post(`${endpoint}/draws`)).data.data;
      setPendingDraw(payload.draw); setSelectedEntry(payload.entry); setStatus("spinning");
    } catch (requestError) { setStatus("ready"); setActionError(requestError.response?.data?.message || "The draw could not be started."); }
  }

  async function confirmWinner() {
    const activeDraw = pendingDraw || data?.pending_draw?.draw;
    if (!activeDraw) return;
    setStatus("confirming"); setActionError("");
    try {
      const payload = (await api.post(`${endpoint}/draws/${activeDraw.id}/confirm`)).data.data;
      setLastWinner(payload.winner); setPendingDraw(null); setSelectedEntry(null); setStatus("confirmed"); await mutate();
    } catch (requestError) {
      if (shouldReconcileRaffleError(requestError)) {
        setPendingDraw(null); setSelectedEntry(null); setStatus("ready");
        try { await mutate(); } catch { /* Keep the safe stale-result message below. */ }
        setActionError("The raffle changed in another session. Its latest state has been loaded.");
      } else { setStatus("pending"); setActionError(requestError.response?.data?.message || "The winner could not be confirmed."); }
    }
  }

  async function drawAgain() {
    const activeDraw = pendingDraw || data?.pending_draw?.draw;
    if (!activeDraw) { setStatus("ready"); setLastWinner(null); return; }
    setStatus("cancelling"); setActionError("");
    try { await api.delete(`${endpoint}/draws/${activeDraw.id}`); setPendingDraw(null); setSelectedEntry(null); setLastWinner(null); setStatus("ready"); await mutate(); }
    catch (requestError) {
      if (shouldReconcileRaffleError(requestError)) {
        setPendingDraw(null); setSelectedEntry(null); setStatus("ready");
        try { await mutate(); } catch { /* Keep the safe stale-result message below. */ }
        setActionError("The raffle changed in another session. Its latest state has been loaded.");
      } else { setStatus("pending"); setActionError(requestError.response?.data?.message || "The draw could not be cancelled."); }
    }
  }

  async function saveSettings(payload) {
    setStatus("saving"); setActionError("");
    try { await api.put(`${endpoint}/settings`, payload); await mutate(); setView("raffle"); setStatus("ready"); setSelectedEntry(null); setLastWinner(null); }
    catch (requestError) { setStatus("ready"); setActionError(requestError.response?.data?.message || "The raffle settings could not be saved."); }
  }

  async function uploadLogo(file) {
    const formData = new FormData();
    formData.append("logo", file);
    const response = await api.post(`${endpoint}/logo`, formData);
    await mutate(response.data.data ? { ...data, settings: response.data.data.settings } : undefined, { revalidate: false });
    return response.data.data.settings.logo_url;
  }

  async function removeLogo() {
    const response = await api.delete(`${endpoint}/logo`);
    await mutate(response.data.data ? { ...data, settings: response.data.data.settings } : undefined, { revalidate: false });
  }

  if (isLoading) return <main className="flex min-h-screen items-center justify-center bg-[#6f3faa] text-white"><LoaderCircle className="size-10 animate-spin" aria-label="Loading raffle" /></main>;
  if (error || !data) return <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#6f3faa] p-6 text-center text-white"><CircleAlert className="size-10" /><p>The raffle could not be loaded.</p><Link href="/" className="rounded-full bg-white px-5 py-3 font-semibold text-[#5d3294]">Return to dashboard</Link></main>;

  if (view === "settings") return <RaffleSettings endpoint={endpoint} initialEntries={data.entries} initialSettings={data.settings} winners={data.winners} winnerPagination={data.winner_pagination} saving={status === "saving"} error={actionError} onBack={() => setView("raffle")} onSave={saveSettings} onUploadLogo={uploadLogo} onRemoveLogo={removeLogo} />;

  const theme = getRaffleTheme(data.settings.theme);
  const effectiveStatus = status === "ready" && data.pending_draw ? "pending" : status;
  const effectiveEntry = selectedEntry || data.pending_draw?.entry || null;
  const celebrationState = getWinnerCelebrationState(effectiveStatus, effectiveEntry, lastWinner);
  const busy = ["drawing", "spinning", "confirming", "cancelling"].includes(effectiveStatus);
  return (
    <main className="flex min-h-screen flex-col overflow-hidden text-white" style={{ background: theme.background }}>
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" aria-label="Back to dashboard" className="rounded-full p-3 hover:bg-white/10"><ArrowLeft /></Link>
        <div className="text-center"><p className="text-xs tracking-[.2em] uppercase text-white/65">Event raffle</p><h1 className="max-w-[55vw] truncate text-lg font-semibold sm:text-2xl">{data.event.title}</h1></div>
        <button type="button" onClick={() => setView("settings")} disabled={busy} aria-label="Raffle settings" className="rounded-full p-3 hover:bg-white/10 disabled:opacity-40"><Settings /></button>
      </header>

      {actionError && <div role="alert" className="mx-auto mt-2 flex max-w-xl items-center gap-2 rounded-lg bg-red-950/35 px-4 py-3 text-sm"><CircleAlert className="size-4" />{actionError}</div>}

      <div className="flex gap-5 flex-col items-center justify-center">
        {data.settings.logo_url && <div className="flex w-full justify-center px-4 pb-2"><Image src={data.settings.logo_url} alt={`${data.event.title} logo`} width={448} height={224} unoptimized className="h-auto w-auto max-h-20 max-w-[min(82vw,28rem)] object-contain sm:max-h-28 lg:max-h-36" /></div>}
        <NamePicker entries={data.entries} selectedEntry={effectiveEntry || lastWinner} spinning={effectiveStatus === "spinning"} speed={data.settings.speed} onAnimationEnd={finishAnimation} />
        <div className="flex min-h-24 flex-wrap items-center justify-center gap-3 px-4">
          {!celebrationState.open && <button type="button" disabled={busy || data.entries.length === 0} onClick={startDraw} className="flex items-center gap-2 rounded-full px-10 py-5 text-xl font-black text-[#382054] shadow-xl disabled:opacity-50" style={{ background: theme.accent }}>{effectiveStatus === "drawing" || effectiveStatus === "spinning" ? <LoaderCircle className="animate-spin" /> : null}{effectiveStatus === "drawing" ? "Choosing..." : effectiveStatus === "spinning" ? "Picking..." : "Pick a Name"}</button>}
        </div>
      </div>
      <WinnerCelebrationDialog
        state={celebrationState}
        theme={theme}
        confirming={effectiveStatus === "confirming"}
        cancelling={effectiveStatus === "cancelling"}
        onConfirm={confirmWinner}
        onDrawAgain={drawAgain}
        onContinue={() => { setLastWinner(null); setStatus("ready"); }}
      />
    </main>
  );
}

export default function EventRafflePage() {
  const { id } = useParams();
  return <RoleGate>{({ user }) => <RafflePage key={`${user.id}:${id}`} eventSlug={id} userId={user.id} />}</RoleGate>;
}
