"use client";

import { useState } from "react";
import { Check, ClipboardList, LoaderCircle, Mail, Pencil, UserRound, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  buildAnsweredFormRows,
  buildEditableAnswerValues,
  buildRegistrationAnswerPayload,
  formatRegistrationAnswer,
} from "@/lib/registration-answers.mjs";

const controlClassName = "h-10 w-full rounded-xl border-0 bg-[#fff4ee] px-3 text-sm text-[#25170f] outline-none focus-visible:ring-2 focus-visible:ring-[#f6671e]/25";
const textareaClassName = "min-h-28 w-full resize-y rounded-xl border-0 bg-[#fff4ee] px-3 py-2.5 text-sm text-[#25170f] outline-none focus-visible:ring-2 focus-visible:ring-[#f6671e]/25";

function editableAnswers(registration) {
  return [...(registration?.answers || [])]
    .filter(({ field }) => field && field.system_key == null)
    .sort((first, second) => (first.field.position ?? 0) - (second.field.position ?? 0));
}

function displayAnswer(answer, field) {
  if (answer === null || answer === undefined || answer === "" || (Array.isArray(answer) && answer.length === 0)) {
    return "No answer provided";
  }

  if (typeof answer === "object" && !Array.isArray(answer)) {
    return formatRegistrationAnswer(answer);
  }

  const optionLabels = new Map((field?.options || []).map((option) => [option.value, option.label]));
  const formatValue = (value) => optionLabels.get(String(value)) || String(value);

  return Array.isArray(answer) ? answer.map(formatValue).join(", ") : formatValue(answer);
}

