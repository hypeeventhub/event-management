"use client";

import { Download, LoaderCircle, QrCode } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getVotingQrFilename, shouldRenderVotingQrImage } from "@/lib/voting-subjects.mjs";

import Link from "next/link";

export function VotingQrDialog({ subject, onOpenChange, onCloseAutoFocus }) {
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!subject) return;
    let current = true;
    Promise.resolve().then(() => {
      if (!current) return;
      setImageUrl("");
      setError("");
      setLoading(true);
      if (!subject.public_url) throw new Error("The public voting link is unavailable.");
      return QRCode.toDataURL(subject.public_url, { width: 320, margin: 2 });
    }).then((url) => {
      if (current && url) setImageUrl(url);
    }).catch((reason) => {
      if (current) setError(reason.message || "The QR code could not be generated.");
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => { current = false; };
  }, [subject]);

  return (
    <Dialog open={Boolean(subject)} onOpenChange={onOpenChange}>
      <DialogContent className="p-6 sm:p-8" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader className="pr-8">
          <DialogTitle>Voting QR code</DialogTitle>
          <DialogDescription>{subject?.title} · Share this link with voters.</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl bg-[#fff4ee] p-4">
          {loading && <LoaderCircle className="size-8 animate-spin text-[#f6671e]" aria-label="Generating QR code" />}
          {!loading && error && <p role="alert" className="text-center text-sm text-[#93000a]">{error}</p>}
          {shouldRenderVotingQrImage(subject, imageUrl, loading) && <Image unoptimized src={imageUrl} width={320} height={320} alt={`QR code for ${subject.title} voting link`} className="max-w-full rounded-xl bg-white" />}
          {!loading && !imageUrl && !error && <QrCode className="size-10 text-[#f6671e]" aria-hidden="true" />}
        </div>
        {subject?.public_url && <Link href={subject.public_url} target="_blank" className="break-all text-center text-xs text-[#6f625b]">{subject.public_url}</Link>}
        <Button asChild disabled={!imageUrl || loading} className="w-full"><a href={imageUrl || undefined} download={getVotingQrFilename(subject?.title)} aria-disabled={!imageUrl || loading} onClick={(event) => { if (!imageUrl || loading) event.preventDefault(); }}><Download /> Download QR PNG</a></Button>
      </DialogContent>
    </Dialog>
  );
}
