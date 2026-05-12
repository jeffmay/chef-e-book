import type { Ingredient, IngredientId, KitchenwareLabelId } from "@recipe-book/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IngredientsTable } from "../IngredientsTable.js";

const DAIRY: Ingredient = {
  kind: "ingredient",
  id: "dairy" as IngredientId,
  name: "Dairy",
  default_measurement_type: "volume",
  labels: new Set<KitchenwareLabelId>(),
};
const BUTTER: Ingredient = {
  kind: "ingredient",
  id: "butter" as IngredientId,
  name: "Butter",
  default_measurement_type: "volume",
  labels: new Set(["fat0000" as KitchenwareLabelId, "sol0000" as KitchenwareLabelId]),
  parent_id: "dairy" as IngredientId,
};
const FLOUR: Ingredient = {
  kind: "ingredient",
  id: "flour" as IngredientId,
  name: "Flour",
  default_measurement_type: "volume",
  labels: new Set(["bak0000" as KitchenwareLabelId]),
};
const CHEESE: Ingredient = {
  kind: "ingredient",
  id: "cheese" as IngredientId,
  name: "Cheese",
  default_measurement_type: "weight",
  labels: new Set(["sol0000" as KitchenwareLabelId]),
};

const onRename = vi.fn();
const onSetType = vi.fn();
const onSetLabels = vi.fn();
const onSetParent = vi.fn();
const onAddLabels = vi.fn();
const onRemoveLabels = vi.fn();
const onBulkSetType = vi.fn();
const onBulkSetParent = vi.fn();

function setup(ingredients: Ingredient[] = [DAIRY, BUTTER, FLOUR, CHEESE]) {
  return render(
    <IngredientsTable
      ingredients={ingredients}
      labels={[]}
      onRename={onRename}
      onSetType={onSetType}
      onSetLabels={onSetLabels}
      onSetParent={onSetParent}
      onAddLabels={onAddLabels}
      onRemoveLabels={onRemoveLabels}
      onBulkSetType={onBulkSetType}
      onBulkSetParent={onBulkSetParent}
    />,
  );
}

