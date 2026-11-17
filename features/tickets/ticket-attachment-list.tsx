"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { ImageOff } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { fetchTicketAttachmentBlob, type TicketAttachment } from "./api";
import type { PendingTicketAttachment } from "./ticket-attachment-composer";

function useAttachmentPreview(attachment: TicketAttachment | undefined) {
  const pendingUrl = (attachment as PendingTicketAttachment | undefined)?.previewUrl;
  // Depend on the attachment's identity, not the object: every list refresh
  // parses a fresh JSON object, and re-running this effect would otherwise
  // revoke and re-download the image on each poll.
  const attachmentId = attachment?.id ?? null;
  const attachmentKind = attachment?.kind ?? null;
  const [loaded, setLoaded] = React.useState<{ id: string; url: string } | null>(null);
  const [failedId, setFailedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!attachmentId || attachmentKind !== "IMAGE" || pendingUrl) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    fetchTicketAttachmentBlob(attachmentId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ id: attachmentId, url: objectUrl });
      })
      .catch(() => {
        if (!cancelled) setFailedId(attachmentId);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentId, attachmentKind, pendingUrl]);

  const url =
    pendingUrl ?? (loaded && attachmentId && loaded.id === attachmentId ? loaded.url : null);
  const failed = Boolean(attachmentId && failedId === attachmentId);
  return { url, failed };
}

function AttachmentImage({
  attachment,
  onOpen,
  className,
}: {
  attachment: TicketAttachment;
  onOpen?: () => void;
  className?: string;
}) {
  const { url, failed } = useAttachmentPreview(attachment);
  if (failed) {
    return (
      <span className="flex size-16 items-center justify-center rounded-md border border-[#E5E5E5] bg-[#F7F7F7] text-[#8A8A8A]">
        <ImageOff className="size-4" aria-hidden="true" />
      </span>
    );
  }
  if (!url) {
    return <span className={cn("block size-16 animate-pulse rounded-md bg-[#EDEDED]", className)} aria-hidden="true" />;
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group relative block size-16 overflow-hidden rounded-md border border-[#E5E5E5] transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
      aria-label={`View image ${attachment.file_name ?? "attachment"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- authenticated blob preview */}
      <img src={url} alt={attachment.file_name ?? "Attached image"} className="size-full object-cover transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none" />
    </button>
  );
}

export function TicketAttachmentList({
  attachments,
  align = "start",
  compact = false,
}: {
  attachments?: TicketAttachment[];
  align?: "start" | "end";
  compact?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [lightbox, setLightbox] = React.useState<TicketAttachment | null>(null);
  const visible = (attachments ?? []).filter((item) => item.kind === "IMAGE" || item.emoji);
  if (visible.length === 0) return null;

  return (
    <>
      <ul
        className={cn(
          "flex flex-wrap items-center gap-1.5",
          align === "end" && "justify-end",
          compact ? "mt-1" : "mt-1.5",
        )}
      >
        {visible.map((item) => (
          <motion.li
            key={item.id}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            {item.kind === "IMAGE" ? (
              <AttachmentImage
                attachment={item}
                onOpen={() => setLightbox(item)}
                className={compact ? "size-12" : undefined}
              />
            ) : (
              <span
                className={cn(
                  "flex items-center justify-center rounded-md bg-white/70 px-2 py-1 leading-none",
                  compact ? "text-2xl" : "text-3xl",
                )}
                title="Emoji"
              >
                {item.emoji}
              </span>
            )}
          </motion.li>
        ))}
      </ul>
      <Dialog open={Boolean(lightbox)} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent className="max-w-[min(90vw,720px)] p-2 sm:max-w-[min(90vw,720px)]">
          <DialogTitle className="sr-only">{lightbox?.file_name ?? "Attached image"}</DialogTitle>
          {lightbox && <LightboxImage attachment={lightbox} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function LightboxImage({ attachment }: { attachment: TicketAttachment }) {
  const pendingUrl = (attachment as PendingTicketAttachment).previewUrl;
  const [loaded, setLoaded] = React.useState<{ id: string; url: string } | null>(null);
  const [failedId, setFailedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (pendingUrl) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    const attachmentId = attachment.id;
    fetchTicketAttachmentBlob(attachmentId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ id: attachmentId, url: objectUrl });
      })
      .catch(() => {
        if (!cancelled) setFailedId(attachmentId);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id, pendingUrl]);

  const url = pendingUrl ?? (loaded && loaded.id === attachment.id ? loaded.url : null);
  const failed = failedId === attachment.id;

  if (failed) {
    return <p className="p-6 text-center text-sm text-[#6F6F6F]">This image could not be loaded.</p>;
  }
  if (!url) {
    return <div className="h-64 animate-pulse rounded-md bg-[#EDEDED]" aria-hidden="true" />;
  }
  return (
    <div className="animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none">
      {/* eslint-disable-next-line @next/next/no-img-element -- authenticated blob preview */}
      <img src={url} alt={attachment.file_name ?? "Attached image"} className="max-h-[75dvh] w-full rounded-md object-contain" />
    </div>
  );
}
