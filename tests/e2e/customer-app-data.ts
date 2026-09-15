import { expect, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { PrismaClient, type BusinessProfile, type PolicyDocument, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ADMIN, E2E_PREFIX } from "./helpers";

// ============================================================
// Data and customer sign-in for customer-app.spec.ts.
//
// The customer app signs in with a WhatsApp code and has no test bypass (and
// must never get one). These specs use what the app already allows:
//   - auth.ts's email + password provider signs in ANY active user whose bcrypt
//     hash matches, CLIENT included; signInAction then sends a CLIENT to
//     /portal with a full page load.
//   - src/lib/portal-identity.ts gives a login a customer's bookings through a
//     CustomerLink row. Method STAFF is how the team grants that access
//     (src/actions/customer-access.actions.ts).
//   - src/lib/guest/host-scope.ts gives an ACTIVE BookingCollaborator row bound
//     to a login that one booking, with its role (CO_HOST | VIEWER).
//
// So each run writes straight to DATABASE_URL (the database the server under
// test uses; CI sets it for the whole job):
//   Contact "E2E Host <stamp>" with a CONFIRMED booking on a seeded hall
//   CLIENT  "E2E Host <stamp>"   password + CustomerLink(STAFF) to that contact
//   CLIENT  "E2E Viewer <stamp>" password + BookingCollaborator(VIEWER, ACTIVE)
//   Invoice E2E-INV-<stamp>-ISSUED  PARTIALLY_PAID  ₹1,50,000 billed, ₹26,544 paid, ₹1,23,456 due
//   Invoice E2E-INV-<stamp>-DRAFT   DRAFT           ₹77,777 (the team's working copy, never billed)
// cleanupCustomerWorld() removes all of it, plus what the tests add through the
// UI (concierge thread and alerts, its task, the guest list, activity rows).
// ============================================================

let client: PrismaClient | null = null;

function db(): PrismaClient {
  client ??= new PrismaClient();
  return client;
}

export async function disconnectDb(): Promise<void> {
  const current = client;
  client = null;
  await current?.$disconnect();
}

// ------------------------------------------------------------
// Values the specs assert on
// ------------------------------------------------------------

/** Whole rupees, and how both sides print them (Indian digit grouping, no paise). */
export const MONEY = {
  issued: {
    total: 150_000,
    paid: 26_544,
    balance: 123_456,
    shownTotal: "₹1,50,000",
    shownPaid: "₹26,544",
    shownBalance: "₹1,23,456",
  },
  draft: { total: 77_777, shownTotal: "₹77,777" },
} as const;

/** The Settings → Customer content card, and the customer URL policyPath("CANCELLATION_REFUND") returns. */
export const CANCELLATION_POLICY = {
  key: "CANCELLATION_REFUND",
  draftKey: "DRAFT:CANCELLATION_REFUND",
  label: "Cancellation & refund policy",
  path: "/app/policies/cancellation-refund",
} as const;

export interface CustomerLogin {
  id: string;
  name: string;
  email: string;
  password: string;
}

export interface CustomerWorld {
  stamp: string;
  contact: { id: string; fullName: string };
  /** The booking's own customer (CustomerLink, method STAFF). */
  host: CustomerLogin;
  /** Invited to the booking as an ACTIVE VIEWER. */
  viewer: CustomerLogin;
  booking: { id: string; bookingNumber: string; eventName: string };
  invoices: { issued: { id: string; number: string }; draft: { id: string; number: string } };
  /** Set only when the database had no active hall and the seed created one. */
  createdVenueId: string | null;
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The two sides format money with different helpers; compare the printed text without whitespace. */
export function moneyText(text: string | null): string {
  return (text ?? "").replace(/\s+/g, "");
}

let mobileSeq = 0;

/** A valid 10-digit Indian mobile starting with `lead`, unique per call. */
export function uniqueIndianMobile(lead: 6 | 7 | 8 | 9 = 9): string {
  mobileSeq = (mobileSeq + 1) % 100;
  return `${lead}${String(Date.now() % 10_000_000).padStart(7, "0")}${String(mobileSeq).padStart(2, "0")}`;
}

// ------------------------------------------------------------
// Seed and cleanup
// ------------------------------------------------------------

/** Short and unique per run; safe in names, emails and invoice numbers. */
function runStamp(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const SLOTS = ["MORNING", "AFTERNOON", "EVENING", "FULL_DAY"] as const;

/** A day 5 to 20 months out, as Booking.date stores it (UTC midnight). */
function futureEventDate(): Date {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  day.setUTCDate(day.getUTCDate() + 150 + Math.floor(Math.random() * 450));
  return day;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

function firstLine(error: unknown): string {
  return String(error instanceof Error ? error.message : error).replace(/\s+/g, " ").trim().slice(0, 300);
}

async function createBookingOnFreeDay(
  prisma: PrismaClient,
  data: Omit<Prisma.BookingUncheckedCreateInput, "date" | "timeSlot">
): Promise<{ id: string; bookingNumber: string; eventName: string }> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.booking.create({
        data: { ...data, date: futureEventDate(), timeSlot: SLOTS[Math.floor(Math.random() * SLOTS.length)] },
        select: { id: true, bookingNumber: true, eventName: true },
      });
    } catch (error) {
      // The hall's slot is already taken that day (partial unique index): try another day.
      if (!isUniqueViolation(error) || attempt >= 5) throw error;
    }
  }
}

interface CreatedRows {
  userIds: string[];
  contactId: string | null;
  bookingId: string | null;
  venueId: string | null;
}

export async function seedCustomerWorld(): Promise<CustomerWorld> {
  const prisma = db();
  const stamp = runStamp();
  const created: CreatedRows = { userIds: [], contactId: null, bookingId: null, venueId: null };

  try {
    const admin =
      (await prisma.user.findUnique({ where: { email: ADMIN.email.toLowerCase() }, select: { id: true } })) ??
      (await prisma.user.findFirst({ where: { role: "SUPER_ADMIN", isActive: true }, select: { id: true } }));
    if (!admin) throw new Error(`No SUPER_ADMIN in the database (expected ${ADMIN.email}). Run pnpm db:seed.`);

    let venue = await prisma.venue.findFirst({
      where: { isActive: true, parentVenueId: null },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!venue) {
      venue = await prisma.venue.create({
        data: { name: `${E2E_PREFIX} Hall ${stamp}`, capacity: 500, pricePerSlot: 100_000 },
        select: { id: true },
      });
      created.venueId = venue.id;
    }

    const contact = await prisma.contact.create({
      data: { firstName: E2E_PREFIX, lastName: `Host ${stamp}`, phone: `+91${uniqueIndianMobile(9)}` },
      select: { id: true, firstName: true, lastName: true },
    });
    created.contactId = contact.id;

    const createLogin = async (label: "Host" | "Viewer"): Promise<CustomerLogin> => {
      const name = `${E2E_PREFIX} ${label} ${stamp}`;
      const email = `e2e.${label.toLowerCase()}.${stamp}@example.com`;
      const password = `E2e-${label}-${stamp}`;
      const user = await prisma.user.create({
        // emailVerified stays null, so the email grants nothing: access comes only from the rows below.
        data: { name, email, hashedPassword: await bcrypt.hash(password, 10), role: "CLIENT", isActive: true },
        select: { id: true },
      });
      created.userIds.push(user.id);
      return { id: user.id, name, email, password };
    };
    const host = await createLogin("Host");
    const viewer = await createLogin("Viewer");

    await prisma.customerLink.create({ data: { userId: host.id, contactId: contact.id, method: "STAFF" } });

    const booking = await createBookingOnFreeDay(prisma, {
      bookingNumber: `${E2E_PREFIX}-BK-${stamp}`,
      eventName: `${E2E_PREFIX} Reception ${stamp}`,
      eventType: "Wedding",
      status: "CONFIRMED",
      guestCount: 250,
      totalAmount: MONEY.issued.total,
      venueId: venue.id,
      contactId: contact.id,
      createdById: admin.id,
    });
    created.bookingId = booking.id;

    const invoiceBase = {
      dueDate: new Date(Date.now() + 30 * 86_400_000),
      cgstRate: 0,
      sgstRate: 0,
      contactId: contact.id,
      bookingId: booking.id,
      createdById: admin.id,
    };
    const issued = await prisma.invoice.create({
      data: {
        ...invoiceBase,
        invoiceNumber: `${E2E_PREFIX}-INV-${stamp}-ISSUED`,
        status: "PARTIALLY_PAID",
        subtotal: MONEY.issued.total,
        totalAmount: MONEY.issued.total,
        paidAmount: MONEY.issued.paid,
        balanceDue: MONEY.issued.balance,
      },
      select: { id: true, invoiceNumber: true },
    });
    const draft = await prisma.invoice.create({
      data: {
        ...invoiceBase,
        invoiceNumber: `${E2E_PREFIX}-INV-${stamp}-DRAFT`,
        status: "DRAFT",
        subtotal: MONEY.draft.total,
        totalAmount: MONEY.draft.total,
        paidAmount: 0,
        balanceDue: MONEY.draft.total,
      },
      select: { id: true, invoiceNumber: true },
    });

    await prisma.bookingCollaborator.create({
      data: {
        bookingId: booking.id,
        phone: `91${uniqueIndianMobile(8)}`, // normalizeOtpPhone() form
        name: viewer.name,
        role: "VIEWER",
        status: "ACTIVE",
        userId: viewer.id,
        invitedById: host.id,
        acceptedAt: new Date(),
      },
    });

    return {
      stamp,
      contact: { id: contact.id, fullName: `${contact.firstName} ${contact.lastName}` },
      host,
      viewer,
      booking,
      invoices: {
        issued: { id: issued.id, number: issued.invoiceNumber },
        draft: { id: draft.id, number: draft.invoiceNumber },
      },
      createdVenueId: created.venueId,
    };
  } catch (error) {
    await removeRows(created);
    throw error;
  }
}

/** Remove everything the seed and the tests created. Returns what could not be removed. */
export async function cleanupCustomerWorld(world: CustomerWorld): Promise<string[]> {
  return removeRows({
    userIds: [world.host.id, world.viewer.id],
    contactId: world.contact.id,
    bookingId: world.booking.id,
    venueId: world.createdVenueId,
  });
}

/** Best effort, children before parents. A row that can't be deleted is left cancelled / inactive instead. */
async function removeRows({ userIds, contactId, bookingId, venueId }: CreatedRows): Promise<string[]> {
  const prisma = db();
  const problems: string[] = [];
  const step = async (label: string, run: () => Promise<unknown>) => {
    try {
      await run();
    } catch (error) {
      problems.push(`${label}: ${firstLine(error)}`);
    }
  };

  const threadWhere = [...(contactId ? [{ contactId }] : []), ...(bookingId ? [{ bookingId }] : [])];
  if (threadWhere.length > 0) {
    let threadIds: string[] = [];
    await step("find concierge threads", async () => {
      const rows = await prisma.conciergeThread.findMany({ where: { OR: threadWhere }, select: { id: true } });
      threadIds = rows.map((row) => row.id);
    });
    if (threadIds.length > 0) {
      await step("concierge messages", () => prisma.conciergeMessage.deleteMany({ where: { threadId: { in: threadIds } } }));
      for (const threadId of threadIds) {
        // The team's bell alerts about the conversation.
        await step("concierge alerts", () =>
          prisma.notification.deleteMany({ where: { metadata: { path: ["threadId"], equals: threadId } } })
        );
      }
      await step("concierge threads", () => prisma.conciergeThread.deleteMany({ where: { id: { in: threadIds } } }));
    }
  }

  const taskWhere = [
    ...(bookingId ? [{ bookingId }] : []),
    ...(contactId ? [{ contactId }] : []),
    ...(userIds.length > 0 ? [{ creatorId: { in: userIds } }] : []),
  ];
  if (taskWhere.length > 0) await step("tasks", () => prisma.task.deleteMany({ where: { OR: taskWhere } }));

  if (bookingId) {
    // Guests and their invitations cascade from the guest list.
    await step("guest list", () => prisma.guestList.deleteMany({ where: { bookingId } }));
    await step("collaborators", () => prisma.bookingCollaborator.deleteMany({ where: { bookingId } }));
    // Line items and instalments cascade from the invoice.
    await step("invoices", () => prisma.invoice.deleteMany({ where: { bookingId } }));
  }

  const linkWhere = [...(contactId ? [{ contactId }] : []), ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : [])];
  if (linkWhere.length > 0) await step("customer links", () => prisma.customerLink.deleteMany({ where: { OR: linkWhere } }));

  if (bookingId) {
    await step("booking", async () => {
      try {
        await prisma.booking.delete({ where: { id: bookingId } });
      } catch (error) {
        await prisma.booking.updateMany({ where: { id: bookingId }, data: { status: "CANCELLED" } });
        throw error;
      }
    });
  }

  if (userIds.length > 0) {
    await step("activity log", () => prisma.activityLog.deleteMany({ where: { userId: { in: userIds } } }));
    await step("logins", async () => {
      try {
        // Their in-app notifications cascade.
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      } catch (error) {
        await prisma.user.updateMany({ where: { id: { in: userIds } }, data: { isActive: false } });
        throw error;
      }
    });
  }

  if (contactId) {
    await step("contact", async () => {
      try {
        await prisma.contact.delete({ where: { id: contactId } });
      } catch (error) {
        await prisma.contact.updateMany({ where: { id: contactId }, data: { deletedAt: new Date() } });
        throw error;
      }
    });
  }

  if (venueId) await step("hall", () => prisma.venue.delete({ where: { id: venueId } }));
  return problems;
}

// ------------------------------------------------------------
// Settings rows the settings tests change, put back afterwards
// ------------------------------------------------------------

export async function snapshotBusinessProfiles(): Promise<BusinessProfile[]> {
  return db().businessProfile.findMany({ orderBy: { updatedAt: "asc" } });
}

/** Oldest first, so the row customers read (the newest) is still the newest afterwards. */
export async function restoreBusinessProfiles(snapshot: readonly BusinessProfile[]): Promise<void> {
  const prisma = db();
  await prisma.businessProfile.deleteMany({ where: { id: { notIn: snapshot.map((row) => row.id) } } });
  for (const row of snapshot) {
    await prisma.businessProfile.update({
      where: { id: row.id },
      data: {
        displayName: row.displayName,
        phone: row.phone,
        whatsapp: row.whatsapp,
        email: row.email,
        address: row.address,
        mapUrl: row.mapUrl,
        supportHours: row.supportHours,
        updatedById: row.updatedById,
      },
    });
  }
}

export async function snapshotPolicyRows(keys: readonly string[]): Promise<PolicyDocument[]> {
  return db().policyDocument.findMany({ where: { key: { in: [...keys] } } });
}

export async function restorePolicyRows(keys: readonly string[], snapshot: readonly PolicyDocument[]): Promise<void> {
  const prisma = db();
  const saved = new Set(snapshot.map((row) => row.key));
  await prisma.policyDocument.deleteMany({ where: { key: { in: keys.filter((key) => !saved.has(key)) } } });
  for (const row of snapshot) {
    const data = {
      title: row.title,
      body: row.body,
      version: row.version,
      isPublished: row.isPublished,
      publishedAt: row.publishedAt,
      updatedById: row.updatedById,
    };
    await prisma.policyDocument.upsert({ where: { key: row.key }, create: { key: row.key, ...data }, update: data });
  }
}

// ------------------------------------------------------------
// Browser
// ------------------------------------------------------------

/**
 * Resolves once React has hydrated this element. A click or keystroke that
 * lands on server-rendered HTML before hydration is silently lost (on a form it
 * becomes a native GET submit). React tags every element it has taken over
 * with a __reactProps$… key; production builds don't set __NEXT_HYDRATED.
 */
export async function whenInteractive(locator: Locator): Promise<void> {
  await expect
    .poll(
      () => locator.evaluate((element) => Object.keys(element).some((key) => key.startsWith("__reactProps$"))),
      "React has hydrated the element"
    )
    .toBe(true);
}

/**
 * A fresh, signed-out, phone-sized browser. Playwright 1.63 applies the
 * config's `use` options only to the built-in context/page fixtures, not to
 * browser.newContext(), so baseURL, locale and time zone are set here.
 */
export function newCustomerContext(browser: Browser, baseURL: string | undefined): Promise<BrowserContext> {
  return browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    viewport: { width: 412, height: 915 },
  });
}

