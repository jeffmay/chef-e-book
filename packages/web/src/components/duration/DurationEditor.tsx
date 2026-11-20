import { useId, useState } from "react";
import type { ReadonlyDeep } from "type-fest";
import parse from "parse-duration";
import { AcceptOrCancelEditor } from "../accept_or_cancel_editor/AcceptOrCancelEditor.tsx";
import { humanizeSeconds } from "./humanizeSeconds.ts";
import "./DurationEditor.css";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type DurationUnit = "min" | "sec";

const MIN_DELTAS = [-5, -1, 1, 5] as const;
const SEC_DELTAS = [-15, -5, 5, 15] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type DurationEditorProps = ReadonlyDeep<{
  value: number; // seconds
  onCommit: (seconds: number) => void;
}>;

export function DurationEditor({ value, onCommit }: DurationEditorProps) {
  const uid = useId();
  const [editing, setEditing] = useState(false);
  const [original, setOriginal] = useState(value);
  const [current, setCurrent] = useState(value);
  const [unit, setUnit] = useState<DurationUnit>("min");
  const [inputText, setInputText] = useState("");
  const [inputError, setInputError] = useState(false);

  function openEditor() {
    setOriginal(value);
    setCurrent(value);
    setUnit("min");
    setInputText(humanizeSeconds(value));
    setInputError(false);
    setEditing(true);
  }

  function handleInputChange(text: string) {
    setInputText(text);
    if (text.trim() === "") {
      setInputError(false);
      return;
    }
    const parsedMs = parse(text);
    if (parsedMs != null && parsedMs >= 0) {
      setCurrent(Math.round(parsedMs / 1000));
      setInputError(false);
    } else {
      setInputError(true);
    }
  }

  function adjust(deltaSeconds: number) {
    const newValue = Math.max(0, current + deltaSeconds);
    setCurrent(newValue);
    setInputText(humanizeSeconds(newValue));
    setInputError(false);
  }

  function revert() {
    setCurrent(original);
    setInputText(humanizeSeconds(original));
    setInputError(false);
  }

  /**
   * "↩" only rewinds the value, so the editor stays open to adjust again.
   * Escape means "I am done here", so it also closes the editor — otherwise the
   * key would leave a reverted editor open with nothing left to revert.
   */
  function revertAndClose() {
    revert();
    setEditing(false);
  }

  function commit() {
    onCommit(current);
    setEditing(false);
  }

  if (!editing) {
    return (
      <span className="duration-editor-root duration-editor-root--closed">
        <span className="duration-editor-display">{humanizeSeconds(value)}</span>
        <button
          type="button"
          className="duration-editor-toggle-btn"
          onClick={openEditor}
          aria-label="Edit duration"
        >
          ±
        </button>
      </span>
    );
  }

  const deltas = unit === "min" ? MIN_DELTAS : SEC_DELTAS;

  return (
    <AcceptOrCancelEditor
      cancelLabel="Cancel changes"
      acceptLabel="Accept changes"
      onCancel={revertAndClose}
      onAccept={() => {
        // Enter on text that did not parse must not silently keep the old value.
        if (!inputError) commit();
      }}
    >
      <span className="duration-editor-root duration-editor-root--open">
        <span className="duration-editor-header">
          <button
            type="button"
            className="duration-editor-toggle-btn"
            onClick={revert}
            aria-label="Cancel changes"
          >
            ↩
          </button>
          <input
            className={`duration-editor-input${inputError ? " duration-editor-input--error" : ""}`}
            type="text"
            value={inputText}
            onChange={(e) => handleInputChange(e.target.value)}
            id={`${uid}-duration`}
            aria-label="Duration"
            aria-invalid={inputError}
          />
        </span>

        <span className="duration-editor-unit-toggle" role="group" aria-label="Duration unit">
          <button
            type="button"
            className={`duration-editor-unit-btn${unit === "min" ? " duration-editor-unit-btn--active" : ""}`}
            onClick={() => setUnit("min")}
            aria-pressed={unit === "min"}
          >
            min
          </button>
          <button
            type="button"
            className={`duration-editor-unit-btn${unit === "sec" ? " duration-editor-unit-btn--active" : ""}`}
            onClick={() => setUnit("sec")}
            aria-pressed={unit === "sec"}
          >
            sec
          </button>
        </span>

        <span className="duration-editor-adjust-buttons">
          {deltas.map((delta) => {
            const seconds = unit === "min" ? delta * 60 : delta;
            const label = delta > 0 ? `+${delta}` : String(delta);
            return (
              <button
                key={delta}
                type="button"
                className="duration-editor-adjust-btn"
                onClick={() => adjust(seconds)}
                aria-label={`${label} ${unit}`}
              >
                {label}
              </button>
            );
          })}
        </span>

        <button
          type="button"
          className="duration-editor-ok-btn"
          onClick={commit}
          aria-label="Accept changes"
        >
          ✔︎
        </button>
      </span>
    </AcceptOrCancelEditor>
  );
}
