"use client";

import { ArrowLeft, BadgeCheck, Eye, FileSpreadsheet, FileText, LoaderCircle, UsersRound } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import AnsweredFormsDialog from "@/components/dashboard/answered-forms-dialog";
import api from "@/lib/api";
import { buildAllRegistrantsCsv, buildAttendeeExportData } from "@/lib/attendee-export.mjs";

async function getAttendeeData(id) {
  const [eventResponse, registrationsResponse] = await Promise.all([
    api.get(`/api/events/${id}`),
    api.get(`/api/events/${id}/registrations`),
  ]);

  return {
    event: eventResponse.data.data,
    registrations: registrationsResponse.data.data,
    total: registrationsResponse.data.total,
  };
}

export default function EventAttendeesPage() {
  const { id } = useParams();
  const { data, error, isLoading, mutate } = useSWR(id ? `/api/events/${id}/attendees` : null, () => getAttendeeData(id));
  const [checkingIn, setCheckingIn] = useState(null);
  const [exportingFormat, setExportingFormat] = useState("");
  const [actionError, setActionError] = useState("");
  const [selectedRegistration, setSelectedRegistration] = useState(null);

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
      await mutate();
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

        <Card className="overflow-hidden border border-[#ffdece]">
          {data.registrations.length === 0 ? (
            <div className="p-12 text-center text-sm text-[#6f625b]">No one has registered for this event yet.</div>
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
