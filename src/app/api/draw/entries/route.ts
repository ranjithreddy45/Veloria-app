// ============================================================
// /api/draw/entries
//   POST  (public)      — guest submits a draw entry
//   GET   (staff auth)  — paginated entry register
// ============================================================

import { headers } from "next/headers";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { clientIpFromHeaders } from "@/lib/hr/geo";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { reportSystemFailure } from "@/lib/ops-alert";
import {
  validateDrawEntry, formatEntryCode, hashDrawIp, DRAW_SOURCES, drawEventLabel,
} from "@/lib/draw";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

// ---- POST (public) --------------------------------------------------------
export async function POST(req: Request) {
  const h = await headers();
  const ip = clientIpFromHeaders(h.get("x-forwarded-for"), h.get("x-real-ip")) || "unknown";

  // Rate limit: 10/hour/IP. Venue Wi-Fi NAT means one IP serves many guests, so
  // this is deliberately generous; the (phone,event_date) unique constraint is
  // the real per-guest guard.
  const rl = checkRateLimit(`draw:entry:${ip}`, { maxRequests: 10, windowSeconds: 3600 });
  if (!rl.success) return rateLimitResponse(rl.resetIn);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const v = validateDrawEntry(body);
  if (!v.ok) {
    // Consent missing is a 422 per spec; other field errors also 422.
    return json({ error: v.error, field: v.field }, 422);
  }

  // Global circuit breaker: >200 entries/hour → alert ops (do NOT block guests).
  try {
    const lastHour = await prisma.drawEntry.count({ where: { createdAt: { gte: new Date(Date.now() - 3600e3) } } });
    if (lastHour + 1 > 200) {
      void reportSystemFailure({
        area: "Guest Draw",
        title: "Unusual draw-entry volume",
        detail: `${lastHour + 1} draw entries in the last hour — possible abuse or a viral standee. Entries are still accepted; review /admin/draw.`,
        actionUrl: "/admin/draw",
      });
    }
  } catch { /* metric only — never block a guest */ }

  const url = new URL(req.url);
  const srcParam = (url.searchParams.get("src") || body.source || "qr") as string;
  const source = DRAW_SOURCES.has(srcParam) ? srcParam : "qr";
  const ipHash = hashDrawIp(ip);

  try {
    // Insert then stamp the human entry code from the PK (unique + monotonic),
    // both in one transaction so a code is never missing or duplicated.
    const entryCode = await prisma.$transaction(async (tx) => {
      const created = await tx.drawEntry.create({
        data: {
          entryCode: `pending-${randomUUID()}`, // unique placeholder; replaced with VG-<id> below
          guestName: v.data.guestName,
          phone: v.data.phone,
          hostName: v.data.hostName,
          eventType: v.data.eventType,
          eventDate: v.data.eventDate,
          consentWhatsapp: true,
          consentTs: new Date(),
          source,
          ipHash,
        },
        select: { id: true },
      });
      const code = formatEntryCode(created.id);
      await tx.drawEntry.update({ where: { id: created.id }, data: { entryCode: code } });
      return code;
    });
    return json({ entry_code: entryCode }, 201);
  } catch (e) {
    // Unique (phone, event_date) → duplicate entry for this guest+event.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return json({ error: "This number has already entered for this event.", field: "phone" }, 409);
    }
    console.error("[DRAW_ENTRY_ERROR]", e);
    return json({ error: "Could not save your entry. Please try again." }, 500);
  }
}

// ---- GET (staff auth) -----------------------------------------------------
export async function GET(req: Request) {
  const session = await auth();
  const role = session?.user?.role;
  if (!role) return json({ error: "Unauthorized" }, 401);
  if (!hasPermission(role, "bookings:read")) return json({ error: "Forbidden" }, 403);

  const url = new URL(req.url);
  const month = url.searchParams.get("month"); // YYYY-MM
  const page = Math.max(1, Number(url.searchParams.get("page") || 1) || 1);
  const perPage = Math.min(200, Math.max(1, Number(url.searchParams.get("per_page") || 50) || 50));
  const q = (url.searchParams.get("q") || "").trim();

  const where: Prisma.DrawEntryWhereInput = {};
  if (month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    const { drawMonthRange } = await import("@/lib/draw");
    const { start, end } = drawMonthRange(month);
    where.createdAt = { gte: start, lt: end };
  }
  if (q) {
    where.OR = [
      { guestName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { hostName: { contains: q, mode: "insensitive" } },
    ];
  }

  const nowMonth = new Date();
  const { drawMonthKey, drawMonthRange } = await import("@/lib/draw");
  const thisMonth = drawMonthRange(drawMonthKey(nowMonth));

  const [rows, total, monthCount] = await Promise.all([
    prisma.drawEntry.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * perPage, take: perPage,
    }),
    prisma.drawEntry.count({ where }),
    prisma.drawEntry.count({ where: { createdAt: { gte: thisMonth.start, lt: thisMonth.end } } }),
  ]);

  return json({
    data: rows.map((r) => ({
      id: r.id, entry_code: r.entryCode, guest_name: r.guestName, phone: r.phone,
      host_name: r.hostName, event_type: r.eventType, event_type_label: drawEventLabel(r.eventType),
      event_date: r.eventDate.toISOString().slice(0, 10), consent_ts: r.consentTs.toISOString(),
      opted_out: r.optedOut, source: r.source, created_at: r.createdAt.toISOString(),
    })),
    total, month_count: monthCount, page, per_page: perPage,
  });
}
