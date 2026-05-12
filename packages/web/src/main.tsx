import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "primereact/resources/primereact.min.css";
import "primereact/resources/themes/lara-light-indigo/theme.css";
import "primeicons/primeicons.css";
import "./styles/global.css";
import { App } from "./App.js";

const rootEl = document.getElementById("root");
if (rootEl === null) throw new Error("Missing #root element");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
