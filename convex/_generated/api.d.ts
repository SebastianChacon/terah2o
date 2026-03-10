/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as bitacoraEntries from "../bitacoraEntries.js";
import type * as financialProjections from "../financialProjections.js";
import type * as inventoryItems from "../inventoryItems.js";
import type * as jarTestSessions from "../jarTestSessions.js";
import type * as plantSettings from "../plantSettings.js";
import type * as shiftRecords from "../shiftRecords.js";
import type * as visitas from "../visitas.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  bitacoraEntries: typeof bitacoraEntries;
  financialProjections: typeof financialProjections;
  inventoryItems: typeof inventoryItems;
  jarTestSessions: typeof jarTestSessions;
  plantSettings: typeof plantSettings;
  shiftRecords: typeof shiftRecords;
  visitas: typeof visitas;
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

export declare const components: {};
