import type { ExportSummary } from "@recipe-book/shared";
import type { ReadonlyDeep } from "type-fest";
import "./ExportNotice.css";

export type ExportNoticeProps = ReadonlyDeep<{
  summary: ExportSummary;
  onDismiss: () => void;
}>;

/**
 * What an export just did: what went into the file, and — as warnings, not errors — anything it
 * could not find. It stays until dismissed, so the person can read it at their own pace on a screen
 * that does not animate.
 */
export function ExportNotice({ summary, onDismiss }: ExportNoticeProps) {
  return (
    <div className="export-notice" role="status">
      <div className="export-notice-text">
        <span>{summary.message}</span>
        {summary.warnings.map((warning) => (
          <span key={warning} className="field-error">
            {warning}
          </span>
        ))}
      </div>
      <button type="button" className="export-notice-dismiss" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
