const podiumByRank = { 1: "first", 2: "second", 3: "third" };

export function getVotingResultsPayload(response) {
  return response.data;
}

/** Keep a cache update from replacing newer nomination totals with an older broadcast. */
export function isNominationStatisticsMonotonic(candidate, current) {
  if (!candidate || !current) return true;
  const count = (value) => Number.isSafeInteger(value) && value >= 0;
  if (!count(candidate.total_votes) || !count(candidate.total_registrations)
    || !count(current.total_votes) || !count(current.total_registrations)) return false;
  return candidate.total_votes > current.total_votes
    || (candidate.total_votes === current.total_votes
      && candidate.total_registrations >= current.total_registrations);
}

export function getLeaderboardRefreshInterval({ mode, status, visibilityState, connectionStatus }) {
  if (mode !== "manual" || status !== "active" || visibilityState !== "visible") return 0;
  // Reverb delivers live changes; retain a slow reconciliation poll for missed or delayed broadcasts.
  return connectionStatus === "connected" ? 30_000 : 3000;
}

export function getLeaderboardLifecycle({ eventSlug, subjectSlug, mode, status }) {
  if (!["manual", "nomination"].includes(mode) || !["draft", "active"].includes(status)) return null;
  const nomination = mode === "nomination";
  const action = status === "active" ? "close" : nomination ? "open" : "activate";
  return {
    action,
    url: `/api/events/${encodeURIComponent(eventSlug)}/${nomination ? "nominations" : "voting-subjects"}/${encodeURIComponent(subjectSlug)}/${action}`,
    label: status === "active" ? `Close ${nomination ? "nominations" : "voting"}` : nomination ? "Open nominations" : "Activate voting",
  };
}

function isNominationSnapshot(snapshot, eventId, subjectId) {
  const nonnegative = (value) => Number.isFinite(value) && value >= 0;
  const count = (value) => Number.isSafeInteger(value) && value >= 0;
  return Boolean(snapshot && String(snapshot.event?.id) === String(eventId)
    && String(snapshot.subject?.id) === String(subjectId)
    && ["draft", "active", "closed"].includes(snapshot.subject.status)
    && typeof snapshot.event.title === "string" && typeof snapshot.subject.title === "string"
    && count(snapshot.total_votes) && count(snapshot.total_registrations)
    && nonnegative(snapshot.participation_percentage)
    && Array.isArray(snapshot.contestants)
    && snapshot.contestants.every((row) => row && Number.isSafeInteger(row.id) && row.id > 0
      && typeof row.name === "string" && count(row.display_order) && count(row.votes)
      && nonnegative(row.percentage) && row.percentage <= 100));
}

/** Rebuild the REST-shaped leaderboard from its stable REST roster and compact Reverb counts. */
export function projectNominationStatistics(base, update, eventId, subjectId) {
  const count = (value) => Number.isSafeInteger(value) && value >= 0;
  if (!isNominationSnapshot(base, eventId, subjectId) || !update
    || String(base.event?.id) !== String(eventId)
    || String(update.event_id) !== String(eventId)
    || String(update.subject_id) !== String(subjectId)
    || update.status !== "active" || base.subject.status !== "active"
    || !count(update.total_votes) || !count(update.total_registrations)
    || update.total_votes < base.total_votes
    || (update.total_votes === base.total_votes && update.total_registrations < base.total_registrations)
    || !Array.isArray(base.contestants) || !Array.isArray(update.contestant_votes)
    || base.contestants.length < 1 || base.contestants.length > 250
    || update.contestant_votes.length !== base.contestants.length
    || !update.contestant_votes.every(count)) return null;

  const roster = [...base.contestants].sort((left, right) => left.display_order - right.display_order || left.id - right.id);
  const ids = new Set();
  for (const row of roster) {
    if (!Number.isSafeInteger(row.id) || row.id <= 0 || ids.has(row.id)
      || typeof row.name !== "string" || !count(row.display_order)) return null;
    ids.add(row.id);
  }

  const sum = update.contestant_votes.reduce((total, votes) => total + votes, 0);
  if (!Number.isSafeInteger(sum) || sum !== update.total_votes) return null;

  const contestants = roster.map((row, index) => ({ ...row, votes: update.contestant_votes[index] }))
    .sort((left, right) => right.votes - left.votes || left.display_order - right.display_order || left.id - right.id);

  let rank = 0;
  let previousVotes;
  const ranked = contestants.map((row, index) => {
    if (index === 0 || row.votes !== previousVotes) rank = index + 1;
    previousVotes = row.votes;
    return {
      ...row,
      rank,
      percentage: update.total_votes === 0 ? 0 : Math.round((row.votes / update.total_votes) * 10000) / 100,
    };
  });
  const registrations = update.total_registrations;

  return {
    ...base,
    subject: { ...base.subject, status: update.status },
    total_votes: update.total_votes,
    total_registrations: registrations,
    participation_percentage: registrations === 0 ? 0 : Math.round((update.total_votes / registrations) * 10000) / 100,
    contestants: ranked,
  };
}

