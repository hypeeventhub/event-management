"use client";

import { CheckCircle2, LoaderCircle, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PublicTopicPairForm } from "@/components/voting/public-topic-vote-form";
import { TOPIC_CATEGORIES } from "@/lib/event-poll.mjs";
import { getPublicNominationError, searchPublicNominationCandidates } from "@/lib/public-nomination.mjs";

function NomineeSearch({ category, slug, error, clearFieldError, onPollRefresh, otherLabel, otherSelectedId, onSelectionChange }) {
  const id = useId();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  const field = `${category.key}_attendee_id`;
  const search = selected ? "" : query.trim();
  const searchResult = result?.query === search ? result : null;

  useEffect(() => {
    if (!search) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const candidates = await searchPublicNominationCandidates(slug, search, { signal: controller.signal });
        if (!controller.signal.aborted) setResult({ query: search, candidates });
      } catch (failure) {
        if (!controller.signal.aborted) {
          setResult({
            query: search,
            error: getPublicNominationError(failure).message,
            closed: failure.response?.status === 404,
          });
        }
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [retry, search, slug]);

  function selectCandidate(candidate) {
    setSelected(candidate);
    setQuery(candidate.full_name);
    setResult(null);
    onSelectionChange(candidate.id);
    clearFieldError(field);
    inputRef.current?.focus();
  }

  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold">{category.label} nominee</label>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#6f625b]" />
        <Input
          id={id}
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            if (selected || value.trim() !== search) {
              setSelected(null);
              onSelectionChange(null);
              setResult(null);
              clearFieldError(field);
            }
          }}
          autoComplete="off"
          maxLength={511}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          placeholder="Search by attendee name"
          className="h-12 border border-[#ead4c7] bg-[#fffaf7] pl-9 text-base focus-visible:ring-[#f6671e]"
        />
        <input type="hidden" name={field} value={selected?.id ?? ""} />
      </div>

      {error && <p id={`${id}-error`} role="alert" className="text-sm text-[#ba1a1a]">{error}</p>}
      {selected && (
        <p role="status" className="flex items-center gap-2 text-sm text-[#006c49]">
          <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
          <span className="wrap-break-word">{selected.full_name} selected</span>
        </p>
      )}
      {search && !searchResult && (
        <p role="status" className="flex items-center gap-2 text-sm text-[#6f625b]">
          <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" /> Searching attendees…
        </p>
      )}
      {searchResult?.error && (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-[#ba1a1a]">{searchResult.closed ? "This nomination round has closed." : searchResult.error}</p>
          <Button type="button" variant="secondary" size="sm" onClick={searchResult.closed ? onPollRefresh : () => {
            setResult(null);
            setRetry((value) => value + 1);
          }}>
            {searchResult.closed ? "Refresh poll" : "Retry search"}
          </Button>
        </div>
      )}
      {searchResult?.candidates?.length === 0 && (
        <p role="status" className="text-sm text-[#6f625b]">No checked-in attendees matched. Try another spelling.</p>
      )}
      {searchResult?.candidates?.length > 0 && (
        <ul aria-label={`Matching attendees for ${category.label} nominee`} className="max-h-52 divide-y divide-[#f5ded1] overflow-y-auto rounded-xl border border-[#f5ded1]">
          {searchResult.candidates.map((candidate) => (
            <li key={candidate.id}>
              <Button
                type="button"
                variant="ghost"
                disabled={String(candidate.id) === String(otherSelectedId)}
                onClick={() => selectCandidate(candidate)}
                className="h-auto min-h-11 w-full justify-start rounded-none px-3 text-left whitespace-normal text-[#25170f] focus-visible:ring-inset"
              >
                <span className="min-w-0 wrap-break-word">
                  {candidate.full_name}
                  {String(candidate.id) === String(otherSelectedId) && <span className="block text-xs text-[#6f625b]">Already selected as the {otherLabel} nominee</span>}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PublicTopicNominationForm({ eventSlug, topic, onPollRefresh }) {
  const [selectedIds, setSelectedIds] = useState({ female: null, male: null });

  return (
    <PublicTopicPairForm eventSlug={eventSlug} topicId={topic.id} kind="nominations" onPollRefresh={onPollRefresh}>
      {({ errors, clearFieldError }) => (
        <div className="grid items-start gap-4 sm:grid-cols-2">
          {TOPIC_CATEGORIES.map((category) => (
            <NomineeSearch
              key={category.key}
              category={category}
              slug={topic.subjectSlugs[category.key]}
              error={errors?.[`${category.key}_attendee_id`]}
              clearFieldError={clearFieldError}
              onPollRefresh={onPollRefresh}
              otherLabel={TOPIC_CATEGORIES.find(({ key }) => key !== category.key).label}
              otherSelectedId={selectedIds[TOPIC_CATEGORIES.find(({ key }) => key !== category.key).key]}
              onSelectionChange={(attendeeId) => setSelectedIds((current) => ({ ...current, [category.key]: attendeeId }))}
            />
          ))}
        </div>
      )}
    </PublicTopicPairForm>
  );
}
