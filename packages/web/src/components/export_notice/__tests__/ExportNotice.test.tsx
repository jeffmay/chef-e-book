import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExportNotice } from "../ExportNotice.tsx";

describe("ExportNotice", () => {
  it("says what was exported, as a status", () => {
    render(
      <ExportNotice
        summary={{ message: "Exported 2 recipes with 5 ingredients.", warnings: [] }}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Exported 2 recipes with 5 ingredients.");
  });

  it("shows each warning, styled as a warning rather than an error", () => {
    render(
      <ExportNotice
        summary={{
          message: "Exported 1 recipe with 1 ingredient.",
          warnings: [
            "1 ingredient could not be found in this book and was left out of the file.",
            "1 folder could not be found in this book and was left out of the file.",
          ],
        }}
        onDismiss={vi.fn()}
      />,
    );
    const warning = screen.getByText(/1 ingredient could not be found/);
    expect(warning).toHaveClass("field-error");
    expect(screen.getByText(/1 folder could not be found/)).toBeInTheDocument();
  });

  it("shows no warnings when there are none", () => {
    render(
      <ExportNotice
        summary={{ message: "Exported 1 ingredient.", warnings: [] }}
        onDismiss={vi.fn()}
      />,
    );
    expect(document.querySelector(".field-error")).toBeNull();
  });

  it("is dismissed by its button", async () => {
    const onDismiss = vi.fn();
    render(
      <ExportNotice
        summary={{ message: "Exported 1 ingredient.", warnings: [] }}
        onDismiss={onDismiss}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
