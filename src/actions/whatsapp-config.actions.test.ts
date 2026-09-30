import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// Settings → WhatsApp → Test Connection. The action used to drop the AiSensy
// credentials on the way to testWhatsAppConnection, so an AiSensy account
// always got "Enter the AiSensy Project ID and API password first." It now
// passes them, plus the templates the app sends for the approved-list check.
// ============================================================

const { db, authMock, testWhatsAppConnection } = vi.hoisted(() => ({
  db: {
    whatsAppConfig: { findFirst: vi.fn() },
    autoWelcomeConfig: { findMany: vi.fn() },
  },
  authMock: vi.fn(),
  testWhatsAppConnection: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/../auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/permissions", () => ({ hasPermission: () => true }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/integrations/whatsapp", () => ({ testWhatsAppConnection }));

import { testWhatsAppConnectionAction } from "./whatsapp-config.actions";

const AISENSY_CONFIG = {
  id: "cfg1",
  provider: "AISENSY",
  accessToken: "",
  phoneNumberId: null,
  businessAccountId: null,
  appSecret: null,
  apiEndpoint: null,
  verifyToken: "tok",
  aisensyProjectId: "proj_1",
  aisensyApiPassword: "pwd_1",
  aisensyApiEndpoint: "https://apis.aisensy.com/project-apis/v1",
  otpTemplateName: "login_code",
  otpTemplateLanguage: "en_US",
  bookingUpdateTemplateName: "booking_update",
  guestInviteTemplateName: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
  db.whatsAppConfig.findFirst.mockResolvedValue(AISENSY_CONFIG);
  db.autoWelcomeConfig.findMany.mockResolvedValue([{ templateName: "welcome_meta" }]);
  testWhatsAppConnection.mockResolvedValue({ success: true, message: "Connected to AiSensy project proj_1." });
});

describe("testWhatsAppConnectionAction", () => {
  it("passes the AiSensy credentials through", async () => {
    const res = await testWhatsAppConnectionAction();

    expect(res).toEqual({ success: true, data: { message: "Connected to AiSensy project proj_1.", phoneNumber: undefined } });
    expect(testWhatsAppConnection.mock.calls[0][0]).toMatchObject({
      provider: "AISENSY",
      aisensyProjectId: "proj_1",
      aisensyApiPassword: "pwd_1",
      aisensyApiEndpoint: "https://apis.aisensy.com/project-apis/v1",
    });
  });

  it("checks the configured, auto-welcome and fixed templates, the OTP one in its own language", async () => {
    await testWhatsAppConnectionAction();

    expect(db.autoWelcomeConfig.findMany).toHaveBeenCalledWith({ where: { isEnabled: true }, select: { templateName: true } });
    const required = testWhatsAppConnection.mock.calls[0][1] as { name: string; language: string }[];
    expect(required.slice(0, 3)).toEqual([
      { name: "login_code", language: "en_US" },
      { name: "booking_update", language: "en" },
      { name: "welcome_meta", language: "en" },
    ]);
    expect(required.map((r) => r.name)).toEqual(
      expect.arrayContaining(["review_request", "referral_invite", "event_reminder", "tomorrow_reminder", "winback_event_proximity"])
    );
  });

  it("leaves Meta and Weflux tests as they were", async () => {
    db.whatsAppConfig.findFirst.mockResolvedValue({ ...AISENSY_CONFIG, provider: "WEFLUX" });
    await testWhatsAppConnectionAction();
    expect(db.autoWelcomeConfig.findMany).not.toHaveBeenCalled();
    expect(testWhatsAppConnection.mock.calls[0][1]).toEqual([]);
  });

  it("reports a failed test as an error", async () => {
    testWhatsAppConnection.mockResolvedValue({ success: false, message: "AiSensy HTTP 401 [ERR401]: Invalid password [REDACTED]" });
    await expect(testWhatsAppConnectionAction()).resolves.toEqual({
      success: false,
      error: "AiSensy HTTP 401 [ERR401]: Invalid password [REDACTED]",
    });
  });
});
