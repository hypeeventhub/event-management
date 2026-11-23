import { useMemo } from "react";

import { VotingQrDialog } from "@/components/voting/voting-qr-dialog";

export function EventPollQrDialog({ publicUrl, title, onOpenChange, onCloseAutoFocus }) {
  const eventPoll = useMemo(() => publicUrl ? { title, public_url: publicUrl } : null, [publicUrl, title]);

  return <VotingQrDialog subject={eventPoll} purpose="event" onOpenChange={onOpenChange} onCloseAutoFocus={onCloseAutoFocus} />;
}
