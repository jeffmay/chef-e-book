import { useState } from "react";
import parse from "parse-duration";
import humanize, { type HumanizeDurationOptions } from "humanize-duration";
import "./DurationEditor.css";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type DurationUnit = "min" | "sec";

const MIN_DELTAS = [-5, -1, 1, 5] as const;
const SEC_DELTAS = [-15, -5, 5, 15] as const;

const HUMANIZE_OPTS: HumanizeDurationOptions = {
  units: ["h", "m", "s"],
  largest: 2,
  round: true,
};

function humanizeSeconds(seconds: number): string {
  return humanize(seconds * 1000, HUMANIZE_OPTS);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface DurationEditorProps {
  readonly value: number; // seconds
  readonly onCommit: (seconds: number) => void;
}

export function DurationEditor({ value, onCommit }: DurationEditorProps) {
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
    const parsed_ms = parse(text);
    if (parsed_ms != null && parsed_ms >= 0) {
      setCurrent(Math.round(parsed_ms / 1000));
      setInputError(false);
    } else {
      setInputError(true);
    }
  }

  function adjust(delta_seconds: number) {
    const new_value = Math.max(0, current + delta_seconds);
    setCurrent(new_value);
    setInputText(humanizeSeconds(new_value));
    setInputError(false);
  }

  function revert() {
    setCurrent(original);
    setInputText(humanizeSeconds(original));
    setInputError(false);
  }

  function commit() {
    onCommit(current);
    setEditing(false);
  }

  if (!editing) {
    return (
      <span className="de-root de-root--closed">
        <span className="de-display">{humanizeSeconds(value)}</span>
        <button
          type="button"
          className="de-toggle-btn"
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
    <span className="de-root de-root--open">
      <span className="de-header">
        <button
          type="button"
          className="de-toggle-btn"
          onClick={revert}
          aria-label="Cancel changes"
        >
          ↩
        </button>
        <input
          className={`de-input${inputError ? " de-input--error" : ""}`}
          type="text"
          value={inputText}
          onChange={(e) => handleInputChange(e.target.value)}
          aria-label="Duration"
          aria-invalid={inputError}
          placeholder="e.g. 5 min, 1h 30m"
        />
      </span>

      <span className="de-unit-toggle" role="group" aria-label="Duration unit">
        <button
          type="button"
          className={`de-unit-btn${unit === "min" ? " de-unit-btn--active" : ""}`}
          onClick={() => setUnit("min")}
          aria-pressed={unit === "min"}
        >
          min
        </button>
        <button
          type="button"
          className={`de-unit-btn${unit === "sec" ? " de-unit-btn--active" : ""}`}
          onClick={() => setUnit("sec")}
          aria-pressed={unit === "sec"}
        >
          sec
        </button>
      </span>

      <span className="de-adjust-buttons">
        {deltas.map((delta) => {
          const seconds = unit === "min" ? delta * 60 : delta;
          const label = delta > 0 ? `+${delta}` : String(delta);
          return (
            <button
              key={delta}
              type="button"
              className="de-adjust-btn"
              onClick={() => adjust(seconds)}
              aria-label={`${label} ${unit}`}
            >
              {label}
            </button>
          );
        })}
      </span>

      <button type="button" className="de-ok-btn" onClick={commit} aria-label="Accept changes">
        ✔︎
      </button>
    </span>
  );
}
