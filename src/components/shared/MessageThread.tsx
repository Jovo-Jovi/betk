"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * MessageThread — buyer↔seller conversation (brief §5.20). Net-new
 * (DS-REGEN). Sent bubbles at inline-start on primary; received at
 * inline-end on muted; logical corner tails mirror automatically.
 * Times are LTR mono islands.
 */
export interface ThreadMessage {
  id: string | number;
  text: string;
  time?: string;
  sent?: boolean;
}
export interface MessageThreadProps {
  messages?: ThreadMessage[];
  composerValue?: string;
  onComposerChange?: (v: string) => void;
  onSend?: (v: string) => void;
  /** Composer placeholder. Default "اكتب رسالة…". */
  composerPlaceholder?: string;
  /** Send aria-label. Default "إرسال". */
  sendLabel?: string;
  /** Empty-thread line. Default "ابدأ المحادثة". */
  emptyMessage?: string;
  className?: string;
}

export function MessageThread({
  messages = [], composerValue = "", onComposerChange, onSend,
  composerPlaceholder = "اكتب رسالة…", sendLabel = "إرسال", emptyMessage = "ابدأ المحادثة", className,
}: MessageThreadProps) {
  return (
    <div className={cn("flex flex-col overflow-hidden rounded-lg border border-border bg-card", className)}>
      <div className="flex min-h-40 flex-col gap-3 p-4">
        {messages.length === 0 && <div className="m-auto text-sm text-muted-foreground">{emptyMessage}</div>}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[75%] rounded-lg px-4 py-3 text-sm leading-relaxed",
              m.sent
                ? "self-start rounded-es-sm bg-primary text-primary-foreground"
                : "self-end rounded-ee-sm bg-muted text-foreground",
            )}
          >
            {m.text}
            {m.time && <div dir="ltr" className="mt-1 text-end font-mono text-xs opacity-70">{m.time}</div>}
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); onSend?.(composerValue); }}
        className="flex gap-2 border-t border-border bg-card p-3"
      >
        <input
          value={composerValue}
          onChange={(e) => onComposerChange?.(e.target.value)}
          placeholder={composerPlaceholder}
          className="h-10 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" size="icon" aria-label={sendLabel} className="size-10 rounded-full">
          <Send className="size-[18px] rtl:-scale-x-100" />
        </Button>
      </form>
    </div>
  );
}
