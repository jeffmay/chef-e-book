import { useState, useMemo, type MouseEvent } from "react";
import CreatableSelect from "react-select/creatable";
import { components as SelectComponents } from "react-select";
import type { GroupBase, MenuProps, MultiValue } from "react-select";
import "./label_editor.css"

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
  readonly onCommit: () => void;
  readonly onCancel?: () => void;
  readonly commitAriaLabel?: string;
  readonly commitDisabled?: boolean;
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
}: LabelEditorProps) {
  const [menuOpen, setMenuOpen] = useState(false);

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
    <span className="it_label_editor">
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
        components={{ Menu: LabelEditorMenu }}
        onMenuOpen={() => setMenuOpen(true)}
        onMenuClose={() => setMenuOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !menuOpen) {
            e.preventDefault();
            onCancel?.();
          }
        }}
      />
      <button
        type="button"
        className="it_confirm_btn"
        onClick={onCommit}
        disabled={commitDisabled}
        aria-label={commitAriaLabel ?? "Confirm edit"}
      >
        ✔︎
      </button>
      {onCancel !== undefined && (
        <button
          type="button"
          className="it_cancel_btn"
          onClick={onCancel}
          aria-label="Cancel edit"
        >
          ✗
        </button>
      )}
    </span>
  );
}
