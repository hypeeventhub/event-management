import { useEffect } from "react";

import { getEcho, getNominationChannelName, getVotingChannelName } from "@/lib/echo";

function getActiveSubjectId(round, voting) {
  const subject = voting ? round?.generated_subject : round;
  return subject?.status === "active" ? subject.id : null;
}

export function useNominationTopicUpdates(topic, revalidate) {
  const eventId = topic?.event_id;
  const voting = topic?.stage === "voting_active";
  const femaleId = getActiveSubjectId(topic?.nomination_rounds.female, voting);
  const maleId = getActiveSubjectId(topic?.nomination_rounds.male, voting);

  useEffect(() => {
    if (!eventId || (!femaleId && !maleId)) return;

    let echo;
    try {
      echo = getEcho();
    } catch {
      return; // The page still offers a manual REST refresh.
    }
    if (!echo) return;

    let disposed = false;
    let timer = null;
    let refreshing = false;
    let refreshQueued = false;

    function scheduleRefresh() {
      if (disposed) return;
      refreshQueued = true;
      // Both category channels can report the same submission in quick succession.
      if (timer === null && !refreshing) timer = setTimeout(refresh, 750);
    }

    async function refresh() {
      timer = null;
      refreshQueued = false;
      refreshing = true;
      try {
        await revalidate();
      } catch {
        // SWR exposes refresh errors alongside the cached topics.
      } finally {
        refreshing = false;
        if (refreshQueued) scheduleRefresh();
      }
    }

    const getChannelName = voting ? getVotingChannelName : getNominationChannelName;
    const eventPrefix = voting ? "Voting" : "Nomination";
    const statisticsEvent = `.App\\Events\\${eventPrefix}StatisticsUpdated`;
    const closedEvent = `.App\\Events\\${eventPrefix}Closed`;
    const unsubscribe = [femaleId, maleId].filter(Boolean).map((subjectId) => {
      const name = getChannelName(eventId, subjectId);
      const channel = echo.private(name);
      const roundUpdated = (update) => {
        if (String(update?.event_id) === String(eventId) && String(update?.subject_id) === String(subjectId)) scheduleRefresh();
      };

      channel.listen(statisticsEvent, roundUpdated);
      channel.listen(closedEvent, roundUpdated);
      channel.subscribed(scheduleRefresh);
      channel.error(scheduleRefresh);

      return () => {
        channel.stopListening(statisticsEvent, roundUpdated);
        channel.stopListening(closedEvent, roundUpdated);
        echo.leave(name);
      };
    });

    return () => {
      disposed = true;
      if (timer !== null) clearTimeout(timer);
      unsubscribe.forEach((stop) => stop());
    };
  }, [eventId, femaleId, maleId, revalidate, voting]);
}
