import { describe, expect, it, vi } from "vitest";

// Sign-in rules only: no database (createCustomerLogin gets a fake transaction),
// no WhatsApp. Heavy imports are stubbed.
vi.mock("@/lib/prisma", () => ({ prisma: {}, default: {} }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ success: true, remaining: 1, resetIn: 0 }),
}));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsApp: vi.fn() }));
vi.mock("@/lib/activity-logger", () => ({ logActivity: vi.fn() }));
vi.mock("next-auth", () => ({
  CredentialsSignin: class CredentialsSignin extends Error {
    code = "credentials";
  },
}));

import {
  clientIpOf,
  contactHasActivity,
  createCustomerLogin,
  decideOtpLogin,
  decideStaffGrant,
  isSameOtpPhone,
  isUndeliverableEmail,
  isValidOtpPhone,
  maskPhone,
  normalizeOtpPhone,
  placeholderLoginEmail,
  planCollaboratorActivation,
  shouldSendLoginCode,
  type OtpCollaboratorFact,
  type OtpFacts,
} from "./otp";

const N = "919876543210";

const user = (id: string, role = "CLIENT", isActive = true) => ({ id, role, isActive });
const contact = (id: string, hasActivity = true) => ({ id, hasActivity });
const invite = (id: string, over: Partial<OtpCollaboratorFact> = {}): OtpCollaboratorFact => ({
  id,
  bookingId: `booking-${id}`,
  status: "INVITED",
  role: "CO_HOST",
  userId: null,
  name: null,
  bookingLive: true,
  ...over,
});
const facts = (over: Partial<OtpFacts> = {}): OtpFacts => ({
  users: [],
  contacts: [],
  collaborators: [],
  ...over,
});

describe("phone numbers", () => {
  it("reads every common way of writing one Indian mobile as the same number", () => {
    for (const raw of ["9876543210", "09876543210", "+91 98765 43210", "91-98765-43210", "(+91) 98765 43210"]) {
      expect(normalizeOtpPhone(raw)).toBe(N);
      expect(isSameOtpPhone(raw, N)).toBe(true);
    }
  });

  it("never matches across countries on the last ten digits", () => {
    const us = normalizeOtpPhone("+1 415 555 2671");
    expect(us).toBe("14155552671");
    expect(isSameOtpPhone("4155552671", us)).toBe(false);
    expect(isSameOtpPhone("+91 41555 52671", us)).toBe(false);
    expect(isSameOtpPhone("+1 (415) 555-2671", us)).toBe(true);
  });

  it("only accepts full numbers, and masks them in logs", () => {
    expect(isValidOtpPhone(N)).toBe(true);
    expect(isValidOtpPhone("9876543210")).toBe(false);
    expect(isValidOtpPhone("12345")).toBe(false);
    expect(isSameOtpPhone(null, N)).toBe(false);
    expect(maskPhone(N)).toBe("91******3210");
  });
});

