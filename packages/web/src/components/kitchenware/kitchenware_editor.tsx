import { type Container, type ContainerId, type KitchenwareLabelId } from "@recipe-book/shared";
import { LabelEditor } from "../ingredients_table/label_editor.js";
import { KitchenwareParentSelector } from "./kitchenware_parent_selector.js";
import "./kitchenware_editor.css";

export interface KitchenwareEditorProps {
  readonly name: string;
  readonly labelIds: readonly KitchenwareLabelId[];
  readonly parentId: ContainerId | undefined;
  readonly allLabelNames: readonly string[];
  readonly containers: readonly Container[];
  readonly onChangeLabels: (label_ids: KitchenwareLabelId[]) => void;
  readonly onChangeParent: (parent_id: ContainerId | undefined) => void;
}

export function KitchenwareEditor({
  name,
  labelIds,
  parentId,
  allLabelNames,
  containers,
  onChangeLabels,
  onChangeParent,
}: KitchenwareEditorProps) {
  const labelNames = labelIds.map(String);

  return (
    <div className="ke_editor">
      <div className="ke_field">
        <span className="ke_field_label">Name</span>
        <span className="ke_field_value">{name}</span>
      </div>
      <div className="ke_field">
        <span className="ke_field_label">Kind</span>
        <span className="ke_field_value ke_field_value--muted">container</span>
      </div>
      <div className="ke_field">
        <span className="ke_field_label">Labels</span>
        <LabelEditor
          selectedLabelNames={labelNames}
          allLabelNames={[...allLabelNames]}
          ariaLabel="Container labels"
          onChange={(names) => onChangeLabels(names as KitchenwareLabelId[])}
          onCommit={() => undefined}
          onCancel={() => undefined}
        />
      </div>
      <div className="ke_field">
        <span className="ke_field_label">Parent</span>
        <KitchenwareParentSelector
          value={parentId}
          containers={containers}
          onChange={onChangeParent}
          ariaLabel="Parent container"
        />
      </div>
    </div>
  );
}
