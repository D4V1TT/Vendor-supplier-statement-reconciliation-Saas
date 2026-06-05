"use client";

/**
 * Wires Clerk's getToken() into the API client.
 * Waits until Clerk is fully loaded before marking the auth as ready
 * so no API call fires before a valid token is available.
 */

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { initApiAuth } from "@/lib/api";

export function ApiAuthProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    // Wrap getToken so it retries once if the first call returns null
    const safeGetToken = async () => {
      try {
        const token = await getToken();
        if (token) return token;
        // Retry once after a short wait (Clerk session can take a tick to hydrate)
        await new Promise(r => setTimeout(r, 300));
        return await getToken();
      } catch {
        return null;
      }
    };

    initApiAuth(safeGetToken);
  }, [isLoaded, isSignedIn, getToken]);

  return <>{children}</>;
}
