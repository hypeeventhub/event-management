"use client";

import { ArrowLeft, CircleAlert, LoaderCircle, Radio, RotateCw, Vote } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import useSWR from "swr";

import { RoleGate } from "@/components/auth/role-gate";
import { Button } from "@/components/ui/button";
import { LeaderboardRow } from "@/components/voting/leaderboard-row";
import { LeaderboardThemeSettings, useLeaderboardTheme } from "@/components/voting/leaderboard-theme-settings";
import api from "@/lib/api";
import { getNominationTopicsUrl } from "@/lib/nomination-voting.mjs";
import { useLeaderboardVisibility, useLiveLeaderboard } from "@/lib/use-live-leaderboard";
import { getLeaderboardRefreshInterval, getRankedContestants, getVotingResultsPayload } from "@/lib/voting-leaderboard.mjs";
import { getVotingHref } from "@/lib/voting-navigation.mjs";
import { getStandaloneVotingSubjectsUrl, getVotingSubjectUrl } from "@/lib/voting-subjects.mjs";

const categories = [
  { id: "female", title: "Female" },
  { id: "male", title: "Male" },
];

const subjectStatusLabels = { draft: "Not started", active: "Open", closed: "Closed" };
const connectionLabels = {
  connecting: "Connecting to live updates…",
  recovering: "Refreshing live results…",
  disconnected: "Live updates disconnected",
  unavailable: "Live updates unavailable",
};

function cannotAccess(error) {
  return [401, 403, 404].includes(error?.response?.status);
}

const requestOptions = { shouldRetryOnError: (error) => !cannotAccess(error) };

function fetchMetadata([url]) {
  return api.get(url).then((response) => response.data.data);
}

function fetchResults([url]) {
  return api.get(url).then(getVotingResultsPayload);
}

function RefreshButton({ onRefresh, refreshing, label = "Refresh" }) {
  return (
    <Button type="button" variant="ghost" onClick={onRefresh} disabled={refreshing} className="min-h-10 border border-white/35 bg-white/10 text-white hover:bg-white/20 hover:text-white focus-visible:ring-white">
      <RotateCw className={refreshing ? "motion-safe:animate-spin" : undefined} /> {label}
    </Button>
  );
}

function LoadingStandings({ children }) {
  return (
    <div role="status" className="flex min-h-48 items-center justify-center gap-3 text-lg font-semibold">
      <LoaderCircle aria-hidden="true" className="size-7 text-(--stage-accent) motion-safe:animate-spin" /> {children}
    </div>
  );
}

function StandingsNotice({ children, error, onRetry }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center gap-4 rounded-2xl border border-white/40 bg-white p-6 text-center text-[#25170f] shadow-lg sm:p-8">
      {error ? <CircleAlert aria-hidden="true" className="size-8 text-red-700" /> : <Vote aria-hidden="true" className="size-8 text-(--stage-background)" />}
      <p role={error ? "alert" : undefined} className="text-xl font-bold">{children}</p>
      {onRetry && <Button type="button" variant="secondary" onClick={onRetry}><RotateCw /> Try again</Button>}
    </div>
  );
}

