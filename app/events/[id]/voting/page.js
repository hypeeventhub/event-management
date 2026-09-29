"use client";

import { ArrowLeft, CircleAlert, LoaderCircle, Plus, Vote } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import useSWR from "swr";

import { RoleGate } from "@/components/auth/role-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VotingQrDialog } from "@/components/voting/voting-qr-dialog";
import { VotingSubjectCard } from "@/components/voting/voting-subject-card";
import { VotingSubjectForm } from "@/components/voting/voting-subject-form";
import api from "@/lib/api";
import { restoreDialogFocus } from "@/lib/dialog-focus.mjs";
import { getVotingSubjectUrl } from "@/lib/voting-subjects.mjs";

const confirmCopy = {
  activate: { title: "Activate voting?", description: "This ballot will become available to voters. Its title and contestants can no longer be edited.", button: "Activate voting" },
  close: { title: "Close voting?", description: "Voters will no longer be able to cast votes for this subject.", button: "Close voting" },
  delete: { title: "Delete this draft?", description: "This voting subject and its contestants will be removed.", button: "Delete subject" },
};

function VotingManagement({ eventSlug, userId }) {
  const endpoint = `/api/events/${encodeURIComponent(eventSlug)}/voting-subjects`;
  const { data: subjects, error, isLoading, mutate } = useSWR([endpoint, String(userId)], ([url]) => api.get(url).then((response) => response.data.data), { revalidateOnFocus: false });
  const { data: event } = useSWR([`/api/events/${encodeURIComponent(eventSlug)}`, String(userId)], ([url]) => api.get(url).then((response) => response.data.data), { revalidateOnFocus: false });
  const [formMode, setFormMode] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [qrSubject, setQrSubject] = useState(null);
  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState("");
  const dialogOpenerRef = useRef(null);
  const createButtonRef = useRef(null);

  function restoreFocus(event) {
    restoreDialogFocus(event, dialogOpenerRef.current, createButtonRef.current);
  }

  function openForm(subject, opener) {
    dialogOpenerRef.current = opener;
    setFormMode({ subject });
  }

  async function saveSubject(payload) {
    if (formMode?.subject) await api.patch(getVotingSubjectUrl(eventSlug, formMode.subject.slug), payload);
    else await api.post(endpoint, payload);
    try { await mutate(); }
    catch { setActionError("The subject was saved, but the list could not be refreshed. Reload the page to see the latest version."); }
    setFormMode(null);
  }

  async function confirmAction() {
    if (!confirmation || busy) return;
    const { subject, action } = confirmation;
    setBusy({ id: subject.id, action });
    setActionError("");
    try {
      const url = getVotingSubjectUrl(eventSlug, subject.slug);
      if (action === "delete") await api.delete(url);
      else await api.post(`${url}/${action}`);
      setConfirmation(null);
      try { await mutate(); }
      catch { setActionError("The change was saved, but the list could not be refreshed. Reload the page to see the latest version."); }
    } catch (requestError) {
      setActionError(requestError.response?.data?.message || `The subject could not be ${action === "delete" ? "deleted" : action === "close" ? "closed" : "activated"}. Try again.`);
    } finally {
      setBusy(null);
    }
  }

  const title = event?.title || "Event voting";
  return (
    <main className="min-h-screen bg-[#fffaf7] px-4 py-5 text-[#25170f] sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="space-y-5">
          <Button asChild variant="ghost" size="sm"><Link href="/"><ArrowLeft /> Dashboard</Link></Button>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-xs font-bold tracking-[0.12em] text-[#f6671e] uppercase">Voting management</p><h1 className="mt-1 break-words text-3xl font-bold sm:text-4xl">{title}</h1><p className="mt-2 text-sm text-[#6f625b]">Create ballots, share voting links, and follow the results.</p></div>
            <Button ref={createButtonRef} type="button" onClick={(event) => openForm(null, event.currentTarget)}><Plus /> Create subject</Button>
          </div>
        </header>

        {actionError && !confirmation && <p role="alert" className="rounded-xl bg-[#ffdad6] px-4 py-3 text-sm text-[#93000a]">{actionError}</p>}
        {isLoading && <div role="status" className="flex min-h-64 items-center justify-center gap-3 text-sm text-[#6f625b]"><LoaderCircle className="size-6 animate-spin text-[#f6671e]" /> Loading voting subjects...</div>}
        {!isLoading && error && <div role="alert" className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-[#ffdece] bg-white p-8 text-center"><CircleAlert className="size-8 text-[#ba1a1a]" /><p>The voting subjects could not be loaded.</p><Button type="button" variant="secondary" onClick={() => mutate()}>Try again</Button></div>}
        {!isLoading && !error && Array.isArray(subjects) && subjects.length === 0 && <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#f3c7b2] bg-white p-8 text-center"><div className="flex size-14 items-center justify-center rounded-2xl bg-[#ffdece] text-[#f6671e]"><Vote className="size-7" /></div><h2 className="text-xl font-bold">No voting subjects yet</h2><p className="max-w-sm text-sm text-[#6f625b]">Create a subject and add at least two contestants to get started.</p><Button type="button" onClick={(event) => openForm(null, event.currentTarget)}><Plus /> Create first subject</Button></div>}
        {!isLoading && !error && Array.isArray(subjects) && subjects.length > 0 && <section aria-label="Voting subjects" className="grid gap-4 md:grid-cols-2">{subjects.map((subject) => <VotingSubjectCard key={subject.id} subject={subject} eventSlug={eventSlug} busyAction={busy?.id === subject.id ? busy.action : null} onEdit={openForm} onConfirm={(selected, action, opener) => { dialogOpenerRef.current = opener; setActionError(""); setConfirmation({ subject: selected, action }); }} onQr={(selected, opener) => { dialogOpenerRef.current = opener; setQrSubject(selected); }} />)}</section>}
      </div>

      {formMode && <VotingSubjectForm key={formMode.subject?.id || "create"} open subject={formMode.subject} onOpenChange={(open) => { if (!open) setFormMode(null); }} onCloseAutoFocus={restoreFocus} onSave={saveSubject} />}
      <VotingQrDialog subject={qrSubject} onOpenChange={(open) => { if (!open) setQrSubject(null); }} onCloseAutoFocus={restoreFocus} />

      <Dialog open={Boolean(confirmation)} onOpenChange={(open) => { if (!open && !busy) { setConfirmation(null); setActionError(""); } }}>
        <DialogContent className="p-6" onCloseAutoFocus={restoreFocus}>
          <DialogHeader className="pr-8"><DialogTitle>{confirmation && confirmCopy[confirmation.action].title}</DialogTitle><DialogDescription>{confirmation && `${confirmation.subject.title} — ${confirmCopy[confirmation.action].description}`}</DialogDescription></DialogHeader>
          {actionError && <p role="alert" className="rounded-xl bg-[#ffdad6] px-4 py-3 text-sm text-[#93000a]">{actionError}</p>}
          <DialogFooter><Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => { setConfirmation(null); setActionError(""); }}>Cancel</Button><Button type="button" variant={confirmation?.action === "delete" ? "amber" : "default"} disabled={Boolean(busy)} onClick={confirmAction}>{busy ? "Working..." : confirmation && confirmCopy[confirmation.action].button}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function EventVotingPage() {
  const { id } = useParams();
  return <RoleGate>{({ user }) => <VotingManagement key={`${user.id}:${id}`} eventSlug={id} userId={user.id} />}</RoleGate>;
}
