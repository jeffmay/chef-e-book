import { useState, type FormEvent } from "react";
import "./profile_settings_page.css";

interface ProfileSettingsPageProps {
  readonly currentName: string;
  readonly onSave: (name: string) => void;
  readonly onCancel: () => void;
}

export function ProfileSettingsPage({
  currentName,
  onSave,
  onCancel,
}: ProfileSettingsPageProps) {
  const [name, setName] = useState(currentName);
  const trimmed = name.trim();
  const isUnchanged = trimmed === currentName;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (trimmed !== "" && !isUnchanged) onSave(trimmed);
  }

  return (
    <main className="profile_settings_page">
      <h1 className="profile_settings_title">Profile Settings</h1>
      <form className="profile_settings_form" onSubmit={handleSubmit}>
        <label className="profile_settings_label" htmlFor="profile-name-input">
          Your name
        </label>
        <input
          id="profile-name-input"
          className="profile_settings_input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
        <div className="profile_settings_actions">
          <button
            type="submit"
            className="profile_settings_save"
            disabled={trimmed === "" || isUnchanged}
          >
            Save
          </button>
          <button type="button" className="profile_settings_cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}
