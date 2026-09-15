import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// ============================================================
// HelpChip: customers reach the numbers the team keeps in Settings → Business
// contact (getPublicContact(), passed down by the page). The build-time
// constants are only the fallback for a caller that passes nothing, never a
// per-field top-up, and support hours show only when they are published.
// ============================================================

vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  COMPANY_PHONE: "080 4000 1234",
  COMPANY_WHATSAPP: "919800000001",
}));

import { HelpChip, helpChipChannels } from "./help-chip";

const published = { phone: "+919812345678", whatsapp: "+919876543210", supportHours: "10am–7pm, Mon–Sat" };

describe("helpChipChannels", () => {
  it("links the numbers the team published", () => {
    expect(helpChipChannels(published, "Hold for 20 June")).toEqual({
      waHref: "https://wa.me/919876543210?text=Hold%20for%2020%20June",
      telHref: "tel:+919812345678",
      supportHours: "10am–7pm, Mon–Sat",
    });
  });

  it("hides a channel the published contact doesn't have instead of topping it up from the constants", () => {
    expect(helpChipChannels({ phone: null, whatsapp: "+919876543210", supportHours: null })).toEqual({
      waHref: "https://wa.me/919876543210",
      telHref: null,
      supportHours: null,
    });
  });

  it("has nothing to show when the published contact has no number, even with hours set", () => {
    expect(helpChipChannels({ phone: null, whatsapp: "  ", supportHours: "10am–7pm" })).toBeNull();
  });

  it("falls back to the configured constants only when no contact is passed", () => {
    const fallback = { waHref: "https://wa.me/919800000001", telHref: "tel:+918040001234", supportHours: null };
    expect(helpChipChannels(undefined)).toEqual(fallback);
    expect(helpChipChannels(null)).toEqual(fallback);
  });
});

describe("<HelpChip>", () => {
  it("renders nothing when no number is published", () => {
    const html = renderToStaticMarkup(
      createElement(HelpChip, { variant: "banner", contact: { phone: null, whatsapp: null, supportHours: "10am–7pm" } })
    );
    expect(html).toBe("");
  });

  it("shows support hours only when they are published", () => {
    const withHours = renderToStaticMarkup(createElement(HelpChip, { variant: "banner", contact: published }));
    expect(withHours).toContain('href="https://wa.me/919876543210"');
    expect(withHours).toContain('href="tel:+919812345678"');
    expect(withHours).toContain("Support hours: 10am–7pm, Mon–Sat");

    const withoutHours = renderToStaticMarkup(createElement(HelpChip, { contact: { ...published, supportHours: null } }));
    expect(withoutHours).toContain('href="tel:+919812345678"');
    expect(withoutHours).not.toContain("Support hours");
  });
});