export default function AnsweredFormsDialog({ registration, open, onOpenChange, onSave }) {
  const attendee = registration?.attendee;
  const answers = buildAnsweredFormRows(registration);
  const orderedAnswerDetails = [...(registration?.answers || [])]
    .sort((first, second) => (first.field?.position ?? 0) - (second.field?.position ?? 0));
  const editable = editableAnswers(registration);
  const attendeeName = attendee
    ? `${attendee.first_name || ""} ${attendee.last_name || ""}`.trim()
    : "Attendee";
  const [editor, setEditor] = useState({
    registrationId: null,
    editing: false,
    values: {},
    saving: false,
    error: "",
  });
  const hasCurrentEditor = editor.registrationId === registration?.id;
  const editing = hasCurrentEditor && editor.editing;
  const values = hasCurrentEditor ? editor.values : {};
  const saving = hasCurrentEditor && editor.saving;
  const saveError = hasCurrentEditor ? editor.error : "";

  function startEditing() {
    setEditor({
      registrationId: registration.id,
      editing: true,
      values: buildEditableAnswerValues(registration),
      saving: false,
      error: "",
    });
  }

  function cancelEditing() {
    setEditor({ registrationId: null, editing: false, values: {}, saving: false, error: "" });
  }

  function updateValue(fieldId, value) {
    setEditor((current) => current.registrationId === registration?.id
      ? { ...current, values: { ...current.values, [fieldId]: value } }
      : current);
  }

  async function saveAnswers() {
    if (!onSave || saving) return;

    setEditor((current) => current.registrationId === registration?.id
      ? { ...current, saving: true, error: "" }
      : current);

    try {
      const updatedRegistration = await onSave(buildRegistrationAnswerPayload(values));
      setEditor({
        registrationId: registration.id,
        editing: false,
        values: buildEditableAnswerValues(updatedRegistration || registration),
        saving: false,
        error: "",
      });
    } catch (error) {
      const validationMessage = Object.values(error.response?.data?.errors || {})
        .flat()
        .find((message) => typeof message === "string");
      setEditor((current) => current.registrationId === registration?.id
        ? {
            ...current,
            saving: false,
            error: validationMessage || error.response?.data?.message || "Your answers could not be saved. Please try again.",
          }
        : current);
    }
  }

  function renderEditor(answer) {
    const field = answer.field;
    const fieldId = String(field.id);
    const value = values[fieldId];
    const options = field.options || [];

    if (field.type === "short") {
      return (
        <Input
          id={`answer-${fieldId}`}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => updateValue(fieldId, event.target.value)}
          maxLength={1000}
          required={field.is_required}
          disabled={saving}
        />
      );
    }

    if (field.type === "paragraph") {
      return (
        <textarea
          id={`answer-${fieldId}`}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => updateValue(fieldId, event.target.value)}
          maxLength={5000}
          required={field.is_required}
          disabled={saving}
          className={textareaClassName}
        />
      );
    }

    if (field.type === "date") {
      return (
        <Input
          id={`answer-${fieldId}`}
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => updateValue(fieldId, event.target.value)}
          required={field.is_required}
          disabled={saving}
        />
      );
    }

    if (field.type === "dropdown") {
      return (
        <select
          id={`answer-${fieldId}`}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => updateValue(fieldId, event.target.value)}
          required={field.is_required}
          disabled={saving}
          className={controlClassName}
        >
          <option value="">Select an option</option>
          {options.map((option) => <option key={option.id} value={option.value}>{option.label}</option>)}
        </select>
      );
    }

    if (field.type === "multiple") {
      return (
        <div className="space-y-2 rounded-xl border border-[#ffdece] bg-white p-3" role="radiogroup" aria-labelledby={`answer-label-${fieldId}`}>
          {!field.is_required && (
            <label className="flex min-h-8 items-center gap-2 text-sm text-[#25170f]">
              <input
                type="radio"
                name={`answer-${fieldId}`}
                value=""
                checked={!value}
                onChange={() => updateValue(fieldId, "")}
                disabled={saving}
                className="size-4 accent-[#f6671e]"
              />
              No selection
            </label>
          )}
          {options.map((option) => (
            <label key={option.id} className="flex min-h-8 items-center gap-2 text-sm text-[#25170f]">
              <input
                type="radio"
                name={`answer-${fieldId}`}
                value={option.value}
                checked={value === option.value}
                onChange={() => updateValue(fieldId, option.value)}
                disabled={saving}
                className="size-4 accent-[#f6671e]"
              />
              {option.label}
            </label>
          ))}
        </div>
      );
    }

    if (field.type === "checkboxes") {
      const selectedValues = Array.isArray(value) ? value : [];

      return (
        <div className="space-y-2 rounded-xl border border-[#ffdece] bg-white p-3">
          {options.map((option) => (
            <label key={option.id} className="flex min-h-8 items-center gap-2 text-sm text-[#25170f]">
              <input
                type="checkbox"
                value={option.value}
                checked={selectedValues.includes(option.value)}
                onChange={(event) => {
                  const nextValues = event.target.checked
                    ? [...selectedValues, option.value]
                    : selectedValues.filter((selectedValue) => selectedValue !== option.value);
                  updateValue(fieldId, nextValues);
                }}
                disabled={saving}
                className="size-4 rounded accent-[#f6671e]"
              />
              {option.label}
            </label>
          ))}
          {options.length === 0 && <p className="text-sm text-[#6f625b]">No options are configured for this answer.</p>}
        </div>
      );
    }

    return <p className="text-sm text-[#6f625b]">This answer type cannot be edited.</p>;
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!saving) {
        if (!nextOpen) cancelEditing();
        onOpenChange(nextOpen);
      }
    }}>
      <DialogContent className="max-w-2xl p-0">
        <div className="border-b border-[#ffdece] bg-[#fff4ee] px-6 py-5 pr-14">
          <DialogHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-[#f6671e] text-white">
              <ClipboardList className="size-5" />
            </div>
            <DialogTitle>Answered registration form</DialogTitle>
            <DialogDescription>
              Review or correct the custom answers submitted by this attendee.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 p-6">
          <div className="flex flex-col gap-3 rounded-xl border border-[#ffdece] bg-[#fffaf7] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 font-semibold text-[#25170f]">
                <UserRound className="size-4 text-[#f6671e]" />
                {attendeeName}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-[#6f625b]">
                <Mail className="size-3.5" />
                {attendee?.email || "No email address"}
              </div>
              {editing && <p className="mt-2 text-xs text-[#96877f]">Name and email are read-only.</p>}
            </div>
            <Badge variant="neutral">{answers.length} answer{answers.length === 1 ? "" : "s"}</Badge>
          </div>

          {saveError && <div role="alert" className="rounded-xl bg-[#ffdad6] px-4 py-3 text-sm font-medium text-[#93000a]">{saveError}</div>}

          {answers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#f3c7b2] px-5 py-8 text-center text-sm text-[#6f625b]">
              This attendee has no recorded form answers.
            </div>
          ) : editing ? (
            <ol className="space-y-3">
              {orderedAnswerDetails.map((answer, index) => {
                if (answer.field?.system_key != null) {
                  return (
                    <li key={answer.id} className="rounded-xl border border-[#ffdece] bg-[#fffaf7] p-4">
                      <p className="text-xs font-bold tracking-[0.05em] text-[#96877f] uppercase">Question {index + 1} · Read only</p>
                      <p className="mt-1 font-semibold text-[#25170f]">{answer.field.label}</p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#6f625b]">{displayAnswer(answer.answer, answer.field)}</p>
                    </li>
                  );
                }

                const fieldId = String(answer.field.id);

                return (
                  <li key={answer.id} className="space-y-3 rounded-xl border border-[#ffdece] p-4">
                    <div>
                      <p className="text-xs font-bold tracking-[0.05em] text-[#96877f] uppercase">Question {index + 1} · Custom answer</p>
                      <label id={`answer-label-${fieldId}`} htmlFor={`answer-${fieldId}`} className="mt-1 block font-semibold text-[#25170f]">
                        {answer.field.label}{answer.field.is_required && <span className="ml-1 text-[#c3382f]" aria-label="required">*</span>}
                      </label>
                      {answer.field.description && <p className="mt-1 text-xs leading-5 text-[#6f625b]">{answer.field.description}</p>}
                    </div>
                    {renderEditor(answer)}
                  </li>
                );
              })}
            </ol>
          ) : (
            <ol className="space-y-3">
              {orderedAnswerDetails.map((answer, index) => {
                const row = answers[index];
                const rawAnswer = displayAnswer(answer.answer, answer.field);

                return (
                  <li key={answer.id} className="rounded-xl border border-[#ffdece] p-4">
                    <p className="text-xs font-bold tracking-[0.05em] text-[#96877f] uppercase">Question {index + 1}</p>
                    <p className="mt-1 font-semibold text-[#25170f]">{answer.field?.label || row?.label}</p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#6f625b]">{rawAnswer}</p>
                  </li>
                );
              })}
            </ol>
          )}

          <DialogFooter className="border-t border-[#ffdece] pt-4">
            {editing ? (
              <>
                <Button type="button" variant="secondary" disabled={saving} onClick={cancelEditing}>
                  <X />Cancel
                </Button>
                <Button type="button" disabled={saving || editable.length === 0} onClick={saveAnswers}>
                  {saving ? <LoaderCircle className="animate-spin" /> : <Check />}
                  {saving ? "Saving…" : "Save answers"}
                </Button>
              </>
            ) : (
              <Button type="button" onClick={startEditing} disabled={!editable.length}>
                <Pencil />Edit answers
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
