import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeFraction } from "@recipe-book/shared";
import type { Measurement } from "@recipe-book/shared";
import { MeasurementEditor } from "../MeasurementEditor.tsx";

const ONE_CUP: Measurement = { value: makeFraction(1, 1), unit: "cup" };
const ONE_OZ: Measurement = { value: makeFraction(1, 1), unit: "oz" };
const HALF_CUP: Measurement = { value: makeFraction(1, 2), unit: "cup" };
const WHOLE: Measurement = { value: makeFraction(3, 1), unit: "whole" };

function setup(measurement: Measurement = ONE_CUP, onCommit = vi.fn()) {
  render(<MeasurementEditor value={measurement} onCommit={onCommit} />);
  return { onCommit };
}

async function openEditor(measurement: Measurement = ONE_CUP) {
  const { onCommit } = setup(measurement);
  await userEvent.click(screen.getByRole("button", { name: "Edit measurement" }));
  return { onCommit };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MeasurementEditor — closed state", () => {
  it("shows the fraction display", () => {
    setup(ONE_CUP);
    expect(screen.getByLabelText("1")).toBeInTheDocument();
  });

  it("shows the unit label", () => {
    setup(ONE_CUP);
    expect(screen.getByText("cup")).toBeInTheDocument();
  });

  it("shows the ± button", () => {
    setup();
    expect(screen.getByRole("button", { name: "Edit measurement" })).toBeInTheDocument();
  });

  it("does not show OK when closed", () => {
    setup();
    expect(screen.queryByRole("button", { name: "Accept changes" })).not.toBeInTheDocument();
  });
});

describe("MeasurementEditor — opening the editor", () => {
  it("shows < button after opening", async () => {
    await openEditor();
    expect(screen.getByRole("button", { name: "Cancel changes" })).toBeInTheDocument();
  });

  it("shows OK button", async () => {
    await openEditor();
    expect(screen.getByRole("button", { name: "Accept changes" })).toBeInTheDocument();
  });

  it("shows the type selector", async () => {
    await openEditor();
    expect(screen.getByRole("combobox", { name: "Measurement type" })).toBeInTheDocument();
  });

  it("shows the unit selector", async () => {
    await openEditor();
    expect(screen.getByRole("combobox", { name: "Measurement unit" })).toBeInTheDocument();
  });

  it("type selector defaults to the unit type of the initial measurement", async () => {
    await openEditor(ONE_CUP);
    expect(screen.getByRole("combobox", { name: "Measurement type" })).toHaveValue("volume");
  });

  it("unit selector defaults to the initial unit", async () => {
    await openEditor(ONE_CUP);
    expect(screen.getByRole("combobox", { name: "Measurement unit" })).toHaveValue("cup");
  });
});

describe("MeasurementEditor — operation buttons", () => {
  it("÷2 halves the displayed fraction", async () => {
    await openEditor(ONE_CUP);
    await userEvent.click(screen.getByRole("button", { name: "÷2" }));
    expect(screen.getByLabelText("1/2")).toBeInTheDocument();
  });

  it("✕2 doubles the displayed fraction", async () => {
    await openEditor(ONE_CUP);
    await userEvent.click(screen.getByRole("radio", { name: "✕" }));
    await userEvent.click(screen.getByRole("button", { name: "x2" }));
    expect(screen.getByLabelText("2")).toBeInTheDocument();
  });

  it("< resets to original fraction", async () => {
    await openEditor(ONE_CUP);
    await userEvent.click(screen.getByRole("button", { name: "÷2" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel changes" }));
    expect(screen.getByLabelText("1")).toBeInTheDocument();
  });
});

describe("MeasurementEditor — type selector", () => {
  it("switching type to weight updates unit selector to oz", async () => {
    await openEditor(ONE_CUP);
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Measurement type" }),
      "weight",
    );
    expect(screen.getByRole("combobox", { name: "Measurement unit" })).toHaveValue("oz");
  });

  it("switching type to count updates unit selector to whole", async () => {
    await openEditor(ONE_CUP);
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Measurement type" }),
      "count",
    );
    expect(screen.getByRole("combobox", { name: "Measurement unit" })).toHaveValue("whole");
  });

  it("switching type to count shows count unit options", async () => {
    await openEditor(ONE_CUP);
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Measurement type" }),
      "count",
    );
    const unit_select = screen.getByRole("combobox", { name: "Measurement unit" });
    expect(unit_select).toContainElement(screen.getByRole("option", { name: "whole" }));
    expect(unit_select).toContainElement(screen.getByRole("option", { name: "pinch" }));
    expect(unit_select).toContainElement(screen.getByRole("option", { name: "dash" }));
  });
});

