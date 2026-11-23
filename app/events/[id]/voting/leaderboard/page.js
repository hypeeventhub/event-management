import { EventLeaderboard } from "@/components/voting/event-leaderboard";

export const metadata = { title: "Event Leaderboard" };

export default async function EventLeaderboardPage({ params }) {
  const { id } = await params;
  return <EventLeaderboard eventSlug={id} />;
}
