import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { App } from "../App.js";

describe("App", () => {
  it("renders the top nav with menu and undo buttons", () => {
    render(<App />);
    expect(screen.getByLabelText("Menu")).toBeInTheDocument();
    expect(screen.getByLabelText("Undo")).toBeInTheDocument();
  });

  it("renders the app title", () => {
    render(<App />);
    expect(screen.getByText("Recipe Book")).toBeInTheDocument();
  });

  it("renders a loading placeholder in the main content", () => {
    render(<App />);
    expect(screen.getByText("Loading your recipes…")).toBeInTheDocument();
  });
});
