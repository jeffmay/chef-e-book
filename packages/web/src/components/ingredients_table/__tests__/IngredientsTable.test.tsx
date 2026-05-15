import type { Ingredient, IngredientId, KitchenwareLabelId } from "@recipe-book/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TreeSelectChangeEvent } from "primereact/treeselect";
import type { TreeNode } from "primereact/treenode";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IngredientsTable } from "../IngredientsTable.js";

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

const DAIRY: Ingredient = {
  kind: "ingredient",
  id: "dairy" as IngredientId,
  name: "Dairy",
  default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "cup" as const },
  labels: new Set<KitchenwareLabelId>(),
};
const BUTTER: Ingredient = {
  kind: "ingredient",
  id: "butter" as IngredientId,
  name: "Butter",
  default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "cup" as const },
  labels: new Set(["fat0000" as KitchenwareLabelId, "sol0000" as KitchenwareLabelId]),
  parent_id: "dairy" as IngredientId,
};
const FLOUR: Ingredient = {
  kind: "ingredient",
  id: "flour" as IngredientId,
  name: "Flour",
  default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "cup" as const },
  labels: new Set(["bak0000" as KitchenwareLabelId]),
};
const CHEESE: Ingredient = {
  kind: "ingredient",
  id: "cheese" as IngredientId,
  name: "Cheese",
  default_measurement_value: { value: { numerator: 1, denominator: 1 }, unit: "oz" as const },
  labels: new Set(["sol0000" as KitchenwareLabelId]),
};

const onRename = vi.fn();
const onSetMeasurementValue = vi.fn();
const onSetLabels = vi.fn();
const onSetParent = vi.fn();
const onAddLabels = vi.fn();
const onRemoveLabels = vi.fn();
const onBulkSetMeasurementValue = vi.fn();
const onBulkSetParent = vi.fn();

function setup(ingredients: Ingredient[] = [DAIRY, BUTTER, FLOUR, CHEESE]) {
  return render(
    <IngredientsTable
      ingredients={ingredients}
      labels={[]}
      onRename={onRename}
      onSetMeasurementValue={onSetMeasurementValue}
      onSetLabels={onSetLabels}
      onSetParent={onSetParent}
      onAddLabels={onAddLabels}
      onRemoveLabels={onRemoveLabels}
      onBulkSetMeasurementValue={onBulkSetMeasurementValue}
      onBulkSetParent={onBulkSetParent}
    />,
  );
}

