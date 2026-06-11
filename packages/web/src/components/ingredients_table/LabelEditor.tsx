import { useState, useMemo, useRef, useEffect, type MouseEvent } from "react";
import CreatableSelect from "react-select/creatable";
import { components as SelectComponents, type SelectInstance } from "react-select";
import type { GroupBase, MenuProps, MultiValue } from "react-select";
import "./LabelEditor.css";

interface LabelOption {
  readonly label: string;
  readonly value: string;
}

// Intercepts non-left-click mousedown to prevent focus steal that would close the dropdown.
function LabelEditorMenu(props: MenuProps<LabelOption, true, GroupBase<LabelOption>>) {
  return (
    <SelectComponents.Menu
      {...props}
      innerProps={{
        ...props.innerProps,
        onMouseDown: (e: MouseEvent<HTMLDivElement>) => {
          if (e.button !== 0) {
            e.preventDefault();
            return;
          }
          props.innerProps.onMouseDown?.(e);
        },
      }}
    />
  );
}

export interface LabelEditorProps {
  readonly selectedLabelNames: readonly string[];
  readonly allLabelNames: readonly string[];
  readonly ariaLabel: string;
  readonly placeholder?: string;
  readonly onChange: (names: readonly string[]) => void;
  readonly onCommit?: () => void;
  readonly onCancel?: () => void;
  readonly commitAriaLabel?: string;
  readonly commitDisabled?: boolean;
  readonly autoFocus?: boolean;
}

export function LabelEditor({
  selectedLabelNames,
  allLabelNames,
  ariaLabel,
  placeholder,
  onChange,
  onCommit,
  onCancel,
  commitAriaLabel,
  commitDisabled,
  autoFocus = false,
}: LabelEditorProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const selectRef = useRef<SelectInstance<LabelOption, true>>(null);

  useEffect(() => {
    if (autoFocus && selectRef.current) {
      selectRef.current.focus();
      selectRef.current.openMenu("first");
    }
  }, [autoFocus]);

  const selectedOptions = useMemo(
    () => selectedLabelNames.map((name) => ({ label: name, value: name })),
    [selectedLabelNames],
  );

  const allOptions = useMemo(
    () => allLabelNames.map((name) => ({ label: name, value: name })),
    [allLabelNames],
  );

  function handleChange(new_value: MultiValue<LabelOption>): void {
    onChange(new_value.map((opt) => opt.value));
  }

  return (
    <span className="it-label-editor">
      <CreatableSelect<LabelOption, true>
        isMulti
        value={selectedOptions}
        options={allOptions}
        onChange={handleChange}
        aria-label={ariaLabel}
        placeholder={placeholder}
        menuPortalTarget={document.body}
        menuPosition="fixed"
        menuPlacement="auto"
        classNamePrefix="le"
        ref={selectRef}
        components={{ Menu: LabelEditorMenu }}
        onMenuOpen={() => setMenuOpen(true)}
        onMenuClose={() => setMenuOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.stopPropagation();
          }
          if (e.key === "Escape" && !menuOpen) {
            e.preventDefault();
            e.stopPropagation();
            onCancel?.();
          }
        }}
      />
      <div className="it-label-edit-buttons">
        {onCancel !== undefined && (
          <button
            type="button"
            className="it-cancel-btn"
            onClick={onCancel}
            aria-label="Cancel edit"
          >
            ↩
          </button>
        )}
        {onCommit !== undefined && (
          <button
            type="button"
            className="it-confirm-btn"
            onClick={onCommit}
            disabled={commitDisabled}
            aria-label={commitAriaLabel ?? "Confirm edit"}
          >
            ✔︎
          </button>
        )}
      </div>
    </span>
  );
}
