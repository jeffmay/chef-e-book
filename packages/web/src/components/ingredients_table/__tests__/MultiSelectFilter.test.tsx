import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MultiSelectFilter } from "../MultiSelectFilter.tsx";

const OPTIONS = ["dairy", "fat", "solid", "liquid"];

interface SetupOptions {
  initial?: string[];
}

function setup({ initial = [] }: SetupOptions = {}) {
  const onChange = vi.fn();
  render(
    <MultiSelectFilter
      value={initial}
      onChange={onChange}
      allOptions={OPTIONS}
      ariaLabel="Filter by labels"
    />,
  );
  return { onChange };
}

describe("MultiSelectFilter — closed state", () => {
  it("shows placeholder when nothing selected", () => {
    setup();
    expect(screen.getByPlaceholderText("Filter…")).toBeInTheDocument();
  });

  it("shows selected option name when one item selected", () => {
    setup({ initial: ["dairy"] });
    const input = screen.getByRole("textbox", { name: "Filter by labels" });
    expect((input as HTMLInputElement).value).toBe("dairy");
  });

  it("shows count when multiple selected", () => {
    setup({ initial: ["dairy", "fat"] });
    const input = screen.getByRole("textbox", { name: "Filter by labels" });
    expect((input as HTMLInputElement).value).toBe("2 selected");
  });

  it("shows clear button when items are selected", () => {
    setup({ initial: ["dairy"] });
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
    setup({ initial: ["dairy", "fat"] });
    await userEvent.click(screen.getByRole("textbox", { name: "Filter by labels" }));
    const dropdown = screen.getByRole("listbox");
    const dairyCb = within(dropdown).getByRole("checkbox", { name: "dairy" });
    const fatCb = within(dropdown).getByRole("checkbox", { name: "fat" });
    const solidCb = within(dropdown).getByRole("checkbox", { name: "solid" });
    expect(dairyCb).toBeChecked();
    expect(fatCb).toBeChecked();
    expect(solidCb).not.toBeChecked();
  });
});

describe("MultiSelectFilter — toggling options", () => {
  it("checking an option calls onChange with the new value", async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole("textbox", { name: "Filter by labels" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "fat" }));
    expect(onChange).toHaveBeenCalledWith(["fat"]);
  });

  it("unchecking an option calls onChange without that option", async () => {
    const { onChange } = setup({ initial: ["fat"] });
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
  it("closes on accept", async () => {
    setup();
    await userEvent.click(screen.getByRole("textbox", { name: "Filter by labels" }));
    await userEvent.click(screen.getByRole("button", { name: "Accept filter" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("reverts to snapshot on revert button click", async () => {
    const { onChange } = setup({ initial: ["dairy"] });
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
  it("calls onChange with empty array on clear", async () => {
    const { onChange } = setup({ initial: ["dairy"] });
    await userEvent.click(screen.getByLabelText("Clear Filter by labels"));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

describe("MultiSelectFilter — outside click auto-accepts", () => {
  it("closes the dropdown when clicking outside", async () => {
    setup({ initial: ["fat"] });
    await userEvent.click(screen.getByRole("textbox", { name: "Filter by labels" }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await userEvent.click(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
