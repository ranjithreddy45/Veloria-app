import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const findFirst = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { whatsAppConfig: { findFirst } } }));
vi.mock("@/lib/whatsapp/inbound-pipeline", () => ({ processMetaWebhookPayload: vi.fn() }));
vi.mock("@/lib/whatsapp/inbound-capture", () => ({ captureInboundEvent: vi.fn(), updateInboundEvent: vi.fn(), errorMessage: vi.fn() }));

import { GET } from "./route";

const verify = (token: string) =>
  GET(new NextRequest(`http://x/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=42`));

describe("WhatsApp webhook verification (R1-5)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("refuses verification when no token is configured — no hard-coded fallback", async () => {
    vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "");
    findFirst.mockResolvedValue(null);
    expect((await verify("veloria_whatsapp_verify")).status).toBe(403);
    expect((await verify("")).status).toBe(403);
  });

  it("accepts the configured token", async () => {
    findFirst.mockResolvedValue({ verifyToken: "s3cret", appSecret: null });
    const res = await verify("s3cret");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("42");
  });
});
