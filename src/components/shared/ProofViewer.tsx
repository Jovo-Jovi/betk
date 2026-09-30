"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { FileWarning, ImageOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * ProofViewer — read-only display of an existing file for ADMIN surfaces
 * (P49 seller documents, P58 payment proof, P74 return evidence). Net-new
 * (CD-DELTA-6 Wave 1). Takes a signed URL the page already minted; never
 * chooses a storage path, never uploads — there is no upload prop or callback.
 * Types (§8f): png, jpeg (.jpg/.jpeg), webp — the types the live upload paths
 * accept. Type is read from the URL path extension (query string ignored);
 * anything else shows `unsupportedLabel` and never attempts to render.
 * No hover zoom: the whole file is visible (object-contain) at every width.
 * Token-only. All strings are props (DS-I18N). No buyer field (M3).
 */
export interface ProofViewerProps {
  /** Signed URL minted by the page. Absent → empty state. */
  sourceUrl?: string;
  /** proof.imageName — accessible name of the image. */
  imageName: string;
  /** proof.loading */
  loadingLabel: string;
  /** proof.empty */
  emptyLabel: string;
  /** proof.error */
  errorLabel: string;
  /** proof.unsupported */
  unsupportedLabel: string;
  /** Emitted when the URL fails to load. */
  onLoadError?: () => void;
  className?: string;
}

const SUPPORTED = new Set(["png", "jpg", "jpeg", "webp"]);

function extOf(url: string): string {
  try {
    const path = new URL(url, "https://x.invalid").pathname;
    const dot = path.lastIndexOf(".");
    return dot === -1 ? "" : path.slice(dot + 1).toLowerCase();
  } catch { return ""; }
}

export function ProofViewer({ sourceUrl, imageName, loadingLabel, emptyLabel, errorLabel, unsupportedLabel, onLoadError, className }: ProofViewerProps) {
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading");
  // Reset during render (not in an effect) so a cached image's onLoad can't be overwritten.
  const [prevUrl, setPrevUrl] = React.useState(sourceUrl);
  if (sourceUrl !== prevUrl) { setPrevUrl(sourceUrl); setState("loading"); }

  const frame = "relative flex min-h-[240px] w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-muted";

  if (!sourceUrl) {
    return (
      <div className={cn(frame, "border-dashed bg-card", className)}>
        <p className="px-4 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  if (!SUPPORTED.has(extOf(sourceUrl))) {
    return (
      <div role="alert" className={cn(frame, "bg-card", className)}>
        <div className="flex flex-col items-center gap-2 px-4 text-center">
          <FileWarning className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium text-foreground">{unsupportedLabel}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(frame, className)} aria-busy={state === "loading" || undefined}>
      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Skeleton className="absolute inset-0 rounded-none" />
          <span role="status" className="relative text-sm text-muted-foreground">{loadingLabel}</span>
        </div>
      )}
      {state === "error" ? (
        <div role="alert" className="flex flex-col items-center gap-2 px-4 text-center">
          <ImageOff className="size-8 text-destructive" aria-hidden />
          <p className="text-sm font-medium text-destructive">{errorLabel}</p>
        </div>
      ) : (
        <img
          key={sourceUrl}
          src={sourceUrl}
          alt={imageName}
          tabIndex={0}
          onLoad={() => setState("ready")}
          onError={() => { setState("error"); onLoadError?.(); }}
          className={cn("max-h-[70vh] w-full object-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", state !== "ready" && "opacity-0")}
        />
      )}
    </div>
  );
}
