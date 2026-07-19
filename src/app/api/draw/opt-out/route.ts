// ============================================================
// /api/draw/opt-out  (POST, admin) — set opted_out on all rows for a phone,
// used when a guest replies "stop" on WhatsApp (DPDP opt-out honouring).
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { INDIAN_MOBILE_RE } from "@/lib/draw";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const isAdmin = (role?: string) => role === "SUPER_ADMIN" || role === "ADMIN";

export async function POST(req: Request) {
  const session = await auth();
  const role = session?.user?.role;
  if (!role) return json({ error: "Unauthorized" }, 401);
  if (!isAdmin(role)) return json({ error: "Only an admin can opt a guest out." }, 403);

  let body: { phone?: unknown };
  try { body = (await req.json()) as { phone?: unknown }; } catch { return json({ error: "Invalid body." }, 400); }
  const phone = String(body.phone ?? "").replace(/\D/g, "");
  if (!INDIAN_MOBILE_RE.test(phone)) return json({ error: "A valid 10-digit phone is required." }, 422);

  const res = await prisma.drawEntry.updateMany({ where: { phone }, data: { optedOut: true } });
  await prisma.activityLog.create({
    data: {
      action: "DRAW_OPT_OUT", entityType: "DRAW_ENTRY", entityId: phone,
      userId: session!.user!.id, changes: { phone, rowsUpdated: res.count },
    },
  }).catch((e) => console.error("[DRAW_OPTOUT_LOG_ERROR]", e));

  return json({ ok: true, updated: res.count });
}
