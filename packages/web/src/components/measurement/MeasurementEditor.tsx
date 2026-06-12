import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import {
  simplify,
  convertVolume,
  convertWeight,
  largestWholeVolumeUnit,
  largestWholeWeightUnit,
  unitType,
  clampToZero,
  type Fraction,
  type Measurement,
  type MeasurementType,
  type MeasurementUnit,
  type VolumeUnit,
  type WeightUnit,
} from "@recipe-book/shared";
import { FractionDisplay, OpMode, OP_ROWS } from "./FractionEditor.tsx";
import "./MeasurementEditor.css";

// ---------------------------------------------------------------------------
// Unit groups
// ---------------------------------------------------------------------------

const VOLUME_US: readonly VolumeUnit[] = ["tsp", "tbsp", "fl_oz", "cup", "pint", "quart", "gallon"];
const VOLUME_METRIC: readonly VolumeUnit[] = ["ml", "l"];
const WEIGHT_US: readonly WeightUnit[] = ["oz", "lb"];
const WEIGHT_METRIC: readonly WeightUnit[] = ["g", "kg"];

const UNIT_LABELS: Record<MeasurementUnit, string> = {
  tsp: "tsp",
  tbsp: "tbsp",
  fl_oz: "fl oz",
  cup: "cup",
  pint: "pint",
  quart: "quart",
  gallon: "gallon",
  ml: "ml",
  l: "L",
  oz: "oz",
  lb: "lb",
  g: "g",
  kg: "kg",
  whole: "whole",
  pinch: "pinch",
  dash: "dash",
};

