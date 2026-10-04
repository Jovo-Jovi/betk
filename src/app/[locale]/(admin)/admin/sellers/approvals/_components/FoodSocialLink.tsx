import { isHttpUrl } from "@/validations/sellerOnboarding";

/**
 * food_social_url on P49 only. A link when the stored value is http(s);
 * otherwise plain text. Never fetched. Never passed to ProofViewer.
 */
export function FoodSocialLink({ value, label }: { value: string; label: string }) {
  if (!isHttpUrl(value)) {
    return (
      <p>
        {label} {value}
      </p>
    );
  }
  return (
    <p>
      {label}{" "}
      <a href={value} rel="noopener noreferrer" target="_blank">
        {value}
      </a>
    </p>
  );
}
