"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Share2, Copy, Check } from "lucide-react";

/**
 * ShareButton — shares the public BETK link of P04 (listing) / P05 (store).
 * Net-new (CD-DELTA-6 Wave 1; absorbs REG-51). One control, no app list.
 * Behaviour (§8b): device share sheet when available; otherwise — or when the
 * sheet fails for a reason other than the user dismissing it — the SAME control
 * becomes a copy-public-URL control (label = `fallbackLabel`) and `onFallback`
 * fires. If the clipboard is also unavailable, the public URL is shown as a
 * selectable LTR island so it can still be copied by hand. No `href` → renders
 * nothing. The component shares `href` only; it never reads data, never takes a
 * private route, a contact channel, or a buyer field (M3/M4: no prop for them).
 * Token-only. All strings are props (DS-I18N) — no hardcoded language.
 */
export interface ShareButtonProps {
  /** Public URL built by the page (stores.slug / listings.id). Absent → no control. */
  href?: string;
  /** Locale title passed to the share sheet. */
  shareTitle: string;
  /** share.action — label + accessible name while the device sheet is available. */
  actionLabel: string;
  /** share.fallback — label when the control copies the URL instead. */
  fallbackLabel: string;
  /** share.copied — announced after a successful copy. */
  copiedLabel: string;
  /** share.error — announced when the sheet is unavailable/failed or copy failed. */
  errorLabel: string;
  /** Emitted when the device sheet is unavailable or fails and the copy fallback takes over. */
  onFallback?: () => void;
  className?: string;
}

type Mode = "share" | "copy";
type Status = "idle" | "busy" | "copied" | "error";

export function ShareButton({ href, shareTitle, actionLabel, fallbackLabel, copiedLabel, errorLabel, onFallback, className }: ShareButtonProps) {
  const [mode, setMode] = React.useState<Mode>("copy");
  const [status, setStatus] = React.useState<Status>("idle");
  const [manual, setManual] = React.useState(false);
  const [announce, setAnnounce] = React.useState("");
  const fellBack = React.useRef(false);

  React.useEffect(() => {
    const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
    setMode(canShare ? "share" : "copy");
  }, []);

  if (!href) return null;

  const toFallback = () => {
    setMode("copy");
    if (!fellBack.current) { fellBack.current = true; onFallback?.(); }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setStatus("copied");
      setAnnounce(copiedLabel);
    } catch {
      setStatus("error");
      setManual(true);
      setAnnounce(errorLabel);
    }
  };

  const activate = async () => {
    if (status === "busy") return;
    if (mode === "share") {
      setStatus("busy");
      try {
        await navigator.share({ title: shareTitle, url: href });
        setStatus("idle");
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") { setStatus("idle"); return; }
        setStatus("error");
        setAnnounce(errorLabel);
        toFallback();
      }
      return;
    }
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      if (!fellBack.current) toFallback();
      setStatus("error"); setManual(true); setAnnounce(errorLabel);
      return;
    }
    if (!fellBack.current) toFallback();
    await copy();
  };

  const label = mode === "share" ? actionLabel : fallbackLabel;
  const Icon = status === "copied" ? Check : mode === "share" ? Share2 : Copy;

  return (
    <div className={cn("inline-flex flex-col items-start gap-2", className)}>
      <button
        type="button"
        onClick={activate}
        aria-busy={status === "busy" || undefined}
        disabled={status === "busy"}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-progress disabled:opacity-60"
      >
        <Icon className={cn("size-4 shrink-0", status === "copied" && "text-primary")} aria-hidden />
        <span>{label}</span>
      </button>
      {manual && (
        <input
          readOnly
          dir="ltr"
          value={href}
          aria-label={fallbackLabel}
          onFocus={(e) => e.currentTarget.select()}
          className="h-9 w-full min-w-0 max-w-xs rounded-md border border-input bg-background px-3 font-mono text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      )}
      <span role="status" aria-live="polite" className="sr-only">{announce}</span>
    </div>
  );
}
