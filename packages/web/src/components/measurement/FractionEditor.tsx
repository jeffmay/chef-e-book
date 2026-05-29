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
  clampToZero,
  type Fraction,
  EnumCompanion,
  extend,
} from "@recipe-book/shared";
import "./FractionEditor.css";

// ---------------------------------------------------------------------------
// Shared display + op constants (also used by MeasurementEditor)
// ---------------------------------------------------------------------------

export interface OpButton {
  readonly label: string;
  readonly apply: (f: Fraction) => Fraction;
}

export const OpMode = extend(EnumCompanion("OpMode", ["=", "+", "-", "✕", "÷"]), (init) => {
  const alphaEnum = {
    SET: "=",
    ADD: "+",
    SUB: "-",
    MUL: "✕",
    DIV: "÷",
  } as const satisfies Record<string, (typeof init.values)[number]>;
  return {
    ...init,
    enum: alphaEnum,
    default: alphaEnum.SET,
  };
});
export type OpMode = typeof OpMode.type.infer;

export const OP_ROWS: Record<OpMode, readonly OpButton[]> = {
  "=": [
    { label: "1", apply: () => makeFraction(1, 1) },
    { label: "2", apply: () => makeFraction(2, 1) },
    { label: "3", apply: () => makeFraction(3, 1) },
  ],
  "+": [
    { label: "+1", apply: (f) => addFractions(f, makeFraction(1, 1)) },
    { label: "+½", apply: (f) => addFractions(f, makeFraction(1, 2)) },
    { label: "+⅓", apply: (f) => addFractions(f, makeFraction(1, 3)) },
    { label: "+⅕", apply: (f) => addFractions(f, makeFraction(1, 5)) },
    { label: "+⅛", apply: (f) => addFractions(f, makeFraction(1, 8)) },
  ],
  "-": [
    { label: "-1", apply: (f) => subtractFractions(f, makeFraction(1, 1)) },
    { label: "−½", apply: (f) => subtractFractions(f, makeFraction(1, 2)) },
    { label: "−⅓", apply: (f) => subtractFractions(f, makeFraction(1, 3)) },
    { label: "−⅕", apply: (f) => subtractFractions(f, makeFraction(1, 5)) },
    { label: "−⅛", apply: (f) => subtractFractions(f, makeFraction(1, 8)) },
  ],
  "✕": [
    { label: "x2", apply: (f) => multiplyFractions(f, makeFraction(2, 1)) },
    { label: "x3", apply: (f) => multiplyFractions(f, makeFraction(3, 1)) },
    { label: "x5", apply: (f) => multiplyFractions(f, makeFraction(5, 1)) },
  ],
  "÷": [
    { label: "÷2", apply: (f) => divideFractions(f, makeFraction(2, 1)) },
    { label: "÷3", apply: (f) => divideFractions(f, makeFraction(3, 1)) },
    { label: "÷5", apply: (f) => divideFractions(f, makeFraction(5, 1)) },
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
    <span className="fe-display" aria-label={formatFraction(s)}>
      {(int !== 0 || frac.numerator === 0) && (
        <span className="fe-integer">{int === 0 ? "0" : int}</span>
      )}
      {frac.numerator !== 0 && (
        <span className="fe-fraction">
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
    setOpMode(OpMode.default);
    setEditing(true);
  }

  function reset() {
    setCurrent(original);
  }

  function applyOp(op: OpButton) {
    setCurrent(clampToZero(simplify(op.apply(current))));
  }

  function commit() {
    onCommit(current);
    setEditing(false);
  }

  if (!editing) {
    return (
      <span className="fe-root fe-root--closed">
        <FractionDisplay value={value} />
        <button
          type="button"
          className="fe-toggle-btn"
          onClick={openEditor}
          aria-label="Edit value"
        >
          ±
        </button>
      </span>
    );
  }

  return (
    <span className="fe-root fe-root--open">
      <span className="fe-header">
        <button type="button" className="fe-toggle-btn" onClick={reset} aria-label="Cancel changes">
          ↩
        </button>
        <FractionDisplay value={current} />
      </span>

      <span className="fe-op-modes" role="group" aria-label="Operation type">
        {OpMode.values.map((mode) => (
          <label key={mode} className="fe-mode-label">
            <input
              type="radio"
              className="fe-mode-radio"
              name="fe-op-mode"
              value={mode}
              checked={opMode === mode}
              onChange={() => setOpMode(mode)}
              aria-label={mode}
            />
            <span className="fe-mode-symbol" aria-hidden>
              {mode}
            </span>
          </label>
        ))}
      </span>

      <span className="fe-op-buttons">
        {OP_ROWS[opMode].map((op) => (
          <button key={op.label} type="button" className="fe-op-btn" onClick={() => applyOp(op)}>
            {op.label}
          </button>
        ))}
      </span>

      {extraControls}

      <button type="button" className="fe-ok-btn" onClick={commit} aria-label="Accept changes">
        ✔︎
      </button>
    </span>
  );
}
