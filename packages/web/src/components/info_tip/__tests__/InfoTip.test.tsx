import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { InfoTip } from "../InfoTip.tsx";

const LABEL = "What does ordered mean?";
const TEXT = "Annotates that the ingredients should be added in the specified order";

describe("InfoTip", () => {
  it("hides the explanation until the toggle is pressed", () => {
    render(<InfoTip label={LABEL} text={TEXT} />);

    expect(screen.queryByText(TEXT)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: LABEL })).toHaveAttribute("aria-expanded", "false");
  });

  it("reveals the explanation when the toggle is pressed", async () => {
    render(<InfoTip label={LABEL} text={TEXT} />);
    await userEvent.click(screen.getByRole("button", { name: LABEL }));

    expect(screen.getByRole("note")).toHaveTextContent(TEXT);
    expect(screen.getByRole("button", { name: LABEL })).toHaveAttribute("aria-expanded", "true");
  });

  it("points the toggle at the explanation it reveals", async () => {
    render(<InfoTip label={LABEL} text={TEXT} />);
    await userEvent.click(screen.getByRole("button", { name: LABEL }));

    const toggle = screen.getByRole("button", { name: LABEL });
    const explanation = screen.getByRole("note");
    expect(toggle).toHaveAttribute("aria-controls", explanation.id);
    expect(toggle).toHaveAccessibleDescription(TEXT);
  });

  it("drops the references while the explanation is hidden", () => {
    render(<InfoTip label={LABEL} text={TEXT} />);

    const toggle = screen.getByRole("button", { name: LABEL });
    expect(toggle).not.toHaveAttribute("aria-controls");
    expect(toggle).not.toHaveAttribute("aria-describedby");
  });

  it("hides the explanation again when the toggle is pressed twice", async () => {
    render(<InfoTip label={LABEL} text={TEXT} />);
    await userEvent.click(screen.getByRole("button", { name: LABEL }));
    await userEvent.click(screen.getByRole("button", { name: LABEL }));

    expect(screen.queryByText(TEXT)).not.toBeInTheDocument();
  });
});
