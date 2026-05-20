import { type Container, type ContainerId, type KitchenwareLabelId } from "@recipe-book/shared";
import { LabelEditor } from "../ingredients_table/LabelEditor.js";
import { KitchenwareParentSelector } from "./KitchenwareParentSelector.js";
import "./KitchenwareEditor.css";

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
    <div className="ke-editor">
      <div className="ke-field">
        <span className="ke-field-label">Name</span>
        <span className="ke-field-value">{name}</span>
      </div>
      <div className="ke-field">
        <span className="ke-field-label">Kind</span>
        <span className="ke-field-value ke-field-value--muted">container</span>
      </div>
      <div className="ke-field">
        <span className="ke-field-label">Labels</span>
        <LabelEditor
          selectedLabelNames={labelNames}
          allLabelNames={[...allLabelNames]}
          ariaLabel="Container labels"
          onChange={(names) => onChangeLabels(names as KitchenwareLabelId[])}
          onCommit={() => undefined}
          onCancel={() => undefined}
        />
      </div>
      <div className="ke-field">
        <span className="ke-field-label">Parent</span>
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
