import { useState, useMemo, useRef, useEffect, type MouseEvent } from "react";
import CreatableSelect from "react-select/creatable";
import { components as SelectComponents, type SelectInstance } from "react-select";
import type { GroupBase, MenuProps, MultiValue } from "react-select";
import type { ReadonlyDeep } from "type-fest";
import { AcceptOrCancelEditor } from "../accept_or_cancel_editor/AcceptOrCancelEditor.tsx";
import "./LabelEditor.css";

type LabelOption = ReadonlyDeep<{
  label: string;
  value: string;
}>;

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

export type LabelEditorProps = ReadonlyDeep<{
  selectedLabelNames: string[];
  allLabelNames: string[];
  ariaLabel: string;
  placeholder?: string;
  onChange: (names: readonly string[]) => void;
  onCommit?: () => void;
  onCancel?: () => void;
  commitAriaLabel?: string;
  commitDisabled?: boolean;
  autoFocus?: boolean;
}>;

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

  function handleChange(newValue: MultiValue<LabelOption>): void {
    onChange(newValue.map((opt) => opt.value));
  }

  const editor = (
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
          // While the menu is open, Escape closes it and goes no further: the
          // enclosing AcceptOrCancelEditor must not also cancel the edit.
          if (e.key === "Escape" && menuOpen) {
            e.stopPropagation();
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

  // Only an editor that can be both accepted and cancelled answers the keyboard.
  // Without both handlers there is nothing for Enter or Escape to do, and
  // swallowing them here would keep them from an editor further out.
  if (onCommit === undefined || onCancel === undefined) return editor;

  return (
    <AcceptOrCancelEditor
      cancelLabel="Cancel edit"
      acceptLabel={commitAriaLabel ?? "Confirm edit"}
      onCancel={onCancel}
      onAccept={() => {
        if (commitDisabled !== true) onCommit();
      }}
    >
      {editor}
    </AcceptOrCancelEditor>
  );
}
