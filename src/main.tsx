import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { api } from "../convex/_generated/api";
import App from "./App";
import SetupScreen from "./SetupScreen";
import "./styles.css";
import "./commonline.css";

const deploymentUrl = import.meta.env.VITE_CONVEX_URL?.trim();
const root = document.getElementById("root");
if (!root) throw new Error("The Commonline root element was not found.");

if (!deploymentUrl) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <SetupScreen />
    </React.StrictMode>,
  );
} else {
  const convex = new ConvexReactClient(deploymentUrl);
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ConvexAuthProvider
        client={convex}
        api={{
          refreshSession: api.auth.refreshSession,
          signOut: api.auth.signOut,
          isAuthenticated: api.auth.isAuthenticated,
        }}
      >
        <App />
      </ConvexAuthProvider>
    </React.StrictMode>,
  );
}
