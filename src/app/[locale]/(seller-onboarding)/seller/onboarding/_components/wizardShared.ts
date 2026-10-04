/**
 * Wizard state for P23. Pickup is the seller's own street. Category values are
 * `categories.id`. Delivery modes are not collected (OD-10).
 */

import type { SubmitSellerApplicationInput } from "@/validations/sellerOnboarding";

export type ErrCode = "required" | "invalid" | "taken";
export type StepErrors = Record<string, ErrCode>;
export type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export interface DocUploadState {
  status: "idle" | "uploading" | "uploaded" | "error";
  progress: number;
  previewUrl?: string;
}

export const emptyDocState: DocUploadState = { status: "idle", progress: 0 };

export interface CategoryOption {
  id: string;
  slug: string;
  labelAr: string;
  labelEn: string;
  /** True when this category is food-beverages or a descendant. */
  food: boolean;
}

export interface WizardData {
  nameAr: string;
  nameEn: string;
  bioAr: string;
  slug: string;
  categoryIds: string[];
  governorate: string;
  city: string;
  pickupCity: string;
  streetAddress: string;
  buildingNotes: string;
  sellerAgreementAccepted: boolean;
  docFrontPath: string;
  docBackPath: string;
  foodPackagingPath: string;
  foodLabelPath: string;
  foodExpiryPath: string;
  foodSocialUrl: string;
}

export function emptyWizardData(categoryLimit: number): WizardData {
  return {
    nameAr: "",
    nameEn: "",
    bioAr: "",
    slug: "",
    categoryIds: Array.from({ length: categoryLimit }, () => ""),
    governorate: "",
    city: "",
    pickupCity: "",
    streetAddress: "",
    buildingNotes: "",
    sellerAgreementAccepted: false,
    docFrontPath: "",
    docBackPath: "",
    foodPackagingPath: "",
    foodLabelPath: "",
    foodExpiryPath: "",
    foodSocialUrl: "",
  };
}

function str(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function chosenCategoryIds(data: WizardData): string[] {
  return [...new Set(data.categoryIds.map((id) => id.trim()).filter((id) => id !== "" && id !== "none"))];
}

export function buildSubmitPayload(
  data: WizardData,
  foodChosen: boolean,
): SubmitSellerApplicationInput {
  const notes = str(data.buildingNotes);
  return {
    nameAr: data.nameAr.trim(),
    nameEn: str(data.nameEn),
    bioAr: str(data.bioAr),
    slug: data.slug.trim(),
    categoryIds: chosenCategoryIds(data),
    governorate: data.governorate,
    city: str(data.city),
    pickup: {
      city: data.pickupCity.trim(),
      streetAddress: data.streetAddress.trim(),
      buildingNotes: notes,
    },
    sellerAgreementAccepted: data.sellerAgreementAccepted,
    docFrontPath: data.docFrontPath,
    docBackPath: data.docBackPath,
    ...(foodChosen
      ? {
          food: {
            packagingPath: data.foodPackagingPath,
            labelPath: data.foodLabelPath,
            expiryPath: data.foodExpiryPath,
            socialUrl: data.foodSocialUrl.trim(),
          },
        }
      : {}),
  };
}
