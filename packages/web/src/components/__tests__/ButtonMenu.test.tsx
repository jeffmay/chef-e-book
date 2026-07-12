import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ButtonMenu } from "../button_menu/ButtonMenu.tsx";

describe("ButtonMenu", () => {
  it("renders the default button and performs its action on click", async () => {
    const onStart = vi.fn();
    render(
      <ButtonMenu
        defaultButton={{ label: "Start", onSelect: onStart, ariaLabel: "Start session" }}
        buttons={[]}
        menuLabel="More actions"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Start session" }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("shows only the chevron when defaultButton is undefined", () => {
    render(
      <ButtonMenu buttons={[{ label: "Start", onSelect: vi.fn() }]} menuLabel="More actions" />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName("More actions");
  });

  it("opens the chevron menu listing all buttons and runs the clicked one", async () => {
    const onStart = vi.fn();
    const onEdit = vi.fn();
    render(
      <ButtonMenu
        defaultButton={{ label: "Start", onSelect: onStart }}
        buttons={[{ label: "Edit", onSelect: onEdit }]}
        menuLabel="More actions"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("closes the menu on Escape", async () => {
    render(
      <ButtonMenu buttons={[{ label: "Start", onSelect: vi.fn() }]} menuLabel="More actions" />,
    );

    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("menuitem", { name: "Start" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("menuitem", { name: "Start" })).not.toBeInTheDocument(),
    );
  });

  it("disables the default button when its action is disabled", () => {
    render(
      <ButtonMenu
        defaultButton={{ label: "Start", onSelect: vi.fn(), disabled: true }}
        buttons={[]}
        menuLabel="More actions"
      />,
    );

    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
  });

  it("closes the menu when clicking outside", async () => {
    render(
      <ButtonMenu buttons={[{ label: "Start", onSelect: vi.fn() }]} menuLabel="More actions" />,
    );

    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("menuitem", { name: "Start" })).toBeInTheDocument();

    // Click outside the menu wrapper
    await userEvent.click(document.body);
    await waitFor(() =>
      expect(screen.queryByRole("menuitem", { name: "Start" })).not.toBeInTheDocument(),
    );
  });
});
