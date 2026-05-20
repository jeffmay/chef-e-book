import { type KitchenwareKind, type KitchenwareLabel, KitchenwareLabelId } from "@recipe-book/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReadonlyDeep } from "type-fest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LabelTable } from "../label_table.js";

const KIND_INGREDIENT: Set<KitchenwareKind> = new Set(["ingredient"]);

const FAT: ReadonlyDeep<KitchenwareLabel> = {
  id: "fat0000" as KitchenwareLabelId,
  name: "fat",
  kinds: KIND_INGREDIENT,
};
const SOLID: ReadonlyDeep<KitchenwareLabel> = {
  id: "sol0000" as KitchenwareLabelId,
  name: "solid",
  kinds: KIND_INGREDIENT,
};
const BAKING: ReadonlyDeep<KitchenwareLabel> = {
  id: "bak0000" as KitchenwareLabelId,
  name: "baking",
  kinds: KIND_INGREDIENT,
};

const onFilterAll = vi.fn();
const onFilterAny = vi.fn();
const onDelete = vi.fn();
const onMerge = vi.fn();
const onRename = vi.fn();

function setup(labels: ReadonlyDeep<KitchenwareLabel[]> = [FAT, SOLID, BAKING]) {
  return render(
    <LabelTable
      labels={labels}
      onFilterAll={onFilterAll}
      onFilterAny={onFilterAny}
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
  it("renders the toggle button", () => {
    setup();
    expect(screen.getByRole("button", { name: /Labels/ })).toBeInTheDocument();
  });

  it("shows the label count on the toggle", () => {
    setup();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("does not show label rows when collapsed", () => {
    setup();
    expect(screen.queryByText("fat")).not.toBeInTheDocument();
  });
});

describe("LabelTable — expanded state", () => {
  async function expand() {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /Labels/ }));
  }

  it("shows label names after expanding", async () => {
    await expand();
    expect(screen.getByText("fat")).toBeInTheDocument();
    expect(screen.getByText("solid")).toBeInTheDocument();
    expect(screen.getByText("baking")).toBeInTheDocument();
  });

  it("shows empty message when no labels", async () => {
    render(
      <LabelTable
        labels={[]}
        onFilterAll={onFilterAll}
        onFilterAny={onFilterAny}
        onDelete={onDelete}
        onMerge={onMerge}
        onRename={onRename}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Labels/ }));
    expect(screen.getByText("No labels yet.")).toBeInTheDocument();
  });

  it("renders per-row checkboxes", async () => {
    await expand();
    expect(screen.getByRole("checkbox", { name: "Select label fat" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select label solid" })).toBeInTheDocument();
  });

  it("renders a select-all checkbox in the header", async () => {
    await expand();
    expect(screen.getByRole("checkbox", { name: "Select all labels" })).toBeInTheDocument();
  });
});

describe("LabelTable — selection and bulk actions", () => {
  async function expand_and_select(labels: ReadonlyDeep<KitchenwareLabel[]> = [FAT, SOLID]) {
    render(
      <LabelTable
        labels={labels}
        onFilterAll={onFilterAll}
        onFilterAny={onFilterAny}
        onDelete={onDelete}
        onMerge={onMerge}
        onRename={onRename}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Labels/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select label fat" }));
  }

  it("shows bulk action bar after selecting a label", async () => {
    await expand_and_select();
    expect(screen.getByRole("region", { name: "Label bulk actions" })).toBeInTheDocument();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("hides bulk bar after deselecting", async () => {
    await expand_and_select();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select label fat" }));
    expect(screen.queryByRole("region", { name: "Label bulk actions" })).not.toBeInTheDocument();
  });

  it("calls onFilterAll with selected ids when All radio is clicked", async () => {
    await expand_and_select();
    await userEvent.click(screen.getByRole("radio", { name: "All" }));
    expect(onFilterAll).toHaveBeenCalledWith([FAT.id]);
  });

  it("calls onFilterAny with selected ids when Any radio is clicked", async () => {
    await expand_and_select();
    await userEvent.click(screen.getByRole("radio", { name: "Any" }));
    expect(onFilterAny).toHaveBeenCalledWith([FAT.id]);
  });

  it("keeps All radio selected after clicking it", async () => {
    await expand_and_select();
    await userEvent.click(screen.getByRole("radio", { name: "All" }));
    expect(screen.getByRole("radio", { name: "All" })).toBeChecked();
  });

  it("calls onDelete with selected ids and clears selection", async () => {
    await expand_and_select();
    await userEvent.click(screen.getByRole("button", { name: "Delete selected labels" }));
    expect(onDelete).toHaveBeenCalledWith([FAT.id]);
    expect(screen.queryByRole("region", { name: "Label bulk actions" })).not.toBeInTheDocument();
  });

  it("Clear button deselects all", async () => {
    await expand_and_select();
    await userEvent.click(screen.getByRole("button", { name: /Clear/ }));
    expect(screen.queryByRole("region", { name: "Label bulk actions" })).not.toBeInTheDocument();
  });

  it("select-all selects all labels", async () => {
    await expand_and_select([FAT, SOLID]);
    await userEvent.click(screen.getByRole("checkbox", { name: "Select all labels" }));
    expect(screen.getByText("2 selected")).toBeInTheDocument();
  });
});

describe("LabelTable — merge action", () => {
  async function expand_and_select_two() {
    setup([FAT, SOLID, BAKING]);
    await userEvent.click(screen.getByRole("button", { name: /Labels/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select label fat" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select label solid" }));
  }

  it("shows Merge button when 2+ labels selected", async () => {
    await expand_and_select_two();
    expect(screen.getByRole("button", { name: "Merge selected labels" })).toBeInTheDocument();
  });

  it("shows name input after clicking Merge", async () => {
    await expand_and_select_two();
    await userEvent.click(screen.getByRole("button", { name: "Merge selected labels" }));
    expect(screen.getByRole("textbox", { name: "Merged label name" })).toBeInTheDocument();
  });

  it("calls onMerge with selected ids and new name on Confirm", async () => {
    await expand_and_select_two();
    await userEvent.click(screen.getByRole("button", { name: "Merge selected labels" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Merged label name" }), "fatty solid");
    await userEvent.click(screen.getByRole("button", { name: "Confirm merge" }));
    expect(onMerge).toHaveBeenCalledWith(
      expect.arrayContaining([FAT.id, SOLID.id]),
      "fatty solid",
    );
  });

  it("hides merge form on Cancel", async () => {
    await expand_and_select_two();
    await userEvent.click(screen.getByRole("button", { name: "Merge selected labels" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel merge" }));
    expect(screen.queryByRole("textbox", { name: "Merged label name" })).not.toBeInTheDocument();
    expect(onMerge).not.toHaveBeenCalled();
  });

  it("hides merge form on Escape key", async () => {
    await expand_and_select_two();
    await userEvent.click(screen.getByRole("button", { name: "Merge selected labels" }));
    await userEvent.type(
      screen.getByRole("textbox", { name: "Merged label name" }),
      "{Escape}",
    );
    expect(screen.queryByRole("textbox", { name: "Merged label name" })).not.toBeInTheDocument();
  });
});

describe("LabelTable — inline rename", () => {
  async function expand() {
    setup([FAT, SOLID]);
    await userEvent.click(screen.getByRole("button", { name: /Labels/ }));
  }

  it("clicking label name shows rename input", async () => {
    await expand();
    await userEvent.click(screen.getByRole("button", { name: "Rename label fat" }));
    expect(screen.getByRole("textbox", { name: "Edit label name fat" })).toBeInTheDocument();
  });

  it("calls onRename on Enter", async () => {
    await expand();
    await userEvent.click(screen.getByRole("button", { name: "Rename label fat" }));
    const input = screen.getByRole("textbox", { name: "Edit label name fat" });
    await userEvent.clear(input);
    await userEvent.type(input, "saturated fat{Enter}");
    expect(onRename).toHaveBeenCalledWith(FAT.id, "saturated fat");
  });

  it("calls onRename on confirm button click", async () => {
    await expand();
    await userEvent.click(screen.getByRole("button", { name: "Rename label fat" }));
    const input = screen.getByRole("textbox", { name: "Edit label name fat" });
    await userEvent.clear(input);
    await userEvent.type(input, "new name");
    await userEvent.click(screen.getByRole("button", { name: "Confirm rename" }));
    expect(onRename).toHaveBeenCalledWith(FAT.id, "new name");
  });

  it("cancels rename on Escape key", async () => {
    await expand();
    await userEvent.click(screen.getByRole("button", { name: "Rename label fat" }));
    await userEvent.type(
      screen.getByRole("textbox", { name: "Edit label name fat" }),
      "{Escape}",
    );
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "Edit label name fat" })).not.toBeInTheDocument();
  });

  it("cancels rename on cancel button click", async () => {
    await expand();
    await userEvent.click(screen.getByRole("button", { name: "Rename label fat" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel rename" }));
    expect(onRename).not.toHaveBeenCalled();
  });
});
