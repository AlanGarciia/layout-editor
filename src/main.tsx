import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import LayerEditor from "./LayerEditor.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LayerEditor />
  </StrictMode>
);