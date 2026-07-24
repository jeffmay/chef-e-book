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

  it("performs the default action when clicked while the menu is open", async () => {
    const onStart = vi.fn();
    const onEdit = vi.fn();
    render(
      <ButtonMenu
        defaultButton={{ label: "Start", onSelect: onStart }}
        buttons={[{ label: "Edit", onSelect: onEdit }]}
        menuLabel="More actions"
      />,
    );

    // Open the menu first
    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();

    // Click the default button while the menu is still open
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
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

  it("hides the default button and folds its action into the menu when hideDefault is set", async () => {
    const onStart = vi.fn();
    const onEdit = vi.fn();
    render(
      <ButtonMenu
        defaultButton={{ label: "Start", onSelect: onStart, ariaLabel: "Start session" }}
        buttons={[{ label: "Edit", onSelect: onEdit }]}
        menuLabel="More actions"
        hideDefault
      />,
    );

    // Only the chevron trigger renders — the default button is gone.
    expect(screen.queryByRole("button", { name: "Start session" })).not.toBeInTheDocument();
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName("More actions");

    // The default action is now the first menu item.
    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    const menuItems = screen.getAllByRole("menuitem");
    expect(menuItems.map((item) => item.textContent)).toEqual(["Start", "Edit"]);
    await userEvent.click(screen.getByRole("menuitem", { name: "Start" }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
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
