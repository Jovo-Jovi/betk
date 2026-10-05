/**
 * P49 approval actions. Result types live here so the `"use server"` file
 * exports only async functions.
 */

import { z } from "zod";

export const approveSellerSchema = z
  .object({
    sellerId: z.string().uuid(),
  })
  .strict();

export const rejectSellerSchema = z
  .object({
    sellerId: z.string().uuid(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export type ApproveSellerInput = z.input<typeof approveSellerSchema>;
export type RejectSellerInput = z.input<typeof rejectSellerSchema>;

export type ApprovalMissing = "categories" | "pickup" | "agreement" | "food_documents";

export type SellerApprovalResult =
  | { ok: true }
  | { ok: false; reason: "forbidden" | "invalid" | "refused" }
  | { ok: false; reason: "incomplete"; missing: ApprovalMissing };