describe("decideOtpLogin: who a verified code signs in", () => {
  it("keeps today's behaviour: the one active login on the number, role untouched", () => {
    expect(decideOtpLogin(facts({ users: [user("u1", "SALES_EXEC")] }))).toEqual({
      kind: "EXISTING_USER",
      userId: "u1",
      linkContactId: null,
      collaboratorIds: [],
    });
  });

  it("links an existing customer login to the single contact that has done business with us", () => {
    const d = decideOtpLogin(facts({ users: [user("u1")], contacts: [contact("c1"), contact("c2", false)] }));
    expect(d).toMatchObject({ kind: "EXISTING_USER", userId: "u1", linkContactId: "c1" });
  });

  it("never links a team login to a customer's contact by phone", () => {
    const d = decideOtpLogin(facts({ users: [user("u1", "STAFF")], contacts: [contact("c1")] }));
    expect(d).toMatchObject({ kind: "EXISTING_USER", linkContactId: null });
  });

  it("creates a customer login for exactly one contact with a booking, lead or quotation", () => {
    expect(decideOtpLogin(facts({ contacts: [contact("c1"), contact("c2", false)] }))).toEqual({
      kind: "NEW_CUSTOMER",
      linkContactId: "c1",
      collaboratorIds: [],
    });
  });

  it("sends nothing and signs in nobody when the number isn't on our records", () => {
    for (const f of [facts(), facts({ contacts: [contact("c1", false)] })]) {
      const d = decideOtpLogin(f);
      expect(d).toEqual({ kind: "REFUSE", reason: "NO_RECORD" });
      expect(shouldSendLoginCode(d)).toBe(false);
    }
  });

  it("refuses when several contacts share the number, but sends the code so the holder is told to contact the venue", () => {
    const d = decideOtpLogin(facts({ contacts: [contact("c1"), contact("c2")] }));
    expect(d).toEqual({ kind: "REFUSE", reason: "SHARED_NUMBER" });
    expect(shouldSendLoginCode(d)).toBe(true);
  });

  it("treats a capped contact lookup as shared, without blocking an existing login", () => {
    expect(decideOtpLogin(facts({ contacts: [contact("c1")], contactsTruncated: true }))).toEqual({
      kind: "REFUSE",
      reason: "SHARED_NUMBER",
    });
    expect(
      decideOtpLogin(facts({ users: [user("u1")], contacts: [contact("c1")], contactsTruncated: true }))
    ).toMatchObject({ kind: "EXISTING_USER", linkContactId: null });
  });

  it("gives an invited collaborator a login for their invites only, even when contacts share the number", () => {
    expect(decideOtpLogin(facts({ collaborators: [invite("k1")] }))).toEqual({
      kind: "NEW_CUSTOMER",
      linkContactId: null,
      collaboratorIds: ["k1"],
    });
    expect(
      decideOtpLogin(facts({ contacts: [contact("c1"), contact("c2")], collaborators: [invite("k1")] }))
    ).toEqual({ kind: "NEW_CUSTOMER", linkContactId: null, collaboratorIds: ["k1"] });
  });

  it("ignores invites on cancelled bookings, revoked invites and seats bound to another login", () => {
    const d = decideOtpLogin(
      facts({
        collaborators: [
          invite("k1", { bookingLive: false }),
          invite("k2", { status: "REVOKED" }),
          invite("k3", { status: "ACTIVE", userId: "someone-else" }),
        ],
      })
    );
    expect(d).toEqual({ kind: "REFUSE", reason: "NO_RECORD" });
  });

  it("lets an existing login take up its own and unclaimed invites, never another login's", () => {
    const d = decideOtpLogin(
      facts({
        users: [user("u1")],
        collaborators: [
          invite("k1", { status: "ACTIVE", userId: "u1" }),
          invite("k2", { status: "ACTIVE", userId: "u2" }),
          invite("k3"),
        ],
      })
    );
    expect(d).toMatchObject({ kind: "EXISTING_USER", collaboratorIds: ["k1", "k3"] });
  });

  it("refuses when two active logins share the number", () => {
    expect(decideOtpLogin(facts({ users: [user("u1"), user("u2", "STAFF")] }))).toEqual({
      kind: "REFUSE",
      reason: "SHARED_NUMBER",
    });
    expect(decideOtpLogin(facts({ users: [user("u1")], usersTruncated: true }))).toEqual({
      kind: "REFUSE",
      reason: "SHARED_NUMBER",
    });
  });

  it("never mints a replacement for a switched-off login, but ignores a switched-off duplicate", () => {
    const disabled = decideOtpLogin(facts({ users: [user("u1", "CLIENT", false)], contacts: [contact("c1")] }));
    expect(disabled).toEqual({ kind: "REFUSE", reason: "LOGIN_DISABLED" });
    expect(shouldSendLoginCode(disabled)).toBe(true);
    expect(decideOtpLogin(facts({ users: [user("u1", "CLIENT", false), user("u2")] }))).toMatchObject({
      kind: "EXISTING_USER",
      userId: "u2",
    });
  });
});

describe("contactHasActivity", () => {
  const none = { bookings: 0, leads: 0, quotes: 0, salesQuotations: 0, invoices: 0, contracts: 0, enquiryStatus: null };

  it("needs real business with the contact", () => {
    expect(contactHasActivity(none)).toBe(false);
    for (const key of ["bookings", "leads", "quotes", "salesQuotations", "invoices", "contracts"] as const) {
      expect(contactHasActivity({ ...none, [key]: 1 })).toBe(true);
    }
    expect(contactHasActivity({ ...none, enquiryStatus: "INTERESTED" })).toBe(true);
  });
});

