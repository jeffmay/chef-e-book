import { useOutletContext, useNavigate } from "react-router";
import { ProfileSettingsPage } from "../pages/ProfileSettingsPage.js";
import type { RootContext } from "../root.js";

export default function Profile() {
  const { userName, onRename } = useOutletContext<RootContext>();
  const navigate = useNavigate();

  return (
    <ProfileSettingsPage
      currentName={userName}
      onSave={(name) => {
        onRename(name);
        navigate("/dashboard");
      }}
      onCancel={() => navigate("/dashboard")}
    />
  );
}
