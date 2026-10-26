"use client";

import { CheckCircle2, CircleAlert, LoaderCircle, Search, UserRound, Vote } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getPublicNominationError,
  loadPublicNomination,
  nominationSuggestion,
  searchPublicNominationCandidates,
  submitPublicNomination,
  validatePublicNomination,
} from "@/lib/public-nomination.mjs";

function isOpen(status) {
  return status === "active" || status === "open";
}

export function PublicNominationForm({ slug }) {
  const [phase, setPhase] = useState("loading");
  const [nomination, setNomination] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selected, setSelected] = useState(null);
  const [registrationCode, setRegistrationCode] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    loadPublicNomination(slug).then((loaded) => {
      if (!current) return;
      setNomination(loaded);
      setPhase("ready");
      setLoadError("");
    }).catch((error) => {
      if (!current) return;
      const mapped = getPublicNominationError(error);
      setLoadError(mapped.message);
      setPhase(error.response?.status === 404 ? "unavailable" : "error");
    });
    return () => { current = false; };
  }, [slug, retry]);

  useEffect(() => {
    const search = query.trim();
    if (!search || !nomination || !isOpen(nomination.status)) return undefined;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      searchPublicNominationCandidates(slug, search, { signal: controller.signal }).then((results) => {
        setCandidates(results);
      }).catch((error) => {
        if (controller.signal.aborted) return;
        setCandidates([]);
        setSearchError(getPublicNominationError(error).message);
      }).finally(() => {
        if (!controller.signal.aborted) setSearching(false);
      });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [nomination, query, slug]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy || phase !== "ready" || !nomination || !isOpen(nomination.status)) return;
    const validation = validatePublicNomination({ selectedAttendee: selected, registrationCode });
    if (validation) {
      setSubmitError(validation);
      return;
    }

    setBusy(true);
    setSubmitError(null);
    try {
      await submitPublicNomination(slug, { attendeeId: selected.id, registrationCode });
      setPhase("success");
    } catch (error) {
      setSubmitError(getPublicNominationError(error));
    } finally {
      setBusy(false);
    }
  }

  const suggestion = nominationSuggestion(query, candidates);
  const errorMessage = submitError?.message;

  return (
    <main className="min-h-screen bg-[#fffaf7] px-4 py-8 text-[#25170f] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#f6671e] text-white shadow-sm"><Vote aria-hidden="true" className="size-6" /></div>
          <span className="text-sm font-bold tracking-[0.12em] text-[#a8460d] uppercase">Event nomination</span>
        </div>

        <section className="rounded-3xl border border-[#f5ded1] bg-white p-6 shadow-[0_18px_48px_-30px_rgba(122,45,8,0.35)] sm:p-8">
          {phase === "loading" && (
            <div role="status" className="flex min-h-60 flex-col items-center justify-center gap-3 text-center">
              <LoaderCircle aria-hidden="true" className="size-8 animate-spin text-[#f6671e]" />
              <p className="text-sm text-[#6f625b]">Loading nomination...</p>
            </div>
          )}

          {(phase === "error" || phase === "unavailable") && (
            <div className="flex min-h-60 flex-col items-center justify-center gap-4 text-center">
              <CircleAlert aria-hidden="true" className="size-10 text-[#ba1a1a]" />
              <h1 className="text-2xl font-bold">{phase === "unavailable" ? "Nomination unavailable" : "Could not load nomination"}</h1>
              <p role="alert" className="max-w-sm text-sm text-[#6f625b]">{loadError}</p>
              {phase === "error" && <Button type="button" variant="secondary" onClick={() => { setPhase("loading"); setRetry((value) => value + 1); }}>Try again</Button>}
            </div>
          )}

          {phase === "success" && (
            <div role="status" className="flex min-h-60 flex-col items-center justify-center gap-4 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-[#e0f5e9] text-[#006c49]"><CheckCircle2 aria-hidden="true" className="size-9" /></div>
              <h1 className="break-words text-2xl font-bold">Nomination submitted</h1>
              <p className="max-w-sm text-sm leading-6 text-[#6f625b]">Thank you for participating in {nomination?.title}.</p>
            </div>
          )}

          {phase === "ready" && nomination && (
            <>
              <p className="text-xs font-bold tracking-[0.12em] text-[#f6671e] uppercase">Nominate a candidate</p>
              <h1 className="mt-2 break-words text-3xl font-bold leading-tight">{nomination.title}</h1>
              {!isOpen(nomination.status) ? (
                <div role="status" className="mt-6 rounded-2xl border border-[#ffdece] bg-[#fff4ee] p-4 text-sm leading-6 text-[#6f625b]">
                  Nominations are not open right now. Please check back with the event organizer.
                </div>
              ) : (
                <>
                  <p className="mt-3 text-sm leading-6 text-[#6f625b]">Enter your registration code first, then search for the attendee you would like to nominate.</p>
                  <form className="mt-7 space-y-6" onSubmit={handleSubmit} noValidate>
                    <div className="space-y-2">
                      <label htmlFor="registration-code" className="block text-sm font-semibold">Your registration code</label>
                      <Input id="registration-code" name="registration_code" type="text" autoComplete="off" autoCapitalize="characters" spellCheck={false} value={registrationCode} onChange={(event) => { setRegistrationCode(event.target.value); setSubmitError((current) => current?.field === "registration_code" ? null : current); }} aria-invalid={submitError?.field === "registration_code"} aria-describedby={submitError?.field === "registration_code" ? "registration-code-error" : undefined} className="h-12 border border-[#ead4c7] bg-[#fffaf7] px-4 text-base uppercase focus-visible:ring-[#f6671e]" placeholder="Enter your code" disabled={busy} />
                      {submitError?.field === "registration_code" && <p id="registration-code-error" role="alert" className="text-sm text-[#ba1a1a]">{submitError.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="nominee-search" className="block text-sm font-semibold">Name to nominate</label>
                      <div className="relative">
                        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#96877f]" />
                        <Input id="nominee-search" type="search" autoComplete="off" value={query} onChange={(event) => { const value = event.target.value; setQuery(value); setCandidates([]); setSearching(Boolean(value.trim())); setSearchError(""); setSelected(null); setSubmitError(null); }} aria-describedby="nominee-search-help" className="h-12 border border-[#ead4c7] bg-[#fffaf7] pl-10 text-base focus-visible:ring-[#f6671e]" placeholder="Start typing an attendee name" disabled={busy} />
                      </div>
                      <p id="nominee-search-help" className="text-xs leading-5 text-[#6f625b]">You must choose a name from the matching attendees below.</p>
                      {searching && <p role="status" className="flex items-center gap-2 text-sm text-[#6f625b]"><LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Searching attendees...</p>}
                      {searchError && <p role="alert" className="text-sm text-[#ba1a1a]">{searchError}</p>}
                      {!searching && !searchError && query.trim() && candidates.length === 0 && <p role="status" className="text-sm text-[#6f625b]">No matching attendees found. Try another spelling.</p>}
                      {!searching && !searchError && candidates.length > 0 && (
                        <div className="space-y-2">
                          {suggestion && <p className="rounded-xl bg-[#fff4ee] px-3 py-2 text-sm text-[#6f625b]">Did you mean <span className="font-semibold text-[#25170f]">“{suggestion.full_name}”</span>? Select it below if that is who you mean.</p>}
                          <ul aria-label="Matching attendees" className="max-h-56 divide-y divide-[#ffdece] overflow-y-auto rounded-xl border border-[#ffdece]">
                            {candidates.map((candidate) => {
                              const chosen = selected && String(selected.id) === String(candidate.id);
                              return <li key={candidate.id}><button type="button" disabled={busy} aria-pressed={Boolean(chosen)} onClick={() => { setSelected(candidate); setSubmitError(null); }} className={`flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-[#fff4ee] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#f6671e] ${chosen ? "bg-[#fff4ee] font-semibold text-[#a8460d]" : "text-[#25170f]"}`}><UserRound aria-hidden="true" className="size-4 shrink-0 text-[#f6671e]" /><span className="min-w-0 break-words">{candidate.full_name}</span>{chosen && <CheckCircle2 aria-hidden="true" className="ml-auto size-4 shrink-0" />}</button></li>;
                            })}
                          </ul>
                        </div>
                      )}
                    </div>

                    {selected && (
                      <div className="space-y-3 rounded-2xl border border-[#ffdece] bg-[#fffaf7] p-4">
                        <p className="text-xs font-semibold tracking-wide text-[#6f625b] uppercase">Your selected nominee</p>
                        <p className="break-words text-lg font-bold">{selected.full_name}</p>
                      </div>
                    )}

                    {errorMessage && !submitError?.field && <p role="alert" className="rounded-xl bg-[#fff1eb] px-4 py-3 text-sm text-[#a13708]">{errorMessage}</p>}
                    <Button type="submit" size="lg" disabled={busy || searching || !selected} className="h-12 w-full text-base focus-visible:ring-[#f6671e]">
                      {busy ? <><LoaderCircle aria-hidden="true" className="animate-spin" /> Submitting...</> : "Submit nomination"}
                    </Button>
                  </form>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
