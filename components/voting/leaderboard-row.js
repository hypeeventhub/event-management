import { Crown, Medal } from "lucide-react";

const podiumStyles = {
  first: "border-[#f1c671] bg-[#fff8e8]",
  second: "border-[#cbd4dd] bg-[#f7fafc]",
  third: "border-[#d9b39a] bg-[#fff4ec]",
};

const barStyles = {
  first: "bg-[#d9951b]",
  second: "bg-[#8798a7]",
  third: "bg-[#bd7852]",
};

export function LeaderboardRow({ contestant }) {
  const progress = Math.max(0, Math.min(100, Number(contestant.percentage) || 0));

  return (
    <li className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${podiumStyles[contestant.podium] || "border-[#ffdece] bg-white"}`}>
      <div className="flex items-start gap-3 sm:gap-5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/80 text-base font-bold text-[#25170f] shadow-sm sm:size-13" aria-label={`Rank ${contestant.rank}`}>
          {contestant.podium === "first" ? <Crown className="size-5 text-[#a66a00]" aria-hidden="true" /> : contestant.podium ? <Medal className="size-5 text-[#6f625b]" aria-hidden="true" /> : null}
          <span className="sr-only">Rank </span>{contestant.rank}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="break-words text-base font-bold text-[#25170f] sm:text-lg">{contestant.name}</h3>
            <div className="flex items-baseline gap-2 text-[#25170f]"><strong className="text-xl tabular-nums sm:text-2xl">{contestant.votes.toLocaleString()}</strong><span className="text-xs text-[#6f625b]">vote{contestant.votes === 1 ? "" : "s"}</span></div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#f3e8e1]" role="progressbar" aria-label={`${contestant.name} vote share`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
              <div className={`h-full rounded-full transition-[width] duration-500 ${barStyles[contestant.podium] || "bg-[#f6671e]"}`} style={{ width: `${progress}%` }} />
            </div>
            <span className="w-16 text-right text-sm font-semibold tabular-nums text-[#6f625b]">{contestant.percentage}%</span>
          </div>
        </div>
      </div>
    </li>
  );
}