describe("planCollaboratorActivation", () => {
  it("activates open invites for this login and binds unclaimed active seats only", () => {
    const rows = [
      invite("invited"),
      invite("invited-mine", { userId: "u1" }),
      invite("active-unbound", { status: "ACTIVE" }),
      invite("active-mine", { status: "ACTIVE", userId: "u1" }),
      invite("active-other", { status: "ACTIVE", userId: "u2" }),
      invite("invited-other", { userId: "u2" }),
      invite("revoked", { status: "REVOKED" }),
      invite("cancelled-booking", { bookingLive: false }),
    ];
    expect(planCollaboratorActivation(rows, "u1")).toEqual({
      activateIds: ["invited", "invited-mine"],
      bindIds: ["active-unbound"],
    });
  });
});

describe("login email: a login made from a phone never takes the contact's email", () => {
  type CreateArgs = { data: { name: string | null; email: string; role: string; phone: string } };

  function fakeTx(takenEmails: string[] = []) {
    const create = vi.fn(async (args: CreateArgs) => ({
      id: "u-new",
      name: args.data.name,
      email: args.data.email,
      image: null,
      role: args.data.role,
    }));
    const findUnique = vi.fn(async (args: { where: { email: string } }) =>
      takenEmails.includes(args.where.email) ? { id: "u-old" } : null
    );
    const findFirst = vi.fn(async () => null);
    const tx = { user: { create, findUnique, findFirst } } as unknown as Parameters<typeof createCustomerLogin>[0];
    return { tx, create, findFirst };
  }

  it("gives every login made from a phone the non-deliverable placeholder email", async () => {
    const { tx, create, findFirst } = fakeTx();
    const login = await createCustomerLogin(tx, {
      normalized: N,
      name: "Priya S",
      phoneVerifiedAt: null,
    });
    expect(login.email).toBe("wa-919876543210@customer.invalid");
    expect(isUndeliverableEmail(login.email)).toBe(true);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: placeholderLoginEmail(N), role: "CLIENT", phone: N }),
      })
    );
    // No contact email is looked up: the address a customer typed on a form never becomes a login.
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("keeps the placeholder unique when an old login still holds it", async () => {
    const { tx } = fakeTx([placeholderLoginEmail(N)]);
    const login = await createCustomerLogin(tx, { normalized: N, name: null, phoneVerifiedAt: new Date() });
    expect(login.email).toMatch(/^wa-919876543210-[0-9a-f]{6}@customer\.invalid$/);
    expect(isUndeliverableEmail(login.email)).toBe(true);
  });

  it("recognises the placeholder and the storefront filler as addresses that reach nobody", () => {
    expect(placeholderLoginEmail(N)).toBe("wa-919876543210@customer.invalid");
    for (const email of [null, "", "  ", "9876543210@noemail.veloria", "wa-91@customer.invalid"]) {
      expect(isUndeliverableEmail(email)).toBe(true);
    }
    expect(isUndeliverableEmail("priya@example.com")).toBe(false);
  });
});

describe("clientIpOf: the key for the sign-in code rate limits", () => {
  it("uses the address our proxy appended, not the first X-Forwarded-For entry the client sent", () => {
    vi.stubEnv("TRUSTED_PROXY_COUNT", "");
    try {
      expect(clientIpOf(new Headers({ "x-forwarded-for": "192.0.2.66, 203.0.113.9" }))).toBe("203.0.113.9");
      expect(clientIpOf(new Headers({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
      expect(clientIpOf(null)).toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("decideStaffGrant: Give access by phone", () => {
  it("creates a login for a new number and links an existing customer or vendor login", () => {
    expect(decideStaffGrant([])).toEqual({ kind: "CREATE_LOGIN" });
    expect(decideStaffGrant([user("u1")])).toEqual({ kind: "LINK_EXISTING", userId: "u1" });
    expect(decideStaffGrant([user("u1", "VENDOR"), user("u0", "CLIENT", false)])).toEqual({
      kind: "LINK_EXISTING",
      userId: "u1",
    });
  });

  it("refuses team logins, duplicate logins and switched-off logins", () => {
    expect(decideStaffGrant([user("u1", "SALES_HEAD")]).kind).toBe("REFUSE");
    expect(decideStaffGrant([user("u1"), user("u2")]).kind).toBe("REFUSE");
    expect(decideStaffGrant([user("u1")], true).kind).toBe("REFUSE");
    expect(decideStaffGrant([user("u1", "CLIENT", false)]).kind).toBe("REFUSE");
  });
});
