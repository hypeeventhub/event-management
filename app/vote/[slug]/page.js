"use client";

import { CheckCircle2, CircleAlert, LoaderCircle, Vote } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useReducer, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPublicVoteError, loadPublicBallot, publicVoteReducer, submitPublicVote, validatePublicVote } from "@/lib/public-voting.mjs";

const initialState = {
  phase: "loading",
  ballot: null,
  registrationCode: "",
  contestantId: "",
  busy: false,
  error: null,
};

export default function PublicVotePage() {
  const { slug } = useParams();
  const [state, dispatch] = useReducer(publicVoteReducer, initialState);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (typeof slug !== "string") return;
    let current = true;
    loadPublicBallot(slug).then(
      (ballot) => { if (current) dispatch({ type: "load_success", ballot }); },
      (error) => {
        if (current) dispatch({ type: "load_error", unavailable: error.response?.status === 404, error: getPublicVoteError(error) });
      },
    );
    return () => { current = false; };
  }, [slug, retry]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (state.busy || state.phase !== "ready") return;

    const validationError = validatePublicVote(state);
    if (validationError) {
      dispatch({ type: "submit_error", error: validationError });
      return;
    }

    dispatch({ type: "submit_start" });
    try {
      const recorded = await submitPublicVote(slug, state);
      if (!recorded) throw new Error("Unexpected public voting response");
      dispatch({ type: "submit_success" });
    } catch (error) {
      const publicError = getPublicVoteError(error);
      if (error.response?.status === 404) dispatch({ type: "load_error", unavailable: true, error: publicError });
      else dispatch({ type: "submit_error", error: publicError });
    }
  }

  const codeError = state.error?.field === "registration_code" ? state.error.message : null;
  const contestantError = state.error?.field === "contestant_id" ? state.error.message : null;
  const generalError = state.error && !state.error.field ? state.error.message : null;

  return (
    <main className="min-h-screen bg-[#fffaf7] px-4 py-8 text-[#25170f] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#f6671e] text-white shadow-sm"><Vote aria-hidden="true" className="size-6" /></div>
          <span className="text-sm font-bold tracking-[0.12em] text-[#a8460d] uppercase">Event voting</span>
        </div>

        <section className="rounded-3xl border border-[#f5ded1] bg-white p-6 shadow-[0_18px_48px_-30px_rgba(122,45,8,0.35)] sm:p-8">
          {state.phase === "loading" && (
            <div role="status" className="flex min-h-60 flex-col items-center justify-center gap-3 text-center">
              <LoaderCircle aria-hidden="true" className="size-8 animate-spin text-[#f6671e]" />
              <p className="text-sm text-[#6f625b]">Loading ballot...</p>
            </div>
          )}

          {(state.phase === "error" || state.phase === "unavailable") && (
            <div className="flex min-h-60 flex-col items-center justify-center gap-4 text-center">
              <CircleAlert aria-hidden="true" className="size-10 text-[#ba1a1a]" />
              <h1 className="text-2xl font-bold">{state.phase === "unavailable" ? "Ballot unavailable" : "Could not load ballot"}</h1>
              <p role="alert" className="max-w-sm text-sm text-[#6f625b]">{state.error?.message}</p>
              {state.phase === "error" && <Button type="button" variant="secondary" onClick={() => { dispatch({ type: "load_start" }); setRetry((value) => value + 1); }}>Try again</Button>}
            </div>
          )}

          {state.phase === "success" && (
            <div role="status" className="flex min-h-60 flex-col items-center justify-center gap-4 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-[#e0f5e9] text-[#006c49]"><CheckCircle2 aria-hidden="true" className="size-9" /></div>
              <h1 className="break-words text-2xl font-bold">Vote submitted</h1>
              <p className="max-w-sm text-sm leading-6 text-[#6f625b]">Thank you for voting in {state.ballot?.title}.</p>
            </div>
          )}

          {state.phase === "ready" && (
            <>
              <p className="text-xs font-bold tracking-[0.12em] text-[#f6671e] uppercase">Cast your vote</p>
              <h1 className="mt-2 break-words text-3xl font-bold leading-tight">{state.ballot.title}</h1>
              <p className="mt-3 text-sm leading-6 text-[#6f625b]">Enter your registration code and choose one contestant.</p>

              <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
                <div className="space-y-2">
                  <label htmlFor="registration-code" className="block text-sm font-semibold">Registration code</label>
                  <Input id="registration-code" name="registration_code" type="text" autoComplete="off" autoCapitalize="characters" spellCheck={false} value={state.registrationCode} onChange={(event) => dispatch({ type: "code_change", value: event.target.value })} aria-invalid={Boolean(codeError)} aria-describedby={codeError ? "registration-code-error" : undefined} className="h-12 border border-[#ead4c7] bg-[#fffaf7] px-4 text-base uppercase focus-visible:ring-[#f6671e]" placeholder="Enter your code" disabled={state.busy} />
                  {codeError && <p id="registration-code-error" role="alert" className="text-sm text-[#ba1a1a]">{codeError}</p>}
                </div>

                <div className="space-y-2">
                  <label htmlFor="contestant" className="block text-sm font-semibold">Contestant</label>
                  <select id="contestant" name="contestant_id" value={state.contestantId} onChange={(event) => dispatch({ type: "contestant_change", value: event.target.value })} aria-invalid={Boolean(contestantError)} aria-describedby={contestantError ? "contestant-error" : undefined} disabled={state.busy} className="h-12 w-full rounded-xl border border-[#ead4c7] bg-[#fffaf7] px-4 text-base text-[#25170f] outline-none focus-visible:ring-2 focus-visible:ring-[#f6671e] disabled:opacity-50">
                    <option value="">Choose a contestant</option>
                    {state.ballot.contestants.map((contestant) => <option key={contestant.id} value={contestant.id}>{contestant.name}</option>)}
                  </select>
                  {contestantError && <p id="contestant-error" role="alert" className="text-sm text-[#ba1a1a]">{contestantError}</p>}
                </div>

                {generalError && <p role="alert" className="rounded-xl bg-[#fff1eb] px-4 py-3 text-sm text-[#a13708]">{generalError}</p>}
                <Button type="submit" size="lg" disabled={state.busy} className="h-12 w-full text-base focus-visible:ring-[#f6671e]">
                  {state.busy ? <><LoaderCircle aria-hidden="true" className="animate-spin" /> Submitting...</> : "Submit vote"}
                </Button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
