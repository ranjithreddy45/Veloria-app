import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const registerTokenSchema = z.object({
  token: z.string().min(1, "Token is required"),
  platform: z.enum(["ios", "android"]),
});

/**
 * POST /api/device-tokens
 *
 * Register a device push notification token for the authenticated user.
 * Upserts to avoid duplicates.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = registerTokenSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { token, platform } = parsed.data;

    // Upsert: create or update the token
    const deviceToken = await prisma.deviceToken.upsert({
      where: { token },
      update: {
        userId: session.user.id,
        platform,
        updatedAt: new Date(),
      },
      create: {
        token,
        platform,
        userId: session.user.id,
      },
    });

    return NextResponse.json(
      { success: true, id: deviceToken.id },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DeviceTokens] Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/device-tokens
 *
 * Remove a device token (e.g., on logout).
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Token parameter is required" },
        { status: 400 }
      );
    }

    await prisma.deviceToken.deleteMany({
      where: {
        token,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[DeviceTokens] Deletion error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
