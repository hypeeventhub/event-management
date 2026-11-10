"use client";

import { Armchair, ArrowLeft, BadgeCheck, ChevronLeft, ChevronRight, Eye, FileSpreadsheet, FileText, LoaderCircle, Search, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AnsweredFormsDialog from "@/components/dashboard/answered-forms-dialog";
import VotingActivityDialog from "@/components/dashboard/voting-activity-dialog";
import api from "@/lib/api";
import { buildAllRegistrantsCsv, buildAttendeeExportData } from "@/lib/attendee-export.mjs";
import { getAttendeesChannelName, getEcho } from "@/lib/echo";

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
  const [selectedVotingRegistration, setSelectedVotingRegistration] = useState(null);
  const [selectedSeatRegistration, setSelectedSeatRegistration] = useState(null);
  const [seatTableNumber, setSeatTableNumber] = useState("");
  const [seatNumber, setSeatNumber] = useState("");
  const [seatChartTable, setSeatChartTable] = useState(1);
  const [activeTab, setActiveTab] = useState("attendees");
  const [assigningSeat, setAssigningSeat] = useState(false);
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
  const seatingKey = id && event?.seating_enabled ? `/api/events/${id}/seating` : null;
  const { data: seatingSummary, mutate: mutateSeating } = useSWR(
    seatingKey,
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

  useEffect(() => {
    if (!event?.id) return undefined;

    const echo = getEcho();
    if (!echo) return undefined;

    const channelName = getAttendeesChannelName(event.id);
    const channel = echo.private(channelName);
    channel.listen(".attendee.registered", () => {
      mutateRegistrations();
      mutateSeating();
    });

    return () => {
      channel.stopListening(".attendee.registered");
      echo.leave(channelName);
    };
  }, [event?.id, mutateRegistrations, mutateSeating]);

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
  const occupiedSeats = seatingSummary?.assignments || [];
  const currentTableAssignments = occupiedSeats.filter((assignment) => Number(assignment.table_number) === seatChartTable);
  const currentTableSeats = Array.from({ length: seatingSummary?.seats_per_table || 0 }, (_, index) => index + 1);
  const assignmentBySeat = new Map(currentTableAssignments.map((assignment) => [Number(assignment.seat_number), assignment]));
  const availableSeats = seatTableNumber && seatingSummary
    ? Array.from({ length: seatingSummary.seats_per_table }, (_, index) => index + 1)
      .filter((number) => !occupiedSeats.some((assignment) => Number(assignment.table_number) === Number(seatTableNumber)
        && Number(assignment.seat_number) === number
        && Number(assignment.registration_id) !== Number(selectedSeatRegistration?.id)))
    : [];

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

  async function exportSeatingToExcel() {
    if (!seatingSummary || exportingFormat) return;

    setExportingFormat("seating");
    setActionError("");
    try {
      const [{ createAttendeeWorkbookSheets }, { default: writeExcelFile }] = await Promise.all([
        import("@/lib/attendee-workbook.mjs"),
        import("write-excel-file/browser"),
      ]);
      const assignments = seatingSummary.assignments || [];
      const columns = [
        { header: "Table number", key: "table_number" },
        { header: "Seat number", key: "seat_number" },
        { header: "Attendee", key: "name" },
        { header: "Email", key: "email" },
        { header: "Registration code", key: "registration_code" },
        { header: "Check-in status", key: "check_in_status" },
      ];
      const sheets = Array.from({ length: seatingSummary.seats_per_table }, (_, index) => {
        const seatNumberForSheet = index + 1;
        return {
          name: `Seat ${seatNumberForSheet}`,
          rows: assignments
            .filter((assignment) => Number(assignment.seat_number) === seatNumberForSheet)
            .map((assignment) => ({
              table_number: assignment.table_number,
              seat_number: assignment.seat_number,
              name: `${assignment.first_name || ""} ${assignment.last_name || ""}`.trim(),
              email: assignment.email || "",
              registration_code: assignment.registration_code || "",
              check_in_status: assignment.checked_in ? "Checked in" : "Not checked in",
            })),
        };
      });
      const safeTitle = data.event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

      await writeExcelFile(createAttendeeWorkbookSheets({ columns, sheets })).toFile(
        `${safeTitle || "event"}-seating-arrangement.xlsx`,
      );
    } catch (requestError) {
      setActionError(requestError.response?.data?.message || "The seating arrangement export could not be generated.");
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
      await Promise.all([mutateRegistrations(), mutateSeating()]);
    } catch (requestError) {
      setActionError(requestError.response?.data?.message || "The attendee could not be checked in.");
    } finally {
      setCheckingIn(null);
    }
  }

  function openSeatDialog(registration) {
    setSelectedSeatRegistration(registration);
    setSeatTableNumber(registration.seat_assignment ? String(registration.seat_assignment.table_number) : "");
    setSeatNumber(registration.seat_assignment ? String(registration.seat_assignment.seat_number) : "");
    setActionError("");
  }

  async function assignSeat() {
    if (!selectedSeatRegistration || !seatTableNumber || !seatNumber || assigningSeat) return;

    setAssigningSeat(true);
    setActionError("");
    try {
      await api.patch(`/api/events/${id}/registrations/${selectedSeatRegistration.id}/seat`, {
        table_number: Number(seatTableNumber),
        seat_number: Number(seatNumber),
      });
      await Promise.all([mutateRegistrations(), mutateSeating()]);
      setSelectedSeatRegistration(null);
    } catch (requestError) {
      setActionError(requestError.response?.data?.message || "The seat could not be assigned. Refresh the seating list and try again.");
    } finally {
      setAssigningSeat(false);
    }
  }

  async function removeSeatAssignment() {
    if (!selectedSeatRegistration || assigningSeat) return;

    setAssigningSeat(true);
    setActionError("");
    try {
      await api.delete(`/api/events/${id}/registrations/${selectedSeatRegistration.id}/seat`);
      await Promise.all([mutateRegistrations(), mutateSeating()]);
      setSelectedSeatRegistration(null);
    } catch (requestError) {
      setActionError(requestError.response?.data?.message || "The seat assignment could not be removed.");
    } finally {
      setAssigningSeat(false);
    }
  }

  async function saveRegistrationAnswers(payload) {
    if (!selectedRegistration) return null;

    const { data: response } = await api.patch(
      `/api/events/${id}/registrations/${selectedRegistration.id}/answers`,
      payload,
    );
    const updatedRegistration = response.data;
    setSelectedRegistration(updatedRegistration);
    await mutateRegistrations().catch(() => undefined);

    return updatedRegistration;
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
            {activeTab === "attendees" && <>
              <Button type="button" variant="secondary" onClick={exportToExcel} disabled={Boolean(exportingFormat) || data.total === 0}>
                {exportingFormat === "excel" ? <LoaderCircle className="animate-spin" /> : <FileSpreadsheet />}
                {exportingFormat === "excel" ? "Exporting..." : "Export Excel"}
              </Button>
              <Button type="button" variant="secondary" onClick={exportToCsv} disabled={Boolean(exportingFormat) || data.total === 0}>
                {exportingFormat === "csv" ? <LoaderCircle className="animate-spin" /> : <FileText />}
                {exportingFormat === "csv" ? "Exporting..." : "Export CSV"}
              </Button>
            </>}
            <div className="flex size-12 items-center justify-center rounded-xl bg-[#ffdece] text-[#f6671e]">{activeTab === "seating" ? <Armchair className="size-6" /> : <UsersRound className="size-6" />}</div>
          </div>
        </div>

        {data.event.seating_enabled && <div
          role="tablist"
          aria-label="Attendee views"
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const nextTab = activeTab === "attendees" ? "seating" : "attendees";
            setActiveTab(nextTab);
            document.getElementById(`${nextTab}-tab`)?.focus();
          }}
          className="flex w-full gap-1 overflow-x-auto rounded-xl border border-[#ffdece] bg-white p-1 sm:w-fit"
        >
          <button
            id="attendees-tab"
            type="button"
            role="tab"
            aria-selected={activeTab === "attendees"}
            aria-controls="attendees-panel"
            tabIndex={activeTab === "attendees" ? 0 : -1}
            onClick={() => setActiveTab("attendees")}
            className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors ${activeTab === "attendees" ? "bg-[#fff4ee] text-[#f6671e] shadow-sm" : "text-[#6f625b] hover:bg-[#fffaf7]"}`}
          >
            <UsersRound className="size-4" />Attendees
          </button>
          <button
            id="seating-tab"
            type="button"
            role="tab"
            aria-selected={activeTab === "seating"}
            aria-controls="seating-panel"
            tabIndex={activeTab === "seating" ? 0 : -1}
            onClick={() => setActiveTab("seating")}
            className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors ${activeTab === "seating" ? "bg-[#fff4ee] text-[#f6671e] shadow-sm" : "text-[#6f625b] hover:bg-[#fffaf7]"}`}
          >
            <Armchair className="size-4" />Seating arrangement
          </button>
        </div>}

        {actionError && <div role="alert" className="rounded-xl bg-[#ffdad6] px-4 py-3 text-sm font-medium text-[#93000a]">{actionError}</div>}

        {data.event.seating_enabled && <div id="seating-panel" role="tabpanel" aria-labelledby="seating-tab" hidden={activeTab !== "seating"} className="space-y-5">
        <Card className="border border-[#ffdece] p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#ffdece] text-[#f6671e]"><Armchair className="size-5" /></div>
              <div>
                <h2 className="font-semibold text-[#25170f]">Seating assignments</h2>
                <p className="mt-1 text-sm text-[#6f625b]">
                  {seatingSummary
                    ? `${seatingSummary.confirmed_assigned_count} of ${seatingSummary.confirmed_registrations_count} confirmed attendees assigned`
                    : "Loading seating assignments…"}
                </p>
              </div>
            </div>
            {seatingSummary && <div className="flex flex-col gap-3 sm:items-end">
              <div className="sm:text-right">
                <p className="text-sm font-semibold text-[#25170f]">{seatingSummary.assigned_count} / {seatingSummary.total_seats} seats assigned</p>
                <p className="mt-1 text-xs text-[#6f625b]">{seatingSummary.unassigned_confirmed_count} confirmed attendee{seatingSummary.unassigned_confirmed_count === 1 ? "" : "s"} still need a seat</p>
              </div>
              <Button type="button" variant="secondary" onClick={exportSeatingToExcel} disabled={Boolean(exportingFormat)}>
                {exportingFormat === "seating" ? <LoaderCircle className="animate-spin" /> : <FileSpreadsheet />}
                {exportingFormat === "seating" ? "Exporting seating…" : "Export seating Excel"}
              </Button>
            </div>}
          </div>
        </Card>

        {seatingSummary && <Card className="border border-[#ffdece] p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-[#25170f]">Seating chart</h2>
              <p className="mt-1 text-sm text-[#6f625b]">View assigned attendees and open seats at each table.</p>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-[#fff4ee] p-2 sm:justify-start">
              <Button type="button" size="icon" variant="secondary" aria-label="Previous table" title="Previous table" disabled={seatChartTable <= 1} onClick={() => setSeatChartTable((current) => Math.max(1, current - 1))}><ChevronLeft /></Button>
              <div className="min-w-28 text-center">
                <p className="text-sm font-bold text-[#25170f]">Table {seatChartTable}</p>
                <p className="text-xs text-[#6f625b]">{seatChartTable} of {seatingSummary.table_count}</p>
              </div>
              <Button type="button" size="icon" variant="secondary" aria-label="Next table" title="Next table" disabled={seatChartTable >= seatingSummary.table_count} onClick={() => setSeatChartTable((current) => Math.min(seatingSummary.table_count, current + 1))}><ChevronRight /></Button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-[#6f625b]">
            <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full bg-[#f6671e]" />Assigned ({currentTableAssignments.length})</span>
            <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full border border-[#d8cbc4] bg-white" />Available ({Math.max(0, seatingSummary.seats_per_table - currentTableAssignments.length)})</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {currentTableSeats.map((seat) => {
              const assignment = assignmentBySeat.get(seat);
              return (
                <div key={seat} className={`min-h-24 rounded-xl border p-3 ${assignment ? "border-[#ffb895] bg-[#fff4ee]" : "border-[#eee4de] bg-white"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6f625b]"><Armchair className={`size-4 ${assignment ? "text-[#f6671e]" : "text-[#96877f]"}`} />Seat {seat}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${assignment ? "bg-[#ffdece] text-[#a84410]" : "bg-[#f7f1ed] text-[#6f625b]"}`}>{assignment ? "Assigned" : "Open"}</span>
                  </div>
                  {assignment ? <div className="mt-3">
                    <p className="text-sm leading-5 font-semibold text-[#25170f]">{assignment.first_name} {assignment.last_name}</p>
                    <p className="mt-1 break-all text-[11px] leading-4 text-[#6f625b]">{assignment.email}</p>
                    <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold ${assignment.checked_in ? "bg-[#e6f8ef] text-[#006c49]" : "bg-[#f7f1ed] text-[#6f625b]"}`}>
                      <span className={`size-1.5 rounded-full ${assignment.checked_in ? "bg-[#00875a]" : "bg-[#96877f]"}`} />
                      {assignment.checked_in ? "Checked in" : "Not checked in"}
                    </span>
                  </div> : <p className="mt-3 text-xs text-[#96877f]">Available seat</p>}
                </div>
              );
            })}
          </div>
        </Card>}
        </div>}

        <div id="attendees-panel" role={data.event.seating_enabled ? "tabpanel" : undefined} aria-labelledby={data.event.seating_enabled ? "attendees-tab" : undefined} hidden={data.event.seating_enabled && activeTab !== "attendees"} className="space-y-5">
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
              <table className="w-full min-w-[68rem] border-collapse text-left text-sm">
                <thead className="bg-[#fff4ee] text-[11px] tracking-[0.06em] text-[#6f625b] uppercase"><tr><th className="px-5 py-3">Attendee</th><th className="px-5 py-3">Registration code</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Voted status</th><th className="px-5 py-3">Registered</th><th className="px-5 py-3">Check-in</th>{data.event.seating_enabled && <th className="px-5 py-3">Seat</th>}<th className="px-5 py-3 text-right">Action</th></tr></thead>
                <tbody className="divide-y divide-[#ffdece]/70">
                  {data.registrations.map((registration) => {
                    const checkedIn = registration.check_ins.some((checkIn) => checkIn.result === "accepted");
                    return (
                      <tr key={registration.id} className="hover:bg-[#fffaf7]">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-[#25170f]">{registration.attendee.first_name} {registration.attendee.last_name}</div>
                          <div className="text-xs text-[#96877f]">{registration.attendee.email}</div>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-[#6f625b]">{registration.registration_code}</td>
                        <td className="px-5 py-4"><Badge variant="success">{registration.status}</Badge></td>
                        <td className="px-5 py-4">
                          <button type="button" onClick={() => setSelectedVotingRegistration(registration)} aria-label={`View voting activity for ${registration.attendee.first_name} ${registration.attendee.last_name}`} title="View voting activity" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f6671e]/40">
                            <Badge variant={registration.has_voted ? "success" : "neutral"}>{registration.has_voted ? "Voted" : "Not voted"}</Badge>
                          </button>
                        </td>
                        <td className="px-5 py-4 text-xs text-[#6f625b]">{new Date(registration.registered_at).toLocaleString()}</td>
                        <td className="px-5 py-4"><Badge variant={checkedIn ? "success" : "neutral"}>{checkedIn ? "Checked in" : "Not checked in"}</Badge></td>
                        {data.event.seating_enabled && <td className="px-5 py-4">
                          <Button type="button" size="sm" variant={registration.seat_assignment ? "secondary" : "outline"} disabled={registration.status !== "confirmed" || !seatingSummary} onClick={() => openSeatDialog(registration)}>
                            <Armchair />
                            {registration.seat_assignment ? `Table ${registration.seat_assignment.table_number} · Seat ${registration.seat_assignment.seat_number}` : "Assign seat"}
                          </Button>
                        </td>}
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button type="button" size="icon" variant="secondary" aria-label="View answered forms" title="View answered forms" onClick={() => setSelectedRegistration(registration)}><Eye /></Button>
                            <Button type="button" size="icon" variant={checkedIn ? "secondary" : "default"} aria-label={checkedIn ? "Checked in" : "Check in attendee"} title={checkedIn ? "Checked in" : "Check in attendee"} disabled={checkedIn || checkingIn === registration.id} onClick={() => checkIn(registration)}>
                              {checkingIn === registration.id ? <LoaderCircle className="animate-spin" /> : <BadgeCheck />}
                            </Button>
                          </div>
                        </td>
                      </tr>
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
      </div>

      <AnsweredFormsDialog
        registration={selectedRegistration}
        open={Boolean(selectedRegistration)}
        onSave={saveRegistrationAnswers}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRegistration(null);
          }
        }}
      />
      <VotingActivityDialog
        registration={selectedVotingRegistration}
        subjects={registrationPage?.voting_subjects || []}
        open={Boolean(selectedVotingRegistration)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedVotingRegistration(null);
          }
        }}
      />
      <Dialog
        open={Boolean(selectedSeatRegistration)}
        onOpenChange={(open) => {
          if (!open && !assigningSeat) {
            setSelectedSeatRegistration(null);
            setActionError("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <div className="space-y-5 p-6">
            <DialogHeader>
              <DialogTitle>Assign a seat</DialogTitle>
              <DialogDescription>
                Choose a table and seat for {selectedSeatRegistration?.attendee.first_name} {selectedSeatRegistration?.attendee.last_name}.
              </DialogDescription>
            </DialogHeader>

            {actionError && <div role="alert" className="rounded-lg bg-[#ffdad6] px-3 py-2 text-sm font-medium text-[#93000a]">{actionError}</div>}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium text-[#25170f]">
                <span>Table</span>
                <select
                  value={seatTableNumber}
                  onChange={(event) => {
                    setSeatTableNumber(event.target.value);
                    setSeatNumber("");
                    setActionError("");
                  }}
                  className="h-10 w-full rounded-lg border border-[#ffdece] bg-white px-3 text-sm outline-none focus:border-[#f6671e] focus:ring-2 focus:ring-[#f6671e]/15"
                >
                  <option value="">Select a table</option>
                  {Array.from({ length: seatingSummary?.table_count || 0 }, (_, index) => index + 1).map((table) => (
                    <option key={table} value={table}>Table {table}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium text-[#25170f]">
                <span>Seat</span>
                <select
                  value={seatNumber}
                  onChange={(event) => {
                    setSeatNumber(event.target.value);
                    setActionError("");
                  }}
                  disabled={!seatTableNumber}
                  className="h-10 w-full rounded-lg border border-[#ffdece] bg-white px-3 text-sm outline-none focus:border-[#f6671e] focus:ring-2 focus:ring-[#f6671e]/15 disabled:cursor-not-allowed disabled:bg-[#f7f1ed]"
                >
                  <option value="">Select a seat</option>
                  {availableSeats.map((seat) => (
                    <option key={seat} value={seat}>Seat {seat}</option>
                  ))}
                </select>
              </label>
            </div>

            <DialogFooter>
              {selectedSeatRegistration?.seat_assignment && <Button type="button" variant="secondary" disabled={assigningSeat} onClick={removeSeatAssignment}>
                {assigningSeat ? <LoaderCircle className="animate-spin" /> : null}Remove assignment
              </Button>}
              <Button type="button" variant="secondary" disabled={assigningSeat} onClick={() => setSelectedSeatRegistration(null)}>Cancel</Button>
              <Button type="button" disabled={!seatTableNumber || !seatNumber || assigningSeat} onClick={assignSeat}>
                {assigningSeat ? <LoaderCircle className="animate-spin" /> : <Armchair />}
                {assigningSeat ? "Saving…" : selectedSeatRegistration?.seat_assignment ? "Save seat" : "Assign seat"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