function getTable() {
  return screen.getByRole("region", { name: "Ingredient list" });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("IngredientsTable — rendering", () => {
  it("renders the ingredient list region", () => {
    setup();
    expect(getTable()).toBeInTheDocument();
  });

  it("renders root-level ingredients", async () => {
    setup();
    expect(await screen.findByText("Dairy")).toBeInTheDocument();
    expect(await screen.findByText("Flour")).toBeInTheDocument();
    expect(await screen.findByText("Cheese")).toBeInTheDocument();
  });

  it("renders column headers", () => {
    setup();
    expect(screen.getByRole("button", { name: "Sort by name" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sort by default_measurement_type" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort by parent_name" })).toBeInTheDocument();
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

  it("shows expand button on rows with children", async () => {
    setup();
    await screen.findByText("Dairy");
    const dairy_row = screen.getByText("Dairy").closest("tr")!;
    expect(within(dairy_row).getByRole("button", { name: /Expand Dairy/ })).toBeInTheDocument();
  });

  it("expands children on expand button click", async () => {
    setup();
    await screen.findByText("Dairy");
    await userEvent.click(screen.getByRole("button", { name: /Expand Dairy/ }));
    expect(screen.getByText("Butter")).toBeInTheDocument();
  });

  it("collapses children on second click", async () => {
    setup();
    await screen.findByText("Dairy");
    await userEvent.click(screen.getByRole("button", { name: /Expand Dairy/ }));
    expect(screen.getByText("Butter")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Collapse Dairy/ }));
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
    // Dairy should appear because it has a child named Butter.
    // "Dairy" text also appears in Butter's Parent column, so use getAllByText.
    expect(screen.getAllByText("Dairy").length).toBeGreaterThan(0);
    // Butter should be visible (auto-expanded)
    expect(screen.getByText("Butter")).toBeInTheDocument();
    // Unrelated rows should be hidden
    expect(screen.queryByText("Flour")).not.toBeInTheDocument();
    expect(screen.queryByText("Cheese")).not.toBeInTheDocument();
  });

  it("parent column has no filter input", () => {
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
    setup([FLOUR, CHEESE]); // No parent-child, all root rows
    await screen.findByText("Flour");
    await userEvent.click(screen.getByRole("button", { name: "Sort by name" }));
    const rows = screen.getAllByRole("row").slice(1); // skip header row
    expect(rows[0]).toHaveTextContent("Cheese");
    expect(rows[1]).toHaveTextContent("Flour");
  });

  it("sorts by name descending on second click", async () => {
    setup([FLOUR, CHEESE]);
    await screen.findByText("Flour");
    await userEvent.click(screen.getByRole("button", { name: "Sort by name" }));
    await userEvent.click(screen.getByRole("button", { name: "Sort by name" }));
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

  it("calls onSetType when committing type edit", async () => {
    setup([FLOUR]);
    await screen.findByRole("button", { name: "Edit type for Flour" });
    await userEvent.click(screen.getByRole("button", { name: "Edit type for Flour" }));
    const select = screen.getByRole("combobox", { name: "Edit type for Flour" });
    await userEvent.selectOptions(select, "weight");
    await userEvent.click(screen.getByRole("button", { name: "Confirm edit" }));
    expect(onSetType).toHaveBeenCalledWith("flour", "weight");
  });

  it("calls onSetLabels when committing labels edit", async () => {
    setup([DAIRY]);
    await screen.findByRole("button", { name: "Edit labels for Dairy" });
    await userEvent.click(screen.getByRole("button", { name: "Edit labels for Dairy" }));
    // LabelEditor opens — type and create a new label, then commit
    const input = screen.getByRole("combobox", { name: "Edit labels for Dairy" });
    await userEvent.type(input, "baking");
    await userEvent.click(await screen.findByText(/Create "baking"/));
    await userEvent.click(screen.getByRole("button", { name: "Confirm edit" }));
    expect(onSetLabels).toHaveBeenCalledWith("dairy", ["baking"]);
  });
});


describe("IngredientsTable — row selection", () => {
  it("renders a select-all checkbox in the header", () => {
    setup([FLOUR, CHEESE]);
    expect(screen.getByRole("checkbox", { name: "Select all ingredients" })).toBeInTheDocument();
  });

  it("renders per-row checkboxes", async () => {
    setup([FLOUR, CHEESE]);
    await screen.findByText("Flour");
    expect(screen.getByRole("checkbox", { name: "Select Flour" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select Cheese" })).toBeInTheDocument();
  });

  it("selecting a row shows the bulk action bar", async () => {
    setup([FLOUR]);
    await screen.findByText("Flour");
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Flour" }));
    expect(screen.getByRole("region", { name: "Bulk actions" })).toBeInTheDocument();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("deselecting all rows hides the bulk action bar", async () => {
    setup([FLOUR]);
    await screen.findByText("Flour");
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Flour" }));
    expect(screen.getByRole("region", { name: "Bulk actions" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Flour" }));
    expect(screen.queryByRole("region", { name: "Bulk actions" })).not.toBeInTheDocument();
  });

  it("select-all selects all visible rows", async () => {
    setup([FLOUR, CHEESE]);
    await screen.findByText("Flour");
    await userEvent.click(screen.getByRole("checkbox", { name: "Select all ingredients" }));
    expect(screen.getByText("2 selected")).toBeInTheDocument();
  });

  it("select-all deselects when all are already selected", async () => {
    setup([FLOUR, CHEESE]);
    await screen.findByText("Flour");
    await userEvent.click(screen.getByRole("checkbox", { name: "Select all ingredients" }));
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select all ingredients" }));
    expect(screen.queryByRole("region", { name: "Bulk actions" })).not.toBeInTheDocument();
  });

  it("Clear button deselects all", async () => {
    setup([FLOUR, CHEESE]);
    await screen.findByText("Flour");
    await userEvent.click(screen.getByRole("checkbox", { name: "Select all ingredients" }));
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByRole("region", { name: "Bulk actions" })).not.toBeInTheDocument();
  });
});

describe("IngredientsTable — bulk actions", () => {
  async function selectFlour() {
    setup([FLOUR, CHEESE]);
    await screen.findByText("Flour");
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Flour" }));
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

  it("calls onBulkSetType when type is selected and applied", async () => {
    await selectFlour();
    await userEvent.selectOptions(screen.getByLabelText("Bulk measurement type"), "weight");
    await userEvent.click(screen.getByRole("button", { name: "Apply type change" }));
    expect(onBulkSetType).toHaveBeenCalledWith(["flour"], "weight");
  });

  it("calls onBulkSetParent when parent is selected and applied", async () => {
    await selectFlour();
    await userEvent.selectOptions(screen.getByLabelText("Bulk parent"), "Cheese");
    await userEvent.click(screen.getByRole("button", { name: "Apply parent change" }));
    expect(onBulkSetParent).toHaveBeenCalledWith(["flour"], "cheese");
  });

  it("calls onBulkSetParent with undefined when Clear parent is selected", async () => {
    await selectFlour();
    await userEvent.selectOptions(screen.getByLabelText("Bulk parent"), "Clear parent");
    await userEvent.click(screen.getByRole("button", { name: "Apply parent change" }));
    expect(onBulkSetParent).toHaveBeenCalledWith(["flour"], undefined);
  });

  it("Add labels Apply button is disabled when no labels selected", async () => {
    await selectFlour();
    expect(screen.getByRole("button", { name: "Apply add labels" })).toBeDisabled();
  });

  it("Change type Apply button is disabled when no type selected", async () => {
    await selectFlour();
    expect(screen.getByRole("button", { name: "Apply type change" })).toBeDisabled();
  });
});
