"use client";

import { ArrowRight, CircleAlert, Clock3, LoaderCircle, RefreshCw, Vote } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PublicTopicNominationForm } from "@/components/voting/public-topic-nomination-form";
import { PublicTopicVoteForm } from "@/components/voting/public-topic-vote-form";
import { loadPublicEventPoll } from "@/lib/event-poll.mjs";

const idleCopy = {
  waiting: ["Waiting for a round to open", "Check back when the organizer opens nominations or voting."],
  closed: ["The round has closed", "Keep this link to check for the next round."],
  empty: ["No rounds are available", "The organizer has not set up a poll for this event yet."],
};

const panelClass = "rounded-3xl border border-[#f5ded1] shadow-[0_18px_48px_-30px_rgba(122,45,8,0.35)]";

function StandaloneRounds({ title, path, rounds }) {
  if (rounds.length === 0) return null;

  return (
    <Card className={panelClass}>
      <CardContent className="p-5 sm:p-7">
        <h2 className="text-lg font-bold">{title}</h2>
        <ul className="mt-4 space-y-2.5">
          {rounds.map((round) => (
            <li key={round.slug}>
              <Button asChild variant="secondary" className="h-auto min-h-12 w-full justify-between px-3.5 py-3 text-left whitespace-normal focus-visible:ring-[#a8460d]">
                <Link href={`/${path}/${encodeURIComponent(round.slug)}`} prefetch={false}>
                  <span className="min-w-0 wrap-break-word">{round.title}</span>
                  <ArrowRight aria-hidden="true" className="shrink-0 text-[#a8460d]" />
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function PublicEventPoll({ eventSlug }) {
  const { data: poll, error, isValidating, mutate } = useSWR(
    ["public-event-poll", eventSlug],
    ([, slug]) => loadPublicEventPoll(slug),
    { shouldRetryOnError: false },
  );
  const missing = error?.status === 404;
  const idle = poll && idleCopy[poll.stage];
  const nomination = poll?.stage === "nomination_active";
  const TopicForm = nomination ? PublicTopicNominationForm : PublicTopicVoteForm;

  function refreshPoll() {
    void mutate();
  }

  return (
    <main className="min-h-screen bg-[#fffaf7] px-4 py-7 text-[#25170f] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#f6671e] text-white shadow-sm">
                <Vote aria-hidden="true" className="size-6" />
              </div>
              <span className="text-sm font-bold tracking-[0.12em] text-[#a8460d] uppercase">Event poll</span>
            </div>
            {poll && !missing && (
              <Button type="button" variant="secondary" onClick={refreshPoll} disabled={isValidating} className="focus-visible:ring-[#a8460d]">
                <RefreshCw aria-hidden="true" className={isValidating ? "motion-safe:animate-spin" : undefined} />
                Refresh poll
              </Button>
            )}
          </div>
          {poll && !missing && <h1 className="wrap-break-word text-3xl leading-tight font-bold sm:text-4xl">{poll.title}</h1>}
          {(!poll || missing) && <h1 className="sr-only">Event poll</h1>}
        </header>

        {!poll && !error && (
          <Card className={panelClass}>
            <CardContent role="status" className="flex min-h-40 items-center justify-center gap-2.5 px-4 text-sm text-[#6f625b]">
              <LoaderCircle aria-hidden="true" className="size-5 text-[#a8460d] motion-safe:animate-spin" /> Loading event poll…
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className={panelClass}>
            <CardContent className="flex items-start gap-3 p-5 sm:p-7">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#ba1a1a]" />
              <div className="space-y-2">
                <h2 className="text-lg font-bold">{missing ? "Event poll unavailable" : "Could not load the latest poll"}</h2>
                <p role="alert" className="text-sm text-[#6f625b]">
                  {missing
                    ? "Check the link or ask the organizer."
                    : error.status === 429 ? "Too many requests. Wait a moment, then try again." : "Check your connection and try again."}
                </p>
                {!missing && !poll && <Button type="button" variant="secondary" onClick={refreshPoll} disabled={isValidating}>Try again</Button>}
              </div>
            </CardContent>
          </Card>
        )}

        {!missing && poll?.topic && (
          <section aria-labelledby="poll-topic-title">
            <Card className={panelClass}>
              <CardContent className="p-5 sm:p-7">
                <p className="text-xs font-bold tracking-[0.08em] text-[#a8460d] uppercase">{nomination ? "Nominations open" : "Voting open"}</p>
                <h2 id="poll-topic-title" className="mt-1.5 wrap-break-word text-2xl font-bold">{poll.topic.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#6f625b]">
                  {nomination
                    ? "Search checked-in attendees and choose one nominee in each category."
                    : "Choose one finalist in each category."}
                </p>
                <TopicForm key={`${poll.topic.id}:${poll.stage}`} eventSlug={eventSlug} topic={poll.topic} onPollRefresh={refreshPoll} />
              </CardContent>
            </Card>
          </section>
        )}

        {!missing && idle && (
          <Card className={panelClass}>
            <CardContent role="status" className="flex items-start gap-3 p-5 sm:p-7">
              <Clock3 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#a8460d]" />
              <div>
                <h2 className="text-lg font-bold">{idle[0]}</h2>
                <p className="mt-1 text-sm leading-6 text-[#6f625b]">{idle[1]}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {!missing && poll && (
          <>
            <StandaloneRounds title="Voting ballots" path="vote" rounds={poll.manualBallots} />
            <StandaloneRounds title="Nomination rounds" path="nomination" rounds={poll.standaloneNominations} />
          </>
        )}
      </div>
    </main>
  );
}