const DEFAULT_UNIT: Record<MeasurementType, MeasurementUnit> = {
  volume: "cup",
  weight: "oz",
  count: "whole",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inferType(unit: MeasurementUnit): MeasurementType {
  return unitType(unit) ?? "volume";
}

/** Convert between units of the same type and system; returns value unchanged on failure. */
function tryConvert(value: Fraction, from: MeasurementUnit, to: MeasurementUnit): Fraction {
  if (from === to) return value;
  try {
    const t = inferType(from);
    if (t !== inferType(to)) return value;
    if (t === "volume") return convertVolume(value, from as VolumeUnit, to as VolumeUnit);
    if (t === "weight") return convertWeight(value, from as WeightUnit, to as WeightUnit);
    return value;
  } catch {
    return value; // cross-system (e.g. tsp → ml)
  }
}

/** Convert to the largest unit that makes the value a whole number. */
function bestUnitConversion(value: Fraction, unit: MeasurementUnit): Measurement {
  const t = inferType(unit);
  if (t === "volume") {
    const best = largestWholeVolumeUnit(value, unit as VolumeUnit);
    return { value: convertVolume(value, unit as VolumeUnit, best), unit: best };
  }
  if (t === "weight") {
    const best = largestWholeWeightUnit(value, unit as WeightUnit);
    return { value: convertWeight(value, unit as WeightUnit, best), unit: best };
  }
  return { value, unit };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface MeasurementEditorProps {
  readonly value: Measurement;
  readonly onCommit: (value: Measurement) => void;
  readonly onCancel?: () => void;
  readonly initiallyOpen?: boolean;
}

export function MeasurementEditor({
  value,
  onCommit,
  onCancel,
  initiallyOpen = false,
}: MeasurementEditorProps) {
  const [editing, setEditing] = useState(initiallyOpen);
  const [original, setOriginal] = useState<Fraction>(value.value);
  const [current, setCurrent] = useState<Fraction>(value.value);
  const [opMode, setOpMode] = useState<OpMode>("=");
  const [mtype, setMtype] = useState<MeasurementType>(() => inferType(value.unit));
  const [unit, setUnit] = useState<MeasurementUnit>(value.unit);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (editing && rootRef.current) {
      rootRef.current.focus();
    }
  }, [editing]);

  function openEditor() {
    setOriginal(value.value);
    setCurrent(value.value);
    setOpMode("÷");
    setMtype(inferType(value.unit));
    setUnit(value.unit);
    setEditing(true);
  }

  function revertAndClose() {
    setCurrent(original);
    setEditing(false);
    onCancel?.();
  }

  function applyOpButton(label: string) {
    const op = OP_ROWS[opMode].find((o) => o.label === label);
    if (op) setCurrent(clampToZero(simplify(op.apply(current))));
  }

  function handleTypeChange(newType: MeasurementType) {
    setMtype(newType);
    setUnit(DEFAULT_UNIT[newType]);
  }

  function handleUnitChange(newUnit: MeasurementUnit) {
    const converted = tryConvert(current, unit, newUnit);
    setCurrent(converted);
    setUnit(newUnit);
  }

  function commit() {
    const result = bestUnitConversion(current, unit);
    onCommit({ value: simplify(result.value), unit: result.unit });
    setEditing(false);
  }

  if (!editing) {
    return (
      <span className="me-root me-root--closed">
        <FractionDisplay value={value.value} />
        <span className="me-unit">{UNIT_LABELS[value.unit]}</span>
        <button
          type="button"
          className="fe-toggle-btn"
          onClick={openEditor}
          aria-label="Edit measurement"
        >
          ±
        </button>
      </span>
    );
  }

  return (
    <span
      ref={rootRef}
      tabIndex={-1}
      className="me-root me-root--open"
      onKeyDown={(e: KeyboardEvent<HTMLSpanElement>) => {
        if (e.key === "Escape") {
          e.preventDefault();
          revertAndClose();
        }
      }}
    >
      <span className="fe-header">
        <FractionDisplay value={current} />
        <span className="me-unit">{UNIT_LABELS[unit]}</span>
      </span>

      <span className="fe-op-modes" role="group" aria-label="Operation type">
        {OpMode.values.map((mode) => (
          <label key={mode} className="fe-mode-label">
            <input
              type="radio"
              className="fe-mode-radio"
              name="me-op-mode"
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
          <button
            key={op.label}
            type="button"
            className="fe-op-btn"
            onClick={() => applyOpButton(op.label)}
          >
            {op.label}
          </button>
        ))}
      </span>

      {/* Type + unit selectors inserted between op buttons and OK */}
      <span className="me-controls">
        <label className="me-control-label">
          Type
          <select
            className="me-select"
            value={mtype}
            onChange={(e) => handleTypeChange(e.target.value as MeasurementType)}
            aria-label="Measurement type"
          >
            <option value="volume">Volume</option>
            <option value="weight">Weight</option>
            <option value="count">Count</option>
          </select>
        </label>

        <label className="me-control-label">
          Unit
          <select
            className="me-select"
            value={unit}
            onChange={(e) => handleUnitChange(e.target.value as MeasurementUnit)}
            aria-label="Measurement unit"
          >
            {mtype === "volume" && (
              <>
                <optgroup label="US">
                  {VOLUME_US.map((u) => (
                    <option key={u} value={u}>
                      {UNIT_LABELS[u]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Metric">
                  {VOLUME_METRIC.map((u) => (
                    <option key={u} value={u}>
                      {UNIT_LABELS[u]}
                    </option>
                  ))}
                </optgroup>
              </>
            )}
            {mtype === "weight" && (
              <>
                <optgroup label="US">
                  {WEIGHT_US.map((u) => (
                    <option key={u} value={u}>
                      {UNIT_LABELS[u]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Metric">
                  {WEIGHT_METRIC.map((u) => (
                    <option key={u} value={u}>
                      {UNIT_LABELS[u]}
                    </option>
                  ))}
                </optgroup>
              </>
            )}
            {mtype === "count" && (
              <>
                <option value="whole">{UNIT_LABELS.whole}</option>
                <option value="pinch">{UNIT_LABELS.pinch}</option>
                <option value="dash">{UNIT_LABELS.dash}</option>
              </>
            )}
          </select>
        </label>
      </span>

      <span className="me-bottom-row">
        <button
          type="button"
          className="fe-toggle-btn"
          onClick={revertAndClose}
          aria-label="Cancel changes"
        >
          ↩
        </button>
        <button type="button" className="fe-ok-btn" onClick={commit} aria-label="Accept changes">
          ✔︎
        </button>
      </span>
    </span>
  );
}
