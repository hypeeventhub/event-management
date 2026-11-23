import { useEffect, useRef, useSyncExternalStore } from "react";

import { getEcho, getNominationChannelName, getVotingChannelName } from "@/lib/echo";
import { isNominationStatisticsMonotonic, subscribeToNominationLeaderboard, subscribeToVotingLeaderboard } from "@/lib/voting-leaderboard.mjs";

function subscribeToVisibility(onChange) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function getVisibilityState() {
  return document.visibilityState;
}

function getServerVisibilityState() {
  return "visible";
}

export function useLeaderboardVisibility() {
  return useSyncExternalStore(subscribeToVisibility, getVisibilityState, getServerVisibilityState);
}

export function useLiveLeaderboard({ mode, results, mutate, onStatus }) {
  const resultsRef = useRef(results);
  const eventId = results?.event?.id;
  const subjectId = results?.subject?.id;
  const subjectStatus = results?.subject?.status;

  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  useEffect(() => {
    if (subjectStatus !== "active" || !eventId || !subjectId || !["nomination", "manual"].includes(mode)) return;

    let echo;
    try {
      echo = getEcho();
    } catch {
      // Results remain available through the REST endpoint.
      echo = null;
    }

    const nomination = mode === "nomination";
    const subscribe = nomination ? subscribeToNominationLeaderboard : subscribeToVotingLeaderboard;
    const getChannelName = nomination ? getNominationChannelName : getVotingChannelName;

    return subscribe({
      echo,
      channelName: getChannelName(eventId, subjectId),
      eventId,
      subjectId,
      mode,
      status: subjectStatus,
      onStatus,
      getBaseSnapshot: () => resultsRef.current,
      onSnapshot: (snapshot) => {
        let rejectedAsStale = false;
        void mutate((current) => {
          if (current?.subject?.status !== "active") return current;
          if (!isNominationStatisticsMonotonic(snapshot, current)) {
            rejectedAsStale = true;
            return current;
          }

          // A second broadcast can arrive before React renders the updated SWR cache.
          resultsRef.current = snapshot;
          return snapshot;
        }, { revalidate: false }).then(() => {
          if (rejectedAsStale) return mutate();
        }).catch(() => {});
      },
      revalidate: () => mutate(),
    });
  }, [eventId, mode, mutate, onStatus, subjectId, subjectStatus]);
}
