import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/global.css";
import { App } from "./App.js";

const root_el = document.getElementById("root");
if (root_el === null) throw new Error("Missing #root element");

createRoot(root_el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
