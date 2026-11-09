"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Building2, CalendarDays, ChevronLeft, ChevronRight, CircleAlert, Clock3, CopyCheck, LoaderCircle, Mail, Search, UsersRound } from "lucide-react";

import { RoleGate } from "@/components/auth/role-gate";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopHeader } from "@/components/dashboard/top-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";

const PAGE_SIZE = 25;

function formatEventDate(value, timezone) {
  if (!value) return "Date not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not set";

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

function DuplicateAttendeesShell({ user, logout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data, error, isLoading, mutate } = useSWR(
    ["/api/attendees/duplicates", debouncedSearch, page],
    ([url, currentSearch, currentPage]) => api.get(url, {
      params: { search: currentSearch || undefined, page: currentPage, per_page: PAGE_SIZE },
    }).then((response) => response.data),
    { revalidateOnFocus: true },
  );

  const attendees = Array.isArray(data?.data) ? data.data : [];
  const meta = data?.meta;
  const currentPage = meta?.current_page || page;
  const lastPage = Math.max(1, meta?.last_page || 1);
  const total = meta?.total || 0;
  const firstItem = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(currentPage * PAGE_SIZE, total);

  return (
    <div className="min-h-screen bg-[#fffaf7] text-[#25170f]">
      <Sidebar role={user.role} activeItem="Duplicate Attendees" mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <TopHeader onMenuOpen={() => setSidebarOpen(true)} onLogout={logout} user={user} />

      <div className="xl:pl-72">
        <main className="min-h-screen px-4 pt-[72px] pb-8 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1600px] space-y-6">
            <section className="flex flex-col gap-4 pt-0.5 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-[#ffdece] text-[#f6671e]">
                    <CopyCheck aria-hidden="true" className="size-5" />
                  </span>
                  <h1 className="text-[28px] leading-9 font-bold tracking-tight sm:text-4xl sm:leading-11">Duplicate Attendees</h1>
                </div>
                <p className="text-sm text-[#6f625b]">Attendees are matched by normalized email. Only confirmed registrations count.</p>
              </div>
              <div className="flex w-full items-center gap-2 rounded-xl border border-[#ffdece] bg-white px-3 sm:max-w-sm">
                <Search aria-hidden="true" className="size-4 shrink-0 text-[#8a766b]" />
                <Input
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search attendee or email"
                  aria-label="Search duplicate attendees by name or email"
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                />
              </div>
            </section>

            <div className="flex flex-wrap items-center gap-2 text-sm text-[#6f625b]">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#fff0e8] px-3 py-1.5 font-semibold text-[#f6671e]">
                <UsersRound aria-hidden="true" className="size-4" />
                {total.toLocaleString()} {total === 1 ? "attendee" : "attendees"} registered across multiple events
              </span>
            </div>

            {error && (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#ffdad6] px-4 py-3 text-sm font-medium text-[#93000a]">
                <span className="flex items-center gap-2"><CircleAlert aria-hidden="true" className="size-4 shrink-0" />Duplicate attendee records could not be loaded.</span>
                <Button type="button" variant="secondary" onClick={() => mutate()}>Try again</Button>
              </div>
            )}

            {isLoading ? (
              <Card className="flex min-h-48 items-center justify-center">
                <LoaderCircle aria-label="Loading duplicate attendees" className="size-7 animate-spin text-[#f6671e]" />
              </Card>
            ) : error ? (
              <Card className="p-6 text-center text-sm text-[#6f625b]">The list is unavailable. Use “Try again” to reload it.</Card>
            ) : attendees.length === 0 ? (
              <Card className="flex min-h-48 flex-col items-center justify-center gap-2 p-6 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-[#fff0e8] text-[#f6671e]"><UsersRound aria-hidden="true" className="size-5" /></span>
                <p className="font-semibold">{debouncedSearch ? "No matching duplicate attendees" : "No duplicate registrations found"}</p>
                <p className="text-sm text-[#6f625b]">Attendees appear here when they have confirmed registrations for at least two different events.</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {attendees.map((attendee) => (
                  <Card key={attendee.id} className="overflow-hidden p-0">
                    <div className="flex flex-col gap-4 border-b border-[#ffdece]/70 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-lg font-semibold">{attendee.first_name} {attendee.last_name}</h2>
                          <span className="rounded-full bg-[#fff0e8] px-2.5 py-1 text-xs font-semibold text-[#d84f0e]">
                            {attendee.confirmed_event_count} events
                          </span>
                        </div>
                        <p className="mt-1 flex items-center gap-2 break-all text-sm text-[#6f625b]"><Mail aria-hidden="true" className="size-4 shrink-0" />{attendee.email}</p>
                      </div>
                    </div>

                    <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
                      {attendee.events.map((event) => (
                        <article key={event.slug} className="rounded-xl border border-[#ffdece]/80 bg-[#fffaf7] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="font-semibold leading-5">{event.title}</h3>
                            <span className="shrink-0 rounded-full bg-[#fff0e8] px-2 py-0.5 text-[10px] font-semibold text-[#9c4318]">
                              {event.event_deleted ? "Deleted" : event.event_status}
                            </span>
                          </div>
                          <p className="mt-2 flex items-start gap-2 text-sm text-[#6f625b]">
                            <Building2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                            <span>{event.location}</span>
                          </p>
                          <p className="mt-2 flex items-start gap-2 text-sm text-[#6f625b]">
                            <CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                            <span>{formatEventDate(event.starts_at, event.timezone)}</span>
                          </p>
                          <p className="mt-2 flex items-start gap-2 text-xs text-[#8a766b]">
                            <Clock3 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                            <span>Registered {formatEventDate(event.registered_at, event.timezone)}</span>
                          </p>
                        </article>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <footer className="flex flex-col gap-3 border-t border-[#ffdece]/70 px-1 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[#6f625b]">{total ? `Showing ${firstItem}–${lastItem} of ${total} attendees` : "0 attendees"}</p>
              <div className="flex items-center justify-end gap-2">
                <span className="mr-1 text-xs text-[#6f625b]">Page {currentPage} of {lastPage}</span>
                <Button type="button" variant="secondary" size="icon" aria-label="Previous page" title="Previous page" disabled={currentPage <= 1 || isLoading} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft aria-hidden="true" className="size-4" /></Button>
                <Button type="button" variant="secondary" size="icon" aria-label="Next page" title="Next page" disabled={currentPage >= lastPage || isLoading} onClick={() => setPage((value) => value + 1)}><ChevronRight aria-hidden="true" className="size-4" /></Button>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function DuplicateAttendeesPage() {
  return <RoleGate>{({ user, logout }) => <DuplicateAttendeesShell user={user} logout={logout} />}</RoleGate>;
}
