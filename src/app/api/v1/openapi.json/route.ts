import { NextResponse } from "next/server";
import { buildOpenApiDocument } from "@/lib/push-api/openapi";

// GET /api/v1/openapi.json — the Push API contract, public by design: it holds
// no secrets and integrators need it before they have a key.
export const dynamic = "force-dynamic";

function publicBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://app.theveloriagrand.com").replace(/\/+$/, "");
}

export function GET() {
  return NextResponse.json(buildOpenApiDocument(publicBaseUrl()), {
    headers: { "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" },
  });
}
