"use client";

import { useState } from "react";
import {
  AlignLeft,
  CalendarDays,
  CheckSquare2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  CircleHelp,
  Copy,
  Eye,
  FileText,
  GripVertical,
  ListChecks,
  Plus,
  PlusCircle,
  Settings2,
  Trash2,
  Type,
  UsersRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const questionTypes = [
  { value: "short", label: "Short answer", icon: Type },
  { value: "paragraph", label: "Paragraph", icon: AlignLeft },
  { value: "multiple", label: "Multiple choice", icon: CircleDot },
  { value: "checkboxes", label: "Checkboxes", icon: CheckSquare2 },
  { value: "dropdown", label: "Dropdown", icon: ListChecks },
  { value: "date", label: "Date", icon: CalendarDays },
];
const choiceTypes = new Set(["multiple", "checkboxes", "dropdown"]);
const initialDetails = {
  title: "",
  description: "",
  qr_description: "",
  category: "Corporate Gala",
  capacity: "",
  startsAt: "",
  endsAt: "",
  venue: "",
};
const initialQuestions = [
  {
    id: "last-name",
    systemKey: "last_name",
    type: "short",
    label: "Last name",
    description: "Enter the attendee's last name.",
    required: true,
    options: [],
  },
  {
    id: "first-name",
    systemKey: "first_name",
    type: "short",
    label: "First name",
    description: "Enter the attendee's first name.",
    required: true,
    options: [],
  },
  {
    id: "work-email",
    systemKey: "email",
    type: "short",
    label: "Work email",
    description: "We will send the registration confirmation to this address.",
    required: true,
    options: [],
  },
];
const fieldLabel = "mb-1.5 block text-[11px] font-semibold tracking-[0.06em] text-[#6f625b] uppercase";
const selectClass = "h-10 w-full rounded-xl border-0 bg-[#fff4ee] px-3 text-sm text-[#25170f] outline-none focus:ring-2 focus:ring-[#f6671e]/25";

function createQuestion(type) {
  return {
    id: crypto.randomUUID(),
    type,
    label: "Untitled question",
    description: "",
    required: false,
    options: choiceTypes.has(type) ? ["Option 1", "Option 2"] : [],
  };
}

function formatEventDate(value) {
  if (!value) return "Schedule pending";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function BuilderTabs({ activeView, onChange }) {
  const tabs = [
    { value: "details", label: "Event details", icon: Settings2 },
    { value: "form", label: "Registration form", icon: FileText },
    { value: "preview", label: "Preview", icon: Eye },
  ];

  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#ffeadf] p-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={cn(
              "flex min-h-10 items-center justify-center gap-2 rounded-lg px-2 text-xs font-semibold transition-all",
              activeView === tab.value ? "bg-white text-[#f6671e] shadow-sm" : "text-[#6f625b] hover:text-[#25170f]",
            )}
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function getLocalDateTimeMin() {
  const now = new Date();
  const offset = now.getTimezoneOffset();

  return new Date(now.getTime() - offset * 60 * 1000)
    .toISOString()
    .slice(0, 16);
}

function EventDetails({ details, onChange  }) {
  const minDateTime = getLocalDateTimeMin();
  return (
    <section className="space-y-5">
      <div>
        <h3 className="text-lg font-bold text-[#25170f]">Event information</h3>
        <p className="text-xs text-[#6f625b]">Set the schedule and attendee capacity for this event.</p>
      </div>
      <div>
        <label htmlFor="event-title" className={fieldLabel}>Event title</label>
        <Input id="event-title" value={details.title} onChange={(event) => onChange("title", event.target.value)} placeholder="e.g. Annual Winter Showcase 2026" />
      </div>
      <div>
        <label htmlFor="event-description" className={fieldLabel}>Description</label>
        <textarea
          id="event-description"
          value={details.description}
          onChange={(event) => onChange("description", event.target.value)}
          placeholder="Tell attendees what to expect..."
          rows={3}
          className="w-full resize-none rounded-xl border-0 bg-[#fff4ee] px-3 py-2.5 text-sm text-[#25170f] outline-none placeholder:text-[#96877f] focus:ring-2 focus:ring-[#f6671e]/25"
        />
      </div>
      <div>
        <label htmlFor="qr-description" className={fieldLabel}>QR Description</label>
        <textarea
          id="qr-description"
          value={details.qr_description}
          onChange={(event) => onChange("qr_description", event.target.value)}
          placeholder="Show QR description to the attendees..."
          rows={3}
          className="w-full resize-none rounded-xl border-0 bg-[#fff4ee] px-3 py-2.5 text-sm text-[#25170f] outline-none placeholder:text-[#96877f] focus:ring-2 focus:ring-[#f6671e]/25"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 #sm:grid-cols-2">
        {/* <div>
          <label htmlFor="event-category" className={fieldLabel}>Category</label>
          <select id="event-category" value={details.category} onChange={(event) => onChange("category", event.target.value)} className={selectClass}>
            <option>Corporate Gala</option>
            <option>Technical Summit</option>
            <option>Networking Mixer</option>
            <option>Awards Ceremony</option>
          </select>
        </div> */}
        <div>
          <label htmlFor="event-capacity" className={fieldLabel}>Capacity</label>
          <Input id="event-capacity" type="number" min="1" value={details.capacity} onChange={(event) => onChange("capacity", event.target.value)} placeholder="e.g. 500" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="event-start" className={fieldLabel}>
            Starts at
          </label>

          <Input
            id="event-start"
            type="datetime-local"
            value={details.startsAt}
            min={minDateTime}
            onChange={(event) =>
              onChange("startsAt", event.target.value)
            }
          />
        </div>

        <div>
          <label htmlFor="event-end" className={fieldLabel}>
            Ends at
          </label>

          <Input
            id="event-end"
            type="datetime-local"
            value={details.endsAt}
            min={details.startsAt || (minDateTime)}
            onChange={(event) =>
              onChange("endsAt", event.target.value)
            }
          />
        </div>
      </div>
      <div>
        <label htmlFor="event-venue" className={fieldLabel}>Venue or meeting link</label>
        <Input id="event-venue" value={details.venue} onChange={(event) => onChange("venue", event.target.value)} placeholder="e.g. Grand Ballroom Hall B" />
      </div>
    </section>
  );
}

function QuestionCard({ question, index, total, onUpdate, onDuplicate, onDelete, onMove }) {
  const fixedSystemQuestionKeys = new Set(["first_name", "last_name", "email"]);
  const fixedSystemQuestionIds = new Set(["first-name", "last-name", "work-email"]);
  const isRequiredSystemQuestion = fixedSystemQuestionKeys.has(question.systemKey) || fixedSystemQuestionIds.has(question.id);

  function updateOption(optionIndex, value) {
    const options = [...question.options];
    options[optionIndex] = value;
    onUpdate({ options });
  }

  return (
    <article className="rounded-2xl border border-[#ffdece] bg-white shadow-[0_3px_14px_rgba(40,48,68,0.06)]">
      <div className="flex items-center justify-between border-b border-[#ffdece] px-4 py-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#96877f]"><GripVertical className="size-4" />Question {index + 1}</div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move question up"><ChevronUp /></Button>
          <Button type="button" variant="ghost" size="icon" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Move question down"><ChevronDown /></Button>
        </div>
      </div>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_190px]">
          <Input value={question.label} readOnly={isRequiredSystemQuestion} onChange={(event) => onUpdate({ label: event.target.value })} placeholder="Question" aria-label={`Question ${index + 1} title`} />
          <select
            value={question.type}
            disabled={isRequiredSystemQuestion}
            onChange={(event) => {
              const type = event.target.value;
              onUpdate({ type, options: choiceTypes.has(type) && question.options.length === 0 ? ["Option 1", "Option 2"] : question.options });
            }}
            className={selectClass}
            aria-label={`Question ${index + 1} type`}
          >
            {questionTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </div>
        <Input value={question.description} onChange={(event) => onUpdate({ description: event.target.value })} placeholder="Description or helper text (optional)" aria-label={`Question ${index + 1} description`} className="h-9 text-xs" />

        {choiceTypes.has(question.type) && (
          <div className="space-y-2 rounded-xl bg-[#fffbf8] p-3">
            {question.options.map((option, optionIndex) => (
              <div key={`${question.id}-${optionIndex}`} className="flex items-center gap-2">
                <span className={question.type === "checkboxes" ? "size-3.5 rounded border border-[#96877f]" : "size-3.5 rounded-full border border-[#96877f]"} />
                {isRequiredSystemQuestion ? (
                  <span className="min-w-0 flex-1 px-1 py-1 text-sm text-[#25170f]">{option}</span>
                ) : (
                  <>
                    <input value={option} onChange={(event) => updateOption(optionIndex, event.target.value)} className="min-w-0 flex-1 border-b border-[#f3c7b2] bg-transparent px-1 py-1 text-sm outline-none focus:border-[#f6671e]" aria-label={`Option ${optionIndex + 1}`} />
                    <button type="button" onClick={() => onUpdate({ options: question.options.filter((_, valueIndex) => valueIndex !== optionIndex) })} className="rounded-md p-1 text-[#96877f] hover:bg-[#ffdad6] hover:text-[#ba1a1a]" aria-label={`Remove option ${optionIndex + 1}`}><Trash2 className="size-3.5" /></button>
                  </>
                )}
              </div>
            ))}
            {!isRequiredSystemQuestion && <button type="button" onClick={() => onUpdate({ options: [...question.options, `Option ${question.options.length + 1}`] })} className="ml-5 inline-flex items-center gap-1 text-xs font-semibold text-[#f6671e]"><Plus className="size-3.5" />Add option</button>}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#ffdece] pt-3">
          {isRequiredSystemQuestion ? (
            <span className="text-xs font-semibold text-[#6f625b]">Required field</span>
          ) : (
            <>
              <Button type="button" variant="ghost" size="icon" onClick={onDuplicate} aria-label="Duplicate question"><Copy /></Button>
              <Button type="button" variant="ghost" size="icon" onClick={onDelete} aria-label="Delete question" className="text-[#ba1a1a]"><Trash2 /></Button>
              <span className="mx-1 h-6 w-px bg-[#ffdece]" />
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#6f625b]">Required<input type="checkbox" checked={question.required} onChange={(event) => onUpdate({ required: event.target.checked })} className="size-4 accent-[#f6671e]" /></label>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function FormBuilder({ questions, onAdd, onUpdate, onDuplicate, onDelete, onMove }) {
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[190px_1fr]">
      <aside className="h-fit rounded-2xl bg-[#fff4ee] p-3 lg:sticky lg:top-0">
        <div className="mb-3 px-1"><div className="text-sm font-bold text-[#25170f]">Add a question</div><p className="text-[11px] text-[#6f625b]">Choose a response type.</p></div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          {questionTypes.map((type) => {
            const Icon = type.icon;
            return <button key={type.value} type="button" onClick={() => onAdd(type.value)} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-left text-xs font-semibold text-[#6f625b] shadow-sm transition hover:text-[#f6671e] hover:shadow-md"><Icon className="size-4 text-[#f6671e]" />{type.label}</button>;
          })}
        </div>
      </aside>
      <div className="space-y-4">
        {questions.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#f0bea6] bg-[#fafaff] p-6 text-center">
            <PlusCircle className="mb-2 size-8 text-[#f6671e]" /><div className="font-bold text-[#25170f]">Your registration form is empty</div><p className="mb-4 text-xs text-[#6f625b]">Add a question type to begin collecting attendee information.</p><Button type="button" size="sm" onClick={() => onAdd("short")}>Add first question</Button>
          </div>
        ) : questions.map((question, index) => (
          <QuestionCard key={question.id} question={question} index={index} total={questions.length} onUpdate={(changes) => onUpdate(question.id, changes)} onDuplicate={() => onDuplicate(question.id)} onDelete={() => onDelete(question.id)} onMove={(direction) => onMove(index, direction)} />
        ))}
      </div>
    </section>
  );
}

function QuestionPreview({ question }) {
  const inputClass = "mt-2 h-10 w-full rounded-xl border border-[#f3c7b2] bg-white px-3 text-sm outline-none";
  return (
    <div className="rounded-2xl border border-[#ffdece] bg-white p-4">
      <label className="text-sm font-semibold text-[#25170f]">{question.label || "Untitled question"}{question.required && <span className="ml-1 text-[#ba1a1a]">*</span>}</label>
      {question.description && <p className="mt-0.5 text-xs text-[#96877f]">{question.description}</p>}
      {question.type === "short" && <input disabled className={inputClass} placeholder="Short answer" />}
      {question.type === "paragraph" && <textarea disabled rows={3} className={cn(inputClass, "h-auto py-2.5")} placeholder="Long answer" />}
      {question.type === "date" && <input disabled type="date" className={inputClass} />}
      {question.type === "dropdown" && <select disabled className={cn(inputClass, "appearance-none")}><option>Choose an option</option>{question.options.map((option) => <option key={option}>{option}</option>)}</select>}
      {(question.type === "multiple" || question.type === "checkboxes") && <div className="mt-3 space-y-2">{question.options.map((option, index) => <label key={`${option}-${index}`} className="flex items-center gap-2 text-sm text-[#6f625b]"><input disabled type={question.type === "multiple" ? "radio" : "checkbox"} />{option}</label>)}</div>}
    </div>
  );
}

function FormPreview({ details, questions }) {
  return (
    <section className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-[#ffdece] bg-[#fffbf8] shadow-sm">
      <div className="border-t-8 border-[#f6671e] bg-white p-6">
        <span className="text-[11px] font-bold tracking-[0.1em] text-[#f6671e] uppercase">Registration form</span>
        <h3 className="mt-2 text-2xl font-bold tracking-tight text-[#25170f]">{details.title || "Untitled event"}</h3>
        <p className="mt-1 text-sm text-[#6f625b]">{details.description || "Add an event description to introduce this form."}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-medium text-[#6f625b]"><span className="rounded-full bg-[#fff4ee] px-2.5 py-1">{formatEventDate(details.startsAt)}</span><span className="rounded-full bg-[#fff4ee] px-2.5 py-1">{details.venue || "Venue pending"}</span></div>
      </div>
      <div className="space-y-3 p-4 sm:p-6">
        {questions.length > 0 ? questions.map((question) => <QuestionPreview key={question.id} question={question} />) : <div className="rounded-xl bg-white p-8 text-center text-sm text-[#96877f]">No registration questions yet.</div>}
        <Button type="button" disabled className="mt-2">Submit registration</Button>
      </div>
    </section>
  );
}

export function CreateEventDialog({ open, onOpenChange, onCreated, initialEvent = null }) {
  const [activeView, setActiveView] = useState("details");
  const [details, setDetails] = useState(() => ({ ...initialDetails, ...initialEvent?.details }));
  const [questions, setQuestions] = useState(() => (
    initialEvent?.registrationForm?.map((question) => ({ ...question, options: [...question.options] }))
    || initialQuestions
  ));
  const [formError, setFormError] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);

  function updateDetails(field, value) {
    setDetails((current) => ({ ...current, [field]: value }));
    setFormError("");
  }

  function updateQuestion(id, changes) {
    setQuestions((current) => current.map((question) => question.id === id ? { ...question, ...changes } : question));
    setFormError("");
  }

  function duplicateQuestion(id) {
    setQuestions((current) => {
      const index = current.findIndex((question) => question.id === id);
      const source = current[index];
      const duplicate = { ...source, id: crypto.randomUUID(), label: `${source.label} copy`, options: [...source.options] };
      return [...current.slice(0, index + 1), duplicate, ...current.slice(index + 1)];
    });
  }

  function moveQuestion(index, direction) {
    setQuestions((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function resetBuilder() {
    setActiveView("details");
    setDetails(initialDetails);
    setQuestions(initialQuestions);
    setFormError("");
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!details.title.trim()) {
      setActiveView("details");
      setFormError("Add an event title before publishing.");
      return;
    }
    if (!details.startsAt || !details.endsAt) {
      setActiveView("details");
      setFormError("Add both a start and end date before publishing.");
      return;
    }
    if (new Date(details.endsAt) <= new Date(details.startsAt)) {
      setActiveView("details");
      setFormError("The event end date must be after its start date.");
      return;
    }
    if (questions.some((question) => !question.label.trim())) {
      setActiveView("form");
      setFormError("Every registration question needs a title.");
      return;
    }

    setConfirmationOpen(true);
  }

  async function publishEvent() {
    setConfirmationOpen(false);
    setIsPublishing(true);
    setFormError("");

    try {
      await onCreated({ details, registrationForm: questions });
      onOpenChange(false);
      resetBuilder();
    } catch (error) {
      const validationErrors = error.response?.data?.errors;
      setFormError(
        validationErrors
          ? Object.values(validationErrors).flat().join(" ")
          : error.response?.data?.message || "The event could not be published. Please try again.",
      );
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl overflow-hidden p-0">
        <form onSubmit={handleSubmit} className="flex max-h-[calc(100vh-2rem)] min-h-0 flex-col">
          <div className="shrink-0 border-b border-[#f3c7b2] bg-[#fff4ee] p-4 pr-14 sm:p-6 sm:pr-16">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#f6671e] text-white shadow-sm"><PlusCircle className="size-5" /></div>
                <DialogHeader><DialogTitle>{initialEvent ? "Edit Event" : "Create New Event"}</DialogTitle><DialogDescription>{initialEvent ? "Update the event and publish a new registration form version." : "Build the event and its attendee registration form."}</DialogDescription></DialogHeader>
              </div>
              <div className="w-full md:w-auto md:min-w-[420px]"><BuilderTabs activeView={activeView} onChange={setActiveView} /></div>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {formError && <div role="alert" className="mb-4 rounded-xl bg-[#ffdad6] px-4 py-3 text-sm font-semibold text-[#93000a]">{formError}</div>}
            {activeView === "details" && <EventDetails details={details} onChange={updateDetails} />}
            {activeView === "form" && <FormBuilder questions={questions} onAdd={(type) => setQuestions((current) => [...current, createQuestion(type)])} onUpdate={updateQuestion} onDuplicate={duplicateQuestion} onDelete={(id) => setQuestions((current) => current.filter((question) => question.id !== id))} onMove={moveQuestion} />}
            {activeView === "preview" && <FormPreview details={details} questions={questions} />}
          </div>
          <footer className="flex shrink-0 flex-col justify-between gap-3 border-t border-[#f3c7b2] bg-white p-4 sm:flex-row sm:items-center sm:px-6">
            <div className="flex items-center gap-2 text-xs text-[#6f625b]"><UsersRound className="size-4 text-[#f6671e]" />{questions.length} registration {questions.length === 1 ? "question" : "questions"}</div>
            <div className="flex items-center justify-end gap-2"><Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isPublishing}>Cancel</Button><Button type="submit" disabled={isPublishing}>{isPublishing ? "Saving..." : initialEvent ? "Save Changes" : "Publish Event"}</Button></div>
          </footer>
        </form>

        {confirmationOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#25170f]/45 p-4 backdrop-blur-[2px]">
            <div role="alertdialog" aria-modal="true" aria-labelledby="publish-confirmation-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex size-11 items-center justify-center rounded-xl bg-[#ffdece] text-[#f6671e]">
                <CircleHelp className="size-6" />
              </div>
              <h2 id="publish-confirmation-title" className="mt-4 text-xl font-bold text-[#25170f]">
                {initialEvent ? "Save event changes?" : "Publish this event?"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#6f625b]">
                {initialEvent
                  ? "The updated details and registration form will be saved."
                  : "The event and its registration form will become available immediately."}
              </p>
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={() => setConfirmationOpen(false)}>
                  No, return to event
                </Button>
                <Button type="button" onClick={publishEvent}>
                  {initialEvent ? "Yes, save changes" : "Yes, publish event"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
