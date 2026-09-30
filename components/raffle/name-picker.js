"use client";

import { useEffect, useMemo, useState } from "react";
import { getSpinDuration } from "@/lib/raffle-themes.mjs";
import { createNamePickerModel } from "@/lib/name-picker.mjs";
import { createRaffleSpinSound } from "@/lib/raffle-spin-sound.mjs";

export function NamePicker({ entries, selectedEntry, spinning, speed, onAnimationEnd }) {
  const [displayName, setDisplayName] = useState("");
  const names = useMemo(() => entries.map((entry) => entry.name), [entries]);
  const model = useMemo(() => createNamePickerModel(entries, selectedEntry), [entries, selectedEntry]);

  useEffect(() => {
    if (!spinning || !selectedEntry) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 650 : getSpinDuration(speed);
    const spinSound = createRaffleSpinSound();
    spinSound.start();
    let index = 0;
    const timer = window.setInterval(() => {
      setDisplayName(names[index++ % Math.max(names.length, 1)] || selectedEntry.name);
    }, reduced ? 120 : 70);
    const finish = window.setTimeout(() => {
      window.clearInterval(timer);
      spinSound.stop();
      setDisplayName(selectedEntry.name);
      onAnimationEnd?.();
    }, duration);
    return () => { window.clearInterval(timer); window.clearTimeout(finish); spinSound.stop(); };
  }, [names, onAnimationEnd, selectedEntry, speed, spinning]);

  const shownName = spinning
    ? (displayName || selectedEntry?.name)
    : model.initialName;

  return (
    <div className="flex min-h-[48vh] w-full items-center justify-center px-5 text-center" aria-live="polite">
      <p className={`max-w-5xl break-words text-5xl font-black tracking-tight text-white drop-shadow-lg sm:text-7xl lg:text-[11rem] ${spinning ? "animate-pulse" : ""}`}>
        {shownName}
      </p>
    </div>
  );
}
