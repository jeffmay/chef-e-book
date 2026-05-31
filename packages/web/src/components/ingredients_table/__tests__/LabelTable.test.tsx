import type { Ingredient, KitchenwareKind, KitchenwareLabel } from "@recipe-book/shared";
import { IngredientId, KitchenwareLabelId, paddedId } from "@recipe-book/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReadonlyDeep } from "type-fest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LabelTableProps } from "../LabelTable.tsx";
import { LabelTable } from "../LabelTable.tsx";

const KIND_INGREDIENT: Set<KitchenwareKind> = new Set(["ingredient"]);

const FAT = {
  id: paddedId(KitchenwareLabelId, "fat"),
  name: "fat",
  kinds: KIND_INGREDIENT,
} as const satisfies KitchenwareLabel;

const SOLID = {
  id: paddedId(KitchenwareLabelId, "solid"),
  name: "solid",
  kinds: KIND_INGREDIENT,
} as const satisfies KitchenwareLabel;

const BAKING = {
  id: paddedId(KitchenwareLabelId, "baking"),
  name: "baking",
  kinds: KIND_INGREDIENT,
} as const satisfies KitchenwareLabel;

const DEFAULT_MEASUREMENT = { value: { numerator: 1, denominator: 1 }, unit: "cup" } as const;

const BUTTER = {
  kind: "ingredient",
  id: paddedId(IngredientId, "butter"),
  name: "Butter",
  default_measurement_value: DEFAULT_MEASUREMENT,
  labels: new Set([paddedId(KitchenwareLabelId, "fat")]),
} as const satisfies Ingredient;

const FLOUR = {
  kind: "ingredient",
  id: paddedId(IngredientId, "flour"),
  name: "Flour",
  default_measurement_value: DEFAULT_MEASUREMENT,
  labels: new Set([paddedId(KitchenwareLabelId, "solid")]),
} as const satisfies Ingredient;

const onFilterAllFn = vi.fn();
const onFilterAnyFn = vi.fn();
const onDeleteFn = vi.fn();
const onMergeFn = vi.fn();
const onRenameFn = vi.fn();

function setup({
  labels = [FAT, SOLID, BAKING],
  ingredients = [],
  onFilterAll = onFilterAllFn,
  onFilterAny = onFilterAnyFn,
  onClearFilters,
  onDelete = onDeleteFn,
  onMerge = onMergeFn,
  onRename = onRenameFn,
}: Partial<LabelTableProps> = {}) {
  return render(
    <LabelTable
      labels={labels}
      ingredients={ingredients}
      onFilterAll={onFilterAll}
      onFilterAny={onFilterAny}
      {...(onClearFilters ? { onClearFilters } : [])}
      onDelete={onDelete}
      onMerge={onMerge}
      onRename={onRename}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LabelTable — collapsed state", () => {
  const labels = [FAT, SOLID, BAKING] as const;

  it("renders the toggle button", () => {
    setup({ labels });
    expect(screen.getByRole("button", { name: /Labels/ })).toBeInTheDocument();
  });

  it("shows the label count on the toggle", () => {
    setup({ labels });
    expect(screen.getByText(`${labels.length}`)).toBeInTheDocument();
  });

  it("does not show label rows when collapsed", () => {
    setup({ labels });
    expect(screen.queryByText(labels[0].name)).not.toBeInTheDocument();
  });
});

