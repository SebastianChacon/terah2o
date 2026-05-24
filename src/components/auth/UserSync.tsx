"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";

/**
 * Fires upsertCurrentUser once per session when BOTH Clerk and Convex are authenticated.
 * Runs earlier and more reliably than calling upsert inside completeSession because it
 * waits for Convex's auth layer to have a valid token (identity.subject will be set).
 *
 * Mounted at the app root so it catches every page load, not just the login page.
 */
export function UserSync() {
  const { isAuthenticated } = useConvexAuth();
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const upsert = useMutation(api.users.upsertCurrentUser);
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !clerkLoaded || !clerkUser) return;
    if (syncedRef.current) return;
    syncedRef.current = true;

    const email = clerkUser.primaryEmailAddress?.emailAddress;
    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || undefined;

    upsert({ email, name }).catch(() => {
      // Non-fatal — will retry on next page load
      syncedRef.current = false;
    });
  }, [isAuthenticated, clerkLoaded, clerkUser, upsert]);

  return null;
}
