import { useState, useMemo, type MouseEvent } from "react";
import CreatableSelect from "react-select/creatable";
import { components as SelectComponents } from "react-select";
import type { GroupBase, MenuProps, MultiValue } from "react-select";

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
  readonly selected_label_names: readonly string[];
  readonly all_label_names: readonly string[];
  readonly aria_label: string;
  readonly placeholder?: string;
  readonly on_change: (names: readonly string[]) => void;
  readonly on_commit: () => void;
  readonly on_cancel?: () => void;
  readonly commit_aria_label?: string;
  readonly commit_disabled?: boolean;
}

export function LabelEditor({
  selected_label_names,
  all_label_names,
  aria_label,
  placeholder,
  on_change,
  on_commit,
  on_cancel,
  commit_aria_label,
  commit_disabled,
}: LabelEditorProps) {
  const [menu_open, set_menu_open] = useState(false);

  const selected_options = useMemo(
    () => selected_label_names.map((name) => ({ label: name, value: name })),
    [selected_label_names],
  );

  const all_options = useMemo(
    () => all_label_names.map((name) => ({ label: name, value: name })),
    [all_label_names],
  );

  function handle_change(new_value: MultiValue<LabelOption>): void {
    on_change(new_value.map((opt) => opt.value));
  }

  return (
    <span className="it-label-editor">
      <CreatableSelect<LabelOption, true>
        isMulti
        value={selected_options}
        options={all_options}
        onChange={handle_change}
        aria-label={aria_label}
        placeholder={placeholder}
        menuPortalTarget={document.body}
        menuPosition="fixed"
        menuPlacement="auto"
        classNamePrefix="le"
        components={{ Menu: LabelEditorMenu }}
        onMenuOpen={() => set_menu_open(true)}
        onMenuClose={() => set_menu_open(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !menu_open) {
            e.preventDefault();
            on_cancel?.();
          }
        }}
      />
      <button
        type="button"
        className="it-confirm-btn"
        onClick={on_commit}
        disabled={commit_disabled}
        aria-label={commit_aria_label ?? "Confirm edit"}
      >
        ✔︎
      </button>
      {on_cancel !== undefined && (
        <button
          type="button"
          className="it-cancel-btn"
          onClick={on_cancel}
          aria-label="Cancel edit"
        >
          ✗
        </button>
      )}
    </span>
  );
}
