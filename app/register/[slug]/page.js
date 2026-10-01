"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, LoaderCircle, LockKeyhole, QrCode } from "lucide-react";
import Image from "next/image";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";

function RegistrationField({ field, value, onChange }) {
  const inputId = `field-${field.id}`;

  if (field.type === "paragraph") {
    return (
      <textarea
        id={inputId}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        required={field.is_required}
        className="w-full resize-y rounded-xl border-0 bg-[#fff4ee] px-3 py-2.5 text-sm text-[#25170f] outline-none focus:ring-2 focus:ring-[#f6671e]/25"
      />
    );
  }

  if (field.type === "dropdown") {
    return (
      <select
        id={inputId}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        required={field.is_required}
        className="h-10 w-full rounded-xl border-0 bg-[#fff4ee] px-3 text-sm text-[#25170f] outline-none focus:ring-2 focus:ring-[#f6671e]/25"
      >
        <option value="">Choose an option</option>
        {field.options.map((option) => <option key={option.id} value={option.value}>{option.label}</option>)}
      </select>
    );
  }

  if (field.type === "multiple" || field.type === "checkboxes") {
    const selectedValues = field.type === "checkboxes" ? value || [] : [value];
    return (
      <div className="space-y-2">
        {field.options.map((option) => (
          <label key={option.id} className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#fff4ee] px-3 py-2 text-sm text-[#25170f]">
            <input
              type={field.type === "multiple" ? "radio" : "checkbox"}
              name={inputId}
              value={option.value}
              checked={selectedValues.includes(option.value)}
              required={field.is_required && field.type === "multiple"}
              onChange={(event) => {
                if (field.type === "multiple") {
                  onChange(option.value);
                  return;
                }

                onChange(
                  event.target.checked
                    ? [...selectedValues, option.value]
                    : selectedValues.filter((selected) => selected !== option.value),
                );
              }}
              className="accent-[#f6671e]"
            />
            {option.label}
          </label>
        ))}
      </div>
    );
  }

  return (
    <Input
      id={inputId}
      type={field.type === "date" ? "date" : field.system_key === "email" ? "email" : "text"}
      value={value || ""}
      onChange={(event) => onChange(event.target.value)}
      required={field.is_required}
    />
  );
}

function RegistrationConfirmation({ confirmation, event }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrError, setQrError] = useState("");
  const registration = confirmation.registration;

  useEffect(() => {
    let active = true;

    QRCode.toDataURL(registration.registration_code, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#25170f", light: "#ffffff" },
    })
      .then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (active) setQrError("The QR image could not be generated. Keep your registration code below.");
      });

    return () => {
      active = false;
    };
  }, [registration.registration_code]);

  function downloadQrCode() {
    if (!qrDataUrl) return;

    const link = document.createElement("a");
    const eventName = event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    link.href = qrDataUrl;
    link.download = `${eventName || "event"}-attendee-qr-pass.png`;
    link.click();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fffaf7] p-4">
      <Card className="w-full max-w-lg text-center">
        <CardContent className="space-y-5 p-6 sm:p-8">
          <CheckCircle2 className="mx-auto size-12 text-[#006c49]" />
          <div>
            <h1 className="text-2xl font-bold">Registration confirmed</h1>
            <p className="mt-2 text-sm text-[#6f625b]">
              Present this attendee QR pass when you arrive at {event.title}.
            </p>
          </div>

          <div className="mx-auto flex size-72 max-w-full items-center justify-center rounded-2xl border border-[#ffdece] bg-white p-3">
            {qrDataUrl ? (
              <Image
                src={qrDataUrl}
                alt={`Attendee QR pass for ${event.title}`}
                width={264}
                height={264}
                unoptimized
              />
            ) : qrError ? (
              <QrCode className="size-16 text-[#96877f]" aria-hidden="true" />
            ) : (
              <LoaderCircle className="size-8 animate-spin text-[#f6671e]" aria-label="Generating attendee QR pass" />
            )}
          </div>

          {qrError && <p role="alert" className="text-sm text-[#93000a]">{qrError}</p>}

          <div>
            <p className="text-sm text-[#6f625b]">Registration code</p>
            <p className="mt-1 font-mono text-lg font-bold text-[#f6671e]">{registration.registration_code}</p>
          </div>

          <div
            role="status"
            className={confirmation.emailQueued
              ? "rounded-xl bg-[#e6f8ef] px-4 py-3 text-sm text-[#006c49]"
              : "rounded-xl bg-[#fff0ed] px-4 py-3 text-sm text-[#a5261d]"}
          >
            {confirmation.emailQueued
              ? `A copy of this QR pass is queued to be emailed to ${registration.attendee.email}.`
              : "The QR email could not be queued. Download and save this pass now."}
          </div>

          <Button type="button" className="w-full" onClick={downloadQrCode} disabled={!qrDataUrl}>
            <Download className="size-4" />
            Download QR pass
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

