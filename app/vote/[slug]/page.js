"use client";

import { useParams } from "next/navigation";

import { PublicVoteForm } from "@/components/voting/public-vote-form";

export default function PublicVotePage() {
  const { slug } = useParams();
  return <PublicVoteForm slug={slug} />;
}
