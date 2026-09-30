"use client";

import { BadgeCheck, Camera, Keyboard, LoaderCircle, ScanLine, TriangleAlert } from "lucide-react";
import { useState } from "react";
import Swal from "sweetalert2";
import useSWR from "swr";

import { RoleGate } from "@/components/auth/role-gate";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopHeader } from "@/components/dashboard/top-header";
import { CameraScanner } from "@/components/scanner/camera-scanner";
import { CheckInResultDialog } from "@/components/scanner/check-in-result-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getApiErrorMessage } from "@/functions/auth";
import api from "@/lib/api";
import { getCameraErrorMessage, getCheckInErrorDetail, getCheckInFeedback, normalizeRegistrationCode, shouldPauseCamera } from "@/lib/check-in.mjs";

const feedbackStyles = {
  success: "border-[#80d5b3] bg-[#edfff6] text-[#005238]",
  warning: "border-[#ffc46b] bg-[#fff8e8] text-[#714500]",
  error: "border-[#ffb4ab] bg-[#fff0ee] text-[#93000a]",
};

async function getScannerEvents() {
  const response = await api.get("/api/scanner/events");
  return response.data.data;
}

function ScannerShell({ user, logout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [eventSlug, setEventSlug] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [scannedCode, setScannedCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const { data: events = [], error, isLoading } = useSWR("/api/scanner/events", getScannerEvents);

  async function handleLogout() {
    try {
      await logout();
    } catch (logoutError) {
      await Swal.fire({
        icon: "error",
        title: "Sign-out failed",
        text: getApiErrorMessage(logoutError, "Please try again."),
        confirmButtonColor: "#dc4f0a",
      });
    }
  }

  async function submitCode(value, source = "manual") {
    const code = normalizeRegistrationCode(value);

    if (!eventSlug) {
      setFeedback({ tone: "error", title: "Select an event first" });
      return;
    }

    if (!code || submitting || (source === "camera" && scannedCode)) {
      if (!code) setFeedback(getCheckInFeedback({ status: 422 }));
      return;
    }

    if (source === "camera") setScannedCode(code);

    setSubmitting(true);
    setFeedback(null);

    try {
      const response = await api.post(`/api/events/${eventSlug}/check-ins`, {
        registration_code: code,
        gate: "Scanner",
      });
      const attendee = response.data.data.registration.attendee;
      setFeedback({
        ...getCheckInFeedback(response),
        detail: `${attendee.first_name} ${attendee.last_name}`,
      });
      setManualCode("");
      setCameraOpen(false);
      setScannedCode("");
    } catch (requestError) {
      setFeedback({
        ...getCheckInFeedback(requestError),
        detail: getCheckInErrorDetail(requestError),
      });
    } finally {
      setSubmitting(false);
    }
  }

  function scanAnotherQr() {
    setFeedback(null);
    setScannedCode("");
    setManualCode("");
    setCameraError("");
    setCameraOpen(true);
    setCameraKey((key) => key + 1);
  }

  return (
    <div className="min-h-screen bg-[#fffaf7] text-[#25170f]">
      <Sidebar role={user.role} activeItem="Check In & Scanner" mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <TopHeader onMenuOpen={() => setSidebarOpen(true)} onLogout={handleLogout} user={user} />

      <div className="xl:pl-72">
        <main className="min-h-screen px-4 pt-24 pb-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl space-y-6">
            <div>
              <p className="text-xs font-bold tracking-[0.08em] text-[#f6671e] uppercase">Event access</p>
              <h1 className="mt-1 text-3xl font-bold">Check In &amp; Scanner</h1>
              <p className="mt-2 text-sm text-[#6f625b]">Scan an attendee QR pass or enter its registration code manually.</p>
            </div>

            {cameraOpen && (
              <Card className="border border-[#ffdece]">
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 font-semibold"><ScanLine className="text-[#f6671e]" /> Point the camera at the attendee QR</div>
                  <CameraScanner key={cameraKey} paused={shouldPauseCamera({ submitting, scannedCode, modalOpen: Boolean(feedback?.modal) })} onCode={(value) => submitCode(value, "camera")} onError={(failure) => setCameraError(getCameraErrorMessage(failure))} />
                  {cameraError && (
                    <div role="alert" className="space-y-3 rounded-xl bg-[#fff0ee] p-4 text-sm text-[#93000a]">
                      <p>{cameraError}</p>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant="secondary" onClick={() => { setCameraError(""); setCameraKey((key) => key + 1); }}>Try again</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => { setCameraOpen(false); setScannedCode(""); }}>Close camera</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="border border-[#ffdece]">
              <CardContent className="space-y-5">
                <div>
                  <label htmlFor="scanner-event" className="text-sm font-semibold">Event</label>
                  <select
                    id="scanner-event"
                    value={eventSlug}
                    onChange={(event) => {
                      setEventSlug(event.target.value);
                      setFeedback(null);
                    }}
                    disabled={isLoading}
                    className="mt-2 h-11 w-full rounded-xl border border-[#ffdece] bg-[#fffaf7] px-3 text-sm outline-none focus:border-[#f6671e] focus:ring-2 focus:ring-[#f6671e]/20"
                  >
                    <option value="">{isLoading ? "Loading events..." : "Select an event"}</option>
                    {events.map((event) => <option key={event.id} value={event.slug}>{event.title}</option>)}
                  </select>
                  {error && <p className="mt-2 text-sm text-[#93000a]">Events could not be loaded. Refresh and try again.</p>}
                  {!isLoading && !error && events.length === 0 && <p className="mt-2 text-sm text-[#6f625b]">No published events are available.</p>}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Button type="button" size="lg" onClick={() => { setCameraOpen((open) => !open); setCameraError(""); setScannedCode(""); }} disabled={!eventSlug || submitting}>
                    <Camera /> {cameraOpen ? "Close camera" : "Scan QR code"}
                  </Button>
                  <div className="flex gap-2">
                    <label htmlFor="registration-code" className="sr-only">Registration code</label>
                    <div className="relative min-w-0 flex-1">
                      <Keyboard className="pointer-events-none absolute top-3.5 left-3 size-4 text-[#96877f]" />
                      <input
                        id="registration-code"
                        value={manualCode}
                        onChange={(event) => setManualCode(event.target.value)}
                        onKeyDown={(event) => { if (event.key === "Enter") submitCode(manualCode); }}
                        placeholder="REG-XXXXXXXX"
                        className="h-11 w-full rounded-xl border border-[#ffdece] bg-[#fffaf7] pr-3 pl-10 font-mono text-sm uppercase outline-none focus:border-[#f6671e] focus:ring-2 focus:ring-[#f6671e]/20"
                      />
                    </div>
                    <Button type="button" size="icon" className="size-11" aria-label="Check in registration code" onClick={() => submitCode(manualCode)} disabled={!eventSlug || submitting}>
                      {submitting ? <LoaderCircle className="animate-spin" /> : <BadgeCheck />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {feedback && !feedback.modal && (
              <div role="status" className={`flex items-start gap-3 rounded-2xl border p-5 ${feedbackStyles[feedback.tone]}`}>
                {feedback.tone === "success" ? <BadgeCheck className="mt-0.5 size-6 shrink-0" /> : <TriangleAlert className="mt-0.5 size-6 shrink-0" />}
                <div>
                  <p className="font-bold">{feedback.title}</p>
                  {feedback.detail && <p className="mt-1 text-sm">{feedback.detail}</p>}
                  {cameraOpen && scannedCode && (
                    <Button type="button" size="sm" variant="secondary" className="mt-3" onClick={() => { setScannedCode(""); setFeedback(null); }}>Scan another QR</Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
      <CheckInResultDialog feedback={feedback} onScanAnother={scanAnotherQr} />
    </div>
  );
}

export default function ScannerPage() {
  return <RoleGate>{({ user, logout }) => <ScannerShell user={user} logout={logout} />}</RoleGate>;
}
