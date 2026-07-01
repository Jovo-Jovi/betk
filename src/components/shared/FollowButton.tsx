import * as React from "react";
import { Button } from "@/components/ui/button";
import { Check, Plus } from "lucide-react";

/**
 * FollowButton — follow/unfollow a store (store_follows). Composes the
 * shadcn ui Button: filled "تابع" → outline "تتابعه".
 */
export interface FollowButtonProps {
  following?: boolean;
  onToggle?: (next: boolean) => void;
  size?: "sm" | "default" | "lg";
  className?: string;
}

export function FollowButton({ following = false, onToggle, size = "default", className }: FollowButtonProps) {
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
      {following ? "تتابعه" : "تابع"}
    </Button>
  );
}
