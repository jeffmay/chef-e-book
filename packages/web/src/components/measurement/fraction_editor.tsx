import { useState, type ReactNode } from "react";
import {
  makeFraction,
  simplify,
  integerPart,
  fractionalPart,
  formatFraction,
  addFractions,
  subtractFractions,
  multiplyFractions,
  divideFractions,
  type Fraction,
} from "@recipe-book/shared";
import "./fraction_editor.css";

// ---------------------------------------------------------------------------
// Shared display + op constants (also used by MeasurementEditor)
// ---------------------------------------------------------------------------

export type OpMode = "÷" | "×" | "−" | "+";

export interface OpButton {
  readonly label: string;
  readonly apply: (f: Fraction) => Fraction;
}

export const OP_MODES: readonly OpMode[] = ["÷", "×", "−", "+"];

export const OP_ROWS: Record<OpMode, readonly OpButton[]> = {
  "÷": [
    { label: "÷2", apply: (f) => divideFractions(f, makeFraction(2, 1)) },
    { label: "÷3", apply: (f) => divideFractions(f, makeFraction(3, 1)) },
    { label: "÷5", apply: (f) => divideFractions(f, makeFraction(5, 1)) },
  ],
  "×": [
    { label: "×2", apply: (f) => multiplyFractions(f, makeFraction(2, 1)) },
    { label: "×3", apply: (f) => multiplyFractions(f, makeFraction(3, 1)) },
    { label: "×5", apply: (f) => multiplyFractions(f, makeFraction(5, 1)) },
  ],
  "−": [
    { label: "−1", apply: (f) => subtractFractions(f, makeFraction(1, 1)) },
    { label: "−½", apply: (f) => subtractFractions(f, makeFraction(1, 2)) },
    { label: "−⅓", apply: (f) => subtractFractions(f, makeFraction(1, 3)) },
    { label: "−⅕", apply: (f) => subtractFractions(f, makeFraction(1, 5)) },
    { label: "−⅛", apply: (f) => subtractFractions(f, makeFraction(1, 8)) },
  ],
  "+": [
    { label: "+⅛", apply: (f) => addFractions(f, makeFraction(1, 8)) },
    { label: "+⅕", apply: (f) => addFractions(f, makeFraction(1, 5)) },
    { label: "+⅓", apply: (f) => addFractions(f, makeFraction(1, 3)) },
    { label: "+½", apply: (f) => addFractions(f, makeFraction(1, 2)) },
    { label: "+1", apply: (f) => addFractions(f, makeFraction(1, 1)) },
  ],
};

// ---------------------------------------------------------------------------
// FractionDisplay
// ---------------------------------------------------------------------------

export interface FractionDisplayProps {
  readonly value: Fraction;
}

export function FractionDisplay({ value }: FractionDisplayProps) {
  const s = simplify(value);
  const int = integerPart(s);
  const frac = fractionalPart(s);

  return (
    <span className="fe_display" aria-label={formatFraction(s)}>
      {(int !== 0 || frac.numerator === 0) && (
        <span className="fe_integer">{int === 0 ? "0" : int}</span>
      )}
      {frac.numerator !== 0 && (
        <span className="fe_fraction">
          <sup>{Math.abs(frac.numerator)}</sup>
          {"⁄"}
          <sub>{frac.denominator}</sub>
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// FractionEditor
// ---------------------------------------------------------------------------

export interface FractionEditorProps {
  readonly value: Fraction;
  readonly onCommit: (value: Fraction) => void;
  /** Rendered between the operation buttons and the OK button when editing. */
  readonly extraControls?: ReactNode;
}

export function FractionEditor({ value, onCommit, extraControls }: FractionEditorProps) {
  const [editing, setEditing] = useState(false);
  const [original, setOriginal] = useState<Fraction>(value);
  const [current, setCurrent] = useState<Fraction>(value);
  const [opMode, setOpMode] = useState<OpMode>("÷");

  function openEditor() {
    setOriginal(value);
    setCurrent(value);
    setOpMode("÷");
    setEditing(true);
  }

  function reset() {
    setCurrent(original);
  }

  function applyOp(op: OpButton) {
    setCurrent(simplify(op.apply(current)));
  }

  function commit() {
    onCommit(current);
    setEditing(false);
  }

  if (!editing) {
    return (
      <span className="fe_root fe_root--closed">
        <FractionDisplay value={value} />
        <button
          type="button"
          className="fe_toggle_btn"
          onClick={openEditor}
          aria-label="Edit value"
        >
          ±
        </button>
      </span>
    );
  }

  return (
    <span className="fe_root fe_root--open">
      <span className="fe_header">
        <button
          type="button"
          className="fe_toggle_btn"
          onClick={reset}
          aria-label="Reset to original"
        >
          {"<"}
        </button>
        <FractionDisplay value={current} />
      </span>

      <span className="fe_op_modes" role="group" aria-label="Operation type">
        {OP_MODES.map((mode) => (
          <label key={mode} className="fe_mode_label">
            <input
              type="radio"
              className="fe_mode_radio"
              name="fe-op-mode"
              value={mode}
              checked={opMode === mode}
              onChange={() => setOpMode(mode)}
              aria-label={mode}
            />
            <span className="fe_mode_symbol" aria-hidden>
              {mode}
            </span>
          </label>
        ))}
      </span>

      <span className="fe_op_buttons">
        {OP_ROWS[opMode].map((op) => (
          <button
            key={op.label}
            type="button"
            className="fe_op_btn"
            onClick={() => applyOp(op)}
          >
            {op.label}
          </button>
        ))}
      </span>

      {extraControls}

      <button type="button" className="fe_ok_btn" onClick={commit} aria-label="OK">
        OK
      </button>
    </span>
  );
}
