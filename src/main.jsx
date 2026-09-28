import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./components/App.jsx";
import { initAnalytics } from "./analytics.js";
import "./styles/index.css";
import "./pwa.js";

initAnalytics();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
