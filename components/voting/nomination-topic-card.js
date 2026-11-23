import { Check, Radio } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TOPIC_CATEGORIES } from "@/lib/event-poll.mjs";

const stageLabels = {
  draft: "Draft",
  nomination_active: "Nominations open",
  voting_active: "Voting open",
  closed: "Closed",
};

const roundLabels = { draft: "Draft", active: "Open", closed: "Closed" };

function CategoryRoundRow({ label, round, contestantLabel, voteLabel, finalistCount }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-[#ffdece] bg-white p-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p className="font-semibold">{label}</p>
        <Badge variant={round?.status === "active" ? "success" : "neutral"}>{roundLabels[round?.status] ?? "Pending"}</Badge>
      </div>
      <dl className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 text-sm text-[#6f625b]">
        {finalistCount !== undefined && <div className="min-w-0"><dt>Target</dt><dd className="font-semibold tabular-nums">Top {finalistCount}</dd></div>}
        <div className="min-w-0"><dt>{contestantLabel}</dt><dd className="font-semibold tabular-nums">{round?.contestant_count ?? 0}</dd></div>
        <div className="min-w-0"><dt>{voteLabel}</dt><dd className="font-semibold tabular-nums">{round?.total_votes ?? 0}</dd></div>
      </dl>
    </div>
  );
}

export function NominationTopicCard({ topic, eventFinished, canOpen, busy, onConfirm }) {
  const nominationsOpen = topic.stage === "nomination_active";
  const votingOpen = topic.stage === "voting_active";
  const showTopicAction = nominationsOpen || (!eventFinished && topic.stage === "draft");
  const hasOpenBallot = TOPIC_CATEGORIES.some(({ key }) => topic.nomination_rounds[key]?.generated_subject?.status === "active");

  return (
    <Card className="overflow-hidden border border-[#ffdece] bg-white shadow-sm">
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="min-w-0 wrap-anywhere text-xl font-bold">{topic.title}</h3>
          <Badge variant={nominationsOpen || votingOpen ? "success" : "neutral"}>{stageLabels[topic.stage] ?? topic.stage}</Badge>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <section aria-label={`${topic.title} nominations`} className="min-w-0 space-y-3">
            <div>
              <h4 className="font-bold">Nominations</h4>
              <p className="text-xs text-[#6f625b]">One topic with a required Female and Male nomination.</p>
            </div>
            {TOPIC_CATEGORIES.map(({ key, label }) => (
              <CategoryRoundRow
                key={key}
                label={label}
                round={topic.nomination_rounds[key]}
                contestantLabel="Nominees"
                voteLabel="Nominations"
              />
            ))}
          </section>
          <section aria-label={`${topic.title} finalist voting`} className="min-w-0 space-y-3">
            <div>
              <h4 className="font-bold">Finalist voting</h4>
              <p className="text-xs text-[#6f625b]">Top finalists include ties at the cutoff.</p>
            </div>
            {TOPIC_CATEGORIES.map(({ key, label }) => {
              const ballot = topic.nomination_rounds[key]?.generated_subject;
              return <CategoryRoundRow key={key} label={label} round={ballot} contestantLabel="Finalists" voteLabel="Votes" finalistCount={topic[`${key}_top_n`]} />;
            })}
            {votingOpen && hasOpenBallot && (
              <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={(event) => onConfirm({ topic, action: "closeTopicVoting" }, event.currentTarget)}>
                <Check /> Close voting
              </Button>
            )}
          </section>
        </div>
      </div>
      {showTopicAction && (
        <div className="border-t border-[#ffdece] bg-[#fffaf7] px-4 py-3 sm:px-6">
          {nominationsOpen ? (
            <Button type="button" size="sm" disabled={busy} onClick={(event) => onConfirm({ topic, action: "closeTopicNominations" }, event.currentTarget)}>
              <Check /> Close nominations
            </Button>
          ) : (
            <Button type="button" size="sm" disabled={busy || !canOpen} onClick={(event) => onConfirm({ topic, action: "openTopicNominations" }, event.currentTarget)}>
              <Radio /> Open nominations
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
