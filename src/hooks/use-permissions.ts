"use client";

import { useCurrentUser } from "@/hooks/use-current-user";
import {
  hasPermission,
  getUserPermissions,
  type Permission,
} from "@/lib/permissions";

/**
 * Client-side hook for permission checking based on the
 * current user's role.
 *
 * @example
 * ```tsx
 * const { can, hasPermission } = usePermissions();
 *
 * if (can("bookings:create")) {
 *   // show create booking button
 * }
 * ```
 */
export function usePermissions() {
  const { user } = useCurrentUser();
  const role = user?.role;

  return {
    /**
     * Check if the current user has a specific permission.
     */
    hasPermission: (permission: Permission): boolean => {
      if (!role) return false;
      return hasPermission(role, permission);
    },

    /**
     * Alias for hasPermission — reads more naturally in JSX.
     */
    can: (permission: Permission): boolean => {
      if (!role) return false;
      return hasPermission(role, permission);
    },

    /**
     * All permissions available to the current user's role.
     */
    permissions: role ? getUserPermissions(role) : [],
  };
}
