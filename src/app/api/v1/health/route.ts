import { NextResponse } from "next/server";
import { PUSH_API_SERVICE, PUSH_API_VERSION } from "@/lib/push-api/config";

// GET /api/v1/health — liveness for integrators. Deliberately says nothing about
// the database, crons or hosts; the team's own /api/health covers those.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { status: "ok", service: PUSH_API_SERVICE, version: PUSH_API_VERSION },
    { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }
  );
}
