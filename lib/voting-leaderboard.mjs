const podiumByRank = { 1: "first", 2: "second", 3: "third" };

export function getVotingResultsPayload(response) {
  return response.data;
}

export function getLeaderboardRefreshInterval({ status, visibilityState }) {
  return status === "active" && visibilityState === "visible" ? 3000 : 0;
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
