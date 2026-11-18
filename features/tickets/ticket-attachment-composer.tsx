"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Loader2, Paperclip, SmilePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  TICKET_ATTACHMENT_LIMIT,
  TICKET_IMAGE_MAX_BYTES,
  TICKET_IMAGE_TYPES,
  deleteTicketAttachment,
  uploadTicketAttachments,
  type TicketAttachment,
} from "./api";
import { DEFAULT_RECENT_EMOJIS, EMOJI_CATEGORIES } from "./emoji-data";
import { insertTextIntoTextarea } from "./text-insert";

/** An uploaded attachment plus a local object URL for an instant thumbnail. */
export type PendingTicketAttachment = TicketAttachment & { previewUrl?: string };

const RECENT_LIMIT = 8;

export function TicketAttachmentComposer({
  ticketId,
  value,
  onChange,
  disabled = false,
  compact = false,
  onUploadingChange,
}: {
  ticketId: string;
  value: PendingTicketAttachment[];
  onChange: (next: PendingTicketAttachment[]) => void;
  disabled?: boolean;
  compact?: boolean;
  /** Lets the parent disable its submit button while an image is uploading. */
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const reduceMotion = useReducedMotion();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const emojiButtonRef = React.useRef<HTMLButtonElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = React.useState(false);
  const [activeCategory, setActiveCategory] = React.useState(EMOJI_CATEGORIES[0]?.id ?? "");
  const [recent, setRecent] = React.useState<string[]>(DEFAULT_RECENT_EMOJIS);

  const remaining = TICKET_ATTACHMENT_LIMIT - value.length;
  const full = remaining <= 0;
  const category =
    EMOJI_CATEGORIES.find((group) => group.id === activeCategory) ?? EMOJI_CATEGORIES[0];

  function fail(message: string | null) {
    setLocalError(message);
  }

  function markUploading(next: boolean) {
    setUploading(next);
    onUploadingChange?.(next);
  }

  async function addFiles(picked: FileList | null) {
    if (!picked || picked.length === 0) return;
    const files = Array.from(picked);
    if (files.length > remaining) {
      fail(`You can attach up to ${TICKET_ATTACHMENT_LIMIT} images per message.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const invalidType = files.find((file) => !TICKET_IMAGE_TYPES.includes(file.type));
    if (invalidType) {
      fail("Only PNG, JPEG, WEBP or GIF images are supported.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const tooLarge = files.find((file) => file.size > TICKET_IMAGE_MAX_BYTES);
    if (tooLarge) {
      fail(`"${tooLarge.name}" is larger than 5 MB. Compress it and try again.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const previews = new Map<string, string>();
    files.forEach((file) =>
      previews.set(`${file.name}-${file.size}-${file.lastModified}`, URL.createObjectURL(file)),
    );
    markUploading(true);
    fail(null);
    try {
      const uploaded = await uploadTicketAttachments(ticketId, { files });
      const drafts: PendingTicketAttachment[] = uploaded.map((item, index) => ({
        ...item,
        previewUrl: previews.get(
          `${files[index]?.name}-${files[index]?.size}-${files[index]?.lastModified}`,
        ),
      }));
      onChange([...value, ...drafts]);
    } catch (cause) {
      previews.forEach((url) => URL.revokeObjectURL(url));
      fail(cause instanceof Error ? cause.message : "Could not upload the image.");
    } finally {
      markUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function remove(item: PendingTicketAttachment) {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    onChange(value.filter((entry) => entry.id !== item.id));
    // Best effort: the row is harmless if the request fails, the backend
    // drops unsent attachments after 24 hours.
    void deleteTicketAttachment(item.id).catch(() => undefined);
  }

  /**
   * Emojis are part of the message text, not attachments: pick one and it lands
   * at the caret of the reply textarea in the same form.
   */
  function pickEmoji(emoji: string) {
    const form = emojiButtonRef.current?.closest("form");
    const textarea = form?.querySelector("textarea") ?? null;
    if (!insertTextIntoTextarea(textarea, emoji)) {
      fail("Could not find the reply box to insert the emoji.");
      return;
    }
    fail(null);
    setRecent((current) => [emoji, ...current.filter((item) => item !== emoji)].slice(0, RECENT_LIMIT));
    setEmojiOpen(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <input
          ref={fileInputRef}
          type="file"
          accept={TICKET_IMAGE_TYPES.join(",")}
          multiple
          className="hidden"
          aria-label="Attach images"
          onChange={(event) => void addFiles(event.target.files)}
        />
        <Button
          type="button"
          variant="ghost"
          size={compact ? "icon-sm" : "sm"}
          className="gap-1.5 text-[#5A5A5A] hover:text-[#111111]"
          disabled={disabled || uploading || full}
          onClick={() => fileInputRef.current?.click()}
          title={full ? `Up to ${TICKET_ATTACHMENT_LIMIT} images` : "Attach images"}
        >
          {uploading ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Paperclip aria-hidden="true" />
          )}
          {!compact && <span>Images</span>}
        </Button>

        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button
              ref={emojiButtonRef}
              type="button"
              variant="ghost"
              size={compact ? "icon-sm" : "sm"}
              className="gap-1.5 text-[#5A5A5A] hover:text-[#111111]"
              disabled={disabled}
              title="Insert emoji"
            >
              <SmilePlus aria-hidden="true" />
              {!compact && <span>Emoji</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[19.5rem] animate-in fade-in-0 zoom-in-95 p-2 duration-150 motion-reduce:animate-none"
            onCloseAutoFocus={(event) => {
              // Keep the caret in the reply textarea so the user can keep typing
              // instead of jumping back to the emoji button.
              event.preventDefault();
            }}
          >
            <div className="flex items-center justify-between gap-1 border-b border-[#F0F0F0] pb-1.5">
              {EMOJI_CATEGORIES.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  title={group.label}
                  aria-label={group.label}
                  aria-pressed={group.id === category?.id}
                  onClick={() => setActiveCategory(group.id)}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md text-base leading-none transition-colors hover:bg-[#F3EFE7] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                    group.id === category?.id && "bg-[#F3EFE7] ring-1 ring-[#E0D8C8]",
                  )}
                >
                  {group.icon}
                </button>
              ))}
            </div>

            <div className="max-h-64 overflow-y-auto pt-1.5">
              {recent.length > 0 && (
                <section className="mb-1">
                  <p className="px-1 pb-1 text-[10.5px] font-medium uppercase tracking-wide text-[#8A8A8A]">
                    Recent
                  </p>
                  <div className="grid grid-cols-8 gap-0.5">
                    {recent.map((emoji) => (
                      <EmojiButton key={`recent-${emoji}`} emoji={emoji} onPick={pickEmoji} />
                    ))}
                  </div>
                </section>
              )}

              {category && (
                <section>
                  <p className="px-1 pb-1 text-[10.5px] font-medium uppercase tracking-wide text-[#8A8A8A]">
                    {category.label}
                  </p>
                  <div className="grid grid-cols-8 gap-0.5">
                    {category.emojis.map((emoji) => (
                      <EmojiButton key={`${category.id}-${emoji}`} emoji={emoji} onPick={pickEmoji} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <span
          className="ml-auto text-[11px] text-[#8A8A8A]"
          title={`Attachments: ${value.length} of ${TICKET_ATTACHMENT_LIMIT}`}
        >
          {value.length}/{TICKET_ATTACHMENT_LIMIT}
        </span>
      </div>

      <AnimatePresence initial={false}>
        {value.length > 0 && (
          <motion.ul
            key="attachments"
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex flex-wrap items-center gap-2 overflow-hidden"
          >
            {value.map((item) => (
              <motion.li
                key={item.id}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className={cn(
                  "group relative flex size-14 items-center justify-center rounded-md border border-[#E5E5E5] bg-[#F7F7F7]",
                  item.kind === "IMAGE" && "overflow-hidden",
                )}
              >
                {item.kind === "IMAGE" ? (
                  item.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- authenticated blob preview
                    <img
                      src={item.previewUrl}
                      alt={item.file_name ?? "Attached image"}
                      className="size-full object-cover"
                    />
                  ) : (
                    <Paperclip className="size-4 text-[#8A8A8A]" aria-hidden="true" />
                  )
                ) : (
                  <span className="text-2xl leading-none">{item.emoji}</span>
                )}
                <button
                  type="button"
                  onClick={() => remove(item)}
                  disabled={disabled}
                  className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border border-[#DADADA] bg-white text-[#5A5A5A] opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
                  aria-label="Remove attachment"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {localError && (
        <p role="alert" className="text-xs text-red-700">
          {localError}
        </p>
      )}
    </div>
  );
}

function EmojiButton({ emoji, onPick }: { emoji: string; onPick: (emoji: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(emoji)}
      title={emoji}
      className="flex size-8 items-center justify-center rounded-md text-xl leading-none transition-transform hover:bg-[#F3EFE7] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-90 motion-reduce:transform-none"
    >
      {emoji}
    </button>
  );
}
