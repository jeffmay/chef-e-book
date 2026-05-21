import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeFraction, simplify } from "@recipe-book/shared";
import { FractionEditor } from "../FractionEditor.js";

const ONE_HALF = makeFraction(1, 2);
const ONE = makeFraction(1, 1);
const THREE = makeFraction(3, 1);

function setup(value = ONE, onCommit = vi.fn()) {
  render(<FractionEditor value={value} onCommit={onCommit} />);
  return { onCommit };
}

async function openEditor(value = ONE) {
  const { onCommit } = setup(value);
  await userEvent.click(screen.getByRole("button", { name: "Edit value" }));
  return { onCommit };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FractionEditor — closed state", () => {
  it("shows the fraction display with aria-label", () => {
    setup(ONE_HALF);
    expect(screen.getByLabelText("1/2")).toBeInTheDocument();
  });

  it("shows the ± button", () => {
    setup();
    expect(screen.getByRole("button", { name: "Edit value" })).toBeInTheDocument();
  });

  it("does not show the OK button when closed", () => {
    setup();
    expect(screen.queryByRole("button", { name: "Accept changes" })).not.toBeInTheDocument();
  });
});

describe("FractionEditor — opening the editor", () => {
  it("clicking ± replaces it with the < button", async () => {
    await openEditor();
    expect(screen.getByRole("button", { name: "Cancel changes" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit value" })).not.toBeInTheDocument();
  });

  it("shows the OK button after opening", async () => {
    await openEditor();
    expect(screen.getByRole("button", { name: "Accept changes" })).toBeInTheDocument();
  });

  it("shows the operation type radio group", async () => {
    await openEditor();
    expect(screen.getByRole("group", { name: "Operation type" })).toBeInTheDocument();
  });

  it("defaults to the ÷ mode button row", async () => {
    await openEditor();
    expect(screen.getByRole("button", { name: "÷2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "÷3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "÷5" })).toBeInTheDocument();
  });
});

describe("FractionEditor — operation mode switching", () => {
  it("switching to × shows multiply buttons", async () => {
    await openEditor();
    await userEvent.click(screen.getByRole("radio", { name: "×" }));
    expect(screen.getByRole("button", { name: "×2" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "÷2" })).not.toBeInTheDocument();
  });

  it("switching to − shows subtract buttons", async () => {
    await openEditor();
    await userEvent.click(screen.getByRole("radio", { name: "−" }));
    expect(screen.getByRole("button", { name: "−1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "−½" })).toBeInTheDocument();
  });

  it("switching to + shows add buttons", async () => {
    await openEditor();
    await userEvent.click(screen.getByRole("radio", { name: "+" }));
    expect(screen.getByRole("button", { name: "+1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+½" })).toBeInTheDocument();
  });
});

describe("FractionEditor — applying operations", () => {
  it("÷2 halves the current value", async () => {
    await openEditor(ONE);
    await userEvent.click(screen.getByRole("button", { name: "÷2" }));
    expect(screen.getByLabelText("1/2")).toBeInTheDocument();
  });

  it("×3 triples the current value", async () => {
    await openEditor(ONE);
    await userEvent.click(screen.getByRole("radio", { name: "×" }));
    await userEvent.click(screen.getByRole("button", { name: "×3" }));
    expect(screen.getByLabelText("3")).toBeInTheDocument();
  });

  it("+1 adds one to the current value", async () => {
    await openEditor(ONE);
    await userEvent.click(screen.getByRole("radio", { name: "+" }));
    await userEvent.click(screen.getByRole("button", { name: "+1" }));
    expect(screen.getByLabelText("2")).toBeInTheDocument();
  });

  it("−½ subtracts one half", async () => {
    await openEditor(ONE);
    await userEvent.click(screen.getByRole("radio", { name: "−" }));
    await userEvent.click(screen.getByRole("button", { name: "−½" }));
    expect(screen.getByLabelText("1/2")).toBeInTheDocument();
  });

  it("chains multiple operations", async () => {
    await openEditor(THREE);
    await userEvent.click(screen.getByRole("button", { name: "÷3" }));
    // 3 ÷ 3 = 1
    expect(screen.getByLabelText("1")).toBeInTheDocument();
  });
});

describe("FractionEditor — reset", () => {
  it("< resets the display to the original value", async () => {
    await openEditor(ONE);
    await userEvent.click(screen.getByRole("button", { name: "÷2" }));
    expect(screen.getByLabelText("1/2")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel changes" }));
    expect(screen.getByLabelText("1")).toBeInTheDocument();
  });

  it("editor stays open after reset", async () => {
    await openEditor();
    await userEvent.click(screen.getByRole("button", { name: "Cancel changes" }));
    expect(screen.getByRole("button", { name: "Accept changes" })).toBeInTheDocument();
  });
});

describe("FractionEditor — OK", () => {
  it("calls onCommit with the current fraction", async () => {
    const { onCommit } = await openEditor(ONE);
    await userEvent.click(screen.getByRole("button", { name: "÷2" }));
    await userEvent.click(screen.getByRole("button", { name: "Accept changes" }));
    expect(onCommit).toHaveBeenCalledWith(simplify(ONE_HALF));
  });

  it("closes the editor and restores ± after OK", async () => {
    await openEditor();
    await userEvent.click(screen.getByRole("button", { name: "Accept changes" }));
    expect(screen.getByRole("button", { name: "Edit value" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept changes" })).not.toBeInTheDocument();
  });

  it("calls onCommit with unchanged value when no ops applied", async () => {
    const { onCommit } = await openEditor(ONE);
    await userEvent.click(screen.getByRole("button", { name: "Accept changes" }));
    expect(onCommit).toHaveBeenCalledWith(ONE);
  });
});

describe("FractionEditor — extra_controls slot", () => {
  it("renders extra_controls between op buttons and OK", async () => {
    render(
      <FractionEditor
        value={ONE}
        onCommit={vi.fn()}
        extraControls={<span data-testid="extra">extra</span>}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Edit value" }));
    expect(screen.getByTestId("extra")).toBeInTheDocument();
  });
});
