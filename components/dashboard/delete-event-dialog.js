"use client";

import { useState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getApiErrorMessage } from "@/functions/auth";

export function DeleteEventDialog({ event, open, onOpenChange, onConfirm }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handleOpenChange(nextOpen) {
    if (submitting) return;
    if (!nextOpen) setError("");
    onOpenChange(nextOpen);
  }

  async function handleDelete() {
    if (!event || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      await onConfirm(event.sourceId);
      onOpenChange(false);
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError, "The event could not be deleted. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open && Boolean(event)} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={!submitting} className="max-w-md">
        <div className="space-y-5 p-6 sm:p-7">
          <DialogHeader className="pr-8">
            <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-[#fff0ed] text-[#ba1a1a]">
              <Trash2 className="size-5" aria-hidden="true" />
            </div>
            <DialogTitle>Delete this event?</DialogTitle>
            <DialogDescription>
              {event ? (
                <>
                  Delete <span className="font-semibold text-[#25170f]">{event.title}</span> from Upcoming Events? Its registration page will be disabled, and existing attendee records will be retained.
                </>
              ) : "This event will be removed from Upcoming Events."}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p role="alert" className="whitespace-pre-line rounded-xl bg-[#fff0ed] px-4 py-3 text-sm text-[#a5261d]">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={submitting || !event}
              className="bg-[#ba1a1a] hover:bg-[#93000a]"
            >
              {submitting && <LoaderCircle className="animate-spin" aria-hidden="true" />}
              Delete event
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
