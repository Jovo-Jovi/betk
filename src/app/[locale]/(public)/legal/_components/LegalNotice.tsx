import { Alert } from "@/components/shared/Alert";
import { LegalError } from "./LegalError";

/**
 * P67–P70 body. The public layout already mounts AppTopbar and Footer.
 * The body is the pending-review notice. The version line renders only when
 * the label is non-empty (returns and privacy stay blank until REG-98/99).
 * It does not render the E-1 drafts.
 */
export function LegalNotice({
  title,
  pendingTitle,
  pendingBody,
  versionCaption,
  versionLabel,
  readFailed,
  errorMessage,
  retryLabel,
}: {
  title: string;
  pendingTitle: string;
  pendingBody: string;
  versionCaption: string;
  versionLabel: string;
  readFailed: boolean;
  errorMessage: string;
  retryLabel: string;
}) {
  return (
    <article
      data-slot="legal-notice"
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10"
    >
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {readFailed ? (
        <LegalError message={errorMessage} retryLabel={retryLabel} />
      ) : (
        <>
          <Alert variant="warning" title={pendingTitle} message={pendingBody} />
          {versionLabel.trim() !== "" && (
            <p className="text-sm text-muted-foreground">
              {versionCaption}{" "}
              <span dir="ltr" data-slot="legal-version" className="font-mono text-foreground">
                {versionLabel}
              </span>
            </p>
          )}
        </>
      )}
    </article>
  );
}
