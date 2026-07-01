import * as React from "react";
import { cn } from "@/lib/utils";
import { Heart } from "lucide-react";

/**
 * WishlistButton — heart toggle for saving a listing. `overlay` is the
 * frosted pill placed over a card hero (top-end). Guests should be routed
 * to /auth/login on tap by the caller.
 */
export interface WishlistButtonProps {
  active?: boolean;
  onToggle?: (next: boolean) => void;
  size?: "sm" | "md" | "lg";
  overlay?: boolean;
  className?: string;
}

const PX = { sm: "size-8", md: "size-9", lg: "size-11" } as const;
const ICO = { sm: 16, md: 19, lg: 22 } as const;

export function WishlistButton({ active = false, onToggle, size = "md", overlay = false, className }: WishlistButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? "إزالة من المفضلة" : "أضف للمفضلة"}
      onClick={() => onToggle?.(!active)}
      className={cn(
        "inline-flex items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        PX[size],
        overlay ? "bg-popover/90 shadow-card" : "border border-border",
        active ? "text-destructive" : "text-muted-foreground",
        className,
      )}
    >
      <Heart size={ICO[size]} fill={active ? "currentColor" : "none"} />
    </button>
  );
}
