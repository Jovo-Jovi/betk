import type { AddressValue } from "@/components/shared/AddressForm";
import type { CreateAddressInput } from "@/validations/address";

/**
 * Map the kit form onto address columns. `fullName` and `phone` stay on the
 * form and are not copied. `addresses` has no columns for them.
 */
export function addressWriteInput(
  value: AddressValue,
  label: string,
  makeDefault: boolean,
): CreateAddressInput {
  const notes = value.notes?.trim() ?? "";
  const trimmedLabel = label.trim();
  return {
    ...(trimmedLabel.length > 0 ? { label: trimmedLabel } : {}),
    governorate: value.governorate ?? "",
    city: value.city?.trim() ?? "",
    streetAddress: value.addressLine?.trim() ?? "",
    ...(notes.length > 0 ? { buildingNotes: notes } : {}),
    makeDefault,
  };
}
