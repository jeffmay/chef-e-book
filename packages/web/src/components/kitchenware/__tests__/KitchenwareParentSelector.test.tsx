import { type Container, type ContainerId } from "@recipe-book/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TreeSelectChangeEvent } from "primereact/treeselect";
import type { TreeNode } from "primereact/treenode";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KitchenwareParentSelector } from "../kitchenware_parent_selector.js";

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

const BOWL: Container = {
  kind: "container",
  id: "------bowl00" as ContainerId,
  name: "Bowl",
  labels: new Set(),
};
const POT: Container = {
  kind: "container",
  id: "------pot000" as ContainerId,
  name: "Pot",
  labels: new Set(),
};
const SMALL_BOWL: Container = {
  kind: "container",
  id: "---small_bow" as ContainerId,
  name: "Small Bowl",
  labels: new Set(),
  parent_id: "------bowl00" as ContainerId,
};

const onChange = vi.fn();

function setup(props: Partial<Parameters<typeof KitchenwareParentSelector>[0]> = {}) {
  render(
    <KitchenwareParentSelector
      value={undefined}
      containers={[BOWL, POT, SMALL_BOWL]}
      onChange={onChange}
      ariaLabel="Parent container"
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("KitchenwareParentSelector — display", () => {
  it("renders with placeholder when no value selected", () => {
    setup();
    expect(screen.getByText("— None —")).toBeInTheDocument();
  });

  it("renders with custom placeholder", () => {
    setup({ placeholder: "Choose parent" });
    expect(screen.getByText("Choose parent")).toBeInTheDocument();
  });

  it("renders all containers as options (including nested)", () => {
    setup();
    const select = screen.getByRole("combobox", { name: "Parent container" });
    const values = Array.from(select.querySelectorAll("option")).map((o) => o.value);
    expect(values).toContain("------bowl00");
    expect(values).toContain("------pot000");
    expect(values).toContain("---small_bow");
  });

  it("reflects the selected value", () => {
    setup({ value: "------pot000" as ContainerId });
    expect(screen.getByRole("combobox", { name: "Parent container" })).toHaveValue("------pot000");
  });
});

describe("KitchenwareParentSelector — onChange", () => {
  it("calls onChange with container id when option selected", async () => {
    setup();
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Parent container" }),
      "------bowl00",
    );
    expect(onChange).toHaveBeenCalledWith("------bowl00");
  });

  it("calls onChange with undefined when empty option selected", async () => {
    setup({ value: "------bowl00" as ContainerId });
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Parent container" }),
      "",
    );
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
