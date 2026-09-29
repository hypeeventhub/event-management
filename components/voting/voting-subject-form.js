"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { mapVotingSubjectFieldErrors, toVotingSubjectPayload, validateVotingSubject } from "@/lib/voting-subjects.mjs";

let nextRowId = 0;
function row(name = "") { return { id: ++nextRowId, name }; }

export function VotingSubjectForm({ open, subject, onOpenChange, onCloseAutoFocus, onSave }) {
  const [title, setTitle] = useState(subject?.title || "");
  const [rows, setRows] = useState(() => subject?.contestants?.map((contestant) => row(contestant.name)) || [row(), row()]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const input = { title, contestants: rows.map((item) => item.name) };
    const validation = validateVotingSubject(input);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    setSaving(true);
    try {
      await onSave(toVotingSubjectPayload(input));
    } catch (error) {
      const fieldErrors = error.response?.data?.errors;
      setErrors({
        ...mapVotingSubjectFieldErrors(fieldErrors, rows),
        form: error.response?.data?.message || "The voting subject could not be saved. Try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  function updateRow(id, name) {
    setRows((current) => current.map((item) => item.id === id ? { ...item, name } : item));
    setErrors((current) => {
      const contestantRows = { ...current.contestantRows };
      delete contestantRows[id];
      return { ...current, contestantRows, contestants: undefined, form: undefined };
    });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!saving) onOpenChange(value); }}>
      <DialogContent className="max-w-2xl p-0" onCloseAutoFocus={onCloseAutoFocus}>
        <form onSubmit={submit} className="flex max-h-[calc(100vh-2rem)] flex-col">
          <DialogHeader className="shrink-0 border-b border-[#ffdece] bg-[#fff4ee] px-5 py-5 pr-14 sm:px-6 sm:pr-16">
            <DialogTitle>{subject ? "Edit voting subject" : "Create voting subject"}</DialogTitle>
            <DialogDescription>Give the ballot a title and add the names voters can choose from.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
            {errors.form && <p role="alert" className="rounded-xl bg-[#ffdad6] px-4 py-3 text-sm text-[#93000a]">{errors.form}</p>}
            <div>
              <label htmlFor="voting-subject-title" className="mb-1.5 block text-sm font-semibold text-[#25170f]">Subject title</label>
              <Input id="voting-subject-title" value={title} maxLength={256} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "voting-title-error" : undefined} onChange={(event) => { setTitle(event.target.value); setErrors((current) => ({ ...current, title: undefined, form: undefined })); }} placeholder="e.g. People's Choice Award" />
              {errors.title && <p id="voting-title-error" className="mt-1 text-xs text-[#93000a]">{errors.title}</p>}
            </div>
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-[#25170f]">Contestants</legend>
              <p className="text-xs text-[#6f625b]">Add 2 to 250 unique names. Their order will appear on the ballot.</p>
              {rows.map((item, index) => (
                <div key={item.id} className="flex items-center gap-2">
                  <label htmlFor={`voting-contestant-${item.id}`} className="w-7 shrink-0 text-center text-xs font-semibold text-[#96877f]">{index + 1}</label>
                  <div className="min-w-0 flex-1">
                    <Input id={`voting-contestant-${item.id}`} value={item.name} maxLength={256} aria-label={`Contestant ${index + 1} name`} aria-invalid={Boolean(errors.contestants || errors.contestantRows?.[item.id])} aria-describedby={errors.contestantRows?.[item.id] ? `voting-contestant-${item.id}-error` : undefined} onChange={(event) => updateRow(item.id, event.target.value)} placeholder="Contestant name" />
                    {errors.contestantRows?.[item.id] && <p id={`voting-contestant-${item.id}-error`} role="alert" className="mt-1 text-xs text-[#93000a]">{errors.contestantRows[item.id]}</p>}
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove contestant ${index + 1}`} disabled={rows.length <= 2 || saving} onClick={() => setRows((current) => current.filter((entry) => entry.id !== item.id))}><Trash2 /></Button>
                </div>
              ))}
              {errors.contestants && <p role="alert" className="text-xs text-[#93000a]">{errors.contestants}</p>}
              <Button type="button" variant="secondary" size="sm" disabled={rows.length >= 250 || saving} onClick={() => setRows((current) => [...current, row()])}><Plus /> Add contestant</Button>
            </fieldset>
          </div>
          <DialogFooter className="shrink-0 border-t border-[#ffdece] px-5 py-4 sm:px-6">
            <Button type="button" variant="secondary" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : subject ? "Save changes" : "Create subject"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