function getRegion() {
  return screen.getByRole("region", { name: "Ingredient list" });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("IngredientsTable — rendering", () => {
  it("renders the ingredient list region", () => {
    setup();
    expect(getRegion()).toBeInTheDocument();
  });

  it("renders root-level ingredients", async () => {
    setup();
    expect(await screen.findByText("Dairy")).toBeInTheDocument();
    expect(await screen.findByText("Flour")).toBeInTheDocument();
    expect(await screen.findByText("Cheese")).toBeInTheDocument();
  });

  it("renders column headers", () => {
    setup();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Default")).toBeInTheDocument();
    expect(screen.getByText("Parent")).toBeInTheDocument();
  });

  it("shows empty message when no ingredients", () => {
    setup([]);
    expect(screen.getByText("No ingredients match the current filter.")).toBeInTheDocument();
  });
});

describe("IngredientsTable — tree expand/collapse", () => {
  it("hides child rows by default (collapsed)", () => {
    setup();
    expect(screen.queryByText("Butter")).not.toBeInTheDocument();
  });

  it("expands children on toggler click", async () => {
    setup();
    await screen.findByText("Dairy");
    const togglers = screen.getAllByRole("button").filter((b) =>
      b.classList.contains("p-treetable-toggler"),
    );
    await userEvent.click(togglers[0]!);
    expect(screen.getByText("Butter")).toBeInTheDocument();
  });

  it("collapses children on second toggler click", async () => {
    setup();
    await screen.findByText("Dairy");
    const togglers = () =>
      screen.getAllByRole("button").filter((b) => b.classList.contains("p-treetable-toggler"));
    await userEvent.click(togglers()[0]!);
    expect(screen.getByText("Butter")).toBeInTheDocument();
    await userEvent.click(togglers()[0]!);
    expect(screen.queryByText("Butter")).not.toBeInTheDocument();
  });
});

describe("IngredientsTable — text filters", () => {
  it("filters by name", async () => {
    setup();
    await screen.findByText("Flour");
    await userEvent.type(screen.getByLabelText("Filter by name"), "Fl");
    expect(screen.getByText("Flour")).toBeInTheDocument();
    expect(screen.queryByText("Dairy")).not.toBeInTheDocument();
    expect(screen.queryByText("Cheese")).not.toBeInTheDocument();
  });

  it("shows empty state when filter matches nothing", async () => {
    setup();
    await screen.findByText("Flour");
    await userEvent.type(screen.getByLabelText("Filter by name"), "zzz");
    expect(screen.getByText("No ingredients match the current filter.")).toBeInTheDocument();
  });

  it("name filter matches child names and shows parent", async () => {
    setup();
    await screen.findByText("Dairy");
    await userEvent.type(screen.getByLabelText("Filter by name"), "Butter");
    expect(screen.getAllByText("Dairy").length).toBeGreaterThan(0);
    expect(screen.getByText("Butter")).toBeInTheDocument();
    expect(screen.queryByText("Flour")).not.toBeInTheDocument();
    expect(screen.queryByText("Cheese")).not.toBeInTheDocument();
  });

  it("parent column has no separate filter input", () => {
    setup();
    expect(screen.queryByLabelText("Filter by parent")).not.toBeInTheDocument();
  });
});

describe("IngredientsTable — multi-select filter (type)", () => {
  it("filters by measurement type via MultiSelectFilter", async () => {
    setup();
    await screen.findByText("Flour");
    const type_filter_input = screen.getByLabelText("Filter by type");
    await userEvent.click(type_filter_input);
    await userEvent.click(screen.getByRole("checkbox", { name: "weight" }));
    await userEvent.click(screen.getByRole("button", { name: "Accept filter" }));
    expect(screen.getByText("Cheese")).toBeInTheDocument();
    expect(screen.queryByText("Flour")).not.toBeInTheDocument();
  });
});

describe("IngredientsTable — sorting", () => {
  it("sorts by name ascending on first click", async () => {
    setup([FLOUR, CHEESE]);
    await screen.findByText("Flour");
    await userEvent.click(screen.getByText("Name"));
    const rows = screen.getAllByRole("row").slice(1); // skip header row
    expect(rows[0]).toHaveTextContent("Cheese");
    expect(rows[1]).toHaveTextContent("Flour");
  });

  it("sorts by name descending on second click", async () => {
    setup([FLOUR, CHEESE]);
    await screen.findByText("Flour");
    await userEvent.click(screen.getByText("Name"));
    await userEvent.click(screen.getByText("Name"));
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Flour");
    expect(rows[1]).toHaveTextContent("Cheese");
  });
});

describe("IngredientsTable — editable cells", () => {
  it("clicking name cell enters edit mode", async () => {
    setup([FLOUR]);
    await screen.findByRole("button", { name: "Edit name for Flour" });
    await userEvent.click(screen.getByRole("button", { name: "Edit name for Flour" }));
    expect(screen.getByRole("textbox", { name: "Edit name for Flour" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel edit" })).toBeInTheDocument();
  });

  it("confirms name edit on ✔︎ button click", async () => {
    setup([FLOUR]);
    await screen.findByRole("button", { name: "Edit name for Flour" });
    await userEvent.click(screen.getByRole("button", { name: "Edit name for Flour" }));
    const input = screen.getByRole("textbox", { name: "Edit name for Flour" });
    await userEvent.clear(input);
    await userEvent.type(input, "Bread Flour");
    await userEvent.click(screen.getByRole("button", { name: "Confirm edit" }));
    expect(onRename).toHaveBeenCalledWith("flour", "Bread Flour");
  });

  it("confirms name edit on Enter key", async () => {
    setup([FLOUR]);
    await screen.findByRole("button", { name: "Edit name for Flour" });
    await userEvent.click(screen.getByRole("button", { name: "Edit name for Flour" }));
    const input = screen.getByRole("textbox", { name: "Edit name for Flour" });
    await userEvent.clear(input);
    await userEvent.type(input, "Rice Flour{Enter}");
    expect(onRename).toHaveBeenCalledWith("flour", "Rice Flour");
  });

  it("cancels edit on ✗ button click without calling callback", async () => {
    setup([FLOUR]);
    await screen.findByRole("button", { name: "Edit name for Flour" });
    await userEvent.click(screen.getByRole("button", { name: "Edit name for Flour" }));
    const input = screen.getByRole("textbox", { name: "Edit name for Flour" });
    await userEvent.clear(input);
    await userEvent.type(input, "Changed");
    await userEvent.click(screen.getByRole("button", { name: "Cancel edit" }));
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "Edit name for Flour" })).not.toBeInTheDocument();
  });

  it("cancels edit on Escape key", async () => {
    setup([FLOUR]);
    await screen.findByRole("button", { name: "Edit name for Flour" });
    await userEvent.click(screen.getByRole("button", { name: "Edit name for Flour" }));
    const input = screen.getByRole("textbox", { name: "Edit name for Flour" });
    await userEvent.type(input, "{Escape}");
    expect(onRename).not.toHaveBeenCalled();
  });

  it("calls onSetMeasurementValue when committing measurement edit", async () => {
    setup([FLOUR]);
    await screen.findByRole("button", { name: "Edit default measurement for Flour" });
    await userEvent.click(screen.getByRole("button", { name: "Edit default measurement for Flour" }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onSetMeasurementValue).toHaveBeenCalledWith("flour", expect.objectContaining({ unit: "cup" }));
  });

  it("calls onSetLabels when committing labels edit", async () => {
    setup([DAIRY]);
    await screen.findByRole("button", { name: "Edit labels for Dairy" });
    await userEvent.click(screen.getByRole("button", { name: "Edit labels for Dairy" }));
    const input = screen.getByRole("combobox", { name: "Edit labels for Dairy" });
    await userEvent.type(input, "baking");
    await userEvent.click(await screen.findByText(/Create "baking"/));
    await userEvent.click(screen.getByRole("button", { name: "Confirm edit" }));
    expect(onSetLabels).toHaveBeenCalledWith("dairy", ["baking"]);
  });
});

describe("IngredientsTable — row selection", () => {
  it("renders a select-all checkbox provided by PrimeReact", () => {
    setup([FLOUR, CHEESE]);
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it("selecting a row shows the bulk action bar", async () => {
    setup([FLOUR]);
    await screen.findByText("Flour");
    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[checkboxes.length - 1]!);
    expect(screen.getByRole("region", { name: "Bulk actions" })).toBeInTheDocument();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("deselecting all rows hides the bulk action bar", async () => {
    setup([FLOUR]);
    await screen.findByText("Flour");
    const checkboxes = screen.getAllByRole("checkbox");
    const row_checkbox = checkboxes[checkboxes.length - 1]!;
    await userEvent.click(row_checkbox);
    expect(screen.getByRole("region", { name: "Bulk actions" })).toBeInTheDocument();
    await userEvent.click(row_checkbox);
    expect(screen.queryByRole("region", { name: "Bulk actions" })).not.toBeInTheDocument();
  });

  it("Clear button deselects all", async () => {
    setup([FLOUR]);
    await screen.findByText("Flour");
    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[checkboxes.length - 1]!);
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByRole("region", { name: "Bulk actions" })).not.toBeInTheDocument();
  });
});

describe("IngredientsTable — bulk actions", () => {
  async function selectFlour() {
    setup([FLOUR, CHEESE]);
    await screen.findByText("Flour");
    // Find the Flour row and click its checkbox
    const flour_row = screen.getByText("Flour").closest("tr")!;
    await userEvent.click(within(flour_row).getAllByRole("checkbox")[0]!);
  }

  it("calls onAddLabels with selected ids and created labels", async () => {
    await selectFlour();
    await userEvent.type(screen.getByRole("combobox", { name: "Labels to add" }), "organic");
    await userEvent.click(await screen.findByText(/Create "organic"/));
    await userEvent.type(screen.getByRole("combobox", { name: "Labels to add" }), "fresh");
    await userEvent.click(await screen.findByText(/Create "fresh"/));
    await userEvent.click(screen.getByRole("button", { name: "Apply add labels" }));
    expect(onAddLabels).toHaveBeenCalledWith(["flour"], ["organic", "fresh"]);
  });

  it("calls onRemoveLabels with selected ids and created labels", async () => {
    await selectFlour();
    await userEvent.type(screen.getByRole("combobox", { name: "Labels to remove" }), "baking");
    await userEvent.click(await screen.findByText(/Create "baking"/));
    await userEvent.click(screen.getByRole("button", { name: "Apply remove labels" }));
    expect(onRemoveLabels).toHaveBeenCalledWith(["flour"], ["baking"]);
  });

  it("calls onBulkSetMeasurementValue when measurement is committed", async () => {
    await selectFlour();
    await userEvent.click(screen.getByRole("button", { name: "Edit measurement" }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onBulkSetMeasurementValue).toHaveBeenCalledWith(["flour"], expect.objectContaining({ unit: "cup" }));
  });

  it("calls onBulkSetParent when parent is selected and applied", async () => {
    await selectFlour();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Bulk parent" }), "cheese");
    await userEvent.click(screen.getByRole("button", { name: "Apply parent change" }));
    expect(onBulkSetParent).toHaveBeenCalledWith(["flour"], "cheese");
  });

  it("calls onBulkSetParent with undefined when Clear parent is clicked", async () => {
    await selectFlour();
    await userEvent.click(screen.getByRole("button", { name: "Clear parent" }));
    expect(onBulkSetParent).toHaveBeenCalledWith(["flour"], undefined);
  });

  it("Add labels Apply button is disabled when no labels selected", async () => {
    await selectFlour();
    expect(screen.getByRole("button", { name: "Apply add labels" })).toBeDisabled();
  });
});
