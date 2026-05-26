import { useState, type FormEvent } from "react";
import "./SelectBookPage.css";

interface SelectBookPageProps {
  readonly onSelect: (name: string) => void;
}

export function SelectBookPage({ onSelect }: SelectBookPageProps) {
  const [name, setName] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed !== "") onSelect(trimmed);
  }

  return (
    <main className="select-user-page">
      <h1 className="page-title">{name || "Recipe Book"}</h1>
      <p className="select-user-subtitle">Enter the name of your book to get started.</p>
      <form className="select-user-form" onSubmit={handleSubmit}>
        <label className="select-user-label" htmlFor="user-name-input">
          Book name
        </label>
        <input
          id="user-name-input"
          className="select-user-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. May Family Recipes"
          autoFocus
          autoComplete="name"
        />
        <button type="submit" className="select-user-submit" disabled={name.trim() === ""}>
          Get Started
        </button>
      </form>
    </main>
  );
}
