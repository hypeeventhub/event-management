import { Crown, Medal } from "lucide-react";

export function LeaderboardRow({ contestant, theme }) {
  const progress = Math.max(0, Math.min(100, Number(contestant.percentage) || 0));
  const podiumBackgrounds = {
    first: "#fff3cb",
    second: "#edf2f7",
    third: "#ffede2",
  };
  const podiumBorders = {
    first: "#e4aa28",
    second: "#a7b7c7",
    third: "#d18858",
  };
  const podiumFills = {
    first: "#d9951b",
    second: "#8798a7",
    third: "#bd7852",
  };

  return (
    <li className="rounded-2xl border-2 bg-white p-4 text-[#25170f] shadow-lg transition-transform hover:-translate-y-0.5 sm:p-5" style={{ backgroundColor: podiumBackgrounds[contestant.podium] || "#ffffff", borderColor: podiumBorders[contestant.podium] || `${theme.background}44` }}>
      <div className="flex items-start gap-3 sm:gap-5">
        <div className="flex size-12 shrink-0 items-center justify-center gap-0.5 rounded-2xl bg-white text-lg font-black text-[#25170f] shadow-sm sm:size-16 sm:text-xl" aria-label={`Rank ${contestant.rank}`}>
          {contestant.podium === "first" ? <Crown className="size-5 text-[#a66a00]" aria-hidden="true" /> : contestant.podium ? <Medal className="size-5 text-[#6f625b]" aria-hidden="true" /> : null}
          <span className="sr-only">Rank </span>{contestant.rank}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="break-words text-xl font-extrabold leading-tight text-[#25170f] sm:text-2xl">{contestant.name}</h3>
            <div className="flex items-baseline gap-2 text-[#25170f]"><strong className="text-2xl font-black tabular-nums sm:text-3xl">{contestant.votes.toLocaleString()}</strong><span className="text-sm font-semibold text-[#554766]">vote{contestant.votes === 1 ? "" : "s"}</span></div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-4 min-w-0 flex-1 overflow-hidden rounded-full bg-black/10" role="progressbar" aria-label={`${contestant.name} vote share`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${progress}%`, backgroundColor: podiumFills[contestant.podium] || theme.background }} />
            </div>
            <span className="w-16 text-right text-base font-extrabold tabular-nums text-[#554766]">{contestant.percentage}%</span>
          </div>
        </div>
      </div>
    </li>
  );
}
