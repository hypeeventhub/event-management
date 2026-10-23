"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toNominationPayload, validateNomination } from "@/lib/nomination-voting.mjs";

export function NominationForm({ open, subject, onOpenChange, onCloseAutoFocus, onSave }) {
  const [title, setTitle] = useState(subject?.title || "");
  const [topN, setTopN] = useState(subject?.top_n ?? 2);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function clearError(field) {
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const input = { title, top_n: topN };
    const validation = validateNomination(input);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    setSaving(true);
    try {
      await onSave(toNominationPayload(input));
    } catch (error) {
      const fields = error.response?.data?.errors || {};
      setErrors({
        title: fields.title?.[0],
        top_n: fields.top_n?.[0],
        form: error.response?.data?.message || "The nomination could not be saved. Try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!saving) onOpenChange(value); }}>
      <DialogContent className="max-w-2xl p-0" onCloseAutoFocus={onCloseAutoFocus} showCloseButton={!saving}>
        <form onSubmit={submit} noValidate className="flex max-h-[calc(100vh-2rem)] flex-col">
          <DialogHeader className="shrink-0 border-b border-[#ffdece] bg-[#fff4ee] px-5 py-5 pr-14 sm:px-6 sm:pr-16">
            <DialogTitle>{subject ? "Edit nomination" : "Create nomination"}</DialogTitle>
            <DialogDescription>Set a title and choose how many finalists should advance. Attendees will nominate candidates from the QR link.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
            {errors.form && <p role="alert" className="rounded-xl bg-[#ffdad6] px-4 py-3 text-sm text-[#93000a]">{errors.form}</p>}
            <div>
              <label htmlFor="nomination-title" className="mb-1.5 block text-sm font-semibold">Nomination title</label>
              <Input id="nomination-title" value={title} maxLength={255} disabled={saving} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "nomination-title-error" : undefined} onChange={(event) => { setTitle(event.target.value); clearError("title"); }} placeholder="e.g. People's Choice Award" />
              {errors.title && <p id="nomination-title-error" role="alert" className="mt-1 text-xs text-[#93000a]">{errors.title}</p>}
            </div>
            <div>
              <label htmlFor="nomination-top-n" className="mb-1.5 block text-sm font-semibold">Number of finalists (top N)</label>
              <Input id="nomination-top-n" type="number" min={2} max={4294967295} step={1} value={topN} disabled={saving} aria-invalid={Boolean(errors.top_n)} aria-describedby={errors.top_n ? "nomination-top-n-help nomination-top-n-error" : "nomination-top-n-help"} onChange={(event) => { setTopN(event.target.value); clearError("top_n"); }} />
              <p id="nomination-top-n-help" className="mt-1 text-xs text-[#6f625b]">At least 2. Ties can produce more finalists; a number above the nominee count includes everyone.</p>
              {errors.top_n && <p id="nomination-top-n-error" role="alert" className="mt-1 text-xs text-[#93000a]">{errors.top_n}</p>}
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-[#ffdece] px-5 py-4 sm:px-6">
            <Button type="button" variant="secondary" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : subject ? "Save changes" : "Create nomination"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
