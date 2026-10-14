import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { sessionAllows } from "@/lib/permission-claims";
import { readFileValueBytes } from "@/lib/storage/data-url";

// ============================================================
// GET /api/hr/payslip-documents/[id] — one payslip FILE that HR uploaded.
// Opens inline (view) or, with ?download=1, as a download.
//
// AUTH: HR (hr:payroll, override-aware like middleware) or the employee the
// payslip belongs to, signed in with a STAFF login — a customer/vendor portal
// account that ended up linked to an employee record (auto-link by email)
// must not get salary documents. Same rule as hr-payslip-doc.actions.ts. A
// real URL rather than a data-URL handed to the browser, so it opens on phones
// and isn't eaten by a pop-up blocker.
// ============================================================

/** Only what upsertPayslipDocument accepts; anything else is served as a download. */
const SAFE_INLINE = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

/** Portal logins: never treated as the employee, whatever Employee.userId says. */
const PORTAL_ROLES = new Set(["CLIENT", "VENDOR"]);

const PRIVATE = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    // A link opened from a notification or a bookmark after the session lapsed.
    return Response.redirect(new URL("/sign-in?callbackUrl=/me/payslips", request.url), 302);
  }

  const { id } = await params;
  // Metadata first; the file bytes are read only once access is settled.
  const doc = await prisma.hrPayslipDocument.findUnique({
    where: { id },
    select: { employeeId: true, fileName: true, mimeType: true, year: true, month: true },
  });
  if (!doc) return new Response("Payslip not found.", { status: 404, headers: PRIVATE });

  const isHr = sessionAllows(session, "hr:payroll");
  if (!isHr) {
    const role = session?.user?.role ?? "";
    const me = PORTAL_ROLES.has(role)
      ? null
      : await prisma.employee.findFirst({ where: { userId, deletedAt: null }, select: { id: true } });
    if (!me || me.id !== doc.employeeId) {
      return new Response("You are not allowed to view this payslip.", { status: 403, headers: PRIVATE });
    }
  }

  const row = await prisma.hrPayslipDocument.findUnique({ where: { id }, select: { data: true } });
  const bytes = row ? await readFileValueBytes(row.data) : null;
  if (!bytes) return new Response("This payslip file could not be read.", { status: 500, headers: PRIVATE });

  const type = SAFE_INLINE.has(doc.mimeType) ? doc.mimeType : "application/octet-stream";
  const download = new URL(request.url).searchParams.get("download") === "1" || type === "application/octet-stream";
  const ext = doc.fileName.includes(".") ? doc.fileName.slice(doc.fileName.lastIndexOf(".")) : "";
  const name = `Payslip-${doc.year}-${String(doc.month).padStart(2, "0")}${ext}`.replace(/[^\w.-]/g, "");

  return new Response(new Uint8Array(bytes.buffer), {
    status: 200,
    headers: {
      ...PRIVATE,
      "Content-Type": type,
      "Content-Length": String(bytes.buffer.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
    },
  });
}
