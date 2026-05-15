import { type Container, type ContainerId, type KitchenwareLabelId } from "@recipe-book/shared";
import { LabelEditor } from "../ingredients_table/LabelEditor.js";
import { KitchenwareParentSelector } from "./KitchenwareParentSelector.js";
import "./KitchenwareEditor.css";

export interface KitchenwareEditorProps {
  readonly name: string;
  readonly label_ids: readonly KitchenwareLabelId[];
  readonly parent_id: ContainerId | undefined;
  readonly all_label_names: readonly string[];
  readonly containers: readonly Container[];
  readonly onChangeLabels: (label_ids: KitchenwareLabelId[]) => void;
  readonly onChangeParent: (parent_id: ContainerId | undefined) => void;
}

export function KitchenwareEditor({
  name,
  label_ids,
  parent_id,
  all_label_names,
  containers,
  onChangeLabels,
  onChangeParent,
}: KitchenwareEditorProps) {
  const label_names = label_ids.map(String);

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
          selected_label_names={label_names}
          all_label_names={[...all_label_names]}
          aria_label="Container labels"
          onChange={(names) => onChangeLabels(names as KitchenwareLabelId[])}
          onCommit={() => undefined}
          onCancel={() => undefined}
        />
      </div>
      <div className="ke-field">
        <span className="ke-field-label">Parent</span>
        <KitchenwareParentSelector
          value={parent_id}
          containers={containers}
          onChange={onChangeParent}
          aria_label="Parent container"
        />
      </div>
    </div>
  );
}
