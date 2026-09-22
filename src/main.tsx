import React from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./App";
import "./styles.css";
const url=import.meta.env.VITE_CONVEX_URL;
createRoot(document.getElementById("root")!).render(url?<ConvexAuthProvider client={new ConvexReactClient(url)}><App/></ConvexAuthProvider>:<div className="splash"><h1>Regretless</h1><p>This site is not configured yet.</p></div>);