describe("LabelTable — expanded state", () => {
  const defaultLabels = [FAT, SOLID, BAKING] as const;

  async function expand(labels: ReadonlyDeep<KitchenwareLabel[]>) {
    setup({ labels });
    await userEvent.click(screen.getByRole("button", { name: /Labels/ }));
  }

  it("shows label names after expanding", async () => {
    await expand(defaultLabels);
    expect(screen.getByText("fat")).toBeInTheDocument();
    expect(screen.getByText("solid")).toBeInTheDocument();
    expect(screen.getByText("baking")).toBeInTheDocument();
  });

  it("shows empty message when no labels", async () => {
    await expand([]);
    expect(screen.getByText("No labels yet.")).toBeInTheDocument();
  });

  it("renders per-row checkboxes", async () => {
    await expand(defaultLabels);
    expect(screen.getByRole("checkbox", { name: "Select label fat" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select label solid" })).toBeInTheDocument();
  });

  it("renders a select-all checkbox in the header", async () => {
    await expand(defaultLabels);
    expect(screen.getByRole("checkbox", { name: "Select all labels" })).toBeInTheDocument();
  });
});

describe("LabelTable — selection and bulk actions", () => {
  const defaultProps = { labels: [FAT, SOLID] } as const;

  async function expand_and_select(
    props: Partial<LabelTableProps>,
    select: ReadonlyDeep<KitchenwareLabel>,
  ) {
    setup(props);
    await userEvent.click(screen.getByRole("button", { name: /Labels/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: `Select label ${select.name}` }));
  }

  it("shows bulk action bar after selecting a label", async () => {
    await expand_and_select(defaultProps, FAT);
    expect(screen.getByRole("region", { name: "Label bulk actions" })).toBeInTheDocument();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("hides bulk bar after deselecting", async () => {
    await expand_and_select(defaultProps, FAT);
    await userEvent.click(screen.getByRole("checkbox", { name: "Select label fat" }));
    expect(screen.queryByRole("region", { name: "Label bulk actions" })).not.toBeInTheDocument();
  });

  it("calls onFilterAll with selected ids when All radio is clicked", async () => {
    await expand_and_select(defaultProps, FAT);
    await userEvent.click(screen.getByRole("radio", { name: "All" }));
    expect(onFilterAllFn).toHaveBeenCalledWith([FAT.id]);
  });

  it("calls onFilterAny with selected ids when Any radio is clicked", async () => {
    await expand_and_select(defaultProps, FAT);
    await userEvent.click(screen.getByRole("radio", { name: "Any" }));
    expect(onFilterAnyFn).toHaveBeenCalledWith([FAT.id]);
  });

  it("keeps All radio selected after clicking it", async () => {
    await expand_and_select(defaultProps, FAT);
    await userEvent.click(screen.getByRole("radio", { name: "All" }));
    expect(screen.getByRole("radio", { name: "All" })).toBeChecked();
  });

  it("calls onDelete with selected ids and clears selection", async () => {
    await expand_and_select(defaultProps, FAT);
    await userEvent.click(screen.getByRole("button", { name: "Delete selected labels" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(onDeleteFn).toHaveBeenCalledWith([FAT.id]);
    expect(screen.queryByRole("region", { name: "Label bulk actions" })).not.toBeInTheDocument();
  });

  it("Clear button deselects all", async () => {
    await expand_and_select(defaultProps, FAT);
    await userEvent.click(screen.getByRole("button", { name: /Clear/ }));
    expect(screen.queryByRole("region", { name: "Label bulk actions" })).not.toBeInTheDocument();
  });

  it("Clear button calls onClearFilters to clear any ingredient filters", async () => {
    const onClearFiltersFn = vi.fn();
    await expand_and_select({ ...defaultProps, onClearFilters: onClearFiltersFn }, FAT);
    await userEvent.click(screen.getByRole("radio", { name: "Any" }));
    vi.clearAllMocks();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select label fat" }));
    expect(onClearFiltersFn).toHaveBeenCalled();
  });

  it("Clear button calls onFilterAll([]) to clear any ingredient filters if onClearFilters is not provided", async () => {
    await expand_and_select(defaultProps, FAT);
    await userEvent.click(screen.getByRole("radio", { name: "Any" }));
    vi.clearAllMocks();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select label fat" }));
    expect(onFilterAllFn).toHaveBeenCalledWith([]);
  });

  it("deselecting the last label via its checkbox clears the ingredient filter", async () => {
    await expand_and_select(defaultProps, FAT);
    await userEvent.click(screen.getByRole("radio", { name: "Any" }));
    vi.clearAllMocks();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select label fat" }));
    expect(onFilterAllFn).toHaveBeenCalledWith([]);
  });

  it("deselect-all via header checkbox clears the ingredient filter", async () => {
    await expand_and_select(defaultProps, FAT);
    await userEvent.click(screen.getByRole("checkbox", { name: "Select all labels" }));
    await userEvent.click(screen.getByRole("radio", { name: "All" }));
    vi.clearAllMocks();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select all labels" }));
    expect(onFilterAllFn).toHaveBeenCalledWith([]);
  });

  it("select-all selects all labels", async () => {
    await expand_and_select(defaultProps, FAT);
    await userEvent.click(screen.getByRole("checkbox", { name: "Select all labels" }));
    expect(screen.getByText("2 selected")).toBeInTheDocument();
  });
});

describe("LabelTable — merge action", () => {
  const defaultLabels = [FAT, SOLID, BAKING] as const;

  async function expand_and_select_two(
    labels: ReadonlyDeep<KitchenwareLabel[]>,
    select: ReadonlyDeep<[KitchenwareLabel, KitchenwareLabel]>,
  ) {
    setup({ labels });
    await userEvent.click(screen.getByRole("button", { name: /Labels/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: `Select label ${select[0].name}` }));
    await userEvent.click(screen.getByRole("checkbox", { name: `Select label ${select[1].name}` }));
  }

  it("shows Merge button when 2+ labels selected", async () => {
    await expand_and_select_two(defaultLabels, [FAT, SOLID]);
    expect(screen.getByRole("button", { name: "Merge selected labels" })).toBeInTheDocument();
  });

  it("shows name input after clicking Merge", async () => {
    await expand_and_select_two(defaultLabels, [FAT, SOLID]);
    await userEvent.click(screen.getByRole("button", { name: "Merge selected labels" }));
    expect(screen.getByRole("textbox", { name: "Merged label name" })).toBeInTheDocument();
  });

  it("calls onMerge with selected ids and new name on Confirm", async () => {
    await expand_and_select_two(defaultLabels, [FAT, SOLID]);
    await userEvent.click(screen.getByRole("button", { name: "Merge selected labels" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Merged label name" }), "fatty solid");
    await userEvent.click(screen.getByRole("button", { name: "Confirm merge" }));
    expect(onMergeFn).toHaveBeenCalledWith(
      expect.arrayContaining([FAT.id, SOLID.id]),
      "fatty solid",
    );
  });

  it("hides merge form on Cancel", async () => {
    await expand_and_select_two(defaultLabels, [FAT, SOLID]);
    await userEvent.click(screen.getByRole("button", { name: "Merge selected labels" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel merge" }));
    expect(screen.queryByRole("textbox", { name: "Merged label name" })).not.toBeInTheDocument();
    expect(onMergeFn).not.toHaveBeenCalled();
  });

  it("hides merge form on Escape key", async () => {
    await expand_and_select_two(defaultLabels, [FAT, SOLID]);
    await userEvent.click(screen.getByRole("button", { name: "Merge selected labels" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Merged label name" }), "{Escape}");
    expect(screen.queryByRole("textbox", { name: "Merged label name" })).not.toBeInTheDocument();
  });
});

describe("LabelTable — delete confirmation dialog", () => {
  async function openDeleteDialog(ingredients: ReadonlyDeep<Ingredient[]>): Promise<void> {
    setup({ ingredients });
    await userEvent.click(screen.getByRole("button", { name: /Labels/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select label fat" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete selected labels" }));
  }

  it("opens the confirmation dialog on Delete click", async () => {
    await openDeleteDialog([]);
    expect(screen.getByRole("dialog", { name: "Confirm delete labels" })).toBeInTheDocument();
  });

  it("shows affected ingredient names when labels are in use", async () => {
    await openDeleteDialog([BUTTER, FLOUR]);
    expect(screen.getByText("Butter")).toBeInTheDocument();
    expect(screen.queryByText("Flour")).not.toBeInTheDocument();
  });

  it("shows no-ingredients message when labels are unused", async () => {
    await openDeleteDialog([]);
    expect(screen.getByText("No ingredients use these labels.")).toBeInTheDocument();
  });

  it("closes dialog without deleting on Cancel click", async () => {
    await openDeleteDialog([]);
    await userEvent.click(screen.getByRole("button", { name: "Cancel delete" }));
    expect(screen.queryByRole("dialog", { name: "Confirm delete labels" })).not.toBeInTheDocument();
    expect(onDeleteFn).not.toHaveBeenCalled();
  });

  it("closes dialog without deleting on Escape key", async () => {
    await openDeleteDialog([]);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Confirm delete labels" })).not.toBeInTheDocument();
    expect(onDeleteFn).not.toHaveBeenCalled();
  });

  it("closes dialog without deleting when clicking the overlay background", async () => {
    await openDeleteDialog([]);
    // fireEvent fires directly on the overlay element (bypasses position-based dispatch),
    // exercising the overlay's own onClick={handleDeleteCancel} handler.
    fireEvent.click(screen.getByRole("dialog", { name: "Confirm delete labels" }));
    expect(screen.queryByRole("dialog", { name: "Confirm delete labels" })).not.toBeInTheDocument();
    expect(onDeleteFn).not.toHaveBeenCalled();
  });

  it("does not close the dialog when clicking inside the dialog card", async () => {
    await openDeleteDialog([]);
    await userEvent.click(screen.getByTestId("lt-delete-dialog-card"));
    expect(screen.getByRole("dialog", { name: "Confirm delete labels" })).toBeInTheDocument();
  });

  it("restores focus to the Delete button after Cancel", async () => {
    await openDeleteDialog([]);
    await userEvent.click(screen.getByRole("button", { name: "Cancel delete" }));
    expect(screen.getByRole("button", { name: "Delete selected labels" })).toHaveFocus();
  });

  it("restores focus to the Delete button after Escape key", async () => {
    await openDeleteDialog([]);
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Delete selected labels" })).toHaveFocus();
  });

  it("calls onDelete and closes dialog on Confirm click", async () => {
    await openDeleteDialog([]);
    await userEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(onDeleteFn).toHaveBeenCalledWith([FAT.id]);
    expect(screen.queryByRole("dialog", { name: "Confirm delete labels" })).not.toBeInTheDocument();
  });
});

describe("LabelTable — inline rename", () => {
  const defaultLabels = [FAT, SOLID] as const;

  async function expand(labels: ReadonlyDeep<KitchenwareLabel[]>) {
    setup({ labels });
    await userEvent.click(screen.getByRole("button", { name: /Labels/ }));
  }

  it("single click on label name selects the label (does not open rename)", async () => {
    await expand(defaultLabels);
    await userEvent.click(screen.getByRole("button", { name: "Rename label fat" }));
    expect(screen.queryByRole("textbox", { name: "Edit label name fat" })).not.toBeInTheDocument();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("double-clicking label name shows rename input", async () => {
    await expand(defaultLabels);
    await userEvent.dblClick(screen.getByRole("button", { name: "Rename label fat" }));
    expect(screen.getByRole("textbox", { name: "Edit label name fat" })).toBeInTheDocument();
  });

  it("calls onRename on Enter", async () => {
    await expand(defaultLabels);
    await userEvent.dblClick(screen.getByRole("button", { name: "Rename label fat" }));
    const input = screen.getByRole("textbox", { name: "Edit label name fat" });
    await userEvent.clear(input);
    await userEvent.type(input, "saturated fat{Enter}");
    expect(onRenameFn).toHaveBeenCalledWith(FAT.id, "saturated fat");
  });

  it("calls onRename on confirm button click", async () => {
    await expand(defaultLabels);
    await userEvent.dblClick(screen.getByRole("button", { name: "Rename label fat" }));
    const input = screen.getByRole("textbox", { name: "Edit label name fat" });
    await userEvent.clear(input);
    await userEvent.type(input, "new name");
    await userEvent.click(screen.getByRole("button", { name: "Confirm rename" }));
    expect(onRenameFn).toHaveBeenCalledWith(FAT.id, "new name");
  });

  it("cancels rename on Escape key", async () => {
    await expand(defaultLabels);
    await userEvent.dblClick(screen.getByRole("button", { name: "Rename label fat" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Edit label name fat" }), "{Escape}");
    expect(onRenameFn).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "Edit label name fat" })).not.toBeInTheDocument();
  });

  it("cancels rename on cancel button click", async () => {
    await expand(defaultLabels);
    await userEvent.dblClick(screen.getByRole("button", { name: "Rename label fat" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel rename" }));
    expect(onRenameFn).not.toHaveBeenCalled();
  });

  it("Enter key on label name toggles selection", async () => {
    await expand(defaultLabels);
    const nameBtn = screen.getByRole("button", { name: "Rename label fat" });
    nameBtn.focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("Space key on label name toggles selection", async () => {
    await expand(defaultLabels);
    const nameBtn = screen.getByRole("button", { name: "Rename label fat" });
    nameBtn.focus();
    await userEvent.keyboard(" ");
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("F2 key on label name opens rename input", async () => {
    await expand(defaultLabels);
    const nameBtn = screen.getByRole("button", { name: "Rename label fat" });
    nameBtn.focus();
    await userEvent.keyboard("{F2}");
    expect(screen.getByRole("textbox", { name: "Edit label name fat" })).toBeInTheDocument();
  });

  it("clicking the checkbox does not double-toggle selection", async () => {
    await expand(defaultLabels);
    await userEvent.click(screen.getByRole("checkbox", { name: "Select label fat" }));
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("clicking a button inside the row (Cancel rename) does not toggle selection", async () => {
    await expand(defaultLabels);
    await userEvent.click(screen.getByRole("button", { name: "Rename label fat" }));
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    await userEvent.dblClick(screen.getByRole("button", { name: "Rename label fat" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel rename" }));
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });
});
