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
    <div className="kitchenware-editor-editor">
      <div className="kitchenware-editor-field">
        <span className="kitchenware-editor-field-label">Name</span>
        <span className="kitchenware-editor-field-value">{name}</span>
      </div>
      <div className="kitchenware-editor-field">
        <span className="kitchenware-editor-field-label">Kind</span>
        <span className="kitchenware-editor-field-value kitchenware-editor-field-value--muted">
          container
        </span>
      </div>
      <div className="kitchenware-editor-field">
        <span className="kitchenware-editor-field-label">Labels</span>
        <LabelEditor
          selectedLabelNames={labelNames}
          allLabelNames={[...allLabelNames]}
          ariaLabel="Container labels"
          onChange={(names) => onChangeLabels(names as KitchenwareLabelId[])}
        />
      </div>
      <div className="kitchenware-editor-field">
        <span className="kitchenware-editor-field-label">Parent</span>
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
