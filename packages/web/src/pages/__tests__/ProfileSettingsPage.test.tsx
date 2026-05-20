import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ProfileSettingsPage } from "../profile_settings_page.js";

describe("ProfileSettingsPage", () => {
  it("renders current name in the input", () => {
    render(
      <ProfileSettingsPage currentName="Alice" onSave={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByLabelText("Your name")).toHaveValue("Alice");
  });

  it("Save is disabled when name is unchanged", () => {
    render(
      <ProfileSettingsPage currentName="Alice" onSave={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("Save is disabled when name is empty", async () => {
    render(
      <ProfileSettingsPage currentName="Alice" onSave={vi.fn()} onCancel={vi.fn()} />,
    );
    await userEvent.clear(screen.getByLabelText("Your name"));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("Save is enabled when name changes to a non-empty value", async () => {
    render(
      <ProfileSettingsPage currentName="Alice" onSave={vi.fn()} onCancel={vi.fn()} />,
    );
    const input = screen.getByLabelText("Your name");
    await userEvent.clear(input);
    await userEvent.type(input, "Bob");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("calls onSave with trimmed name when Save is clicked", async () => {
    const onSave = vi.fn();
    render(
      <ProfileSettingsPage currentName="Alice" onSave={onSave} onCancel={vi.fn()} />,
    );
    const input = screen.getByLabelText("Your name");
    await userEvent.clear(input);
    await userEvent.type(input, "  Bob  ");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith("Bob");
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const onCancel = vi.fn();
    render(
      <ProfileSettingsPage currentName="Alice" onSave={vi.fn()} onCancel={onCancel} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
