import { PublicEventPoll } from "@/components/voting/public-event-poll";

export const metadata = { title: "Event poll" };

export default async function EventPollPage({ params }) {
  const { slug } = await params;
  return <PublicEventPoll key={slug} eventSlug={slug} />;
}
