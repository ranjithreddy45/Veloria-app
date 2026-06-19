"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { computePortfolio } from "@/lib/projects/portfolio";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}
function canRead(role?: string) { return !!role && hasPermission(role, "projects:read"); }

// Portfolio health/variance/risk across every in-flight venue project.
// Gated server action — the actual computation lives in a plain lib module
// (@/lib/projects/portfolio) so it is never exposed as an ungated RPC endpoint.
export async function getPortfolio() {
  const u = await requireUser();
  if (!canRead(u?.role)) return null;
  return computePortfolio();
}
