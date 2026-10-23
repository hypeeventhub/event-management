"use client";

import { ArrowLeft, CircleAlert, LoaderCircle, Plus, Vote } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import useSWR from "swr";

import { RoleGate } from "@/components/auth/role-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NominationForm } from "@/components/voting/nomination-form";
import { VotingQrDialog } from "@/components/voting/voting-qr-dialog";
import { VotingSubjectCard } from "@/components/voting/voting-subject-card";
import { VotingSubjectForm } from "@/components/voting/voting-subject-form";
import api from "@/lib/api";
import { restoreDialogFocus } from "@/lib/dialog-focus.mjs";
import { getNominationUrl, getPublicNominationUrl } from "@/lib/nomination-voting.mjs";
import { getVotingSubjectUrl } from "@/lib/voting-subjects.mjs";

const confirmCopy = {
  open: { title: "Open nomination?", description: "Attendees can begin nominating candidates. The title and finalist count can no longer be edited.", button: "Open nomination" },
  closeNomination: { title: "Close nomination?", description: "Candidate nominations will end. A separate voting draft will be created from the top nominees, including ties at the cutoff. At least two unique nominees are required to create a voting draft.", button: "Close nomination" },
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
  const [qrPurpose, setQrPurpose] = useState("voting");
  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const dialogOpenerRef = useRef(null);
  const createButtonRef = useRef(null);

  function restoreFocus(event) {
    restoreDialogFocus(event, dialogOpenerRef.current, createButtonRef.current);
  }

  function openForm(subject, opener, mode = subject?.mode) {
    dialogOpenerRef.current = opener;
    setActionError("");
    setFormMode({ subject, mode });
  }

  async function saveSubject(payload) {
    if (formMode?.subject) await api.patch(getVotingSubjectUrl(eventSlug, formMode.subject.slug), payload);
    else await api.post(endpoint, payload);
    try { await mutate(); }
    catch { setActionError("The subject was saved, but the list could not be refreshed. Reload the page to see the latest version."); }
    setFormMode(null);
  }

  async function saveNomination(payload) {
    let saved;
    if (formMode?.subject) {
      const response = await api.patch(getNominationUrl(eventSlug, formMode.subject.slug), payload);
      saved = response.data?.data;
    } else {
      const response = await api.post(getNominationUrl(eventSlug), payload);
      saved = response.data?.data;
    }
    let refreshed;
    try { refreshed = await mutate(); }
    catch { setActionError("The nomination was saved, but the list could not be refreshed. Reload the page to see the latest version."); }
    setFormMode(null);
    if (!formMode?.subject) {
      const created = saved?.slug ? saved : refreshed?.find((item) => item.mode === "nomination" && item.title === payload.title);
      if (created?.slug) {
        setQrPurpose("nomination");
        setQrSubject({ ...created, public_url: getPublicNominationUrl(created.slug, window.location.origin) });
      } else {
        setActionError("The nomination was created, but its QR link could not be prepared. Use the QR code action on its card.");
      }
    }
  }

  async function confirmAction() {
    if (!confirmation || busy) return;
    const { subject, action } = confirmation;
    setBusy({ id: subject.id, action });
    setActionError("");
    setActionNotice("");
    try {
      const nomination = subject.mode === "nomination";
      const url = nomination ? getNominationUrl(eventSlug, subject.slug) : getVotingSubjectUrl(eventSlug, subject.slug);
      if (action === "delete") await api.delete(url);
      else {
        const response = await api.post(`${url}/${action}`);
        if (nomination && action === "close") {
          const closed = response.data.data;
          const generated = closed.generated_subject;
          await mutate((current) => {
            const updated = (current || []).map((item) => item.id === closed.id ? closed : item);
            return generated && !updated.some((item) => item.id === generated.id) ? [...updated, generated] : updated;
          }, { revalidate: false });
          setActionNotice("Nomination closed. Review the generated voting draft before activating it.");
        }
      }
      setConfirmation(null);
      try { await mutate(); }
      catch { setActionError("The change was saved, but the list could not be refreshed. Reload the page to see the latest version."); }
    } catch (requestError) {
      setActionError(requestError.response?.data?.message || `The ${subject.mode === "nomination" ? "nomination" : "subject"} could not be ${action === "delete" ? "deleted" : action === "close" ? "closed" : action === "open" ? "opened" : "activated"}. Try again.`);
    } finally {
      setBusy(null);
    }
  }

  const title = event?.title || "Event voting";
  const confirmationCopy = confirmation && confirmCopy[confirmation.subject.mode === "nomination" && confirmation.action === "close" ? "closeNomination" : confirmation.action];
  return (
    <main className="min-h-screen bg-[#fffaf7] px-4 py-5 text-[#25170f] sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="space-y-5">
          <Button asChild variant="ghost" size="sm"><Link href="/"><ArrowLeft /> Dashboard</Link></Button>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-xs font-bold tracking-[0.12em] text-[#f6671e] uppercase">Voting management</p><h1 className="mt-1 break-words text-3xl font-bold sm:text-4xl">{title}</h1><p className="mt-2 text-sm text-[#6f625b]">Create ballots, share voting links, and follow the results.</p></div>
            <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={(event) => openForm(null, event.currentTarget, "nomination")}><Plus /> Create nomination</Button><Button ref={createButtonRef} type="button" onClick={(event) => openForm(null, event.currentTarget)}><Plus /> Create subject</Button></div>
          </div>
        </header>

        {actionError && !confirmation && <p role="alert" className="rounded-xl bg-[#ffdad6] px-4 py-3 text-sm text-[#93000a]">{actionError}</p>}
        {actionNotice && <p role="status" className="rounded-xl bg-[#e5f3e7] px-4 py-3 text-sm text-[#255b31]">{actionNotice}</p>}
        {isLoading && <div role="status" className="flex min-h-64 items-center justify-center gap-3 text-sm text-[#6f625b]"><LoaderCircle className="size-6 animate-spin text-[#f6671e]" /> Loading voting subjects...</div>}
        {!isLoading && error && <div role="alert" className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-[#ffdece] bg-white p-8 text-center"><CircleAlert className="size-8 text-[#ba1a1a]" /><p>The voting subjects could not be loaded.</p><Button type="button" variant="secondary" onClick={() => mutate()}>Try again</Button></div>}
        {!isLoading && !error && Array.isArray(subjects) && subjects.length === 0 && <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#f3c7b2] bg-white p-8 text-center"><div className="flex size-14 items-center justify-center rounded-2xl bg-[#ffdece] text-[#f6671e]"><Vote className="size-7" /></div><h2 className="text-xl font-bold">No voting subjects yet</h2><p className="max-w-sm text-sm text-[#6f625b]">Create a subject and add at least two contestants to get started.</p><Button type="button" onClick={(event) => openForm(null, event.currentTarget)}><Plus /> Create first subject</Button></div>}
        {!isLoading && !error && Array.isArray(subjects) && subjects.length > 0 && <section aria-label="Voting subjects" className="grid gap-4 md:grid-cols-2">{subjects.map((subject) => <VotingSubjectCard key={subject.id} subject={subject} eventSlug={eventSlug} busyAction={busy?.id === subject.id ? busy.action : null} onEdit={openForm} onConfirm={(selected, action, opener) => { dialogOpenerRef.current = opener; setActionError(""); setConfirmation({ subject: selected, action }); }} onQr={(selected, opener) => { dialogOpenerRef.current = opener; const nomination = selected.mode === "nomination"; setQrPurpose(nomination ? "nomination" : "voting"); setQrSubject(nomination ? { ...selected, public_url: getPublicNominationUrl(selected.slug, window.location.origin) } : selected); }} />)}</section>}
      </div>

      {formMode?.mode === "nomination" ? <NominationForm key={formMode.subject?.id || "create-nomination"} open subject={formMode.subject} onOpenChange={(open) => { if (!open) setFormMode(null); }} onCloseAutoFocus={restoreFocus} onSave={saveNomination} /> : formMode && <VotingSubjectForm key={formMode.subject?.id || "create"} open subject={formMode.subject} onOpenChange={(open) => { if (!open) setFormMode(null); }} onCloseAutoFocus={restoreFocus} onSave={saveSubject} />}
      <VotingQrDialog subject={qrSubject} purpose={qrPurpose} onOpenChange={(open) => { if (!open) setQrSubject(null); }} onCloseAutoFocus={restoreFocus} />

      <Dialog open={Boolean(confirmation)} onOpenChange={(open) => { if (!open && !busy) { setConfirmation(null); setActionError(""); } }}>
        <DialogContent className="p-6" onCloseAutoFocus={restoreFocus}>
          <DialogHeader className="pr-8"><DialogTitle>{confirmationCopy?.title}</DialogTitle><DialogDescription>{confirmation && `${confirmation.subject.title} — ${confirmationCopy.description}`}</DialogDescription></DialogHeader>
          {actionError && <p role="alert" className="rounded-xl bg-[#ffdad6] px-4 py-3 text-sm text-[#93000a]">{actionError}</p>}
          <DialogFooter><Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => { setConfirmation(null); setActionError(""); }}>Cancel</Button><Button type="button" variant={confirmation?.action === "delete" ? "amber" : "default"} disabled={Boolean(busy)} onClick={confirmAction}>{busy ? "Working..." : confirmationCopy?.button}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function EventVotingPage() {
  const { id } = useParams();
  return <RoleGate>{({ user }) => <VotingManagement key={`${user.id}:${id}`} eventSlug={id} userId={user.id} />}</RoleGate>;
}
