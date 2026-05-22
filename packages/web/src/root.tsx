import { type ReactNode } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useNavigate } from "react-router";
import "primereact/resources/themes/lara-light-indigo/theme.css";
import "primereact/resources/primereact.css";
import "primeicons/primeicons.css";
import "./styles/global.css";
import { useUser } from "./hooks/useUser.js";
import { useYjsDoc } from "./hooks/useYjsDoc.js";
import { DocContext } from "./contexts/docContext.js";
import { NavMenu } from "./components/NavMenu.js";
import { UserMenu } from "./components/UserMenu.js";
import { SelectUserPage } from "./pages/SelectUserPage.js";

export interface RootContext {
  readonly userName: string;
  readonly onRename: (name: string) => void;
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Recipe Book</title>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

interface AuthenticatedShellProps {
  readonly userName: string;
  readonly onRename: (name: string) => void;
}

function AuthenticatedShell({ userName, onRename }: AuthenticatedShellProps) {
  const doc = useYjsDoc(userName);
  const navigate = useNavigate();

  return (
    <DocContext.Provider value={doc}>
      <div className="app">
        <header className="top-nav">
          <NavMenu />
          <span className="app-title">Recipe Book</span>
          <div className="nav-right">
            <button className="undo-btn" aria-label="Undo">
              ↩ Undo
            </button>
            <UserMenu userName={userName} onProfile={() => navigate("/profile")} />
          </div>
        </header>
        <Outlet context={{ userName, onRename } satisfies RootContext} />
      </div>
    </DocContext.Provider>
  );
}

export default function Root() {
  const { userName, setUserName } = useUser();

  if (userName === null) {
    return <SelectUserPage onSelect={setUserName} />;
  }

  return <AuthenticatedShell key={userName} userName={userName} onRename={setUserName} />;
}
