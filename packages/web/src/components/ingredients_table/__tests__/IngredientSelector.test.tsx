import { type Ingredient, type IngredientId, type KitchenwareLabel } from "@recipe-book/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TreeSelectChangeEvent } from "primereact/treeselect";
import type { TreeNode } from "primereact/treenode";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IngredientSelector } from "../IngredientSelector.js";

interface MockTreeSelectProps {
  value: string | null | undefined;
  onChange: (e: TreeSelectChangeEvent) => void;
  ariaLabel: string | undefined;
  options: TreeNode[] | undefined;
  placeholder: string | undefined;
}

// Mock TreeSelect so overlay rendering works in jsdom.
// Tests focus on IngredientSelector's tree-building and value mapping logic.
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

const DAIRY: Ingredient = {
  kind: "ingredient",
  id: "dairy000000" as IngredientId,
  name: "Dairy",
  default_measurement_type: "volume",
  labels: new Set(),
};
const BUTTER: Ingredient = {
  kind: "ingredient",
  id: "butter00000" as IngredientId,
  name: "Butter",
  default_measurement_type: "volume",
  labels: new Set(),
  parent_id: "dairy000000" as IngredientId,
};
const CHEESE: Ingredient = {
  kind: "ingredient",
  id: "cheese00000" as IngredientId,
  name: "Cheese",
  default_measurement_type: "weight",
  labels: new Set(),
};

const LABELS: KitchenwareLabel[] = [];
const onChange = vi.fn();

function setup(props: Partial<Parameters<typeof IngredientSelector>[0]> = {}) {
  render(
    <IngredientSelector
      value={undefined}
      options={[DAIRY, BUTTER, CHEESE]}
      labels={LABELS}
      onChange={onChange}
      aria_label="Select parent ingredient"
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("IngredientSelector — display", () => {
  it("renders with placeholder text when no value is selected", () => {
    setup();
    expect(screen.getByText("— None —")).toBeInTheDocument();
  });

  it("renders with a custom placeholder when provided", () => {
    setup({ placeholder: "— Parent —" });
    expect(screen.getByText("— Parent —")).toBeInTheDocument();
  });

  it("renders a select with the given aria_label", () => {
    setup();
    expect(screen.getByRole("combobox", { name: "Select parent ingredient" })).toBeInTheDocument();
  });

  it("reflects the selected value", () => {
    setup({ value: "cheese00000" as IngredientId });
    expect(screen.getByRole("combobox", { name: "Select parent ingredient" })).toHaveValue(
      "cheese00000",
    );
  });
});

describe("IngredientSelector — tree structure", () => {
  it("includes all ingredients as options (including nested children)", () => {
    setup();
    const select = screen.getByRole("combobox", { name: "Select parent ingredient" });
    const values = Array.from(select.querySelectorAll("option")).map((o) => o.value);
    expect(values).toContain("dairy000000");
    expect(values).toContain("butter00000");
    expect(values).toContain("cheese00000");
  });

  it("shows ingredient names as option labels", () => {
    setup();
    expect(screen.getByRole("option", { name: "Dairy" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Butter" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Cheese" })).toBeInTheDocument();
  });
});

describe("IngredientSelector — onChange", () => {
  it("calls onChange with the ingredient id when an option is selected", async () => {
    setup();
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Select parent ingredient" }),
      "cheese00000",
    );
    expect(onChange).toHaveBeenCalledWith("cheese00000");
  });

  it("calls onChange with undefined when the empty option is selected", async () => {
    setup({ value: "cheese00000" as IngredientId });
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Select parent ingredient" }),
      "",
    );
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