function LeaderboardTabs({ label, tabs, selection, onSelect, children }) {
  const groupId = useId();
  const [focused, setFocused] = useState(null);
  const focusableTab = tabs.some((tab) => tab.id === focused) ? focused : selection;

  function moveFocus(event) {
    const index = tabs.findIndex((tab) => event.target.id === `${groupId}-${tab.id}-tab`);
    if (index < 0) return;

    let nextIndex;
    switch (event.key) {
      case "ArrowLeft": nextIndex = (index + tabs.length - 1) % tabs.length; break;
      case "ArrowRight": nextIndex = (index + 1) % tabs.length; break;
      case "Home": nextIndex = 0; break;
      case "End": nextIndex = tabs.length - 1; break;
      default: return;
    }

    event.preventDefault();
    event.currentTarget.children[nextIndex]?.focus();
  }

  return (
    <div className="min-w-0 space-y-5">
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={moveFocus}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(null); }}
        className="flex gap-2 overflow-x-auto rounded-xl border border-white/35 bg-(--stage-surface) p-2"
      >
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            id={`${groupId}-${tab.id}-tab`}
            type="button"
            variant="ghost"
            role="tab"
            aria-selected={selection === tab.id}
            aria-controls={`${groupId}-${tab.id}-panel`}
            tabIndex={focusableTab === tab.id ? 0 : -1}
            onFocus={() => setFocused(tab.id)}
            onClick={() => onSelect(tab.id)}
            className="h-auto min-h-11 max-w-64 justify-start px-3 text-left text-base font-bold wrap-anywhere whitespace-normal text-white hover:bg-white/15 hover:text-white focus-visible:ring-white aria-selected:bg-(--stage-accent) aria-selected:text-[#2c1644] sm:px-5"
          >
            {tab.title}
          </Button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${groupId}-${tab.id}-panel`}
          role="tabpanel"
          aria-labelledby={`${groupId}-${tab.id}-tab`}
          hidden={selection !== tab.id}
          tabIndex={tab.topic ? undefined : 0}
          className="min-w-0 rounded-xl focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
        >
          {selection === tab.id && children(tab)}
        </div>
      ))}
    </div>
  );
}

function LatestStandings({ eventSlug, userId, subject, title, theme, refreshEntries }) {
  const url = `${getVotingSubjectUrl(eventSlug, subject.slug)}/results`;
  const { mode, status: metadataStatus } = subject;
  const visibilityState = useLeaderboardVisibility();
  const [connectionStatus, setConnectionStatus] = useState(null);
  // SWR resets its timer when this callback changes. Standings updates should
  // leave the timer in place, while metadata can start it before the first snapshot.
  const refreshInterval = useCallback((latest) => getLeaderboardRefreshInterval({
    mode,
    status: latest?.subject?.status ?? metadataStatus,
    visibilityState,
    connectionStatus,
  }), [mode, metadataStatus, visibilityState, connectionStatus]);
  const { data, error, isValidating, mutate } = useSWR([url, String(userId)], fetchResults, {
    ...requestOptions,
    refreshInterval,
    refreshWhenHidden: false,
  });
  const results = cannotAccess(error) ? undefined : data;
  const status = results?.subject?.status;
  const nomination = mode === "nomination";

  useLiveLeaderboard({ mode, results, mutate, onStatus: setConnectionStatus });

  useEffect(() => {
    if (status === "closed" && metadataStatus !== "closed") {
      // The updated metadata cancels polling or points the category at its new finalist ballot.
      void refreshEntries();
    }
  }, [metadataStatus, refreshEntries, status]);

  async function refreshResults() {
    await Promise.allSettled([mutate(), refreshEntries()]);
  }

  if (!results) {
    return error
      ? <StandingsNotice error onRetry={refreshResults}>The standings could not be loaded.</StandingsNotice>
      : <LoadingStandings>Loading standings…</LoadingStandings>;
  }

  const contestants = getRankedContestants(results.contestants);
  const live = status === "active" && !error && connectionStatus === "connected";
  const resultLabel = nomination ? "nomination" : "vote";

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h2 className="text-3xl leading-tight font-black wrap-anywhere sm:text-5xl">{title ?? results.subject.title}</h2>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base font-semibold">
            <span>{nomination ? "Nominations" : "Voting"}</span>
            <span className="rounded-md bg-white/15 px-2 py-0.5">{subjectStatusLabels[status]}</span>
            {live && <span className="flex items-center gap-1.5"><Radio aria-hidden="true" className="size-4 text-(--stage-accent)" /> Updating live</span>}
          </p>
        </div>
        <RefreshButton onRefresh={refreshResults} refreshing={isValidating} label="Refresh standings" />
      </header>

      {error || (status === "active" && !live) ? (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 font-medium text-amber-950">
          <CircleAlert aria-hidden="true" className="mt-1 size-4 shrink-0" />
          <span>{error ? "The standings could not be refreshed. Showing the last available results." : connectionLabels[connectionStatus ?? "connecting"]}</span>
        </p>
      ) : null}

      {results.total_votes === 0 ? (
        <StandingsNotice>No {nomination ? "nominations" : "votes"} yet</StandingsNotice>
      ) : (
        <ol className="space-y-3">
          {contestants.map((contestant) => <LeaderboardRow key={contestant.id} contestant={contestant} theme={theme} resultLabel={resultLabel} />)}
        </ol>
      )}

      <dl className="grid gap-3 sm:grid-cols-1">
        {/* <div className="rounded-xl border border-white/35 bg-(--stage-surface) p-4 sm:p-5">
          <dt className="font-semibold">Total {nomination ? "nominations" : "votes"}</dt>
          <dd className="mt-1 text-3xl font-black tabular-nums sm:text-4xl">{results.total_votes.toLocaleString()}</dd>
        </div> */}
        <div className="rounded-xl border border-white/35 bg-(--stage-surface) p-4 sm:p-5">
          <dt className="font-semibold">Registration participation</dt>
          <dd className="mt-1 text-3xl font-black tabular-nums sm:text-4xl">{results.participation_percentage}%</dd>
          {/* <dd className="mt-1 text-sm">Out of {results.total_registrations.toLocaleString()} registered attendees</dd> */}
        </div>
      </dl>
    </section>
  );
}

function TopicStandings({ topic, ...standingsProps }) {
  const [category, setCategory] = useState("female");

  return (
    <LeaderboardTabs label={`${topic.title} categories`} tabs={categories} selection={category} onSelect={setCategory}>
      {(tab) => {
        const round = topic.nomination_rounds?.[tab.id];
        const subject = round?.generated_subject ?? round;
        return subject
          ? <LatestStandings key={subject.slug} {...standingsProps} subject={subject} title={`${topic.title} · ${tab.title}`} />
          : <StandingsNotice>This category is not available.</StandingsNotice>;
      }}
    </LeaderboardTabs>
  );
}

function EventStandingsTabs({ tabs, ...standingsProps }) {
  const [selection, setSelection] = useState(() => (tabs.find((tab) => tab.active) ?? tabs[0]).id);
  const selected = tabs.find((tab) => tab.id === selection) ?? tabs[0];

  return (
    <LeaderboardTabs label="Nomination topics and voting subjects" tabs={tabs} selection={selected.id} onSelect={setSelection}>
      {(tab) => tab.topic
        ? <TopicStandings {...standingsProps} topic={tab.topic} />
        : <LatestStandings key={tab.subject.slug} {...standingsProps} subject={tab.subject} />}
    </LeaderboardTabs>
  );
}

function EventStandings({ eventSlug, userId }) {
  const scope = String(userId);
  const { data: event } = useSWR([`/api/events/${encodeURIComponent(eventSlug)}`, scope], fetchMetadata, requestOptions);
  const topics = useSWR([getNominationTopicsUrl(eventSlug), scope], fetchMetadata, requestOptions);
  const subjects = useSWR([getStandaloneVotingSubjectsUrl(eventSlug), scope], fetchMetadata, requestOptions);
  const [theme, selectTheme] = useLeaderboardTheme();
  const denied = cannotAccess(topics.error) || cannotAccess(subjects.error);
  const loading = !denied && (topics.isLoading || subjects.isLoading);
  const hasMetadataError = Boolean(topics.error || subjects.error);
  const tabs = denied ? [] : [
    ...(topics.data ?? []).map((topic) => ({
      id: `topic-${topic.id}`,
      title: topic.title,
      active: ["nomination_active", "voting_active"].includes(topic.stage),
      topic,
    })),
    ...(subjects.data ?? []).filter((subject) => subject.mode === "manual")
      .map((subject) => ({ id: `subject-${subject.id}`, title: subject.title, active: subject.status === "active", subject })),
  ];

  const { mutate: refreshTopics } = topics;
  const { mutate: refreshSubjects } = subjects;
  const refreshEntries = useCallback(
    () => Promise.allSettled([refreshTopics(), refreshSubjects()]),
    [refreshTopics, refreshSubjects],
  );

  return (
    <main className="min-h-screen bg-(--stage-background) px-4 py-5 text-white sm:px-8 sm:py-8" style={{
      "--stage-background": theme.background,
      "--stage-surface": theme.surface,
      "--stage-accent": theme.accent,
      backgroundImage: `radial-gradient(ellipse at 12% 0%, ${theme.accent}35, transparent 34%), radial-gradient(ellipse at 90% 100%, ${theme.accent}22, transparent 38%)`,
    }}>
      <div className="mx-auto max-w-5xl space-y-6 sm:space-y-8">
        <header className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/15 hover:text-white focus-visible:ring-white">
              <Link href={getVotingHref({ sourceId: eventSlug })}><ArrowLeft /> Voting management</Link>
            </Button>
            <LeaderboardThemeSettings theme={theme} onSelectTheme={selectTheme} />
          </div>
          <div className="space-y-1 text-center">
            {event?.title && !denied && <p className="text-base font-semibold wrap-anywhere sm:text-xl">{event.title}</p>}
            {/* <h1 className="text-4xl font-black tracking-tight sm:text-6xl">Event leaderboard</h1> */}
          </div>
        </header>

        {loading ? <LoadingStandings>Loading leaderboard…</LoadingStandings> : tabs.length > 0 ? (
          <>
            {hasMetadataError && (
              <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/35 bg-(--stage-surface) px-4 py-3">
                <p>Some topics or subjects could not be refreshed.</p>
                <RefreshButton onRefresh={refreshEntries} refreshing={topics.isValidating || subjects.isValidating} />
              </div>
            )}
            <EventStandingsTabs tabs={tabs} eventSlug={eventSlug} userId={userId} theme={theme} refreshEntries={refreshEntries} />
          </>
        ) : hasMetadataError ? (
          <StandingsNotice error onRetry={refreshEntries}>The event leaderboard could not be loaded.</StandingsNotice>
        ) : (
          <>
            <StandingsNotice>No nomination topics or voting subjects yet</StandingsNotice>
            <RefreshButton onRefresh={refreshEntries} refreshing={topics.isValidating || subjects.isValidating} label="Refresh topics and subjects" />
          </>
        )}
      </div>
    </main>
  );
}

export function EventLeaderboard({ eventSlug }) {
  return <RoleGate>{({ user }) => <EventStandings key={`${user.id}:${eventSlug}`} eventSlug={eventSlug} userId={user.id} />}</RoleGate>;
}
