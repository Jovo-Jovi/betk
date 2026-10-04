/**
 * Per-step client checks. The server schema in `submitSellerApplication` is
 * authoritative. These slices only stop an empty step from advancing.
 */

import { z } from "zod";
import { storeSlugInputSchema } from "@/validations/sellerOnboarding";

export const identityStepSchema = z.object({
  nameAr: z.string().trim().min(2).max(100),
  nameEn: z.string().trim().min(2).max(100).optional(),
  bioAr: z.string().trim().max(200).optional(),
  slug: storeSlugInputSchema,
});

export const categoryStepSchema = z.object({
  categoryIds: z.array(z.string().uuid()).min(1),
  governorate: z.string().trim().min(1).max(50),
  city: z.string().trim().min(1).max(100).optional(),
});

export const pickupStepSchema = z.object({
  pickupCity: z.string().trim().min(1).max(100),
  streetAddress: z.string().trim().min(1).max(2000),
  buildingNotes: z.string().trim().max(2000).optional(),
});

export const documentsStepSchema = z.object({
  docFrontPath: z.string().trim().min(3),
  docBackPath: z.string().trim().min(3),
  sellerAgreementAccepted: z.literal(true),
});

export const foodStepSchema = z.object({
  foodPackagingPath: z.string().trim().min(3),
  foodLabelPath: z.string().trim().min(3),
  foodExpiryPath: z.string().trim().min(3),
  foodSocialUrl: z.string().trim().url().max(500),
});
