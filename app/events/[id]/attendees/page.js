"use client";

import { ArrowLeft, BadgeCheck, ChevronLeft, ChevronRight, Eye, FileSpreadsheet, FileText, LoaderCircle, Search, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import AnsweredFormsDialog from "@/components/dashboard/answered-forms-dialog";
import api from "@/lib/api";
import { buildAllRegistrantsCsv, buildAttendeeExportData } from "@/lib/attendee-export.mjs";

export default function EventAttendeesPage() {
  const { id } = useParams();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [checkInFilter, setCheckInFilter] = useState("all");
  const [sort, setSort] = useState("registered_at:desc");
  const [perPage, setPerPage] = useState(50);
  const [page, setPage] = useState(1);
  const [checkingIn, setCheckingIn] = useState(null);
  const [exportingFormat, setExportingFormat] = useState("");
  const [actionError, setActionError] = useState("");
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [sortBy, sortDirection] = sort.split(":");

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const query = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
    sort_by: sortBy,
    sort_direction: sortDirection,
  });
  if (search) query.set("search", search);
  if (statusFilter !== "all") query.set("status", statusFilter);
  if (checkInFilter !== "all") query.set("check_in", checkInFilter);

  const { data: event, error: eventError, isLoading: eventLoading } = useSWR(
    id ? `/api/events/${id}` : null,
    (url) => api.get(url).then((response) => response.data.data),
  );
  const registrationsKey = id ? `/api/events/${id}/registrations?${query.toString()}` : null;
  const {
    data: registrationPage,
    error: registrationsError,
    isLoading: registrationsLoading,
    isValidating: registrationsValidating,
    mutate: mutateRegistrations,
  } = useSWR(
    registrationsKey,
    (url) => api.get(url).then((response) => response.data),
    { keepPreviousData: true },
  );
  const data = event && registrationPage ? {
    event,
    registrations: registrationPage.data,
    total: registrationPage.all_total ?? event.registrations_count ?? registrationPage.total,
  } : null;
  const error = eventError || registrationsError;
  const isLoading = eventLoading || (registrationsLoading && !registrationPage);
  const resultCount = registrationPage?.total ?? 0;
  const lastPage = registrationPage?.last_page ?? 1;
  const currentPage = registrationPage?.current_page ?? page;
  const hasFilters = Boolean(search || statusFilter !== "all" || checkInFilter !== "all");

  useEffect(() => {
    if (registrationPage && page > registrationPage.last_page) {
      setPage(Math.max(1, registrationPage.last_page));
    }
  }, [page, registrationPage]);

  function resetToFirstPage() {
    setPage(1);
  }

  async function exportToExcel() {
    setExportingFormat("excel");
    setActionError("");

    try {
      const [{ data: response }, { createAttendeeWorkbookSheets }, { default: writeExcelFile }] = await Promise.all([
        api.get(`/api/events/${id}/registrations/export`),
        import("@/lib/attendee-workbook.mjs"),
        import("write-excel-file/browser"),
      ]);
      const safeTitle = data.event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

      await writeExcelFile(
        createAttendeeWorkbookSheets(
          buildAttendeeExportData(response.data, data.event.active_registration_form?.fields || []),
          data.event.timezone,
        ),
      ).toFile(`${safeTitle || "event"}-attendees.xlsx`);
    } catch (requestError) {
      setActionError(requestError.response?.data?.message || "The Excel export could not be generated.");
    } finally {
      setExportingFormat("");
    }
  }

  async function exportToCsv() {
    setExportingFormat("csv");
    setActionError("");

    try {
      const { data: response } = await api.get(`/api/events/${id}/registrations/export`);
      const safeTitle = data.event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const exportData = buildAttendeeExportData(response.data, data.event.active_registration_form?.fields || []);
      const file = new Blob([buildAllRegistrantsCsv(exportData)], { type: "text/csv;charset=utf-8" });
      const downloadUrl = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${safeTitle || "event"}-all-registrants.csv`;
      link.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (requestError) {
      setActionError(requestError.response?.data?.message || "The CSV export could not be generated.");
    } finally {
      setExportingFormat("");
    }
  }

  async function checkIn(registration) {
    setCheckingIn(registration.id);
    setActionError("");

    try {
      await api.post(`/api/events/${id}/check-ins`, {
        registration_code: registration.registration_code,
        gate: "Dashboard",
      });
      await mutateRegistrations();
    } catch (requestError) {
      setActionError(requestError.response?.data?.message || "The attendee could not be checked in.");
    } finally {
      setCheckingIn(null);
    }
  }

  if (isLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#fffaf7]"><LoaderCircle className="size-8 animate-spin text-[#f6671e]" /></main>;
  }

  if (error || !data) {
    return <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#fffaf7] p-6 text-center text-[#25170f]"><p>The attendee list could not be loaded.</p><Button asChild variant="secondary"><Link href="/">Return to dashboard</Link></Button></main>;
  }

  return (
    <main className="min-h-screen bg-[#fffaf7] p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <Button asChild variant="ghost" size="sm"><Link href="/"><ArrowLeft />Dashboard</Link></Button>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><p className="text-xs font-bold tracking-[0.08em] text-[#f6671e] uppercase">Registered attendees</p><h1 className="mt-1 text-3xl font-bold text-[#25170f]">{data.event.title}</h1><p className="mt-1 text-sm text-[#6f625b]">{data.total} total registration{data.total === 1 ? "" : "s"}</p></div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" onClick={exportToExcel} disabled={Boolean(exportingFormat) || data.total === 0}>
              {exportingFormat === "excel" ? <LoaderCircle className="animate-spin" /> : <FileSpreadsheet />}
              {exportingFormat === "excel" ? "Exporting..." : "Export Excel"}
            </Button>
            <Button type="button" variant="secondary" onClick={exportToCsv} disabled={Boolean(exportingFormat) || data.total === 0}>
              {exportingFormat === "csv" ? <LoaderCircle className="animate-spin" /> : <FileText />}
              {exportingFormat === "csv" ? "Exporting..." : "Export CSV"}
            </Button>
            <div className="flex size-12 items-center justify-center rounded-xl bg-[#ffdece] text-[#f6671e]"><UsersRound className="size-6" /></div>
          </div>
        </div>

        {actionError && <div role="alert" className="rounded-xl bg-[#ffdad6] px-4 py-3 text-sm font-medium text-[#93000a]">{actionError}</div>}

        <Card className="border border-[#ffdece] p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(16rem,1.5fr)_repeat(3,minmax(10rem,1fr))]">
            <label className="relative block">
              <span className="sr-only">Search attendees</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#96877f]" />
              <input
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                  resetToFirstPage();
                }}
                placeholder="Search name, email, or code"
                className="h-10 w-full rounded-lg border border-[#ffdece] bg-white pr-10 pl-9 text-sm text-[#25170f] outline-none placeholder:text-[#96877f] focus:border-[#f6671e] focus:ring-2 focus:ring-[#f6671e]/15"
              />
              {searchInput && <button type="button" onClick={() => { setSearchInput(""); setSearch(""); resetToFirstPage(); }} aria-label="Clear search" className="absolute top-1/2 right-3 -translate-y-1/2 text-[#96877f] hover:text-[#25170f]"><X className="size-4" /></button>}
            </label>
            <label className="text-xs font-semibold text-[#6f625b]">
              <span className="sr-only">Registration status</span>
              <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); resetToFirstPage(); }} className="h-10 w-full rounded-lg border border-[#ffdece] bg-white px-3 text-sm font-normal text-[#25170f] outline-none focus:border-[#f6671e] focus:ring-2 focus:ring-[#f6671e]/15">
                <option value="all">All statuses</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option><option value="rejected">Rejected</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-[#6f625b]">
              <span className="sr-only">Check-in status</span>
              <select value={checkInFilter} onChange={(event) => { setCheckInFilter(event.target.value); resetToFirstPage(); }} className="h-10 w-full rounded-lg border border-[#ffdece] bg-white px-3 text-sm font-normal text-[#25170f] outline-none focus:border-[#f6671e] focus:ring-2 focus:ring-[#f6671e]/15">
                <option value="all">All check-ins</option><option value="checked_in">Checked in</option><option value="not_checked_in">Not checked in</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-[#6f625b]">
              <span className="sr-only">Sort attendees</span>
              <select value={sort} onChange={(event) => { setSort(event.target.value); resetToFirstPage(); }} className="h-10 w-full rounded-lg border border-[#ffdece] bg-white px-3 text-sm font-normal text-[#25170f] outline-none focus:border-[#f6671e] focus:ring-2 focus:ring-[#f6671e]/15">
                <option value="registered_at:desc">Newest registered</option><option value="registered_at:asc">Oldest registered</option><option value="name:asc">Name A–Z</option><option value="name:desc">Name Z–A</option><option value="status:asc">Status A–Z</option><option value="status:desc">Status Z–A</option>
              </select>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#6f625b]">
            <p>{hasFilters ? `${resultCount} matching registration${resultCount === 1 ? "" : "s"}` : `${resultCount} registration${resultCount === 1 ? "" : "s"}`} {registrationsValidating && <span className="ml-1 text-[#f6671e]">Updating…</span>}</p>
            {hasFilters && <Button type="button" variant="ghost" size="sm" onClick={() => { setSearchInput(""); setSearch(""); setStatusFilter("all"); setCheckInFilter("all"); resetToFirstPage(); }}>Clear filters</Button>}
          </div>
        </Card>

        <Card className="overflow-hidden border border-[#ffdece]">
          {data.registrations.length === 0 ? (
            <div className="p-12 text-center text-sm text-[#6f625b]">{hasFilters ? "No attendees match these filters." : "No one has registered for this event yet."}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[62rem] border-collapse text-left text-sm">
                <thead className="bg-[#fff4ee] text-[11px] tracking-[0.06em] text-[#6f625b] uppercase"><tr><th className="px-5 py-3">Attendee</th><th className="px-5 py-3">Registration code</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Registered</th><th className="px-5 py-3">Check-in</th><th className="px-5 py-3 text-right">Action</th></tr></thead>
                <tbody className="divide-y divide-[#ffdece]/70">
                  {data.registrations.map((registration) => {
                    const checkedIn = registration.check_ins.some((checkIn) => checkIn.result === "accepted");
                    return (
                      <tr key={registration.id} className="hover:bg-[#fffaf7]"><td className="px-5 py-4"><div className="font-semibold text-[#25170f]">{registration.attendee.first_name} {registration.attendee.last_name}</div><div className="text-xs text-[#96877f]">{registration.attendee.email}</div></td><td className="px-5 py-4 font-mono text-xs text-[#6f625b]">{registration.registration_code}</td><td className="px-5 py-4"><Badge variant="success">{registration.status}</Badge></td><td className="px-5 py-4 text-xs text-[#6f625b]">{new Date(registration.registered_at).toLocaleString()}</td><td className="px-5 py-4"><Badge variant={checkedIn ? "success" : "neutral"}>{checkedIn ? "Checked in" : "Not checked in"}</Badge></td><td className="px-5 py-4"><div className="flex items-center justify-end gap-2"><Button type="button" size="icon" variant="secondary" aria-label="View answered forms" title="View answered forms" onClick={() => setSelectedRegistration(registration)}><Eye /></Button><Button type="button" size="icon" variant={checkedIn ? "secondary" : "default"} aria-label={checkedIn ? "Checked in" : "Check in attendee"} title={checkedIn ? "Checked in" : "Check in attendee"} disabled={checkedIn || checkingIn === registration.id} onClick={() => checkIn(registration)}>{checkingIn === registration.id ? <LoaderCircle className="animate-spin" /> : <BadgeCheck />}</Button></div></td></tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {resultCount > 0 && <div className="flex flex-col justify-between gap-3 text-sm text-[#6f625b] sm:flex-row sm:items-center">
          <p>Showing {registrationPage.from ?? 0}–{registrationPage.to ?? 0} of {resultCount}</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">Rows per page<select value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); resetToFirstPage(); }} className="h-9 rounded-lg border border-[#ffdece] bg-white px-2 text-[#25170f] outline-none focus:border-[#f6671e]"><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label>
            <span>Page {currentPage} of {lastPage}</span>
            <div className="flex gap-2">
              <Button type="button" size="icon" variant="secondary" aria-label="Previous page" title="Previous page" disabled={currentPage <= 1 || registrationsValidating} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft /></Button>
              <Button type="button" size="icon" variant="secondary" aria-label="Next page" title="Next page" disabled={currentPage >= lastPage || registrationsValidating} onClick={() => setPage((value) => Math.min(lastPage, value + 1))}><ChevronRight /></Button>
            </div>
          </div>
        </div>}
      </div>

      <AnsweredFormsDialog
        registration={selectedRegistration}
        open={Boolean(selectedRegistration)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRegistration(null);
          }
        }}
      />
    </main>
  );
}
