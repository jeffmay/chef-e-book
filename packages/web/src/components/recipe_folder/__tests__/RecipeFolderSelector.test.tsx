import { type RecipeFolder, RecipeFolderId, fixedId } from "@recipe-book/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TreeSelectChangeEvent } from "primereact/treeselect";
import type { TreeNode } from "primereact/treenode";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecipeFolderSelector } from "../RecipeFolderSelector.tsx";

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

const MAIN_ID = fixedId(RecipeFolderId, "folder-main00");
const SUB_ID = fixedId(RecipeFolderId, "folder-sub000");

const MAIN_FOLDER: RecipeFolder = {
  id: MAIN_ID,
  name: "Main",
  tags: [],
  sort_order: "alphabetical",
  children: [{ id: SUB_ID, name: "Sub", tags: [], sort_order: "alphabetical", children: [] }],
};

const onChange = vi.fn();
const onCreateFolder = vi.fn();

function makeFolder(name: string): RecipeFolder {
  return {
    id: fixedId(RecipeFolderId, "folder-new000"),
    name,
    tags: [],
    sort_order: "alphabetical",
    children: [],
  };
}

function setup(props: Partial<Parameters<typeof RecipeFolderSelector>[0]> = {}) {
  onCreateFolder.mockReturnValue(makeFolder("New Folder"));
  render(
    <RecipeFolderSelector
      value={undefined}
      folders={[MAIN_FOLDER]}
      onChange={onChange}
      onCreateFolder={onCreateFolder}
      ariaLabel="Select folder"
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RecipeFolderSelector — display", () => {
  it("renders with placeholder when no value selected", () => {
    setup();
    expect(screen.getByText("— No folder —")).toBeInTheDocument();
  });

  it("renders folders and nested children as options", () => {
    setup();
    const select = screen.getByRole("combobox", { name: "Select folder" });
    const values = Array.from(select.querySelectorAll("option")).map((o) => o.value);
    expect(values).toContain(MAIN_ID);
    expect(values).toContain(SUB_ID);
  });

  it("shows selected folder path when value is set", () => {
    setup({ value: SUB_ID });
    expect(screen.getByLabelText("Selected folder path")).toHaveTextContent("Main / Sub");
  });

  it("does not show path when no value selected", () => {
    setup();
    expect(screen.queryByLabelText("Selected folder path")).not.toBeInTheDocument();
  });
});

describe("RecipeFolderSelector — selection", () => {
  it("calls onChange with folder id when option selected", async () => {
    setup();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Select folder" }), MAIN_ID);
    expect(onChange).toHaveBeenCalledWith(MAIN_ID);
  });

  it("calls onChange with undefined when empty option selected", async () => {
    setup({ value: MAIN_ID });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Select folder" }), "");
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});

describe("RecipeFolderSelector — adding folders", () => {
  it("shows a New subfolder checkbox", () => {
    setup();
    expect(screen.getByRole("checkbox", { name: "Create new subfolder" })).toBeInTheDocument();
  });

  it("checking New subfolder shows the name input", async () => {
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Create new subfolder" }));
    expect(screen.getByRole("textbox", { name: "New folder name" })).toBeInTheDocument();
  });

  it("requires a subfolder name: shows an error and disables ✓ until a name is typed", async () => {
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Create new subfolder" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Subfolder name is required");
    expect(screen.getByRole("button", { name: "Create folder" })).toBeDisabled();

    await userEvent.type(screen.getByRole("textbox", { name: "New folder name" }), "Sauces");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create folder" })).not.toBeDisabled();
  });

  it("pressing Enter in the name input calls onCreateFolder and onChange", async () => {
    onCreateFolder.mockReturnValue(makeFolder("My Folder"));
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Create new subfolder" }));
    const input = screen.getByRole("textbox", { name: "New folder name" });
    await userEvent.type(input, "My Folder{Enter}");
    expect(onCreateFolder).toHaveBeenCalledWith("My Folder", undefined);
    expect(onChange).toHaveBeenCalledWith(fixedId(RecipeFolderId, "folder-new000"));
  });

  it("uses selected folder as parent when creating subfolder", async () => {
    onCreateFolder.mockReturnValue(makeFolder("Child"));
    setup({ value: MAIN_ID });
    await userEvent.click(screen.getByRole("checkbox", { name: "Create new subfolder" }));
    const input = screen.getByRole("textbox", { name: "New folder name" });
    await userEvent.type(input, "Child{Enter}");
    expect(onCreateFolder).toHaveBeenCalledWith("Child", MAIN_ID);
  });

  it("pressing Escape cancels the folder input", async () => {
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Create new subfolder" }));
    const input = screen.getByRole("textbox", { name: "New folder name" });
    await userEvent.type(input, "{Escape}");
    expect(screen.queryByRole("textbox", { name: "New folder name" })).not.toBeInTheDocument();
    expect(onCreateFolder).not.toHaveBeenCalled();
  });

  it("unchecking New subfolder cancels the folder input", async () => {
    setup();
    const checkbox = screen.getByRole("checkbox", { name: "Create new subfolder" });
    await userEvent.click(checkbox);
    await userEvent.click(checkbox);
    expect(screen.queryByRole("textbox", { name: "New folder name" })).not.toBeInTheDocument();
  });

  it("clicking ✕ cancels the folder input", async () => {
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Create new subfolder" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel new folder" }));
    expect(screen.queryByRole("textbox", { name: "New folder name" })).not.toBeInTheDocument();
  });

  it("clicking ✓ button submits the folder", async () => {
    onCreateFolder.mockReturnValue(makeFolder("Quick"));
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Create new subfolder" }));
    const input = screen.getByRole("textbox", { name: "New folder name" });
    await userEvent.type(input, "Quick");
    await userEvent.click(screen.getByRole("button", { name: "Create folder" }));
    expect(onCreateFolder).toHaveBeenCalledWith("Quick", undefined);
  });
});
