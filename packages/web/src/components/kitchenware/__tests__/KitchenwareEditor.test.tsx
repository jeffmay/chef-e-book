import { type Container, ContainerId, fixedId } from "@recipe-book/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TreeSelectChangeEvent } from "primereact/treeselect";
import type { TreeNode } from "primereact/treenode";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KitchenwareEditor } from "../KitchenwareEditor.tsx";

interface MockTreeSelectProps {
  value: string | null | undefined;
  onChange: (e: TreeSelectChangeEvent) => void;
  ariaLabel: string | undefined;
  options: TreeNode[] | undefined;
  placeholder: string | undefined;
}

vi.mock("primereact/treeselect", () => ({
  TreeSelect: ({ value, onChange, ariaLabel, options, placeholder }: MockTreeSelectProps) => {
    const allNodes: { key: string; label: string }[] = [];
    function collect(nodes: TreeNode[]) {
      for (const n of nodes) {
        allNodes.push({ key: String(n.key ?? ""), label: String(n.label ?? "") });
        if (n.children) collect(n.children);
      }
    }
    collect(options ?? []);
    return (
      <select
        aria-label={ariaLabel}
        value={value ?? ""}
        onChange={(e) => {
          const val = e.target.value || null;
          onChange({
            value: val,
            originalEvent: e,
            stopPropagation: () => e.stopPropagation(),
            preventDefault: () => e.preventDefault(),
            target: { name: "", id: "", value: val },
          });
        }}
      >
        <option value="">{placeholder}</option>
        {allNodes.map((n) => (
          <option key={n.key} value={n.key}>
            {n.label}
          </option>
        ))}
      </select>
    );
  },
}));

const POT: Container = {
  kind: "container",
  id: fixedId(ContainerId, "pot000"),
  name: "Pot",
  labels: new Set(),
};

const onChangeLabels = vi.fn();
const onChangeParent = vi.fn();

function setup(overrides: Partial<Parameters<typeof KitchenwareEditor>[0]> = {}) {
  render(
    <KitchenwareEditor
      name="Bowl"
      labelIds={[]}
      parentId={undefined}
      allLabelNames={["big", "small"]}
      containers={[POT]}
      onChangeLabels={onChangeLabels}
      onChangeParent={onChangeParent}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("KitchenwareEditor — rendering", () => {
  it("shows the container name as read-only", () => {
    setup();
    expect(screen.getByText("Bowl")).toBeInTheDocument();
  });

  it("shows kind as 'container' (locked)", () => {
    setup();
    expect(screen.getByText("container")).toBeInTheDocument();
  });

  it("renders the labels field", () => {
    setup();
    expect(screen.getByRole("combobox", { name: "Container labels" })).toBeInTheDocument();
  });

  it("renders the parent selector", () => {
    setup();
    expect(screen.getByRole("combobox", { name: "Parent container" })).toBeInTheDocument();
  });
});

describe("KitchenwareEditor — label editing", () => {
  it("calls onChangeLabels when labels are changed", async () => {
    setup({ allLabelNames: ["big", "small"] });
    const combobox = screen.getByRole("combobox", { name: "Container labels" });
    await userEvent.type(combobox, "new-label");
    await userEvent.click(await screen.findByText(/Create "new-label"/));
    expect(onChangeLabels).toHaveBeenCalled();
  });
});

describe("KitchenwareEditor — parent selection", () => {
  it("calls onChangeParent when parent is selected", async () => {
    setup({ containers: [POT] });
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Parent container" }),
      fixedId(ContainerId, "pot000"),
    );
    expect(onChangeParent).toHaveBeenCalledWith(fixedId(ContainerId, "pot000"));
  });

  it("calls onChangeParent with undefined when cleared", async () => {
    setup({ parentId: fixedId(ContainerId, "pot000"), containers: [POT] });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Parent container" }), "");
    expect(onChangeParent).toHaveBeenCalledWith(undefined);
  });
});
