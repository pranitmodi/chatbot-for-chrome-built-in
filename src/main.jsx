import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./components/App.jsx";
import "./styles/index.css";
import "./pwa.js";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
