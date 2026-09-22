/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as catalog from "../catalog.js";
import type * as claims from "../claims.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_eligibility from "../lib/eligibility.js";
import type * as lib_firecrawl from "../lib/firecrawl.js";
import type * as mail from "../mail.js";
import type * as monitoring from "../monitoring.js";
import type * as pipeline from "../pipeline.js";
import type * as pipelineStore from "../pipelineStore.js";
import type * as purchases from "../purchases.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  catalog: typeof catalog;
  claims: typeof claims;
  crons: typeof crons;
  http: typeof http;
  "lib/access": typeof lib_access;
  "lib/eligibility": typeof lib_eligibility;
  "lib/firecrawl": typeof lib_firecrawl;
  mail: typeof mail;
  monitoring: typeof monitoring;
  pipeline: typeof pipeline;
  pipelineStore: typeof pipelineStore;
  purchases: typeof purchases;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
