import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { HelmetProvider } from "react-helmet-async";

// The static fallback lives beside (not inside) #root so server-rendered FAQ
// content can be injected into the empty mount point. Remove it immediately
// before React takes over for every route.
document.getElementById("app-bootstrap-fallback")?.remove();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>,
);
