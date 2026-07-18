import * as React from "react";
import { cn } from "@/lib/utils";
import { Heart } from "lucide-react";

/**
 * WishlistButton — heart toggle for saving a listing. i18n: the aria-labels
 * for both states come in as props (Arabic defaults). `overlay` is the
 * frosted pill over a card hero (top-end). Route guests to /auth/login on tap.
 * CD-DELTA-2: onClick calls stopPropagation() + preventDefault() internally, so a
 * toggle tap never bubbles to a wrapping card link/onClick. Signature unchanged.
 */
export interface WishlistButtonProps {
  active?: boolean;
  onToggle?: (next: boolean) => void;
  size?: "sm" | "md" | "lg";
  overlay?: boolean;
  /** aria-label when not saved. Default "أضف للمفضلة". */
  addLabel?: string;
  /** aria-label when saved. Default "إزالة من المفضلة". */
  removeLabel?: string;
  className?: string;
}

const PX = { sm: "size-8", md: "size-9", lg: "size-11" } as const;
const ICO = { sm: 16, md: 19, lg: 22 } as const;

export function WishlistButton({ active = false, onToggle, size = "md", overlay = false, addLabel = "أضف للمفضلة", removeLabel = "إزالة من المفضلة", className }: WishlistButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? removeLabel : addLabel}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onToggle?.(!active);
      }}
      className={cn(
        "inline-flex items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        PX[size],
        overlay ? "bg-popover/90 shadow-sm" : "border border-border",
        active ? "text-destructive" : "text-muted-foreground",
        className,
      )}
    >
      <Heart size={ICO[size]} fill={active ? "currentColor" : "none"} />
    </button>
  );
}
