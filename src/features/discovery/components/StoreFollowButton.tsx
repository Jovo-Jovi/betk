"use client";

/**
 * StoreFollowButton — client island wiring the storefront FollowButton to the
 * `toggleFollow` Server Action. Phase 03 / T06 (FR-PUB-5, composition only —
 * FollowButton is an untouched Claude-Design component).
 *
 * - Initial `following` comes from the RSC (real state via `getStoreFollowState`
 *   under the caller's self-scope RLS — see the storefront page).
 * - Click → optimistic flip, then `toggleFollow(storeId)`:
 *     · `{ ok: true, active }`      → reconcile to the server's truth (idempotent
 *        23505 "already followed" also lands here as `active: true`).
 *     · `reason: "unauthenticated"` → revert + route to /auth/login?returnUrl=…
 *        (locale-preserving; guests never mutate).
 *     · any other failure           → revert (no error surface on the heart/CTA).
 *
 * `useTransition` keeps the button responsive and prevents double-submits while
 * the action is in flight.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { routes } from "@/constants/routes";
import { FollowButton } from "@/components/shared";
import { toggleFollow } from "@/features/discovery/actions/toggleFollow";

export interface StoreFollowButtonProps {
  storeId: string;
  storeSlug: string;
  initialFollowing: boolean;
  followLabel: string;
  followingLabel: string;
  size?: "sm" | "default" | "lg";
  className?: string;
}

export function StoreFollowButton({
  storeId,
  storeSlug,
  initialFollowing,
  followLabel,
  followingLabel,
  size = "default",
  className,
}: StoreFollowButtonProps) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [, startTransition] = useTransition();

  const handleToggle = (next: boolean) => {
    const previous = following;
    setFollowing(next); // optimistic

    startTransition(async () => {
      const result = await toggleFollow(storeId);
      if (result.ok) {
        setFollowing(result.active);
        return;
      }
      setFollowing(previous); // revert
      if (result.reason === "unauthenticated") {
        router.push(
          `${routes.auth.login}?returnUrl=${encodeURIComponent(routes.store(storeSlug))}`,
        );
      }
    });
  };

  return (
    <FollowButton
      following={following}
      onToggle={handleToggle}
      followLabel={followLabel}
      followingLabel={followingLabel}
      size={size}
      className={className}
    />
  );
}
