"use client";

import { LoaderCircle, RotateCcw, Sparkles, Trophy } from "lucide-react";
import { useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { createConfettiPieces } from "@/lib/winner-celebration.mjs";

export function WinnerCelebrationDialog({ state, theme, confirming, cancelling, onConfirm, onDrawAgain, onContinue }) {
  const confetti = useMemo(() => createConfettiPieces(), []);
  const busy = confirming || cancelling;

  return (
    <Dialog open={state.open} onOpenChange={(open) => { if (!open && state.dismissible) onContinue?.(); }}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => { if (!state.dismissible) event.preventDefault(); }}
        onInteractOutside={(event) => { if (!state.dismissible) event.preventDefault(); }}
        className="overflow-hidden border border-white/25 bg-[#4c287b] text-white sm:max-w-2xl"
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden" aria-hidden="true">
          {confetti.map((piece) => <span key={piece.id} className="raffle-confetti absolute -top-6 h-3 w-2 rounded-sm" style={{ left: `${piece.left}%`, backgroundColor: piece.color, animationDelay: `${piece.delay}ms`, animationDuration: `${piece.duration}ms`, rotate: `${piece.rotation}deg` }} />)}
        </div>
        <div className="relative z-10 flex flex-col items-center px-6 py-10 text-center sm:px-12 sm:py-14">
          <span className="mb-5 flex size-20 items-center justify-center rounded-full shadow-2xl" style={{ background: theme.accent, color: "#382054" }}>{state.mode === "confirmed" ? <Trophy className="size-10" /> : <Sparkles className="size-10" />}</span>
          <p className="text-sm font-bold tracking-[.24em] text-white/70 uppercase">{state.mode === "confirmed" ? "Winner confirmed" : "We have a winner"}</p>
          <DialogTitle className="mt-3 max-w-full break-words text-4xl leading-tight font-black text-white sm:text-6xl">{state.name}</DialogTitle>
          <DialogDescription className="mt-3 text-base text-white/75">{state.mode === "confirmed" ? "This winner has been saved to the event history." : "Confirm this result or draw another name."}</DialogDescription>
          <div className="mt-9 flex w-full max-w-md flex-col gap-3 sm:flex-row">
            {state.mode === "confirmed" ? <button type="button" onClick={onContinue} className="w-full rounded-full px-7 py-4 font-black text-[#382054] shadow-lg" style={{ background: theme.accent }}>Continue</button> : <>
              <button type="button" disabled={busy} onClick={onConfirm} className="flex flex-1 items-center justify-center gap-2 rounded-full px-7 py-4 font-black text-[#382054] shadow-lg disabled:opacity-60" style={{ background: theme.accent }}>{confirming ? <LoaderCircle className="animate-spin" /> : <Trophy />}{confirming ? "Confirming..." : "Confirm Winner"}</button>
              <button type="button" disabled={busy} onClick={onDrawAgain} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white/15 px-7 py-4 font-semibold ring-1 ring-white/40 disabled:opacity-60">{cancelling ? <LoaderCircle className="animate-spin" /> : <RotateCcw />}{cancelling ? "Cancelling..." : "Draw Again"}</button>
            </>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
