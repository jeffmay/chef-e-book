import { type Container, type ContainerId, type KitchenwareLabelId } from "@recipe-book/shared";
import type { ReadonlyDeep } from "type-fest";
import { LabelEditor } from "../ingredients_table/LabelEditor.tsx";
import "./KitchenwareEditor.css";
import { KitchenwareParentSelector } from "./KitchenwareParentSelector.tsx";

export type KitchenwareEditorProps = ReadonlyDeep<{
  name: string;
  labelIds: KitchenwareLabelId[];
  parentId: ContainerId | undefined;
  allLabelNames: string[];
  containers: Container[];
  onChangeLabels: (labelIds: readonly KitchenwareLabelId[]) => void;
  onChangeParent: (parentId: ContainerId | undefined) => void;
}>;

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
