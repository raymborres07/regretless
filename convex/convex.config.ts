import { defineApp } from "convex/server";
import staticHosting from "@convex-dev/static-hosting/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";

// Preserve root auth endpoints; http.ts registers the static catch-all last.
const app = defineApp();
app.use(staticHosting);
app.use(rateLimiter);

export default app;
