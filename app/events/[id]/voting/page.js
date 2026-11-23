"use client";

import { ArrowLeft, CircleAlert, LoaderCircle, Plus, QrCode, RotateCw, Trophy, Vote } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import useSWR from "swr";

import { RoleGate } from "@/components/auth/role-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EventPollQrDialog } from "@/components/voting/event-poll-qr-dialog";
import { NominationForm } from "@/components/voting/nomination-form";
import { NominationTopicCard } from "@/components/voting/nomination-topic-card";
import { NominationTopicsForm } from "@/components/voting/nomination-topics-form";
import { VotingSubjectCard } from "@/components/voting/voting-subject-card";
import { VotingSubjectForm } from "@/components/voting/voting-subject-form";
import api from "@/lib/api";
import { restoreDialogFocus } from "@/lib/dialog-focus.mjs";
import { isEventFinished } from "@/lib/event-time.mjs";
import { getNominationTopicsUrl, getNominationUrl } from "@/lib/nomination-voting.mjs";
import { useNominationTopicUpdates } from "@/lib/use-nomination-topic-updates";
import { getEventLeaderboardHref } from "@/lib/voting-navigation.mjs";
import { getStandaloneVotingSubjectsUrl, getVotingSubjectUrl } from "@/lib/voting-subjects.mjs";

const swrOptions = { revalidateOnFocus: false };

const confirmCopy = {
  openTopicNominations: { title: "Open nominations?", description: "Attendees can submit Female and Male nominations through the event poll.", button: "Open nominations" },
  closeTopicNominations: { title: "Close nominations?", description: "Each category needs at least two distinct nominees. Both finalist ballots will open automatically in the event poll.", button: "Close nominations" },
  closeTopicVoting: { title: "Close voting?", description: "This will close both the Female and Male finalist ballots.", button: "Close both ballots" },
  open: { title: "Open nomination?", description: "Attendees can begin nominating candidates. The title and finalist count can no longer be edited.", button: "Open nomination" },
  closeNomination: { title: "Close nomination?", description: "Candidate nominations will end and a finalist voting draft will be created. Activate the draft to make it available in the event poll. At least two unique nominees are required.", button: "Close nomination" },
  activate: { title: "Activate voting?", description: "This ballot will become available to voters. Its title and contestants can no longer be edited.", button: "Activate voting" },
  close: { title: "Close voting?", description: "Voters will no longer be able to cast votes for this subject.", button: "Close voting" },
  delete: { title: "Delete this draft?", description: "This voting subject and its contestants will be removed.", button: "Delete subject" },
};

async function loadVotingData(url) {
  const response = await api.get(url);
  return response.data.data;
}

function fetchVotingData([url]) {
  return loadVotingData(url);
}

function mergeTopics(current, updated) {
  const topicsById = new Map(current.map((topic) => [topic.id, topic]));
  for (const topic of updated) topicsById.set(topic.id, topic);
  return [...topicsById.values()].sort((first, second) => first.position - second.position);
}

function LoadingVotingData({ label }) {
  return (
    <div role="status" className="flex min-h-24 items-center justify-center gap-3 text-sm text-[#6f625b]">
      <LoaderCircle className="size-6 animate-spin text-[#f6671e]" /> Loading {label}…
    </div>
  );
}

function VotingDataError({ label, onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#ffdece] bg-white p-6 text-center">
      <CircleAlert className="size-7 text-[#ba1a1a]" />
      <p>The {label} could not be loaded.</p>
      <Button type="button" variant="secondary" onClick={onRetry}>Try again</Button>
    </div>
  );
}

