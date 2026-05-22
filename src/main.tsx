import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "../invoice_ai_sme";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
