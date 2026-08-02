import { useState } from "react";
import type { ReadonlyDeep } from "type-fest";
import "./InfoTip.css";

export type InfoTipProps = ReadonlyDeep<{
  /** The explanation revealed when the "ⓘ" is pressed. */
  text: string;
  /** Accessible name for the toggle, e.g. "What does ordered mean?". */
  label: string;
}>;

/**
 * A "ⓘ" toggle that reveals a short explanation next to the field it explains.
 * The text is toggled on press rather than shown on hover because the app
 * targets a stylus/touch e-ink tablet, where there is no hover state.
 */
export function InfoTip({ text, label }: InfoTipProps) {
  const [showing, setShowing] = useState(false);

  return (
    <span className="info-tip">
      <button
        type="button"
        className="info-tip-toggle"
        aria-label={label}
        aria-expanded={showing}
        onClick={() => setShowing((s) => !s)}
      >
        ⓘ
      </button>
      {showing && (
        <span className="info-tip-text" role="note">
          {text}
        </span>
      )}
    </span>
  );
}
