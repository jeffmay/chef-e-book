import "./UserMenu.css";

interface UserMenuProps {
  readonly userName: string;
  readonly onProfile: () => void;
}

export function UserMenu({ userName, onProfile }: UserMenuProps) {
  return (
    <details className="user-menu">
      <summary className="user-menu-trigger" aria-label={`User menu for ${userName}`}>
        {userName} ▾
      </summary>
      <div className="user-menu-dropdown" role="menu">
        <button
          className="user-menu-item"
          role="menuitem"
          onClick={onProfile}
        >
          Profile settings
        </button>
      </div>
    </details>
  );
}
