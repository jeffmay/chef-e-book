import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LabelEditor } from "../LabelEditor.js";

const ALL_LABELS = ["baking", "dairy", "fat", "solid"];

interface SetupOptions {
  selected_label_names?: readonly string[];
  all_label_names?: readonly string[];
  aria_label?: string;
}

function setup(options: SetupOptions = {}) {
  const on_change = vi.fn();
  const on_commit = vi.fn();
  const on_cancel = vi.fn();
  render(
    <LabelEditor
      selected_label_names={options.selected_label_names ?? []}
      all_label_names={options.all_label_names ?? ALL_LABELS}
      aria_label={options.aria_label ?? "Edit labels for Flour"}
      on_change={on_change}
      on_commit={on_commit}
      on_cancel={on_cancel}
    />,
  );
  return { on_change, on_commit, on_cancel };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LabelEditor — rendering", () => {
  it("renders Confirm and Cancel buttons", () => {
    setup();
    expect(screen.getByRole("button", { name: "Confirm edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel edit" })).toBeInTheDocument();
  });

  it("renders the select input with the given aria-label", () => {
    setup({ aria_label: "Edit labels for Butter" });
    expect(screen.getByRole("combobox", { name: "Edit labels for Butter" })).toBeInTheDocument();
  });

  it("shows currently selected labels as multi-value chips", () => {
    setup({ selected_label_names: ["baking", "fat"] });
    expect(screen.getByText("baking")).toBeInTheDocument();
    expect(screen.getByText("fat")).toBeInTheDocument();
  });

  it("renders with no selections when selected_label_names is empty", () => {
    setup({ selected_label_names: [] });
    expect(screen.queryByText("baking")).not.toBeInTheDocument();
  });
});

describe("LabelEditor — confirm and cancel", () => {
  it("calls on_commit when Confirm button is clicked", async () => {
    const { on_commit } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Confirm edit" }));
    expect(on_commit).toHaveBeenCalledOnce();
  });

  it("calls on_cancel when Cancel button is clicked", async () => {
    const { on_cancel } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Cancel edit" }));
    expect(on_cancel).toHaveBeenCalledOnce();
  });
});

describe("LabelEditor — selecting existing labels", () => {
  it("shows available labels in the dropdown when opened", async () => {
    setup({ selected_label_names: [] });
    await userEvent.click(screen.getByRole("combobox", { name: "Edit labels for Flour" }));
    expect(await screen.findByText("baking")).toBeInTheDocument();
    expect(await screen.findByText("dairy")).toBeInTheDocument();
  });

  it("calls on_change with the new label when an existing option is selected", async () => {
    const { on_change } = setup({ selected_label_names: [] });
    await userEvent.click(screen.getByRole("combobox", { name: "Edit labels for Flour" }));
    await userEvent.click(await screen.findByText("baking"));
    expect(on_change).toHaveBeenCalledWith(["baking"]);
  });

  it("calls on_change with accumulated labels when multiple are selected", async () => {
    const { on_change } = setup({ selected_label_names: ["fat"] });
    await userEvent.click(screen.getByRole("combobox", { name: "Edit labels for Flour" }));
    await userEvent.click(await screen.findByText("baking"));
    expect(on_change).toHaveBeenCalledWith(["fat", "baking"]);
  });

  it("calls on_change without the label when a chip remove button is clicked", async () => {
    const { on_change } = setup({ selected_label_names: ["baking", "fat"] });
    await userEvent.click(screen.getByRole("button", { name: "Remove baking" }));
    expect(on_change).toHaveBeenCalledWith(["fat"]);
  });
});

describe("LabelEditor — creating new labels", () => {
  it("shows a create option when typed text does not match any existing label", async () => {
    setup({ all_label_names: ["baking"] });
    const input = screen.getByRole("combobox", { name: "Edit labels for Flour" });
    await userEvent.type(input, "spicy");
    expect(await screen.findByText(/Create "spicy"/)).toBeInTheDocument();
  });

  it("calls on_change with the new label name when create option is clicked", async () => {
    const { on_change } = setup({ all_label_names: [] });
    const input = screen.getByRole("combobox", { name: "Edit labels for Flour" });
    await userEvent.type(input, "spicy");
    await userEvent.click(await screen.findByText(/Create "spicy"/));
    expect(on_change).toHaveBeenCalledWith(["spicy"]);
  });
});