/** Sign a CLIENT in through the real /sign-in email + password form, in its own browser. */
export async function signInCustomer(
  browser: Browser,
  baseURL: string | undefined,
  who: Pick<CustomerLogin, "email" | "password">
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await newCustomerContext(browser, baseURL);
  const page = await context.newPage();
  try {
    await page.goto("/sign-in");
    const submit = page.getByRole("button", { name: "Sign in", exact: true });
    await whenInteractive(submit);
    await page.locator("input[type=email]").fill(who.email);
    await page.locator("input[type=password]").fill(who.password);
    await submit.click();
    // signInAction answers a CLIENT with /portal and the form does a full page load.
    await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 60_000 });
    return { context, page };
  } catch (error) {
    const toast = await page
      .locator("[data-sonner-toast]")
      .first()
      .textContent({ timeout: 1_000 })
      .catch(() => null);
    const stuckOn = page.url();
    await context.close();
    throw new Error(
      `Customer sign-in as ${who.email} failed; still on ${stuckOn}${toast ? ` (toast: "${toast.trim()}")` : ""}. ${firstLine(error)}`
    );
  }
}

/** Run `run` with a signed-in customer page, then close that customer's browser. */
export async function asCustomer<T>(
  browser: Browser,
  baseURL: string | undefined,
  who: Pick<CustomerLogin, "email" | "password">,
  run: (page: Page) => Promise<T>
): Promise<T> {
  const session = await signInCustomer(browser, baseURL, who);
  try {
    return await run(session.page);
  } finally {
    await session.context.close();
  }
}
