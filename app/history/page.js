"use client";

import { ChevronLeft, ChevronRight, CircleAlert, Dice5, History, LoaderCircle, Trophy, UsersRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";

import { RoleGate } from "@/components/auth/role-gate";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopHeader } from "@/components/dashboard/top-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import api from "@/lib/api";

const PAGE_SIZE = 25;

function formatEventDate(value, timezone) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone || undefined,
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function HistoryAction({ href, title, eventName, icon: Icon }) {
  return (
    <Button asChild type="button" variant="ghost" size="icon" aria-label={`${title} for ${eventName}`} title={title}>
      <Link href={href}>
        <Icon aria-hidden="true" className="size-4" />
      </Link>
    </Button>
  );
}

function HistoryShell({ user, logout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [page, setPage] = useState(1);
  const { data, error, isLoading, mutate } = useSWR(
    ["/api/events/history", page],
    ([url, currentPage]) => api.get(url, { params: { page: currentPage, per_page: PAGE_SIZE } }).then((response) => response.data),
    { revalidateOnFocus: true },
  );
  const events = Array.isArray(data?.data) ? data.data : [];
  const meta = data?.meta;
  const currentPage = meta?.current_page || page;
  const lastPage = Math.max(1, meta?.last_page || 1);
  const total = meta?.total || 0;
  const firstItem = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(currentPage * PAGE_SIZE, total);

  return (
    <div className="min-h-screen bg-[#fffaf7] text-[#25170f]">
      <Sidebar role={user.role} activeItem="History" mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <TopHeader onMenuOpen={() => setSidebarOpen(true)} onLogout={logout} user={user} />

      <div className="xl:pl-72">
        <main className="min-h-screen px-4 pt-[72px] pb-8 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1600px] space-y-6">
            <section className="space-y-1 pt-0.5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#ffdece] text-[#f6671e]">
                  <History aria-hidden="true" className="size-5" />
                </span>
                <h1 className="text-[28px] leading-9 font-bold tracking-tight sm:text-4xl sm:leading-11">History</h1>
              </div>
              <p className="text-sm text-[#6f625b]">Past events and quick access to their voting, raffles, and attendees.</p>
            </section>

            {error && (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#ffdad6] px-4 py-3 text-sm font-medium text-[#93000a]">
                <span className="flex items-center gap-2"><CircleAlert aria-hidden="true" className="size-4 shrink-0" />Past events could not be loaded.</span>
                <Button type="button" variant="secondary" onClick={() => mutate()}>Try again</Button>
              </div>
            )}

            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] border-collapse text-left text-sm">
                  <thead className="bg-[#fff4ee] text-xs font-semibold tracking-wide text-[#6f625b] uppercase">
                    <tr>
                      <th scope="col" className="px-5 py-4">Event Name</th>
                      <th scope="col" className="px-5 py-4">Location</th>
                      <th scope="col" className="px-5 py-4">Capacity</th>
                      <th scope="col" className="px-5 py-4">Start Date</th>
                      <th scope="col" className="px-5 py-4">End Date</th>
                      <th scope="col" className="px-5 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ffdece]/70">
                    {isLoading ? (
                      <tr><td colSpan={6} className="h-40 text-center text-[#6f625b]"><LoaderCircle aria-label="Loading event history" className="mx-auto size-6 animate-spin text-[#f6671e]" /></td></tr>
                    ) : error ? (
                      <tr><td colSpan={6} className="h-40 px-5 text-center text-[#6f625b]">History is unavailable. Use “Try again” to reload it.</td></tr>
                    ) : events.length === 0 ? (
                      <tr><td colSpan={6} className="h-40 px-5 text-center text-[#6f625b]">No previous events yet.</td></tr>
                    ) : events.map((event) => {
                      const eventPath = `/events/${encodeURIComponent(event.slug)}`;
                      return (
                        <tr key={event.slug} className="bg-white transition-colors hover:bg-[#fffaf7]">
                          <td className="max-w-72 px-5 py-4 font-semibold text-[#25170f]">{event.title}</td>
                          <td className="max-w-64 px-5 py-4 text-[#6f625b]">{event.location || "Venue pending"}</td>
                          <td className="px-5 py-4 tabular-nums text-[#6f625b]">{event.capacity == null ? "—" : event.capacity.toLocaleString()}</td>
                          <td className="px-5 py-4 whitespace-nowrap text-[#6f625b]">{formatEventDate(event.starts_at, event.timezone)}</td>
                          <td className="px-5 py-4 whitespace-nowrap text-[#6f625b]">{formatEventDate(event.ends_at, event.timezone)}</td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-1">
                              <HistoryAction href={`${eventPath}/voting`} title="View Voting" eventName={event.title} icon={Trophy} />
                              <HistoryAction href={`${eventPath}/raffle`} title="View Raffles" eventName={event.title} icon={Dice5} />
                              <HistoryAction href={`${eventPath}/attendees`} title="View Attendees" eventName={event.title} icon={UsersRound} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <footer className="flex flex-col gap-3 border-t border-[#ffdece]/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-xs text-[#6f625b]">{total ? `Showing ${firstItem}–${lastItem} of ${total} events` : "0 events"}</p>
                <div className="flex items-center justify-end gap-2">
                  <span className="mr-1 text-xs text-[#6f625b]">Page {currentPage} of {lastPage}</span>
                  <Button type="button" variant="secondary" size="icon" aria-label="Previous page" title="Previous page" disabled={currentPage <= 1 || isLoading} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft aria-hidden="true" className="size-4" /></Button>
                  <Button type="button" variant="secondary" size="icon" aria-label="Next page" title="Next page" disabled={currentPage >= lastPage || isLoading} onClick={() => setPage((value) => value + 1)}><ChevronRight aria-hidden="true" className="size-4" /></Button>
                </div>
              </footer>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  return <RoleGate>{({ user, logout }) => <HistoryShell user={user} logout={logout} />}</RoleGate>;
}