export default function EventRegistrationPage() {
  const { slug } = useParams();
  const { data: event, error, isLoading } = useSWR(
    slug ? `/api/registration/events/${slug}` : null,
    () => api.get(`/api/registration/events/${slug}`).then((response) => response.data.data),
    { shouldRetryOnError: false },
  );
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [confirmation, setConfirmation] = useState(null);

  async function handleSubmit(submitEvent) {
    submitEvent.preventDefault();
    setIsSubmitting(true);
    setSubmitError("");

    try {
      const { data } = await api.post(`/api/registration/events/${slug}`, { answers });
      setConfirmation({ registration: data.data, emailQueued: data.email_queued });
    } catch (requestError) {
      const errors = requestError.response?.data?.errors;
      setSubmitError(
        errors
          ? Object.values(errors).flat().join(" ")
          : requestError.response?.data?.message || "Registration could not be completed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#fffaf7]"><LoaderCircle className="size-8 animate-spin text-[#f6671e]" /></main>;
  }

  if (error || !event) {
    return <main className="flex min-h-screen items-center justify-center bg-[#fffaf7] p-6 text-center text-[#25170f]">This registration form is unavailable.</main>;
  }

  if (confirmation) {
    return <RegistrationConfirmation confirmation={confirmation} event={event} />;
  }

  if (event.registration_is_open === false) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fffaf7] p-4">
        <Card className="w-full max-w-lg border border-[#ffdece] text-center">
          <CardContent className="space-y-4 p-6 sm:p-8">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#fff4ee] text-[#f6671e]"><LockKeyhole className="size-7" /></div>
            <div>
              <h1 className="text-2xl font-bold text-[#25170f]">Registration is closed</h1>
              <p className="mt-2 text-sm text-[#6f625b]">Registration for {event.title} is currently closed by the event organizer.</p>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const form = event.active_registration_form;

  return (
    <main className="min-h-screen bg-[#fffaf7] px-4 py-8 sm:py-12">
      <Card className="mx-auto w-full max-w-2xl overflow-hidden border border-[#ffdece]">
        <div className="border-t-8 border-[#f6671e] p-6 sm:p-8">
          <span className="text-[11px] font-bold tracking-[0.1em] text-[#f6671e] uppercase">Event registration</span>
          <h1 className="mt-2 text-2xl font-bold text-[#25170f] sm:text-3xl">{event.title}</h1>
          {event.description && <p className="mt-2 text-sm leading-6 text-[#6f625b]">{event.description}</p>}
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#6f625b]"><span className="rounded-full bg-[#fff4ee] px-3 py-1.5">{new Date(event.starts_at).toLocaleString()}</span><span className="rounded-full bg-[#fff4ee] px-3 py-1.5">{event.venue || "Online event"}</span></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 border-t border-[#ffdece] p-6 sm:p-8">
          {submitError && <div role="alert" className="rounded-xl bg-[#ffdad6] px-4 py-3 text-sm font-medium text-[#93000a]">{submitError}</div>}
          {form.fields.map((field) => (
            <div key={field.id}>
              <label htmlFor={`field-${field.id}`} className="mb-1.5 block text-sm font-semibold text-[#25170f]">{field.label}{field.is_required && <span className="ml-1 text-[#ba1a1a]">*</span>}</label>
              {field.description && <p className="mb-2 text-xs text-[#96877f]">{field.description}</p>}
              <RegistrationField field={field} value={answers[field.key]} onChange={(value) => setAnswers((current) => ({ ...current, [field.key]: value }))} />
            </div>
          ))}
          <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Registering..." : "Complete Registration"}</Button>
        </form>
      </Card>
    </main>
  );
}
