import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./community.css";
import "./account.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
