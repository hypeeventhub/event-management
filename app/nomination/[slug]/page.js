import { PublicNominationForm } from "@/components/voting/public-nomination-form";

export const metadata = { title: "Event nomination" };

export default async function PublicNominationPage({ params }) {
  const { slug } = await params;
  return <PublicNominationForm slug={slug} />;
}
