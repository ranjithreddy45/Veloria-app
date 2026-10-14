import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { readFileValueBytes } from "@/lib/storage/data-url";

// ============================================================
// GET /api/hr/payslip-documents/[id] — one payslip FILE that HR uploaded.
// Opens inline (view) or, with ?download=1, as a download.
//
// AUTH: HR (hr:payroll) or the employee the payslip belongs to — the same rule
// as the server actions in hr-payslip-doc.actions.ts. A real URL rather than a
// data-URL handed to the browser, so it opens on phones and isn't eaten by a
// pop-up blocker.
// ============================================================

/** Only what upsertPayslipDocument accepts; anything else is served as a download. */
const SAFE_INLINE = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

const PRIVATE = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Please sign in to view this payslip.", { status: 401, headers: PRIVATE });

  const { id } = await params;
  const doc = await prisma.hrPayslipDocument.findUnique({
    where: { id },
    select: { employeeId: true, fileName: true, mimeType: true, data: true, year: true, month: true },
  });
  if (!doc) return new Response("Payslip not found.", { status: 404, headers: PRIVATE });

  const isHr = hasPermission(session?.user?.role ?? "", "hr:payroll");
  if (!isHr) {
    const me = await prisma.employee.findFirst({ where: { userId, deletedAt: null }, select: { id: true } });
    if (me?.id !== doc.employeeId) {
      return new Response("You are not allowed to view this payslip.", { status: 403, headers: PRIVATE });
    }
  }

  const bytes = await readFileValueBytes(doc.data);
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
