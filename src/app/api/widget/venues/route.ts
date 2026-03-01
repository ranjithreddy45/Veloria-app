import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ============================================================
// GET: List Active Venues (Public — No Auth Required)
// ============================================================

export async function GET() {
  try {
    const venues = await prisma.venue.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        capacity: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: venues,
    });
  } catch (error) {
    console.error("[WIDGET_VENUES_GET_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch venues" },
      { status: 500 }
    );
  }
}
