import { IngredientId, fixedId } from "@recipe-book/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TreeNode } from "primereact/treenode";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InstructionIngredientSelector } from "../InstructionIngredientSelector.tsx";

type SelectionState = { checked?: boolean; partialChecked?: boolean };

type MockTreeSelectProps = {
  value: Record<string, SelectionState> | null | undefined;
  options: TreeNode[] | undefined;
  onChange: (e: { value: Record<string, SelectionState> }) => void;
  ariaLabel: string | undefined;
};

// Render the checkbox-mode TreeSelect as a flat list of leaf checkboxes that
// reads/writes the selection-keys object the real component expects.
vi.mock("primereact/treeselect", () => ({
  TreeSelect: ({ value, options, onChange, ariaLabel }: MockTreeSelectProps) => {
    const leaves: TreeNode[] = [];
    function collect(nodes: TreeNode[]) {
      for (const n of nodes) {
        if (n.children && n.children.length > 0) collect(n.children);
        else leaves.push(n);
      }
    }
    collect(options ?? []);
    return (
      <div aria-label={ariaLabel}>
        {leaves.map((n) => {
          const key = String(n.key);
          const checked = value?.[key]?.checked === true;
          return (
            <input
              key={key}
              type="checkbox"
              aria-label={String(n.label ?? "")}
              checked={checked}
              onChange={() => {
                const next: Record<string, SelectionState> = { ...(value ?? {}) };
                if (checked) delete next[key];
                else next[key] = { checked: true, partialChecked: false };
                onChange({ value: next });
              }}
            />
          );
        })}
      </div>
    );
  },
}));

const BUTTER = fixedId(IngredientId, "butter");
const FLOUR = fixedId(IngredientId, "flour");

const NODES: TreeNode[] = [
  { key: "leaf-butter", label: "Butter", data: { ingredient_id: BUTTER } },
  {
    key: "grp-bowl",
    label: "Bowl",
    children: [{ key: "leaf-flour", label: "Flour", data: { ingredient_id: FLOUR } }],
  },
];

const onChange = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("InstructionIngredientSelector", () => {
  it("renders a checkbox for each ingredient, including ones nested in a container", () => {
    render(<InstructionIngredientSelector nodes={NODES} selectedIds={[]} onChange={onChange} />);
    expect(screen.getByRole("checkbox", { name: "Butter" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Flour" })).not.toBeChecked();
  });

  it("pre-checks ingredients that are already selected", () => {
    render(
      <InstructionIngredientSelector nodes={NODES} selectedIds={[FLOUR]} onChange={onChange} />,
    );
    expect(screen.getByRole("checkbox", { name: "Flour" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Butter" })).not.toBeChecked();
  });

  it("emits the resolved ingredient ids when a leaf is checked", async () => {
    render(<InstructionIngredientSelector nodes={NODES} selectedIds={[]} onChange={onChange} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Butter" }));
    expect(onChange).toHaveBeenCalledWith([BUTTER]);
  });

  it("emits an empty list when the last selected ingredient is unchecked", async () => {
    render(
      <InstructionIngredientSelector nodes={NODES} selectedIds={[BUTTER]} onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole("checkbox", { name: "Butter" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
