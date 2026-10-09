"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, ExternalLink, History, LoaderCircle, Mail, MailOpen, QrCode, Send } from "lucide-react";
import Image from "next/image";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import api from "@/lib/api";
import {
  buildInvitationPreview,
  invitationMessageType,
  isInvitationContextCurrent,
  isValidInvitationEmail,
  parseInvitationEmails,
} from "@/lib/invitations.mjs";

function formatInvitationDate(value) {
  if (!value) return "Date unavailable";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function InvitationDialogContent({ event, mode, open, onOpenChange }) {
  const [emailInput, setEmailInput] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [sendingEventId, setSendingEventId] = useState(null);
  const [invitationLogs, setInvitationLogs] = useState([]);
  const [loadedLogsFor, setLoadedLogsFor] = useState(null);
  const [logError, setLogError] = useState("");
  const [message, setMessage] = useState(null);
  const dialogContextRef = useRef({ eventId: event?.sourceId ?? null, open });
  const logRequestIdRef = useRef(0);
  const emails = useMemo(() => parseInvitationEmails(emailInput), [emailInput]);
  const invalidEmails = useMemo(
    () => emails.filter((email) => !isValidInvitationEmail(email)),
    [emails],
  );
  const isSending = sendingEventId === event?.sourceId;
  const canSend = Boolean(event?.sourceId) && emails.length > 0 && emails.length <= 100 && invalidEmails.length === 0 && !isSending;
  const isLoadingLogs = Boolean(open && event?.sourceId && loadedLogsFor !== event.sourceId);
  const registrationUrl = useMemo(() => {
    if (!event || typeof window === "undefined") return "";
    return `${window.location.origin}/register/${event.id}`;
  }, [event]);
  const invitationPreview = useMemo(
    () => buildInvitationPreview(event?.title || "this event", registrationUrl),
    [event?.title, registrationUrl],
  );

  useEffect(() => {
    dialogContextRef.current = { eventId: event?.sourceId ?? null, open };
  }, [event?.sourceId, open]);

  useEffect(() => {
    if (!open || !registrationUrl) return;

    let active = true;
    QRCode.toDataURL(registrationUrl, {
      width: 256,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#25170f", light: "#ffffff" },
    }).then((dataUrl) => {
      if (active) setQrDataUrl(dataUrl);
    });

    return () => {
      active = false;
    };
  }, [open, registrationUrl]);

  const loadInvitationLogs = useCallback(async (eventId) => {
    const requestId = ++logRequestIdRef.current;

    try {
      const { data } = await api.get(`/api/events/${eventId}/invitations`);

      if (requestId === logRequestIdRef.current && isInvitationContextCurrent(eventId, dialogContextRef.current)) {
        setInvitationLogs(data.data);
        setLogError("");
        setLoadedLogsFor(eventId);
      }
    } catch {
      if (requestId === logRequestIdRef.current && isInvitationContextCurrent(eventId, dialogContextRef.current)) {
        setInvitationLogs([]);
        setLogError("Recent invitation logs could not be loaded.");
        setLoadedLogsFor(eventId);
      }
    }
  }, []);

  useEffect(() => {
    if (!open || !event?.sourceId) return;

    const eventId = event.sourceId;
    const requestId = ++logRequestIdRef.current;

    api.get(`/api/events/${eventId}/invitations`)
      .then(({ data }) => {
        if (requestId === logRequestIdRef.current && isInvitationContextCurrent(eventId, dialogContextRef.current)) {
          setInvitationLogs(data.data);
          setLogError("");
          setLoadedLogsFor(eventId);
        }
      })
      .catch(() => {
        if (requestId === logRequestIdRef.current && isInvitationContextCurrent(eventId, dialogContextRef.current)) {
          setInvitationLogs([]);
          setLogError("Recent invitation logs could not be loaded.");
          setLoadedLogsFor(eventId);
        }
      });
  }, [event?.sourceId, open]);

  async function sendInvitation(submitEvent) {
    submitEvent.preventDefault();
    if (!canSend) return;

    const eventId = event.sourceId;
    setSendingEventId(eventId);
    setMessage(null);

    try {
      const { data } = await api.post(`/api/events/${eventId}/invitations`, {
        emails,
      });

      if (!isInvitationContextCurrent(eventId, dialogContextRef.current)) return;

      setMessage({ type: invitationMessageType(data.failed_count), text: data.message });
      setEmailInput("");
      await loadInvitationLogs(eventId);
    } catch (error) {
      if (!isInvitationContextCurrent(eventId, dialogContextRef.current)) return;

      const errors = error.response?.data?.errors;
      setMessage({
        type: "error",
        text: errors
          ? Object.values(errors).flat().join(" ")
          : error.response?.data?.message || "The invitation could not be sent.",
      });
    } finally {
      setSendingEventId((current) => current === eventId ? null : current);
    }
  }

  function downloadQrCode() {
    if (!qrDataUrl) return;

    const downloadLink = document.createElement("a");
    const filename = (event?.title || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    downloadLink.href = qrDataUrl;
    downloadLink.download = `${filename || "event"}-registration-qr.png`;
    downloadLink.click();
    setMessage({ type: "success", text: "Registration QR downloaded." });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-4xl overflow-x-hidden overflow-y-auto p-3 sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100%-2rem)] sm:p-6">
        <DialogHeader className="mt-1 min-w-0 pr-10 sm:mt-0">
          <DialogTitle>{mode === "view" ? event?.title : "Event published successfully"}</DialogTitle>
          <DialogDescription>
            {mode === "view"
              ? "Review the invitation, send it by email, or share the registration QR code."
              : "Invite attendees by email or let them scan the registration QR code."}
          </DialogDescription>
        </DialogHeader>

        <section className="mt-3 min-w-0 rounded-2xl border border-[#ffdece] bg-[#fffaf7] p-3 sm:mt-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#ffdece] text-[#f6671e]">
              <MailOpen className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-[#25170f]">Invitation email preview</h3>
              <p className="mt-2 break-words whitespace-pre-line text-sm leading-6 text-[#6f625b] [overflow-wrap:anywhere]">{invitationPreview}</p>
              <a
                href={registrationUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#f6671e] hover:underline"
              >
                <ExternalLink className="size-3.5" /> Open registration link
              </a>
            </div>
          </div>
        </section>

        <div className="mt-3 grid min-w-0 gap-3 sm:mt-4 sm:gap-4 md:grid-cols-2">
          <section className="min-w-0 rounded-2xl bg-[#fff4ee] p-3 sm:p-5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#ffdece] text-[#f6671e]">
              <Mail className="size-5" />
            </div>
            <h3 className="mt-3 font-bold text-[#25170f]">Email an invitation</h3>
            <p className="mt-1 text-xs leading-5 text-[#6f625b]">
              Paste up to 100 emails separated by commas, spaces, semicolons, or new lines.
            </p>
            <form onSubmit={sendInvitation} className="mt-4 space-y-3">
              <textarea
                value={emailInput}
                onChange={(inputEvent) => setEmailInput(inputEvent.target.value)}
                placeholder={"attendee@example.com\nsecond@example.com"}
                required
                rows={6}
                className="w-full min-w-0 resize-y rounded-xl border-0 bg-white px-3 py-2 text-sm text-[#25170f] outline-none placeholder:text-[#96877f] focus-visible:ring-2 focus-visible:ring-[#f6671e]/25"
              />
              <div className="space-y-1 text-xs">
                <p className={emails.length > 100 ? "font-medium text-[#93000a]" : "text-[#6f625b]"}>
                  {emails.length} unique {emails.length === 1 ? "recipient" : "recipients"} detected
                  {emails.length > 100 ? " — maximum is 100." : "."}
                </p>
                {invalidEmails.length > 0 && (
                  <p className="break-words font-medium text-[#93000a]">
                    Invalid: {invalidEmails.join(", ")}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={!canSend}>
                {isSending ? <LoaderCircle className="animate-spin" /> : <Send />}
                {isSending ? "Sending..." : `Send ${emails.length || ""} Invitation${emails.length === 1 ? "" : "s"}`}
              </Button>
            </form>
          </section>

          <section className="flex min-w-0 flex-col items-center rounded-2xl border border-[#ffdece] bg-white p-3 text-center sm:p-5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#ffdece] text-[#f6671e]">
              <QrCode className="size-5" />
            </div>
            <h3 className="mt-3 font-bold text-[#25170f]">Registration QR</h3>
            <div className="mt-3 flex aspect-square w-full max-w-56 items-center justify-center rounded-xl bg-[#fffaf7] p-2">
              {qrDataUrl ? (
                <Image src={qrDataUrl} alt={`Registration QR code for ${event?.title || "event"}`} width={208} height={208} className="h-auto w-full max-w-[208px]" unoptimized />
              ) : (
                <LoaderCircle className="size-7 animate-spin text-[#f6671e]" />
              )}
            </div>
            <div className="mt-3 flex w-full flex-col gap-2 min-[420px]:flex-row">
              <Button type="button" variant="secondary" size="sm" className="w-full min-w-0 flex-1" onClick={downloadQrCode} disabled={!qrDataUrl}>
                <Download />Download QR
              </Button>
              <Button asChild size="sm" className="w-full min-w-0 flex-1">
                <a href={registrationUrl} target="_blank" rel="noreferrer"><ExternalLink />Open Form</a>
              </Button>
            </div>
          </section>
        </div>

        <section className="mt-3 min-w-0 rounded-2xl border border-[#ffdece] bg-white p-3 sm:mt-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#ffdece] text-[#f6671e]">
              <History className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-[#25170f]">Recent invitation logs</h3>
              <p className="text-xs text-[#6f625b]">The latest 20 invitations for this event.</p>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-[#f3e5de]">
            {isLoadingLogs ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-[#6f625b]">
                <LoaderCircle className="size-4 animate-spin" /> Loading invitation logs...
              </div>
            ) : logError ? (
              <p className="px-4 py-6 text-sm text-[#93000a]">{logError}</p>
            ) : invitationLogs.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[#6f625b]">No invitations have been sent for this event.</p>
            ) : (
              <div className="divide-y divide-[#f3e5de]">
                {invitationLogs.map((invitation) => (
                  <div key={invitation.id} className="grid min-w-0 gap-2 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_auto_auto] sm:items-center">
                    <span className="truncate font-medium text-[#25170f]" title={invitation.event.title}>{invitation.event.title}</span>
                    <span className="truncate text-[#6f625b]" title={invitation.email}>{invitation.email}</span>
                    <span className={invitation.status === "sent" ? "w-fit rounded-full bg-[#6cf8bb]/35 px-2.5 py-1 text-xs font-semibold text-[#006c49]" : "w-fit rounded-full bg-[#ffdad6] px-2.5 py-1 text-xs font-semibold text-[#93000a]"}>
                      {invitation.status === "sent" ? "Sent" : "Failed"}
                    </span>
                    <time className="text-xs text-[#6f625b]" dateTime={invitation.created_at}>{formatInvitationDate(invitation.created_at)}</time>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {message && (
          <div role="status" className={message.type === "success" ? "mt-3 flex min-w-0 items-start gap-2 break-words rounded-xl bg-[#6cf8bb]/35 px-4 py-3 text-sm font-medium text-[#006c49] [overflow-wrap:anywhere] sm:mt-4" : "mt-3 min-w-0 break-words rounded-xl bg-[#ffdad6] px-4 py-3 text-sm font-medium text-[#93000a] [overflow-wrap:anywhere] sm:mt-4"}>
            {message.type === "success" && <CheckCircle2 className="size-4" />}
            {message.text}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function InvitationDialog({ event, mode = "published", open, onOpenChange }) {
  return (
    <InvitationDialogContent
      key={event?.sourceId ?? "no-event"}
      event={event}
      mode={mode}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
