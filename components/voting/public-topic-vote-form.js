"use client";

import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useId, useState } from "react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitPublicTopicPair, TOPIC_CATEGORIES } from "@/lib/event-poll.mjs";
import { loadPublicBallot } from "@/lib/public-voting.mjs";

const fieldClass = "h-12 border border-[#ead4c7] bg-[#fffaf7] px-3 text-base focus-visible:ring-[#f6671e]";

export function PublicTopicPairForm({ eventSlug, topicId, kind, onPollRefresh, children }) {
  const codeId = useId();
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const nomination = kind === "nominations";
  const codeError = error?.fields?.registration_code;

  function clearFieldError(field) {
    setError((current) => {
      if (!current || current.closed) return current;
      const fields = { ...current.fields };
      delete fields[field];
      return { fields };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy || error?.closed) return;

    const formData = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const failure = await submitPublicTopicPair(eventSlug, topicId, kind, formData);
      if (failure) setError(failure);
      else setSubmitted(true);
    } catch {
      setError({ message: "Could not submit your choices. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div role="status" className="mt-6 flex items-center gap-3 rounded-xl bg-[#e0f5e9] px-4 py-3.5 font-semibold text-[#006c49]">
        <CheckCircle2 aria-hidden="true" className="size-5 shrink-0" />
        {nomination ? "Both nominations were submitted." : "Both votes were recorded."}
      </div>
    );
  }

  return (
    <form className="mt-6" onSubmit={handleSubmit} noValidate>
      <fieldset disabled={busy || error?.closed} className="min-w-0 space-y-5">
        <div className="max-w-sm space-y-2">
          <label htmlFor={codeId} className="block text-sm font-semibold">Registration code</label>
          <Input
            id={codeId}
            name="registration_code"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            maxLength={255}
            placeholder="Enter your code"
            onChange={() => clearFieldError("registration_code")}
            aria-invalid={Boolean(codeError)}
            aria-describedby={codeError ? `${codeId}-error` : undefined}
            className={`${fieldClass} uppercase`}
          />
          {codeError && <p id={`${codeId}-error`} role="alert" className="text-sm text-[#ba1a1a]">{codeError}</p>}
        </div>

        {children({ errors: error?.fields, clearFieldError })}

        <Button type="submit" size="lg" className="h-12 w-full bg-[#a8460d] text-base hover:bg-[#873709] focus-visible:ring-[#a8460d] sm:w-auto">
          {busy
            ? <><LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /> Submitting…</>
            : nomination ? "Submit nominations" : "Submit votes"}
        </Button>
      </fieldset>
      {error?.message && <p role="alert" className="mt-4 rounded-xl bg-[#fff1eb] px-4 py-3 text-sm text-[#a13708]">{error.message}</p>}
      {error?.closed && <Button type="button" variant="secondary" className="mt-3" onClick={onPollRefresh}>Refresh poll</Button>}
    </form>
  );
}

function FinalistSelect({ category, contestants, error, clearFieldError }) {
  const id = useId();
  const field = `${category.key}_contestant_id`;

  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold">{category.label} finalist</label>
      <select
        id={id}
        name={field}
        required
        defaultValue=""
        onChange={() => clearFieldError(field)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${fieldClass} w-full rounded-xl text-[#25170f] outline-none focus-visible:ring-2`}
      >
        <option value="" disabled>Choose a finalist</option>
        {contestants.map((contestant) => <option key={contestant.id} value={contestant.id}>{contestant.name}</option>)}
      </select>
      {error && <p id={`${id}-error`} role="alert" className="text-sm text-[#ba1a1a]">{error}</p>}
    </div>
  );
}

export function PublicTopicVoteForm({ eventSlug, topic, onPollRefresh }) {
  const { female, male } = topic.subjectSlugs;
  const { data: ballots, error, isValidating, mutate } = useSWR(
    ["public-topic-finalists", female, male],
    ([, femaleSlug, maleSlug]) => Promise.all([loadPublicBallot(femaleSlug), loadPublicBallot(maleSlug)]),
    { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false },
  );

  if (error) {
    const closed = error.response?.status === 404;
    const message = closed
      ? "This round has closed. Refresh the poll for the current round."
      : error.response?.status === 429 ? "Too many requests. Wait a moment, then try again." : "Could not load both finalist lists.";
    return (
      <div className="mt-6 space-y-3">
        <p role="alert" className="text-sm text-[#ba1a1a]">{message}</p>
        <Button type="button" variant="secondary" disabled={isValidating} onClick={closed ? onPollRefresh : () => void mutate()}>
          {closed ? "Refresh poll" : "Try again"}
        </Button>
      </div>
    );
  }
  if (!ballots) {
    return <p role="status" className="mt-6 flex items-center gap-2 text-sm text-[#6f625b]"><LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" /> Loading finalists…</p>;
  }
  if (ballots.some(({ contestants }) => contestants.length === 0)) {
    return <p role="status" className="mt-6 text-sm text-[#6f625b]">Both finalist lists must be available before you can vote. Check with the organizer.</p>;
  }

  return (
    <PublicTopicPairForm eventSlug={eventSlug} topicId={topic.id} kind="votes" onPollRefresh={onPollRefresh}>
      {({ errors, clearFieldError }) => (
        <div className="grid gap-4 sm:grid-cols-2">
          {TOPIC_CATEGORIES.map((category, index) => (
            <FinalistSelect
              key={category.key}
              category={category}
              contestants={ballots[index].contestants}
              error={errors?.[`${category.key}_contestant_id`]}
              clearFieldError={clearFieldError}
            />
          ))}
        </div>
      )}
    </PublicTopicPairForm>
  );
}
