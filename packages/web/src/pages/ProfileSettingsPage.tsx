import { useState, type FormEvent } from "react";
import "./ProfileSettingsPage.css";

interface ProfileSettingsPageProps {
  readonly currentName: string;
  readonly onSave: (name: string) => void;
  readonly onCancel: () => void;
}

export function ProfileSettingsPage({ currentName, onSave, onCancel }: ProfileSettingsPageProps) {
  const [name, setName] = useState(currentName);
  const trimmed = name.trim();
  const isUnchanged = trimmed === currentName;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (trimmed !== "" && !isUnchanged) onSave(trimmed);
  }

  return (
    <main className="profile-settings-page">
      <h1 className="page-title">Profile Settings</h1>
      <form className="profile-settings-form" onSubmit={handleSubmit}>
        <label className="profile-settings-label" htmlFor="profile-name-input">
          Your name
        </label>
        <input
          id="profile-name-input"
          className="profile-settings-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
        <div className="profile-settings-actions">
          <button
            type="submit"
            className="profile-settings-save"
            disabled={trimmed === "" || isUnchanged}
          >
            Save
          </button>
          <button type="button" className="profile-settings-cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}
