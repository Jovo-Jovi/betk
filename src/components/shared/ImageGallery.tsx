import * as React from "react";
import { cn } from "@/lib/utils";
import { ImageOff } from "lucide-react";

/**
 * ImageGallery — listing-detail viewer. Presentational guarantee:
 * hero first (index 0) and never more than 5 thumbnails, even if the
 * query passes more. RTL thumbnail rail; thumbs swap the hero.
 */
export interface ImageGalleryProps {
  images: string[];
  alt?: string;
  className?: string;
}

export function ImageGallery({ images, alt = "", className }: ImageGalleryProps) {
  const capped = images?.length ? images.slice(0, 5) : [];
  const list = capped.length ? capped : [null as string | null];
  const [active, setActive] = React.useState(0);
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-secondary">
        {list[active]
          ? <img src={list[active]!} alt={alt} className="size-full object-cover" />
          : <div className="flex size-full items-center justify-center text-border"><ImageOff className="size-14" /></div>}
        {list.length > 1 && (
          <span className="absolute bottom-2.5 end-2.5 rounded-full bg-foreground/70 px-2 py-0.5 font-mono text-[0.6875rem] text-background" dir="ltr">
            {active + 1}/{list.length}
          </span>
        )}
      </div>
      {list.length > 1 && (
        <div className="flex gap-2">
          {list.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={cn("size-[60px] shrink-0 overflow-hidden rounded-md bg-secondary", i === active ? "ring-2 ring-primary" : "border border-border")}
            >
              {src
                ? <img src={src} alt="" className="size-full object-cover" />
                : <div className="flex size-full items-center justify-center text-border"><ImageOff className="size-5" /></div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
