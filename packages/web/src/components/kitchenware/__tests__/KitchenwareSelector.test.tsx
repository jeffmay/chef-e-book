import { type Container, type ContainerId } from "@recipe-book/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TreeSelectChangeEvent } from "primereact/treeselect";
import type { TreeNode } from "primereact/treenode";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KitchenwareSelector } from "../kitchenware_selector.js";

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

const onChange = vi.fn();
const onCreateContainer = vi.fn();
const onUpdateContainer = vi.fn();

function makeNewContainer(name: string): Container {
  return {
    kind: "container",
    id: "---new000000" as ContainerId,
    name,
    labels: new Set(),
  };
}

function setup(props: Partial<Parameters<typeof KitchenwareSelector>[0]> = {}) {
  onCreateContainer.mockReturnValue(makeNewContainer("New Container"));
  render(
    <KitchenwareSelector
      value={undefined}
      containers={[BOWL]}
      allLabelNames={["big", "small"]}
      onChange={onChange}
      onCreateContainer={onCreateContainer}
      onUpdateContainer={onUpdateContainer}
      ariaLabel="Container"
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("KitchenwareSelector — display", () => {
  it("renders with placeholder text", () => {
    setup();
    expect(screen.getByText("Select or create a container…")).toBeInTheDocument();
  });

  it("renders existing containers as options", async () => {
    setup();
    await userEvent.click(screen.getByRole("combobox", { name: "Container" }));
    expect(await screen.findByText("Bowl")).toBeInTheDocument();
  });

  it("renders with custom placeholder", () => {
    setup({ placeholder: "Pick one…" });
    expect(screen.getByText("Pick one…")).toBeInTheDocument();
  });
});

describe("KitchenwareSelector — selecting existing container", () => {
  it("calls onChange when an existing option is selected", async () => {
    setup();
    await userEvent.click(screen.getByRole("combobox", { name: "Container" }));
    const option = screen.getByRole("option", { name: "Bowl" });
    await userEvent.click(option);
    expect(onChange).toHaveBeenCalledWith("------bowl00");
  });
});

describe("KitchenwareSelector — creating a new container", () => {
  it("opens modal when a new name is typed and created", async () => {
    setup();
    const input = screen.getByRole("combobox", { name: "Container" });
    await userEvent.type(input, "Mixing Bowl");
    const create_option = await screen.findByText(/Create "Mixing Bowl"/);
    onCreateContainer.mockReturnValue(makeNewContainer("Mixing Bowl"));
    await userEvent.click(create_option);
    expect(onCreateContainer).toHaveBeenCalledWith("Mixing Bowl");
    expect(await screen.findByRole("dialog", { name: "New container" })).toBeInTheDocument();
  });

  it("calls onUpdateContainer and onChange when Create is clicked", async () => {
    setup();
    const input = screen.getByRole("combobox", { name: "Container" });
    await userEvent.type(input, "Mixing Bowl");
    const create_option = await screen.findByText(/Create "Mixing Bowl"/);
    onCreateContainer.mockReturnValue(makeNewContainer("Mixing Bowl"));
    await userEvent.click(create_option);
    await screen.findByRole("dialog", { name: "New container" });
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(onUpdateContainer).toHaveBeenCalledWith("---new000000", [], undefined);
    expect(onChange).toHaveBeenCalledWith("---new000000");
  });

  it("closes modal without saving when Cancel is clicked", async () => {
    setup();
    const input = screen.getByRole("combobox", { name: "Container" });
    await userEvent.type(input, "Temp Bowl");
    const create_option = await screen.findByText(/Create "Temp Bowl"/);
    onCreateContainer.mockReturnValue(makeNewContainer("Temp Bowl"));
    await userEvent.click(create_option);
    await screen.findByRole("dialog", { name: "New container" });
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "New container" })).not.toBeInTheDocument(),
    );
    expect(onUpdateContainer).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
