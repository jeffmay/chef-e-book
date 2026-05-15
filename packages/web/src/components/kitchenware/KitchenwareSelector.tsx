import { type Container, type ContainerId, type KitchenwareLabelId } from "@recipe-book/shared";
import { useState } from "react";
import CreatableSelect from "react-select/creatable";
import { KitchenwareEditor } from "./KitchenwareEditor.js";
import "./KitchenwareSelector.css";

interface SelectOption {
  readonly value: ContainerId;
  readonly label: string;
}

interface NewContainerState {
  readonly container: Container;
  label_ids: KitchenwareLabelId[];
  parent_id: ContainerId | undefined;
}

export interface KitchenwareSelectorProps {
  readonly value: ContainerId | undefined;
  readonly containers: readonly Container[];
  readonly all_label_names: readonly string[];
  readonly onChange: (id: ContainerId | undefined) => void;
  readonly onCreateContainer: (name: string) => Container;
  readonly onUpdateContainer: (id: ContainerId, label_ids: KitchenwareLabelId[], parent_id: ContainerId | undefined) => void;
  readonly aria_label?: string;
  readonly placeholder?: string;
}

export function KitchenwareSelector({
  value,
  containers,
  all_label_names,
  onChange,
  onCreateContainer,
  onUpdateContainer,
  aria_label = "Container",
  placeholder = "Select or create a container…",
}: KitchenwareSelectorProps) {
  const [new_container, set_new_container] = useState<NewContainerState | null>(null);

  const options: SelectOption[] = containers.map((c) => ({ value: c.id, label: c.name }));
  const selected = value !== undefined ? (options.find((o) => o.value === value) ?? null) : null;

  function handleCreate(name: string) {
    const container = onCreateContainer(name);
    set_new_container({ container, label_ids: [], parent_id: undefined });
  }

  function handleSave() {
    if (new_container === null) return;
    onUpdateContainer(new_container.container.id, new_container.label_ids, new_container.parent_id);
    onChange(new_container.container.id);
    set_new_container(null);
  }

  function handleCancel() {
    set_new_container(null);
  }

  return (
    <>
      <CreatableSelect<SelectOption>
        value={selected}
        options={options}
        onChange={(opt) => onChange(opt?.value)}
        onCreateOption={handleCreate}
        isClearable
        aria-label={aria_label}
        placeholder={placeholder}
        classNamePrefix="ks"
        formatCreateLabel={(input) => `Create "${input}"`}
      />

      {new_container !== null && (
        <div className="ks-modal-overlay" role="dialog" aria-modal="true" aria-label="New container">
          <div className="ks-modal">
            <h3 className="ks-modal-title">New Container: {new_container.container.name}</h3>
            <KitchenwareEditor
              name={new_container.container.name}
              label_ids={new_container.label_ids}
              parent_id={new_container.parent_id}
              all_label_names={all_label_names}
              containers={containers.filter((c) => c.id !== new_container.container.id)}
              onChangeLabels={(ids) => set_new_container((prev) => prev ? { ...prev, label_ids: ids } : prev)}
              onChangeParent={(id) => set_new_container((prev) => prev ? { ...prev, parent_id: id } : prev)}
            />
            <div className="ks-modal-actions">
              <button type="button" className="ks-modal-create" onClick={handleSave}>
                Create
              </button>
              <button type="button" className="ks-modal-cancel" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
