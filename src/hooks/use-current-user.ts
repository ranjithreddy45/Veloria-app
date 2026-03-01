"use client";

import { useSession } from "next-auth/react";
import type { ExtendedUser } from "@/types/next-auth";

/**
 * Client-side hook to get the current authenticated user.
 * Returns the user object with `id` and `role` fields
 * from the extended NextAuth session.
 */
export function useCurrentUser() {
  const { data: session, status } = useSession();

  return {
    user: session?.user as ExtendedUser | undefined,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
  };
}
