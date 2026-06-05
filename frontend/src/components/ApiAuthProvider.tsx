"use client";

/**
 * Mounts once inside ClerkProvider.
 * Wires Clerk's getToken() into the API client so every api.* call
 * automatically gets a fresh JWT without any manual token management.
 */

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { initApiAuth } from "@/lib/api";

export function ApiAuthProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();

  useEffect(() => {
    initApiAuth(getToken as () => Promise<string | null>);
  }, [getToken]);

  return <>{children}</>;
}
