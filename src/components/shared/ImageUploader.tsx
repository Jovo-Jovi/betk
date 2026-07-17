"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Upload, Camera } from "lucide-react";

/**
 * ImageUploader — dashed drop/pick zone with progress bar, error line and
 * thumbnail row (brief §5.38 .upload-zone). Net-new (DS-REGEN). Visual +
 * file-pick only: WebP conversion and signed-URL upload stay in the
 * feature layer; drive `uploading`/`progress`/`error` from there.
 */
export interface ImageUploaderProps {
  /** Zone label. Default "اسحب الصور هنا أو اضغط للاختيار". */
  label?: string;
  hint?: string;
  /** Preview URLs (empty string → placeholder thumb). */
  files?: string[];
  onFiles?: (files: File[]) => void;
  uploading?: boolean;
  /** 0–100 while uploading. */
  progress?: number;
  error?: string;
  className?: string;
}

export function ImageUploader({ label = "اسحب الصور هنا أو اضغط للاختيار", hint, files = [], onFiles, uploading = false, progress = 0, error, className }: ImageUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          error ? "border-destructive" : "border-border",
        )}
      >
        <Upload className="size-7" />
        <span className="text-sm font-semibold">{label}</span>
        {hint && <span className="text-xs">{hint}</span>}
      </button>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles?.(Array.from(e.target.files ?? []))} />
      {uploading && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${progress}%` }} />
        </div>
      )}
      {error && <div className="mt-2 text-xs text-destructive">{error}</div>}
      {files.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={i} className="flex size-16 items-center justify-center overflow-hidden rounded-md border border-border bg-muted text-muted-foreground">
              {f ? <img src={f} alt="" className="size-full object-cover" /> : <Camera className="size-5" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
