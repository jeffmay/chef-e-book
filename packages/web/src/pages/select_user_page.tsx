import { useState, type FormEvent } from "react";
import "./select_user_page.css";

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
    <main className="select_user_page">
      <h1 className="select_user_title">Recipe Book</h1>
      <p className="select_user_subtitle">Enter your name to get started.</p>
      <form className="select_user_form" onSubmit={handleSubmit}>
        <label className="select_user_label" htmlFor="user-name-input">
          Your name
        </label>
        <input
          id="user-name-input"
          className="select_user_input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Alice"
          autoFocus
          autoComplete="name"
        />
        <button
          type="submit"
          className="select_user_submit"
          disabled={name.trim() === ""}
        >
          Get Started
        </button>
      </form>
    </main>
  );
}