function VotingManagement({ eventSlug, userId }) {
  const subjectsUrl = getStandaloneVotingSubjectsUrl(eventSlug);
  const topicsUrl = getNominationTopicsUrl(eventSlug);
  const scope = String(userId);
  const { data: standaloneSubjects = [], error, isLoading, mutate: mutateSubjects } = useSWR([subjectsUrl, scope], fetchVotingData, swrOptions);
  const { data: topics, error: topicsError, isLoading: topicsLoading, isValidating: topicsRefreshing, mutate: mutateTopics } = useSWR([topicsUrl, scope], fetchVotingData, swrOptions);
  const { data: event } = useSWR([`/api/events/${encodeURIComponent(eventSlug)}`, scope], fetchVotingData, swrOptions);
  const [formMode, setFormMode] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [publicUrl, setPublicUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const dialogOpenerRef = useRef(null);
  const createButtonRef = useRef(null);
  const qrButtonRef = useRef(null);

  function restoreFocus(event) {
    restoreDialogFocus(event, dialogOpenerRef.current, createButtonRef.current ?? qrButtonRef.current);
  }

  function openForm(subject, opener, mode = subject?.mode) {
    dialogOpenerRef.current = opener;
    setActionError("");
    setActionNotice("");
    setFormMode({ subject, mode });
  }

  function openEventQr() {
    dialogOpenerRef.current = qrButtonRef.current;
    setPublicUrl(new URL(`/event-poll/${encodeURIComponent(eventSlug)}`, window.location.origin).href);
  }

  function openConfirmation(selection, opener) {
    dialogOpenerRef.current = opener;
    setActionError("");
    setActionNotice("");
    setConfirmation(selection);
  }

  function closeConfirmation() {
    setConfirmation(null);
    setActionError("");
  }

  async function refreshAfterSave(refresh) {
    try { await refresh(); }
    catch { setActionError("The change was saved, but the list could not be refreshed. Reload the page to see the latest version."); }
  }

  function refreshTopics(updated) {
    return mutateTopics(
      (current) => current && updated ? mergeTopics(current, updated) : loadVotingData(topicsUrl),
      { revalidate: false }
    );
  }

  async function saveTopicSet(payload) {
    const response = await api.post(topicsUrl, payload);
    await refreshAfterSave(() => refreshTopics(response.data.data));
    setFormMode(null);
  }

  async function saveSubject(payload) {
    if (formMode.subject) await api.patch(getVotingSubjectUrl(eventSlug, formMode.subject.slug), payload);
    else await api.post(getVotingSubjectUrl(eventSlug), payload);
    await refreshAfterSave(mutateSubjects);
    setFormMode(null);
  }

  async function saveNomination(payload) {
    await api.patch(getNominationUrl(eventSlug, formMode.subject.slug), payload);
    await refreshAfterSave(mutateSubjects);
    setFormMode(null);
  }

  async function confirmTopicAction({ topic, subject, action }) {
    if (action === "closeTopicVoting") {
      const response = await api.post(`${getNominationTopicsUrl(eventSlug, topic.id)}/close-voting`);
      setConfirmation(null);
      setActionNotice("Voting closed for both categories.");
      await refreshAfterSave(() => refreshTopics([response.data.data]));
      return;
    }

    const closing = action === "closeTopicNominations";
    const route = closing ? "close-nominations" : "open";
    const response = await api.post(`${getNominationTopicsUrl(eventSlug, topic.id)}/${route}`);
    setConfirmation(null);
    if (closing) setActionNotice("Nominations closed. Both finalist ballots were generated.");
    await refreshAfterSave(() => refreshTopics([response.data.data]));
  }

  async function confirmSubjectAction({ subject, action }) {
    const nomination = subject.mode === "nomination";
    const subjectUrl = nomination ? getNominationUrl(eventSlug, subject.slug) : getVotingSubjectUrl(eventSlug, subject.slug);
    if (action === "delete") await api.delete(subjectUrl);
    else await api.post(`${subjectUrl}/${action}`);

    setConfirmation(null);
    if (nomination && action === "close") setActionNotice("Nomination closed. Activate the finalist ballot to open it in the event poll.");
    await refreshAfterSave(mutateSubjects);
  }

  async function confirmAction() {
    if (!confirmation || busy) return;
    setBusy(true);
    setActionError("");
    try {
      if (confirmation.topic) await confirmTopicAction(confirmation);
      else await confirmSubjectAction(confirmation);
    } catch (requestError) {
      setActionError(requestError.response?.data?.message || "The change could not be completed. Try again.");
      if (confirmation.topic && requestError.response?.status === 409) {
        // Keep the stage and counts current if another admin changed the topic or a round needs more nominations.
        await mutateTopics();
      }
    } finally {
      setBusy(false);
    }
  }

  const title = event?.title || "Event voting";
  const eventFinished = isEventFinished(event?.ends_at);
  const activeTopic = topics?.find((topic) => topic.stage === "nomination_active" || topic.stage === "voting_active");
  const currentTopic = activeTopic ?? topics?.find((topic) => topic.stage !== "closed");
  const hasWaitingTopics = topics?.some((topic) => topic.stage === "draft" && topic.id !== currentTopic?.id);
  useNominationTopicUpdates(activeTopic, mutateTopics);
  const generatedVotingIds = new Set(standaloneSubjects
    .filter((subject) => subject.mode === "nomination" && subject.status === "closed" && subject.generated_subject)
    .map((subject) => subject.generated_subject.id));
  const cardSubjects = standaloneSubjects.filter((subject) => !generatedVotingIds.has(subject.id));
  const confirmationCopy = confirmation && confirmCopy[
    confirmation.subject?.mode === "nomination" && confirmation.action === "close" ? "closeNomination" : confirmation.action
  ];
  const confirmationTitle = confirmation?.topic?.title ?? confirmation?.subject?.title;

  return (
    <main className="min-h-screen bg-[#fffaf7] px-4 py-5 text-[#25170f] sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="space-y-5">
          <Button asChild variant="ghost" size="sm"><Link href="/"><ArrowLeft /> Dashboard</Link></Button>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-[0.12em] text-[#f6671e] uppercase">Voting management</p>
              <h1 className="mt-1 wrap-anywhere text-3xl font-bold sm:text-4xl">{title}</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary"><Link href={getEventLeaderboardHref(eventSlug)}><Trophy /> Event leaderboard</Link></Button>
              <Button ref={qrButtonRef} type="button" variant="secondary" onClick={openEventQr}><QrCode /> Event poll QR code</Button>
              {!eventFinished && (
                <>
                  <Button type="button" variant="secondary" onClick={(event) => openForm(null, event.currentTarget, "topics")}><Plus /> Create nomination set</Button>
                  <Button ref={createButtonRef} type="button" onClick={(event) => openForm(null, event.currentTarget)}><Plus /> Create voting subject</Button>
                </>
              )}
            </div>
          </div>
        </header>

        {actionError && !confirmation && <p role="alert" className="rounded-xl bg-[#ffdad6] px-4 py-3 text-sm text-[#93000a]">{actionError}</p>}
        {actionNotice && <p role="status" className="rounded-xl bg-[#e5f3e7] px-4 py-3 text-sm text-[#255b31]">{actionNotice}</p>}

        {topicsLoading && <LoadingVotingData label="nomination topics" />}
        {topicsError && !topics && <VotingDataError label="nomination topics" onRetry={() => mutateTopics()} />}
        {topics?.length > 0 && (
          <section aria-labelledby="nomination-topics-heading" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="nomination-topics-heading" className="text-xl font-bold">Nomination topics</h2>
              <Button type="button" variant="secondary" size="sm" disabled={busy || topicsRefreshing} onClick={() => mutateTopics()}>
                <RotateCw className={topicsRefreshing ? "animate-spin" : undefined} /> Refresh topics
              </Button>
            </div>
            {topicsError && <p role="status" className="text-sm text-[#93000a]">The topics could not be refreshed. Showing the last available counts.</p>}
            {!eventFinished && hasWaitingTopics && (
              <p className="text-sm text-[#6f625b]">Topics open in the order shown. Complete <strong className="wrap-anywhere">{currentTopic.title}</strong> before opening the next topic.</p>
            )}
            <div className="grid gap-4 lg:grid-cols-2">
              {topics.map((topic) => <NominationTopicCard key={topic.id} topic={topic} eventFinished={eventFinished} canOpen={!activeTopic && topic.id === currentTopic?.id} busy={busy} onConfirm={openConfirmation} />)}
            </div>
          </section>
        )}

        {isLoading && <LoadingVotingData label="voting subjects" />}
        {!isLoading && error && <VotingDataError label="voting subjects" onRetry={() => mutateSubjects()} />}
        {!isLoading && !error && cardSubjects.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#f3c7b2] bg-white p-6 text-center sm:p-8">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-[#ffdece] text-[#f6671e]"><Vote className="size-7" /></div>
            <h2 className="text-xl font-bold">No standalone voting subjects yet</h2>
            <p className="max-w-sm text-sm text-[#6f625b]">{eventFinished ? "No standalone voting subjects were created for this event." : "Create a subject and add at least two contestants to get started."}</p>
            {!eventFinished && <Button type="button" onClick={(event) => openForm(null, event.currentTarget)}><Plus /> Create first subject</Button>}
          </div>
        )}
        {!isLoading && !error && cardSubjects.length > 0 && (
          <section aria-label="Standalone voting subjects" className="grid gap-4 md:grid-cols-2">
            {cardSubjects.map((subject) => {
              const actionSubject = subject.mode === "nomination" && subject.status === "closed" && subject.generated_subject
                ? subject.generated_subject
                : subject;
              return (
                <VotingSubjectCard
                  key={subject.id}
                  subject={subject}
                  eventSlug={eventSlug}
                  readOnly={eventFinished}
                  busyAction={busy && confirmation?.subject?.id === actionSubject.id ? confirmation.action : null}
                  onEdit={openForm}
                  onConfirm={(subject, action, opener) => openConfirmation({ subject, action }, opener)}
                />
              );
            })}
          </section>
        )}
      </div>

      {formMode?.mode === "topics" && <NominationTopicsForm onOpenChange={(open) => { if (!open) setFormMode(null); }} onCloseAutoFocus={restoreFocus} onSave={saveTopicSet} />}
      {formMode?.mode === "nomination" && <NominationForm key={formMode.subject.id} open subject={formMode.subject} onOpenChange={(open) => { if (!open) setFormMode(null); }} onCloseAutoFocus={restoreFocus} onSave={saveNomination} />}
      {formMode && formMode.mode !== "topics" && formMode.mode !== "nomination" && <VotingSubjectForm key={formMode.subject?.id || "create"} open subject={formMode.subject} onOpenChange={(open) => { if (!open) setFormMode(null); }} onCloseAutoFocus={restoreFocus} onSave={saveSubject} />}
      <EventPollQrDialog title={title} publicUrl={publicUrl} onOpenChange={(open) => { if (!open) setPublicUrl(""); }} onCloseAutoFocus={restoreFocus} />

      <Dialog open={Boolean(confirmation)} onOpenChange={(open) => { if (!open && !busy) closeConfirmation(); }}>
        <DialogContent className="gap-4 p-6" onCloseAutoFocus={restoreFocus} showCloseButton={!busy}>
          <DialogHeader className="pr-8">
            <DialogTitle>{confirmationCopy?.title}</DialogTitle>
            <DialogDescription className="wrap-anywhere">
              {confirmationTitle}
              {confirmation?.category && ` · ${confirmation.category}`}
              {confirmationCopy && ` — ${confirmationCopy.description}`}
            </DialogDescription>
          </DialogHeader>
          {actionError && <p role="alert" className="rounded-xl bg-[#ffdad6] px-4 py-3 text-sm text-[#93000a]">{actionError}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={busy} onClick={closeConfirmation}>Cancel</Button>
            <Button type="button" variant={confirmation?.action === "delete" ? "amber" : "default"} disabled={busy} onClick={confirmAction}>{busy ? "Working..." : confirmationCopy?.button}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function EventVotingPage() {
  const { id } = useParams();
  return <RoleGate>{({ user }) => <VotingManagement key={`${user.id}:${id}`} eventSlug={id} userId={user.id} />}</RoleGate>;
}
