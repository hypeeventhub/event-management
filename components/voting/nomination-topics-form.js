import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TOPIC_CATEGORIES } from "@/lib/event-poll.mjs";
import { MAX_NOMINATION_TOPICS, MAX_TOPIC_FINALISTS, toNominationTopicsPayload, validateNominationTopics } from "@/lib/nomination-voting.mjs";

function newTopic(id) {
  return { id, title: "", female_top_n: "2", male_top_n: "2" };
}

function TopicField({ id, label, error, ...props }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">{label}</label>
      <Input id={id} required aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} {...props} />
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-[#93000a]">{error}</p>}
    </div>
  );
}

export function NominationTopicsForm({ onOpenChange, onCloseAutoFocus, onSave }) {
  const nextId = useRef(1);
  const formRef = useRef(null);
  const focusError = useRef(false);
  const [rows, setRows] = useState(() => [newTopic(0)]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (saving || !focusError.current) return;

    focusError.current = false;
    const form = formRef.current;
    const target = form?.querySelector('input[aria-invalid="true"]') ?? form?.querySelector("[data-validation-summary]");
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "center", inline: "nearest" });
  }, [errors, saving]);

  function updateRow(id, index, field, value) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => {
      if (key === "form") return false;
      return field === "title" ? !key.endsWith(".title") : key !== `topics.${index}.${field}`;
    })));
  }

  function addTopic() {
    const row = newTopic(nextId.current++);
    setRows((current) => [...current, row]);
    requestAnimationFrame(() => document.getElementById(`nomination-topic-${row.id}-title`)?.focus());
  }

  function removeTopic(id) {
    const index = rows.findIndex((row) => row.id === id);
    const nextFocus = rows[index + 1] ?? rows[index - 1];
    setRows((current) => current.filter((row) => row.id !== id));
    setErrors({});
    requestAnimationFrame(() => document.getElementById(`nomination-topic-${nextFocus.id}-title`)?.focus());
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const payload = toNominationTopicsPayload(rows);
    const validation = validateNominationTopics(payload.topics);
    focusError.current = Object.keys(validation).length > 0;
    setErrors(validation);
    if (focusError.current) return;

    setSaving(true);
    try {
      await onSave(payload);
    } catch (requestError) {
      const response = requestError.response?.data;
      const fieldErrors = Object.fromEntries(
        Object.entries(response?.errors ?? {}).map(([field, messages]) => [field, messages[0]])
      );
      focusError.current = true;
      setErrors({ ...fieldErrors, form: response?.message || "The nomination set could not be saved. Try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!saving) onOpenChange(open); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-hidden p-0" onCloseAutoFocus={onCloseAutoFocus}>
        <form ref={formRef} noValidate onSubmit={submit} className="flex min-h-0 max-h-[calc(100dvh-2rem)] flex-col">
          <DialogHeader className="shrink-0 border-b border-[#ffdece] bg-[#fff4ee] px-4 py-4 pr-14 sm:px-6 sm:pr-16">
            <DialogTitle>Create nomination set</DialogTitle>
            <DialogDescription>Add up to {MAX_NOMINATION_TOPICS} topics in the order you want to run them. Set how many finalists advance in each category.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
            {errors.form && <p role="alert" tabIndex={-1} data-validation-summary className="rounded-xl bg-[#ffdad6] px-4 py-3 text-sm text-[#93000a]">{errors.form}</p>}
            {rows.map((row, index) => {
              const id = `nomination-topic-${row.id}`;
              const field = `topics.${index}`;
              return (
                <fieldset key={row.id} disabled={saving} className="min-w-0 space-y-3 rounded-xl border border-[#ffdece] p-3 sm:p-4">
                  <legend className="px-1 text-sm font-semibold">Topic {index + 1}</legend>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <TopicField id={`${id}-title`} label="Title" value={row.title} error={errors[`${field}.title`]} onChange={(event) => updateRow(row.id, index, "title", event.target.value)} />
                    <Button type="button" variant="ghost" size="icon" className="mt-6" aria-label={`Remove topic ${index + 1}`} disabled={rows.length === 1 || saving} onClick={() => removeTopic(row.id)}><Trash2 /></Button>
                  </div>
                  <div className="grid gap-3 min-[375px]:grid-cols-2">
                    {TOPIC_CATEGORIES.map(({ key, label }) => {
                      const count = `${key}_top_n`;
                      return <TopicField key={key} id={`${id}-${key}`} label={`${label} finalists`} type="number" min={2} max={MAX_TOPIC_FINALISTS} step={1} value={row[count]} error={errors[`${field}.${count}`]} onChange={(event) => updateRow(row.id, index, count, event.target.value)} />;
                    })}
                  </div>
                </fieldset>
              );
            })}
            {errors.topics && <p role="alert" tabIndex={-1} data-validation-summary className="text-sm text-[#93000a]">{errors.topics}</p>}
            <Button type="button" variant="secondary" size="sm" disabled={saving || rows.length >= MAX_NOMINATION_TOPICS} onClick={addTopic}><Plus /> Add topic</Button>
          </div>
          <DialogFooter className="shrink-0 border-t border-[#ffdece] px-4 py-4 sm:px-6">
            <Button type="button" variant="secondary" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create nomination set"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
