import { useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  QrCode,
  ScanQrCode,
  Settings2,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const fieldLabel =
  "mb-1 block text-[11px] leading-4 font-semibold text-[#6f625b] uppercase";
const selectClass =
  "h-10 w-full rounded-xl border-0 bg-[#fff4ee] px-3 text-sm text-[#25170f] outline-none focus:ring-2 focus:ring-[#f6671e]/25";

export { CreateEventDialog } from "@/components/dashboard/create-event-dialog";

function DialogHeading({ icon: Icon, title, description, tone = "primary" }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm",
          tone === "success" ? "bg-[#006c49]" : "bg-[#f6671e]",
        )}
      >
        <Icon className="size-5" />
      </div>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
    </div>
  );
}

function ScannerPanel({ onToast }) {
  const [scanState, setScanState] = useState("ready");
  const states = {
    ready: {
      icon: ShieldCheck,
      title: "Ready for Gate Optical Read",
      detail: "Gate Scanner Device #04 is connected",
      classes: "bg-[#fff4ee] text-[#25170f]",
      iconClasses: "text-[#006c49]",
    },
    success: {
      icon: CheckCircle2,
      title: "ACCESS GRANTED",
      detail: "Devon Ross • ID: NX-90123 • Attended Confirmed",
      classes: "bg-[#6cf8bb] text-[#00714d]",
      iconClasses: "text-[#00714d]",
    },
    duplicate: {
      icon: CircleAlert,
      title: "ALREADY CHECKED-IN",
      detail: "Badge previously scanned. Flag to supervisor.",
      classes: "bg-amber-100 text-amber-900",
      iconClasses: "text-amber-700",
    },
    error: {
      icon: XCircle,
      title: "INVALID PASS",
      detail: "Direct attendee to Helpdesk Desk 03.",
      classes: "bg-[#ffdad6] text-[#93000a]",
      iconClasses: "text-[#ba1a1a]",
    },
  };
  const current = states[scanState];
  const CurrentIcon = current.icon;

  function updateState(state) {
    setScanState(state);
    if (state === "success") onToast("Scan Verified (Gate 01)", "Attendee Devon Ross verified.");
    if (state === "duplicate") onToast("Duplicate Scan Warning", "Badge already consumed.");
    if (state === "error") onToast("Security Alert", "Unrecognized QR token rejected.");
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-xs leading-4 text-[#6f625b]">
        Choose a condition to simulate the response shown on a field scanner.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => updateState("success")}
          className="rounded-xl bg-[#6cf8bb] p-3 text-center font-semibold text-[#00714d] transition-opacity hover:opacity-85"
        >
          <CheckCircle2 className="mx-auto mb-1 size-7" />
          <span className="block text-[11px]">1. Success Scan</span>
        </button>
        <button
          type="button"
          onClick={() => updateState("duplicate")}
          className="rounded-xl bg-amber-100 p-3 text-center font-semibold text-amber-900 transition-opacity hover:opacity-85"
        >
          <CircleAlert className="mx-auto mb-1 size-7" />
          <span className="block text-[11px]">2. Amber Duplicate</span>
        </button>
        <button
          type="button"
          onClick={() => updateState("error")}
          className="rounded-xl bg-[#ffdad6] p-3 text-center font-semibold text-[#93000a] transition-opacity hover:opacity-85"
        >
          <XCircle className="mx-auto mb-1 size-7" />
          <span className="block text-[11px]">3. Red Scan Error</span>
        </button>
      </div>
      <div className={cn("flex min-h-28 flex-col items-center justify-center rounded-xl p-4 text-center", current.classes)}>
        <CurrentIcon className={cn("size-9", current.iconClasses)} />
        <div className="mt-1 text-xl leading-7 font-bold">{current.title}</div>
        <div className="text-xs leading-4 font-medium">{current.detail}</div>
      </div>
    </div>
  );
}

function PassPanel({ onToast }) {
  return (
    <div className="flex flex-col items-center space-y-4 text-center">
      <div className="flex w-60 flex-col items-center rounded-2xl bg-[#fff4ee] p-4 shadow-sm">
        <div className="my-3 flex size-36 items-center justify-center rounded-xl bg-white p-2 shadow-inner">
          <QrCode className="size-28 stroke-[1.5] text-[#25170f]" />
        </div>
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#6cf8bb] px-2 py-0.5 text-[11px] font-semibold text-[#00714d]">
          <span className="size-1.5 animate-pulse rounded-full bg-[#006c49]" /> Pass Validated
        </span>
      </div>
    </div>
  );
}

function SettingsPanel({ onToast }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-[#fff4ee] p-3">
        <label htmlFor="settings-name" className={fieldLabel}>
          Event Name & Primary Slug
        </label>
        <Input id="settings-name" className="bg-white" defaultValue="Annual Corporate Gala 2026" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-[#fff4ee] p-3">
          <label htmlFor="settings-limit" className={fieldLabel}>
            Invited Quorum Limit
          </label>
          <Input id="settings-limit" className="bg-white" type="number" defaultValue="2500" />
        </div>
        <div className="rounded-xl bg-[#fff4ee] p-3">
          <label htmlFor="settings-raffle" className={fieldLabel}>
            Raffle Ingestion Mode
          </label>
          <select id="settings-raffle" className={cn(selectClass, "bg-white")}>
            <option>Attended Guests Only (1,864)</option>
            <option>All Registered (2,287)</option>
          </select>
        </div>
      </div>
      <div className="flex flex-col justify-between gap-3 rounded-xl bg-[#6cf8bb]/30 p-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#25170f]">
          <BadgeCheck className="size-5 text-[#006c49]" />
          Sync to 12 Gate Mobile Scanners
        </div>
        <Button
          type="button"
          variant="success"
          size="sm"
          onClick={() => onToast("Configuration Pushed", "Broadcast sent to all 12 floor gate handhelds.")}
        >
          Push Live Update
        </Button>
      </div>
    </div>
  );
}

const dialogDetails = {
  scanner: {
    icon: ScanQrCode,
    title: "Staff POC QR Scanner (Tri-State)",
    description: "Green success, amber already checked-in, and red error states",
    status: "Gate Scanner Device #04 (Connected)",
  },
  pass: {
    icon: QrCode,
    title: "Mobile Attendee Reg & Pass Simulator",
    description: "Attendee self-registration preview with dynamic QR payload",
    status: "Cryptographic Signature: SHA-256 Valid",
  },
  settings: {
    icon: Settings2,
    title: "Client Admin & Event Setup",
    description: "Configuration engine for Annual Gala 2026",
    status: "Active Schema: gala_2026_enterprise_v2",
  },
};

export function OperationDialog({ type, onOpenChange, onToast }) {
  const details = type ? dialogDetails[type] : null;

  if (!details) return null;
  const Icon = details.icon;

  return (
    <Dialog open={Boolean(type)} onOpenChange={(open) => !open && onOpenChange(null)}>
      <DialogContent className="max-w-2xl p-0">
        <div className="bg-[#fff4ee] p-6 pr-14">
          <DialogHeading icon={Icon} title={details.title} description={details.description} />
        </div>
        <div className="p-6 sm:p-8">
          {type === "scanner" && <ScannerPanel onToast={onToast} />}
          {type === "pass" && <PassPanel onToast={onToast} />}
          {type === "settings" && <SettingsPanel onToast={onToast} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
