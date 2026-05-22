import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { UserMenu } from "../UserMenu.js";

function renderMenu(onProfile = vi.fn()) {
  return render(
    <>
      <UserMenu userName="Alice" onProfile={onProfile} />
      <button>Outside</button>
    </>,
  );
}

describe("UserMenu", () => {
  it("renders the user name in the trigger", () => {
    render(<UserMenu userName="Alice" onProfile={vi.fn()} />);
    expect(screen.getByLabelText("User menu for Alice")).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
  });

  it("shows Profile settings button when opened", async () => {
    render(<UserMenu userName="Alice" onProfile={vi.fn()} />);
    await userEvent.click(screen.getByLabelText("User menu for Alice"));
    expect(screen.getByRole("menuitem", { name: "Profile settings" })).toBeInTheDocument();
  });

  it("calls onProfile when Profile settings is clicked", async () => {
    const onProfile = vi.fn();
    render(<UserMenu userName="Alice" onProfile={onProfile} />);
    await userEvent.click(screen.getByLabelText("User menu for Alice"));
    await userEvent.click(screen.getByRole("menuitem", { name: "Profile settings" }));
    expect(onProfile).toHaveBeenCalledOnce();
  });

  it("closes the menu when focus moves to an element outside the menu", async () => {
    renderMenu();
    const trigger = screen.getByLabelText("User menu for Alice");
    await userEvent.click(trigger);
    const details = trigger.closest("details");
    expect(details?.hasAttribute("open")).toBe(true);
    const outside = screen.getByRole("button", { name: "Outside" });
    if (!details) throw new Error("No details element");
    fireEvent.focusOut(trigger, { relatedTarget: outside });
    expect(details.hasAttribute("open")).toBe(false);
  });
});
