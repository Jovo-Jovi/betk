import * as React from "react";
import { Button } from "@/components/ui/button";
import { Check, Plus } from "lucide-react";

/**
 * FollowButton — follow/unfollow a store (store_follows). i18n: both state
 * labels come in as props (Arabic defaults). Composes the shadcn ui Button:
 * filled (not following) → outline (following).
 */
export interface FollowButtonProps {
  following?: boolean;
  onToggle?: (next: boolean) => void;
  size?: "sm" | "default" | "lg";
  /** Label when not following. Default "تابع". */
  followLabel?: string;
  /** Label when following. Default "تتابعه". */
  followingLabel?: string;
  className?: string;
}

export function FollowButton({ following = false, onToggle, size = "default", followLabel = "تابع", followingLabel = "تتابعه", className }: FollowButtonProps) {
  return (
    <Button
      type="button"
      variant={following ? "outline" : "default"}
      size={size}
      aria-pressed={following}
      onClick={() => onToggle?.(!following)}
      className={className}
    >
      {following ? <Check className="size-4" /> : <Plus className="size-4" />}
      {following ? followingLabel : followLabel}
    </Button>
  );
}
