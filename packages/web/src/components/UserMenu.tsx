import { useRef, type FocusEvent } from "react";
import "./UserMenu.css";

interface UserMenuProps {
  readonly userName: string;
  readonly onProfile: () => void;
}

export function UserMenu({ userName, onProfile }: UserMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  function close() {
    if (detailsRef.current) detailsRef.current.open = false;
  }

  function handleBlur(e: FocusEvent<HTMLDetailsElement>) {
    const related = e.relatedTarget instanceof Node ? e.relatedTarget : null;
    if (!e.currentTarget.contains(related)) close();
  }

  function handleProfile() {
    close();
    onProfile();
  }

  return (
    <details ref={detailsRef} className="user-menu" onBlur={handleBlur}>
      <summary className="user-menu-trigger" aria-label={`User menu for ${userName}`}>
        {userName} ▾
      </summary>
      <div className="user-menu-dropdown" role="menu">
        <button className="user-menu-item" role="menuitem" onClick={handleProfile}>
          Profile settings
        </button>
      </div>
    </details>
  );
}
