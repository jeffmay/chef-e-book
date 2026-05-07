import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ItemLabel, ItemKind } from "@recipe-book/shared";
import { LabelTable } from "../LabelTable.js";

const KIND_INGREDIENT: ReadonlySet<ItemKind> = new Set(["ingredient"]);

const FAT: ItemLabel = {
  id: "fat0000" as ItemLabel.Id,
  name: "fat",
  kinds: KIND_INGREDIENT,
};
const SOLID: ItemLabel = {
  id: "sol0000" as ItemLabel.Id,
  name: "solid",
  kinds: KIND_INGREDIENT,
};
const BAKING: ItemLabel = {
  id: "bak0000" as ItemLabel.Id,
  name: "baking",
  kinds: KIND_INGREDIENT,
};

const on_filter_all = vi.fn();
const on_filter_any = vi.fn();
const on_delete = vi.fn();
const on_merge = vi.fn();
const on_rename = vi.fn();

function setup(labels: ItemLabel[] = [FAT, SOLID, BAKING]) {
  return render(
    <LabelTable
      labels={labels}
      on_filter_all={on_filter_all}
      on_filter_any={on_filter_any}
      on_delete={on_delete}
      on_merge={on_merge}
      on_rename={on_rename}
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
        on_filter_all={on_filter_all}
        on_filter_any={on_filter_any}
        on_delete={on_delete}
        on_merge={on_merge}
        on_rename={on_rename}
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
  async function expand_and_select(labels: ItemLabel[] = [FAT, SOLID]) {
    render(
      <LabelTable
        labels={labels}
        on_filter_all={on_filter_all}
        on_filter_any={on_filter_any}
        on_delete={on_delete}
        on_merge={on_merge}
        on_rename={on_rename}
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

  it("calls on_filter_all with selected ids", async () => {
    await expand_and_select();
    await userEvent.click(screen.getByRole("button", { name: "Filter ingredients with all selected labels" }));
    expect(on_filter_all).toHaveBeenCalledWith([FAT.id]);
  });

  it("calls on_filter_any with selected ids", async () => {
    await expand_and_select();
    await userEvent.click(screen.getByRole("button", { name: "Filter ingredients with any selected labels" }));
    expect(on_filter_any).toHaveBeenCalledWith([FAT.id]);
  });

  it("calls on_delete with selected ids and clears selection", async () => {
    await expand_and_select();
    await userEvent.click(screen.getByRole("button", { name: "Delete selected labels" }));
    expect(on_delete).toHaveBeenCalledWith([FAT.id]);
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

  it("calls on_merge with selected ids and new name on Confirm", async () => {
    await expand_and_select_two();
    await userEvent.click(screen.getByRole("button", { name: "Merge selected labels" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Merged label name" }), "fatty solid");
    await userEvent.click(screen.getByRole("button", { name: "Confirm merge" }));
    expect(on_merge).toHaveBeenCalledWith(
      expect.arrayContaining([FAT.id, SOLID.id]),
      "fatty solid",
    );
  });

  it("hides merge form on Cancel", async () => {
    await expand_and_select_two();
    await userEvent.click(screen.getByRole("button", { name: "Merge selected labels" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel merge" }));
    expect(screen.queryByRole("textbox", { name: "Merged label name" })).not.toBeInTheDocument();
    expect(on_merge).not.toHaveBeenCalled();
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

  it("calls on_rename on Enter", async () => {
    await expand();
    await userEvent.click(screen.getByRole("button", { name: "Rename label fat" }));
    const input = screen.getByRole("textbox", { name: "Edit label name fat" });
    await userEvent.clear(input);
    await userEvent.type(input, "saturated fat{Enter}");
    expect(on_rename).toHaveBeenCalledWith(FAT.id, "saturated fat");
  });

  it("calls on_rename on confirm button click", async () => {
    await expand();
    await userEvent.click(screen.getByRole("button", { name: "Rename label fat" }));
    const input = screen.getByRole("textbox", { name: "Edit label name fat" });
    await userEvent.clear(input);
    await userEvent.type(input, "new name");
    await userEvent.click(screen.getByRole("button", { name: "Confirm rename" }));
    expect(on_rename).toHaveBeenCalledWith(FAT.id, "new name");
  });

  it("cancels rename on Escape key", async () => {
    await expand();
    await userEvent.click(screen.getByRole("button", { name: "Rename label fat" }));
    await userEvent.type(
      screen.getByRole("textbox", { name: "Edit label name fat" }),
      "{Escape}",
    );
    expect(on_rename).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "Edit label name fat" })).not.toBeInTheDocument();
  });

  it("cancels rename on cancel button click", async () => {
    await expand();
    await userEvent.click(screen.getByRole("button", { name: "Rename label fat" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel rename" }));
    expect(on_rename).not.toHaveBeenCalled();
  });
});
