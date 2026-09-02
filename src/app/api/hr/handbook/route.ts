import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/hr/handbook — stream the current Employee Handbook PDF.
 * Any signed-in user may read it (the handbook exists to be read by every
 * staff member); managing it is gated in handbook.actions (hr:write).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to read the handbook." }, { status: 401 });
  }

  const doc = await prisma.document.findFirst({
    where: { category: "HANDBOOK" },
    orderBy: { createdAt: "desc" },
    select: { url: true, fileName: true },
  });
  if (!doc?.url || !doc.url.startsWith("data:application/pdf;base64,")) {
    return NextResponse.json({ error: "No handbook is published." }, { status: 404 });
  }

  const b64 = doc.url.slice(doc.url.indexOf(",") + 1);
  const bytes = Buffer.from(b64, "base64");
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="${doc.fileName || "employee-handbook.pdf"}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
