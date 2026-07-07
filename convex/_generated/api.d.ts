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
import type * as bitacoraEntries from "../bitacoraEntries.js";
import type * as financialProjections from "../financialProjections.js";
import type * as http from "../http.js";
import type * as inventoryItems from "../inventoryItems.js";
import type * as jarTestSessions from "../jarTestSessions.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as migrations from "../migrations.js";
import type * as operatorPermissions from "../operatorPermissions.js";
import type * as organizations from "../organizations.js";
import type * as paymentSettings from "../paymentSettings.js";
import type * as plans from "../plans.js";
import type * as plantSettings from "../plantSettings.js";
import type * as shiftRecords from "../shiftRecords.js";
import type * as subscriptions from "../subscriptions.js";
import type * as superAdmin from "../superAdmin.js";
import type * as testHelpers from "../testHelpers.js";
import type * as users from "../users.js";
import type * as visitas from "../visitas.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  bitacoraEntries: typeof bitacoraEntries;
  financialProjections: typeof financialProjections;
  http: typeof http;
  inventoryItems: typeof inventoryItems;
  jarTestSessions: typeof jarTestSessions;
  "lib/auth": typeof lib_auth;
  "lib/permissions": typeof lib_permissions;
  migrations: typeof migrations;
  operatorPermissions: typeof operatorPermissions;
  organizations: typeof organizations;
  paymentSettings: typeof paymentSettings;
  plans: typeof plans;
  plantSettings: typeof plantSettings;
  shiftRecords: typeof shiftRecords;
  subscriptions: typeof subscriptions;
  superAdmin: typeof superAdmin;
  testHelpers: typeof testHelpers;
  users: typeof users;
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
