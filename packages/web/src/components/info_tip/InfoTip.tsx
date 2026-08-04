import { useId, useState } from "react";
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
  const textId = useId();

  return (
    <span className="info-tip">
      {/* The revealed text is both the region the toggle controls and the
          toggle's own description, so a screen reader announces the
          explanation from the button instead of only its expanded state.
          Both references are dropped while collapsed, when the element they
          point at does not exist. */}
      <button
        type="button"
        className="info-tip-toggle"
        aria-label={label}
        aria-expanded={showing}
        {...(showing && { "aria-controls": textId, "aria-describedby": textId })}
        onClick={() => setShowing((s) => !s)}
      >
        ⓘ
      </button>
      {showing && (
        <span className="info-tip-text" role="note" id={textId}>
          {text}
        </span>
      )}
    </span>
  );
}
