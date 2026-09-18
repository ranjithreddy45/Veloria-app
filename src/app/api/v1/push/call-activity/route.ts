import { pushCallActivityEndpoint } from "@/lib/push-api/calls/endpoint";

// POST /api/v1/push/call-activity — see src/lib/push-api/pipeline.ts for the
// request flow and /api/v1/docs for the contract.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const { POST, OPTIONS } = pushCallActivityEndpoint;
