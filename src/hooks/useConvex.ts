"use client";

/**
 * Safe wrappers around Convex hooks that gracefully handle
 * when ConvexProvider is not available (NEXT_PUBLIC_CONVEX_URL not set).
 *
 * After running `npx convex dev` and setting the URL, these hooks
 * behave identically to the originals.
 */

import {
    useMutation as useConvexMutation,
    useQuery as useConvexQuery,
} from "convex/react";
import type { FunctionReference } from "convex/server";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Check if ConvexProvider is available by testing the env var.
 */
function isConvexAvailable(): boolean {
    return !!process.env.NEXT_PUBLIC_CONVEX_URL;
}

/**
 * Safe useMutation — returns a no-op function when Convex is not configured.
 */
export function useSafeMutation<T extends FunctionReference<"mutation", any, any, any>>(
    fn: T
): (...args: any[]) => Promise<any> {
    if (!isConvexAvailable()) {
        return async () => {
            console.warn("[TeraH2O] Convex not configured — mutation skipped. Run `npx convex dev` to enable.");
        };
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useConvexMutation(fn);
}

/**
 * Safe useQuery — returns undefined when Convex is not configured.
 */
export function useSafeQuery<T extends FunctionReference<"query", any, any, any>>(
    fn: T,
    ...args: any[]
): any {
    if (!isConvexAvailable()) {
        return undefined;
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useConvexQuery(fn, ...args);
}