export function projectVotingStatistics(base, update, eventId, subjectId) {
  return projectNominationStatistics(base, update, eventId, subjectId);
}

function subscribeToLiveLeaderboard({ echo, channelName, eventId, subjectId, mode, expectedMode, status, getBaseSnapshot, onSnapshot, revalidate, onStatus, statisticsEventName, closedEventName, projectSnapshot }) {
  if (mode !== expectedMode || status !== "active" || !eventId || !subjectId) return () => {};
  if (!echo) {
    onStatus("unavailable");
    return () => {};
  }

  let disposed = false;
  let recovery = 0;
  let recoveryInFlight = false;
  let recoveryRequested = false;
  const channel = echo.private(channelName);
  onStatus("connecting");
  const snapshotReceived = (snapshot) => {
    if (disposed) return;
    const projected = projectSnapshot(getBaseSnapshot?.(), snapshot, eventId, subjectId);
    if (projected) onSnapshot(projected);
    else void recoverResults(true);
  };
  const closedReceived = (notice) => {
    if (disposed) return;
    if (notice && String(notice.event_id) === String(eventId)
      && String(notice.subject_id) === String(subjectId) && notice.status === "closed") {
      void recoverResults(true, true);
    } else {
      void recoverResults(false);
    }
  };
  const disconnected = () => {
    recovery++;
    if (!disposed) onStatus("disconnected");
  };
  const recoverResults = async (subscribed, force = false) => {
    if (disposed) return;
    if (recoveryInFlight) {
      if (force) {
        // Invalidate a potentially pre-close REST response and run another recovery afterwards.
        recovery++;
        recoveryRequested = true;
        onStatus("recovering");
      }
      return;
    }
    recoveryInFlight = true;
    const attempt = ++recovery;
    onStatus(subscribed ? "recovering" : "disconnected");
    try {
      // Closed subjects fail channel authorization; REST must recover their status too.
      const results = await revalidate();
      if (disposed || attempt !== recovery) return;
      if (isNominationSnapshot(results, eventId, subjectId) && results.subject.status !== "active") {
        stop();
      } else if (subscribed) {
        onStatus("connected");
      }
    } catch {
      if (!disposed && attempt === recovery) onStatus("disconnected");
    } finally {
      recoveryInFlight = false;
      if (recoveryRequested && !disposed) {
        recoveryRequested = false;
        void recoverResults(true);
      }
    }
  };
  channel.listen(statisticsEventName, snapshotReceived);
  channel.listen(closedEventName, closedReceived);
  channel.error(() => recoverResults(false));
  // Also recover on the first subscription to cover the initial REST/auth gap.
  channel.subscribed(() => recoverResults(true));
  const stopConnectionChanges = echo.connector.onConnectionChange((state) => {
    if (disposed) return;
    if (state === "connected" || state === "connecting") {
      onStatus("connecting");
    } else {
      disconnected();
    }
  });

  function stop() {
    if (disposed) return;
    disposed = true;
    recovery++;
    recoveryRequested = false;
    stopConnectionChanges();
    channel.stopListening(statisticsEventName, snapshotReceived);
    channel.stopListening(closedEventName, closedReceived);
    echo.leave(channelName);
  }
  return stop;
}

export function subscribeToNominationLeaderboard(options) {
  return subscribeToLiveLeaderboard({
    ...options,
    expectedMode: "nomination",
    statisticsEventName: ".App\\Events\\NominationStatisticsUpdated",
    closedEventName: ".App\\Events\\NominationClosed",
    projectSnapshot: projectNominationStatistics,
  });
}

export function subscribeToVotingLeaderboard(options) {
  return subscribeToLiveLeaderboard({
    ...options,
    expectedMode: "manual",
    statisticsEventName: ".App\\Events\\VotingStatisticsUpdated",
    closedEventName: ".App\\Events\\VotingClosed",
    projectSnapshot: projectVotingStatistics,
  });
}

export function getRankedContestants(contestants) {
  if (!Array.isArray(contestants)) return [];

  let rank = 0;
  let previousVotes;

  return contestants.map((contestant, index) => {
    if (index === 0 || contestant.votes !== previousVotes) rank = index + 1;
    previousVotes = contestant.votes;
    return { ...contestant, rank, podium: podiumByRank[rank] || null };
  });
}