describe("MeasurementEditor — unit selector conversion", () => {
  it("switching from cup to tsp converts the fraction (1 cup → 48 tsp)", async () => {
    await openEditor(ONE_CUP);
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Measurement unit" }),
      "tsp",
    );
    expect(screen.getByLabelText("48")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Measurement unit" })).toHaveValue("tsp");
  });

  it("switching from cup to ml keeps the value (cross-system, no conversion)", async () => {
    await openEditor(ONE_CUP);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Measurement unit" }), "ml");
    // Cross-system: value stays as 1 (displayed in the new unit context)
    expect(screen.getByLabelText("1")).toBeInTheDocument();
  });

  it("switching from oz to lb converts the fraction (16 oz → 1 lb)", async () => {
    const sixteen_oz: Measurement = { value: makeFraction(16, 1), unit: "oz" };
    await openEditor(sixteen_oz);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Measurement unit" }), "lb");
    expect(screen.getByLabelText("1")).toBeInTheDocument();
  });
});

describe("MeasurementEditor — OK with best unit conversion", () => {
  it("OK on 48 tsp converts to 1 cup", async () => {
    const { onCommit } = await openEditor(ONE_CUP);
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Measurement unit" }),
      "tsp",
    );
    // now at 48 tsp; largest whole unit for 48 tsp is cup (48/48 = 1)
    await userEvent.click(screen.getByRole("button", { name: "Accept changes" }));
    expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({ unit: "cup" }));
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({ value: expect.objectContaining({ numerator: 1, denominator: 1 }) }),
    );
  });

  it("OK on 1 cup stays as 1 cup (already at best unit)", async () => {
    const { onCommit } = await openEditor(ONE_CUP);
    await userEvent.click(screen.getByRole("button", { name: "Accept changes" }));
    expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({ unit: "cup" }));
  });

  it("OK closes the editor", async () => {
    await openEditor();
    await userEvent.click(screen.getByRole("button", { name: "Accept changes" }));
    expect(screen.getByRole("button", { name: "Edit measurement" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept changes" })).not.toBeInTheDocument();
  });

  it("OK on weight value converts to largest whole unit (16 oz → 1 lb)", async () => {
    const { onCommit } = setup(ONE_OZ, vi.fn());
    await userEvent.click(screen.getByRole("button", { name: "Edit measurement" }));
    await userEvent.click(screen.getByRole("radio", { name: "✕" }));
    await userEvent.click(screen.getByRole("button", { name: "x2" }));
    // now 2 oz
    await userEvent.click(screen.getByRole("radio", { name: "✕" }));
    await userEvent.click(screen.getByRole("button", { name: "x2" }));
    // now 4 oz
    await userEvent.click(screen.getByRole("radio", { name: "✕" }));
    await userEvent.click(screen.getByRole("button", { name: "x2" }));
    // now 8 oz
    await userEvent.click(screen.getByRole("radio", { name: "✕" }));
    await userEvent.click(screen.getByRole("button", { name: "x2" }));
    // now 16 oz = 1 lb
    await userEvent.click(screen.getByRole("button", { name: "Accept changes" }));
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        unit: "lb",
        value: expect.objectContaining({ numerator: 1, denominator: 1 }),
      }),
    );
  });

  it("OK on count value passes through unchanged", async () => {
    const { onCommit } = await openEditor(WHOLE);
    await userEvent.click(screen.getByRole("button", { name: "Accept changes" }));
    expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({ unit: "whole" }));
  });

  it("fractional cup value on OK converts to fl_oz (1/2 cup = 4 fl_oz)", async () => {
    const { onCommit } = await openEditor(HALF_CUP);
    await userEvent.click(screen.getByRole("button", { name: "Accept changes" }));
    // 1/2 cup → largest whole unit: fl_oz (4 fl_oz, larger than 24 tsp or 8 tbsp)
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        unit: "fl_oz",
        value: expect.objectContaining({ numerator: 4, denominator: 1 }),
      }),
    );
  });
});
