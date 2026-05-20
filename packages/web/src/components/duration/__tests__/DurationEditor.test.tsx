import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DurationEditor } from "../duration_editor.js";

const FIVE_MIN = 300;
const ONE_HOUR = 3600;
const NINETY_SEC = 90;

function setup(value = FIVE_MIN, onCommit = vi.fn()) {
  render(<DurationEditor value={value} onCommit={onCommit} />);
  return { onCommit };
}

async function openEditor(value = FIVE_MIN) {
  const { onCommit } = setup(value);
  await userEvent.click(screen.getByRole("button", { name: "Edit duration" }));
  return { onCommit };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DurationEditor — closed state", () => {
  it("shows humanized duration", () => {
    setup(FIVE_MIN);
    expect(screen.getByText("5 minutes")).toBeInTheDocument();
  });

  it("shows humanized hours + minutes for long durations", () => {
    setup(ONE_HOUR + FIVE_MIN);
    expect(screen.getByText("1 hour, 5 minutes")).toBeInTheDocument();
  });

  it("shows the ± edit button", () => {
    setup();
    expect(screen.getByRole("button", { name: "Edit duration" })).toBeInTheDocument();
  });

  it("does not show OK when closed", () => {
    setup();
    expect(screen.queryByRole("button", { name: "OK" })).not.toBeInTheDocument();
  });
});

describe("DurationEditor — open state", () => {
  it("shows < reset button", async () => {
    await openEditor();
    expect(screen.getByRole("button", { name: "Reset to original" })).toBeInTheDocument();
  });

  it("shows duration text input", async () => {
    await openEditor();
    expect(screen.getByRole("textbox", { name: "Duration" })).toBeInTheDocument();
  });

  it("text input starts with humanized value", async () => {
    await openEditor(FIVE_MIN);
    expect(screen.getByRole("textbox", { name: "Duration" })).toHaveValue("5 minutes");
  });

  it("shows min/sec unit toggle buttons", async () => {
    await openEditor();
    expect(screen.getByRole("button", { name: "min" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "sec" })).toBeInTheDocument();
  });

  it("min unit is active by default", async () => {
    await openEditor();
    expect(screen.getByRole("button", { name: "min" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "sec" })).toHaveAttribute("aria-pressed", "false");
  });

  it("shows OK button", async () => {
    await openEditor();
    expect(screen.getByRole("button", { name: "OK" })).toBeInTheDocument();
  });

  it("shows -5, -1, +1, +5 adjust buttons in min mode", async () => {
    await openEditor();
    expect(screen.getByRole("button", { name: "-5 min" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "-1 min" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+1 min" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+5 min" })).toBeInTheDocument();
  });

  it("shows -15, -5, +5, +15 adjust buttons in sec mode", async () => {
    await openEditor();
    await userEvent.click(screen.getByRole("button", { name: "sec" }));
    expect(screen.getByRole("button", { name: "-15 sec" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "-5 sec" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+5 sec" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+15 sec" })).toBeInTheDocument();
  });
});

describe("DurationEditor — unit toggle", () => {
  it("switching to sec activates sec button", async () => {
    await openEditor();
    await userEvent.click(screen.getByRole("button", { name: "sec" }));
    expect(screen.getByRole("button", { name: "sec" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "min" })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("DurationEditor — adjust buttons", () => {
  it("+1 min increases duration by 60 seconds", async () => {
    await openEditor(FIVE_MIN);
    await userEvent.click(screen.getByRole("button", { name: "+1 min" }));
    // 5 min + 1 min = 6 min
    expect(screen.getByRole("textbox", { name: "Duration" })).toHaveValue("6 minutes");
  });

  it("-1 min decreases duration by 60 seconds", async () => {
    await openEditor(FIVE_MIN);
    await userEvent.click(screen.getByRole("button", { name: "-1 min" }));
    expect(screen.getByRole("textbox", { name: "Duration" })).toHaveValue("4 minutes");
  });

  it("+5 min increases duration by 300 seconds", async () => {
    await openEditor(FIVE_MIN);
    await userEvent.click(screen.getByRole("button", { name: "+5 min" }));
    expect(screen.getByRole("textbox", { name: "Duration" })).toHaveValue("10 minutes");
  });

  it("+5 sec adds 5 seconds", async () => {
    await openEditor(NINETY_SEC);
    await userEvent.click(screen.getByRole("button", { name: "sec" }));
    await userEvent.click(screen.getByRole("button", { name: "+5 sec" }));
    expect(screen.getByRole("textbox", { name: "Duration" })).toHaveValue("1 minute, 35 seconds");
  });

  it("does not go below 0 seconds", async () => {
    await openEditor(30);
    await userEvent.click(screen.getByRole("button", { name: "-5 min" }));
    expect(screen.getByRole("textbox", { name: "Duration" })).toHaveValue("0 seconds");
  });
});

describe("DurationEditor — text input parsing", () => {
  it("parses a typed duration string and updates current value", async () => {
    await openEditor(FIVE_MIN);
    const input = screen.getByRole("textbox", { name: "Duration" });
    await userEvent.clear(input);
    await userEvent.type(input, "10 min");
    // No error state
    expect(input).not.toHaveAttribute("aria-invalid", "true");
  });

  it("shows error state for unparseable input", async () => {
    await openEditor(FIVE_MIN);
    const input = screen.getByRole("textbox", { name: "Duration" });
    await userEvent.clear(input);
    await userEvent.type(input, "banana");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });
});

describe("DurationEditor — reset and commit", () => {
  it("< resets the input to the original value", async () => {
    await openEditor(FIVE_MIN);
    await userEvent.click(screen.getByRole("button", { name: "+5 min" }));
    await userEvent.click(screen.getByRole("button", { name: "Reset to original" }));
    expect(screen.getByRole("textbox", { name: "Duration" })).toHaveValue("5 minutes");
  });

  it("OK calls onCommit with the current seconds value", async () => {
    const { onCommit } = await openEditor(FIVE_MIN);
    await userEvent.click(screen.getByRole("button", { name: "+1 min" }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onCommit).toHaveBeenCalledWith(360); // 5 + 1 = 6 min = 360 sec
  });

  it("OK closes the editor", async () => {
    await openEditor();
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.getByRole("button", { name: "Edit duration" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "OK" })).not.toBeInTheDocument();
  });

  it("OK with typed input commits parsed value", async () => {
    const { onCommit } = await openEditor(FIVE_MIN);
    const input = screen.getByRole("textbox", { name: "Duration" });
    await userEvent.clear(input);
    await userEvent.type(input, "10 min");
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onCommit).toHaveBeenCalledWith(600);
  });
});
