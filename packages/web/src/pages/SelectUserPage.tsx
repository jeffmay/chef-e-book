import { useState, type FormEvent } from "react";
import "./SelectUserPage.css";

interface SelectUserPageProps {
  readonly onSelect: (name: string) => void;
}

export function SelectUserPage({ onSelect }: SelectUserPageProps) {
  const [name, setName] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed !== "") onSelect(trimmed);
  }

  return (
    <main className="select-user-page">
      <h1 className="page-title">Recipe Book</h1>
      <p className="select-user-subtitle">Enter your name to get started.</p>
      <form className="select-user-form" onSubmit={handleSubmit}>
        <label className="select-user-label" htmlFor="user-name-input">
          Your name
        </label>
        <input
          id="user-name-input"
          className="select-user-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Alice"
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
