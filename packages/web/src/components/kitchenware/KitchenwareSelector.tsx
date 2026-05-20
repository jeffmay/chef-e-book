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
  labelIds: KitchenwareLabelId[];
  parentId: ContainerId | undefined;
}

export interface KitchenwareSelectorProps {
  readonly value: ContainerId | undefined;
  readonly containers: readonly Container[];
  readonly allLabelNames: readonly string[];
  readonly onChange: (id: ContainerId | undefined) => void;
  readonly onCreateContainer: (name: string) => Container;
  readonly onUpdateContainer: (id: ContainerId, label_ids: KitchenwareLabelId[], parent_id: ContainerId | undefined) => void;
  readonly ariaLabel?: string;
  readonly placeholder?: string;
}

export function KitchenwareSelector({
  value,
  containers,
  allLabelNames,
  onChange,
  onCreateContainer,
  onUpdateContainer,
  ariaLabel = "Container",
  placeholder = "Select or create a container…",
}: KitchenwareSelectorProps) {
  const [newContainer, setNewContainer] = useState<NewContainerState | null>(null);

  const options: SelectOption[] = containers.map((c) => ({ value: c.id, label: c.name }));
  const selected = value !== undefined ? (options.find((o) => o.value === value) ?? null) : null;

  function handleCreate(name: string) {
    const container = onCreateContainer(name);
    setNewContainer({ container, labelIds: [], parentId: undefined });
  }

  function handleSave() {
    if (newContainer === null) return;
    onUpdateContainer(newContainer.container.id, newContainer.labelIds, newContainer.parentId);
    onChange(newContainer.container.id);
    setNewContainer(null);
  }

  function handleCancel() {
    setNewContainer(null);
  }

  return (
    <>
      <CreatableSelect<SelectOption>
        value={selected}
        options={options}
        onChange={(opt) => onChange(opt?.value)}
        onCreateOption={handleCreate}
        isClearable
        aria-label={ariaLabel}
        placeholder={placeholder}
        classNamePrefix="ks"
        formatCreateLabel={(input) => `Create "${input}"`}
      />

      {newContainer !== null && (
        <div className="ks-modal-overlay" role="dialog" aria-modal="true" aria-label="New container">
          <div className="ks-modal">
            <h3 className="ks-modal-title">New Container: {newContainer.container.name}</h3>
            <KitchenwareEditor
              name={newContainer.container.name}
              labelIds={newContainer.labelIds}
              parentId={newContainer.parentId}
              allLabelNames={allLabelNames}
              containers={containers.filter((c) => c.id !== newContainer.container.id)}
              onChangeLabels={(ids) => setNewContainer((prev) => prev ? { ...prev, labelIds: ids } : prev)}
              onChangeParent={(id) => setNewContainer((prev) => prev ? { ...prev, parentId: id } : prev)}
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
