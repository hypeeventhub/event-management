"use client";

import { ArrowLeft, LoaderCircle, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import api from "@/lib/api";

export function RaffleWinnersArchive({ event, endpoint, winners, pagination, theme }) {
  const [history, setHistory] = useState(winners || []);
  const [page, setPage] = useState(pagination?.current_page || 1);
  const [lastPage, setLastPage] = useState(pagination?.last_page || 1);
  const [total, setTotal] = useState(pagination?.total || 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadMore() {
    if (loading || page >= lastPage) return;

    setLoading(true);
    setError("");
    try {
      const response = await api.get(`${endpoint}?winners_page=${page + 1}`);
      const data = response.data.data;
      setHistory((current) => [...current, ...(data.winners || [])]);
      setPage(data.winner_pagination.current_page);
      setLastPage(data.winner_pagination.last_page);
      setTotal(data.winner_pagination.total);
    } catch {
      setError("More winners could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen overflow-y-auto px-5 py-6 text-white sm:px-10 sm:py-8" style={{ background: theme.background }}>
      <div className="mx-auto max-w-3xl space-y-7">
        <header className="flex items-center justify-between gap-4">
          <Link href="/history" aria-label="Back to event history" title="Back to history" className="rounded-full p-3 transition hover:bg-white/10">
            <ArrowLeft aria-hidden="true" />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-xs tracking-[.2em] text-white/65 uppercase">Raffle winners</p>
            <h1 className="truncate text-xl font-semibold sm:text-2xl">{event.title}</h1>
          </div>
          <span className="size-12 shrink-0" aria-hidden="true" />
        </header>

        <section aria-label="Confirmed raffle winners" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Confirmed winners</h2>
            <span className="rounded-full px-3 py-1 text-sm font-semibold" style={{ background: theme.surface }}>{total} total</span>
          </div>

          {history.length === 0 ? (
            <div className="rounded-2xl p-8 text-center text-white/80" style={{ background: theme.surface }}>
              <Trophy aria-hidden="true" className="mx-auto mb-3 size-8" style={{ color: theme.accent }} />
              <p>No confirmed winners for this event.</p>
            </div>
          ) : (
            <ol className="space-y-2">
              {history.map((winner, index) => (
                <li key={winner.id} className="flex items-center gap-4 rounded-xl px-4 py-3 sm:px-5" style={{ background: theme.surface }}>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-black" style={{ background: theme.accent, color: theme.surface }}>
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{winner.name}</span>
                  <time className="shrink-0 text-right text-xs text-white/70 sm:text-sm">
                    {new Date(winner.won_at).toLocaleString(undefined, { timeZone: event.timezone || undefined })}
                  </time>
                </li>
              ))}
            </ol>
          )}

          {error && <p role="alert" className="rounded-lg bg-red-950/40 px-4 py-3 text-sm">{error}</p>}
          {page < lastPage && (
            <button type="button" onClick={loadMore} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold transition hover:brightness-110 disabled:opacity-60" style={{ background: theme.surface }}>
              {loading && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
              {loading ? "Loading winners..." : "Load more winners"}
            </button>
          )}
        </section>
      </div>
    </main>
  );
}
