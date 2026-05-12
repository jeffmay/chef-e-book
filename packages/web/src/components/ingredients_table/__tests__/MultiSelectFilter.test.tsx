import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MultiSelectFilter } from "../MultiSelectFilter.js";

const OPTIONS = ["dairy", "fat", "solid", "liquid"];

function setup(initial: string[] = []) {
  const onChange = vi.fn();
  function Wrapper() {
    const [value, setValue] = useState<string[]>(initial);
    return (
      <MultiSelectFilter
        allOptions={OPTIONS}
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange(v);
        }}
        ariaLabel="Filter by labels"
      />
    );
  }
  render(<Wrapper />);
  return { onChange };
}

describe("MultiSelectFilter — closed state", () => {
  it("shows placeholder when nothing selected", () => {
    setup();
    expect(screen.getByPlaceholderText("Filter…")).toBeInTheDocument();
  });

  it("shows selected option name when one item selected", () => {
    setup(["dairy"]);
    const input = screen.getByRole("textbox", { name: "Filter by labels" });
    expect((input as HTMLInputElement).value).toBe("dairy");
  });

  it("shows count when multiple selected", () => {
    setup(["dairy", "fat"]);
    const input = screen.getByRole("textbox", { name: "Filter by labels" });
    expect((input as HTMLInputElement).value).toBe("2 selected");
  });

  it("shows clear button when items are selected", () => {
    setup(["dairy"]);
    expect(screen.getByLabelText("Clear Filter by labels")).toBeInTheDocument();
  });

  it("does not show clear button when nothing selected", () => {
    setup();
    expect(screen.queryByLabelText("Clear Filter by labels")).not.toBeInTheDocument();
  });
});

describe("MultiSelectFilter — opening the dropdown", () => {
  it("opens dropdown on click", async () => {
    setup();
    await userEvent.click(screen.getByRole("textbox", { name: "Filter by labels" }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(OPTIONS.length);
  });

  it("pre-checks already-selected options on open", async () => {
    setup(["dairy", "fat"]);
    await userEvent.click(screen.getByRole("textbox", { name: "Filter by labels" }));
    const dropdown = screen.getByRole("listbox");
    const dairy_cb = within(dropdown).getByRole("checkbox", { name: "dairy" });
    const fat_cb = within(dropdown).getByRole("checkbox", { name: "fat" });
    const solid_cb = within(dropdown).getByRole("checkbox", { name: "solid" });
    expect(dairy_cb).toBeChecked();
    expect(fat_cb).toBeChecked();
    expect(solid_cb).not.toBeChecked();
  });
});

describe("MultiSelectFilter — toggling options", () => {
  it("checking an option calls onChange immediately", async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole("textbox", { name: "Filter by labels" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "fat" }));
    expect(onChange).toHaveBeenCalledWith(["fat"]);
  });

  it("unchecking an option calls onChange with item removed", async () => {
    const { onChange } = setup(["fat"]);
    await userEvent.click(screen.getByRole("textbox", { name: "Filter by labels" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "fat" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

describe("MultiSelectFilter — search within dropdown", () => {
  it("filters visible options by search text", async () => {
    setup();
    await userEvent.click(screen.getByRole("textbox", { name: "Filter by labels" }));
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search Filter by labels options" }),
      "da",
    );
    const dropdown = screen.getByRole("listbox");
    expect(within(dropdown).getByRole("checkbox", { name: "dairy" })).toBeInTheDocument();
    expect(within(dropdown).queryByRole("checkbox", { name: "fat" })).not.toBeInTheDocument();
  });

  it("shows no-options message when search matches nothing", async () => {
    setup();
    await userEvent.click(screen.getByRole("textbox", { name: "Filter by labels" }));
    await userEvent.type(
      screen.getByRole("textbox", { name: "Search Filter by labels options" }),
      "zzz",
    );
    expect(screen.getByText("No options")).toBeInTheDocument();
  });
});

describe("MultiSelectFilter — accept and revert", () => {
  it("closes on accept without reverting", async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole("textbox", { name: "Filter by labels" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "fat" }));
    await userEvent.click(screen.getByRole("button", { name: "Accept filter" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(["fat"]);
  });

  it("reverts to snapshot on revert button click", async () => {
    const { onChange } = setup(["dairy"]);
    await userEvent.click(screen.getByRole("textbox", { name: "Filter by labels" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "fat" }));
    await userEvent.click(screen.getByRole("button", { name: "Revert filter" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(["dairy"]);
  });

  it("reverts to empty array when snapshot was empty", async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole("textbox", { name: "Filter by labels" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "fat" }));
    await userEvent.click(screen.getByRole("button", { name: "Revert filter" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});

describe("MultiSelectFilter — clear button", () => {
  it("clears the filter and collapses to placeholder", async () => {
    const { onChange } = setup(["dairy"]);
    await userEvent.click(screen.getByLabelText("Clear Filter by labels"));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

describe("MultiSelectFilter — outside click auto-accepts", () => {
  it("closes the dropdown when clicking outside", async () => {
    setup(["fat"]);
    await userEvent.click(screen.getByRole("textbox", { name: "Filter by labels" }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await userEvent.click(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("keeps current selection on outside click", async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole("textbox", { name: "Filter by labels" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "solid" }));
    await userEvent.click(document.body);
    expect(onChange).toHaveBeenLastCalledWith(["solid"]);
  });
});
