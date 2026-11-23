"use client";

import { Settings } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DEFAULT_RAFFLE_THEME, getRaffleTheme, RAFFLE_THEMES } from "@/lib/raffle-themes.mjs";

const THEME_STORAGE_KEY = "event-voting-leaderboard-theme";
const THEME_CHANGE_EVENT = "leaderboard-theme-change";

function subscribeToStorage(onChange) {
  function onStorage(event) {
    if (event.key === THEME_STORAGE_KEY || event.key === null) onChange();
  }

  window.addEventListener("storage", onStorage);
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  };
}

function getDefaultThemeKey() {
  return DEFAULT_RAFFLE_THEME;
}

function getStoredThemeKey() {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) ?? DEFAULT_RAFFLE_THEME;
  } catch {
    return DEFAULT_RAFFLE_THEME;
  }
}

export function useLeaderboardTheme() {
  const storedThemeKey = useSyncExternalStore(subscribeToStorage, getStoredThemeKey, getDefaultThemeKey);
  const [fallbackThemeKey, setFallbackThemeKey] = useState(null);

  function selectTheme(key) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, key);
    } catch {
      setFallbackThemeKey(key);
      return;
    }

    setFallbackThemeKey(null);
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT));
  }

  return [getRaffleTheme(fallbackThemeKey ?? storedThemeKey), selectTheme];
}

export function LeaderboardThemeSettings({ theme, onSelectTheme }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="Leaderboard settings" title="Leaderboard settings" className="rounded-full border border-white/35 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <Settings className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="p-6">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-2xl font-extrabold">Leaderboard settings</DialogTitle>
          <DialogDescription>Choose a theme color for this stage display. Your choice is saved in this browser.</DialogDescription>
        </DialogHeader>
        <section aria-label="Theme color">
          <h2 className="mb-4 text-sm font-bold text-[#554766]">Theme color</h2>
          <div className="grid grid-cols-5 gap-3 sm:gap-4">
            {RAFFLE_THEMES.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => onSelectTheme(option.key)}
                aria-label={`${option.key} theme`}
                aria-pressed={theme.key === option.key}
                className="aspect-square rounded-full border-4 shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  backgroundColor: option.background,
                  borderColor: theme.key === option.key ? option.accent : "#ffffff",
                  boxShadow: theme.key === option.key ? `0 0 0 2px ${option.background}` : undefined,
                }}
              />
            ))}
          </div>
        </section>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" className="font-bold text-[#2c1644]" style={{ backgroundColor: theme.accent }}>Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
