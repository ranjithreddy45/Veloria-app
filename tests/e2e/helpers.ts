import { expect, type Locator, type Page } from "@playwright/test";
import path from "node:path";

// ============================================================
// Shared helpers for the e2e smoke suite.
//
// Selector conventions (see README.md):
//   1. Prefer getByRole / getByLabel / getByText.
//   2. Many dialogs in this app render a bare shadcn <Label> with NO htmlFor,
//      so getByLabel() finds nothing there. Use fieldByLabel()/inputByLabel()
//      which walk label → parent field wrapper → control.
//   3. Radix Select: trigger is role="combobox", the popover is
//      role="listbox" and each item role="option". Use selectRadixOption().
// ============================================================

export const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL ?? "admin@veloriagrand.com",
  password: process.env.E2E_ADMIN_PASSWORD ?? "Admin@123",
  // prisma/seed.ts names the SUPER_ADMIN "Rajesh Kumar".
  name: process.env.E2E_ADMIN_NAME ?? "Rajesh Kumar",
};

/**
 * Seeded non-admin logins (prisma/seed.ts creates every one of these, with
 * these passwords). Specs that sign in as one of them must opt out of the
 * shared admin session: `test.use({ storageState: { cookies: [], origins: [] } })`.
 */
export const ROLE_USERS = {
  STAFF: { email: "staff@veloriagrand.com", password: "Staff@123" },
  SALES_EXEC: { email: "sales1@veloriagrand.com", password: "Sales@123" },
  EVENT_COORDINATOR: { email: "events@veloriagrand.com", password: "Events@123" },
  FINANCE: { email: "finance@veloriagrand.com", password: "Finance@123" },
} as const;

export type SeededRole = keyof typeof ROLE_USERS;

/**
 * The screens the visual tour photographs: one or more from each family of
 * layout (home, list, board, calendar, detail-heavy, settings, ops, finance,
 * HR). header-geometry.spec.ts measures the same list, so a screen added here
 * is both photographed and held to the header rules.
 */
export const TOUR_SCREENS: readonly { name: string; path: string }[] = [
  { name: "home", path: "/dashboard" },
  // Sales
  { name: "sales-dashboard", path: "/sales/dashboard" },
  { name: "leads", path: "/leads" },
  { name: "contacts", path: "/contacts" },
  { name: "pipeline", path: "/pipeline" },
  { name: "quotations", path: "/quotations" },
  { name: "calendar", path: "/calendar" },
  { name: "bd-deals", path: "/bd/deals" },
  // Bookings and venue
  { name: "bookings", path: "/bookings" },
  { name: "bookings-calendar", path: "/bookings/calendar" },
  { name: "availability", path: "/availability" },
  { name: "site-visits", path: "/site-visits" },
  // Delivery and ops
  { name: "tasks", path: "/tasks" },
  { name: "projects", path: "/projects" },
  { name: "beo", path: "/beo" },
  { name: "kitchen", path: "/kitchen" },
  { name: "procurement", path: "/procurement" },
  { name: "support", path: "/support" },
  { name: "vendors", path: "/vendors" },
  // Money
  { name: "invoices", path: "/invoices" },
  { name: "payments", path: "/payments" },
  { name: "finance", path: "/finance" },
  { name: "finance-command-center", path: "/finance/command-center" },
  // People
  { name: "people", path: "/people" },
  { name: "people-payroll", path: "/people/payroll" },
  { name: "people-lms", path: "/people/lms" },
  // Insight and admin
  { name: "reports", path: "/reports" },
  { name: "settings", path: "/settings" },
  { name: "settings-integrations", path: "/settings/integrations" },
];

/** Every record a spec creates starts with this so humans can spot/purge it. */
export const E2E_PREFIX = "E2E";

/** localStorage key the dashboard welcome tour checks before showing itself. */
export const WELCOME_TOUR_SEEN_KEY = "vg_welcome_seen_v1";

export function storageStatePath(): string {
  return path.resolve(process.cwd(), "tests/e2e/.auth/admin.json");
}

/** "E2E Lead 1694012345678" — unique per run, greppable, sortable. */
export function uniqueName(label: string): string {
  return `${E2E_PREFIX} ${label} ${Date.now()}`;
}

/** 10-digit Indian-looking mobile that is unique per millisecond. */
export function uniqueMobile(): string {
  return `9${Date.now().toString().slice(-9)}`;
}

type Root = Page | Locator;

/**
 * Tables here render a hidden mobile-card twin of every row/link (`sm:hidden`
 * vs `hidden sm:block`), so a bare getByRole often resolves to an invisible
 * duplicate first. Narrow to what is actually on screen.
 */
export function visibleOnly(locator: Locator): Locator {
  return locator.filter({ visible: true }).first();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Anchored, case-insensitive, tolerant of the trailing " *" required marker. */
export function labelPattern(label: string | RegExp): RegExp {
  return typeof label === "string"
    ? new RegExp(`^\\s*${escapeRegExp(label)}\\s*\\*?\\s*$`, "i")
    : label;
}

/**
 * The wrapper element of a form field, found via its <label> text.
 * Works for both react-hook-form FormItems and the bare
 * `<div><Label/>…control…</div>` pattern used in most dialogs here.
 */
export function fieldByLabel(root: Root, label: string | RegExp): Locator {
  return root
    .locator("label")
    .filter({ hasText: labelPattern(label) })
    .first()
    .locator("xpath=..");
}

/** The <input>/<textarea> that sits under a label (no htmlFor needed). */
export function inputByLabel(root: Root, label: string | RegExp): Locator {
  return fieldByLabel(root, label).locator("input, textarea").first();
}

/** Open a Radix Select found by its label and pick an option by text. */
export async function selectRadixOption(
  root: Root,
  triggerLabel: string | RegExp,
  optionText: string | RegExp
): Promise<void> {
  const trigger = fieldByLabel(root, triggerLabel).getByRole("combobox").first();
  await selectRadixOptionOn(trigger, optionText);
}

/** Same as selectRadixOption but for a trigger you already located. */
export async function selectRadixOptionOn(
  trigger: Locator,
  optionText: string | RegExp
): Promise<void> {
  const page = trigger.page();
  await trigger.click();
  const listbox = page.getByRole("listbox").first();
  await expect(listbox).toBeVisible();
  await listbox
    .getByRole("option", { name: optionText, exact: typeof optionText === "string" })
    .first()
    .click();
  await expect(listbox).toBeHidden();
}

/** Pick the first option of an already-located Radix Select trigger. */
export async function selectFirstRadixOptionOn(trigger: Locator): Promise<string> {
  const page = trigger.page();
  await trigger.click();
  const listbox = page.getByRole("listbox").first();
  await expect(listbox).toBeVisible();
  const option = listbox.getByRole("option").first();
  const text = (await option.textContent())?.trim() ?? "";
  await option.click();
  await expect(listbox).toBeHidden();
  return text;
}

/** Sonner toast containing the text (root layout mounts <Toaster/>). */
export function toast(page: Page, text: string | RegExp): Locator {
  return page.locator("[data-sonner-toast]").filter({ hasText: text }).first();
}

export async function expectToast(page: Page, text: string | RegExp): Promise<void> {
  await expect(toast(page, text)).toBeVisible();
}

// ------------------------------------------------------------
// Auth
// ------------------------------------------------------------

/** Fill the password form on /sign-in and submit. Does not wait for landing. */
export async function login(
  page: Page,
  email: string = ADMIN.email,
  password: string = ADMIN.password
): Promise<void> {
  await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
  await page.locator("input[type=email]").fill(email);
  await page.locator("input[type=password]").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

/**
 * Sign in through the real /sign-in form as any seeded user and wait for the
 * dashboard. Use it from a spec that opted out of the shared admin session.
 *
 * The welcome tour is marked as seen before the first page script runs (the
 * same localStorage key global setup sets), so it never opens over a spec.
 */
export async function signInAs(page: Page, email: string, password: string): Promise<void> {
  await page.addInitScript((key) => {
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      /* storage blocked: dismissTour() is the fallback */
    }
  }, WELCOME_TOUR_SEEN_KEY);

  await login(page, email, password);

  // A refused login stays on /sign-in with a toast. Say so, rather than let
  // the spec fail later on a redirect it can't explain.
  await page.waitForURL(/\/dashboard/, { timeout: 90_000 }).catch(async () => {
    const toastText = await page
      .locator("[data-sonner-toast]")
      .first()
      .textContent()
      .catch(() => null);
    throw new Error(
      `signInAs could not sign in as ${email}. Still on ${page.url()}` +
        (toastText ? ` (toast: "${toastText.trim()}")` : "") +
        ". Is the database seeded (pnpm db:seed)?"
    );
  });
}

/**
 * Close the "Two-factor authentication is required for your role" strip if it
 * is showing (SUPER_ADMIN, ADMIN, FINANCE and HR_MANAGER see it until they
 * enrol). This only hides it for the browser session; it never enrols 2FA.
 * The strip renders after hydration, so give it a moment to appear.
 */
export async function dismissTwoFactorBanner(page: Page): Promise<void> {
  const dismiss = page.getByRole("button", { name: "Dismiss for this session", exact: true });
  const shown = await dismiss
    .waitFor({ state: "visible", timeout: 3_000 })
    .then(() => true, () => false);
  if (!shown) return;
  await dismiss.click();
  await expect(dismiss).toBeHidden();
}

/** Skip the first-run "Welcome to Veloria Grand" tour if it is showing. */
export async function dismissTour(page: Page): Promise<void> {
  const dialog = page
    .getByRole("dialog")
    .filter({ hasText: "Welcome to Veloria Grand" });
  const shown = await dialog
    .waitFor({ state: "visible", timeout: 2_500 })
    .then(() => true, () => false);
  if (!shown) return;
  await dialog.getByRole("button", { name: "Skip" }).click();
  await expect(dialog).toBeHidden();
}

/** Sidebar footer has an icon button aria-label="Sign out"; header menu is the fallback. */
export async function signOut(page: Page): Promise<void> {
  const sidebarButton = page.getByRole("button", { name: "Sign out", exact: true }).first();
  if (await sidebarButton.isVisible().catch(() => false)) {
    await sidebarButton.click();
  } else {
    const firstName = ADMIN.name.split(" ")[0];
    await page.getByRole("button", { name: new RegExp(firstName) }).first().click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
  }
  await page.waitForURL(/\/sign-in/);
}

// ------------------------------------------------------------
// Sales CRM
// ------------------------------------------------------------

/** /contacts/new — react-hook-form labels carry htmlFor, so getByLabel works. */
export async function createContact(
  page: Page,
  opts: { firstName?: string; lastName?: string } = {}
): Promise<void> {
  await page.goto("/contacts/new");
  await expect(page.getByRole("heading", { level: 1, name: "New Contact" })).toBeVisible();
  await page.getByLabel(/^First Name/).fill(opts.firstName ?? E2E_PREFIX);
  await page.getByLabel(/^Last Name/).fill(opts.lastName ?? `Contact ${Date.now()}`);
  await page.getByLabel(/^Phone/).fill(uniqueMobile());
  await page.getByRole("button", { name: "Create Contact" }).click();
  await page.waitForURL(/\/contacts(\/|\?|$)/);
}

/**
 * /leads/new — Title + Contact are required. The contact picker is a
 * cmdk combobox; the seed ships ~10 contacts, but if the DB has none we
 * create one and start over.
 */
export async function createSalesLead(
  page: Page,
  opts: { title: string; guestCount?: string; estimatedValue?: string }
): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto("/leads/new");
    await expect(page.getByRole("heading", { level: 1, name: "New Lead" })).toBeVisible();
    await page.getByLabel(/^Title/).fill(opts.title);

    const contactTrigger = page.getByRole("combobox", { name: /Contact/ }).first();
    await contactTrigger.click();
    await expect(page.getByPlaceholder("Search contacts...")).toBeVisible();
    const firstContact = page.getByRole("option").first();
    const hasContact = await firstContact
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true, () => false);

    if (!hasContact) {
      await page.keyboard.press("Escape");
      await createContact(page);
      continue; // retry with a contact in place
    }

    await firstContact.click();
    await expect(contactTrigger).not.toHaveText(/Select contact/);

    if (opts.guestCount) await page.getByLabel("Guest Count").fill(opts.guestCount);
    if (opts.estimatedValue) await page.getByLabel("Estimated Value").fill(opts.estimatedValue);

    await page.getByRole("button", { name: "Create Lead" }).click();
    await expectToast(page, "Lead created successfully");
    await page.waitForURL(/\/leads(\?|$)/);
    return;
  }
  throw new Error("createSalesLead: could not find or create a contact to attach the lead to.");
}

/** Search the all-scope leads list for a title and open its detail page. */
export async function openSalesLeadByTitle(page: Page, title: string): Promise<string> {
  // Default scope is "My leads"; auto-assignment rules may have handed the
  // new lead to someone else, so search the whole book.
  await page.goto("/leads?scope=all");
  await expect(page.getByRole("heading", { level: 1, name: "Leads" })).toBeVisible();
  const search = page.getByPlaceholder(/Search name, email or phone/);
  const link = visibleOnly(page.getByRole("link", { name: title, exact: true }));
  // Typing before React has hydrated the table is silently dropped on a slow CI
  // runner (the lead already exists), so re-type until the search actually runs.
  await expect(async () => {
    await search.fill("");
    await search.fill(title);
    await expect(link).toBeVisible({ timeout: 4_000 });
  }).toPass({ timeout: 30_000 });
  await link.click();
  await page.waitForURL(/\/leads\/[^/?]+$/);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  return page.url();
}

/** Lead detail → Delete → confirm. Soft-delete; safe to call on cleanup. */
export async function deleteSalesLead(page: Page, leadUrl: string): Promise<void> {
  await page.goto(leadUrl);
  await visibleOnly(page.getByRole("button", { name: "Delete", exact: true })).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByText("Delete Lead")).toBeVisible();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expectToast(page, "Lead deleted successfully");
}

// ------------------------------------------------------------
// HR / People
// ------------------------------------------------------------

/** First-run /people shows a "Set up organisation" seeder (hr:admin only). */
export async function ensureOrgSetUp(page: Page): Promise<void> {
  await page.goto("/people");
  await expect(page.getByRole("heading", { level: 1, name: "People" })).toBeVisible();
  const seedButton = page.getByRole("button", { name: "Set up organisation" });
  if (!(await seedButton.isVisible().catch(() => false))) return;
  await seedButton.click();
  // The seeder refreshes the route on success; give it a beat, then reload
  // so the assertion is on a fresh server render.
  await expect(seedButton).toBeDisabled({ timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(1_500);
  await page.reload();
  await expect(page.getByRole("button", { name: "Set up organisation" })).toHaveCount(0);
}

/**
 * "Add employee" dialog on /people. Only First/Last name + Legal entity are
 * required. When `workEmail` matches an active, unclaimed login and the
 * actor holds hr:admin (SUPER_ADMIN does), createEmployee auto-links the
 * Employee to that User — which is how the reimbursement spec makes the
 * admin eligible to file a claim.
 */
export async function createEmployee(
  page: Page,
  opts: { firstName: string; lastName: string; workEmail?: string }
): Promise<string> {
  await ensureOrgSetUp(page);
  await page.getByRole("button", { name: "Add employee" }).click();
  const dialog = page.getByRole("dialog").filter({ hasText: "Add employee" });
  await expect(dialog).toBeVisible();

  await inputByLabel(dialog, "First name").fill(opts.firstName);
  await inputByLabel(dialog, "Last name").fill(opts.lastName);
  if (opts.workEmail) await inputByLabel(dialog, "Work email").fill(opts.workEmail);
  await selectFirstRadixOptionOn(fieldByLabel(dialog, "Legal entity").getByRole("combobox"));

  await dialog.getByRole("button", { name: "Create employee" }).click();
  await page.waitForURL(/\/people\/[^/?]+$/);
  return page.url();
}

// ------------------------------------------------------------
// Layout measurement (header-geometry.spec.ts)
// ------------------------------------------------------------

/**
 * Wait until what a spec measures has stopped moving: web fonts loaded and
 * every finite animation or transition finished (the layout's fade-in-up, a
 * hover transition). Infinite ones (skeleton pulses, spinners) are ignored.
 * Capped at 3s, so a page that keeps starting new animations can't hang a spec.
 */
export async function settleLayout(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const done = (async () => {
      await document.fonts.ready;
      const finite = document.getAnimations().filter((a) => {
        const timing = a.effect?.getComputedTiming();
        return !!timing && timing.endTime !== Infinity;
      });
      await Promise.all(finite.map((a) => a.finished.catch(() => undefined)));
    })();
    await Promise.race([done, new Promise((resolve) => setTimeout(resolve, 3_000))]);
  });
}

export type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number };

/** A list item or pill in a "Page actions" cluster. `clippedBy` names the ancestor that cuts it, if any. */
export type ClusterPart = { label: string; box: Box; clippedBy: string | null };

export type PageHeaderGeometry = {
  viewportWidth: number;
  /** Left edge of the page content: the layout's max-width wrapper inside #main-content. */
  contentLeft: number;
  /** Module chips actually on screen (the chip is display:none below sm). */
  visibleChips: number;
  chip: Box | null;
  h1: Box | null;
  h1Text: string;
  eyebrow: Box | null;
  description: Box | null;
  /** Every rendered `[aria-label="Page actions"]` list: its <li>s and its pills (links, buttons, More). */
  lists: { box: Box; items: ClusterPart[]; pills: ClusterPart[] }[];
};

/**
 * Measure the page header inside #main-content. Runs IN THE PAGE:
 * `page.evaluate(measurePageHeader, 4)`. Self-contained, because Playwright
 * serialises it; it may not call anything defined outside its own body.
 *
 * `ring` is how far past an element the focus outline reaches (2px outline at
 * a 2px offset): an ancestor that clips (overflow other than visible) must
 * contain the element plus that margin.
 *
 * The header's h1 is found through the module chip, its sibling in the title
 * row (even below sm, where the chip is display:none), so another h1 on the
 * page can't be mistaken for the title. The eyebrow and the description are
 * the title row's neighbours in PageHeader's title column.
 */
export function measurePageHeader(ring: number): PageHeaderGeometry {
  const toBox = (r: DOMRect): Box => ({
    left: r.left,
    right: r.right,
    top: r.top,
    bottom: r.bottom,
    width: r.width,
    height: r.height,
  });
  const rendered = (el: Element | null): el is Element => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  };
  const describe = (el: Element) => {
    const slot = el.getAttribute("data-slot");
    return el.tagName.toLowerCase() + (el.id ? `#${el.id}` : "") + (slot ? `[data-slot=${slot}]` : "");
  };
  const clippingAncestor = (el: Element): string | null => {
    const r = el.getBoundingClientRect();
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
      // A clipping box is the padding box: border box minus borders and scrollbars.
      const ar = a.getBoundingClientRect();
      const left = ar.left + a.clientLeft;
      const top = ar.top + a.clientTop;
      const right = left + a.clientWidth;
      const bottom = top + a.clientHeight;
      const cut =
        r.left - ring < left - 0.5 ||
        r.right + ring > right + 0.5 ||
        r.top - ring < top - 0.5 ||
        r.bottom + ring > bottom + 0.5;
      if (cut) return `${describe(a)} (overflow ${cs.overflowX}/${cs.overflowY})`;
    }
    return null;
  };
  const labelOf = (el: Element) =>
    (el.getAttribute("aria-label") ?? el.querySelector("[aria-label]")?.getAttribute("aria-label") ?? el.textContent ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 40);
  const part = (el: Element): ClusterPart => ({
    label: labelOf(el),
    box: toBox(el.getBoundingClientRect()),
    clippedBy: clippingAncestor(el),
  });

  const main = document.querySelector("#main-content");
  if (!main) throw new Error("#main-content is missing");
  const content = main.firstElementChild ?? main;

  const chips = Array.from(main.querySelectorAll('[data-slot="module-chip"]'));
  const visibleChips = chips.filter(rendered);
  const chipEl = visibleChips[0] ?? chips[0] ?? null;
  const h1 = chipEl?.parentElement?.querySelector(":scope > h1") ?? main.querySelector("h1");
  const titleRow = h1?.parentElement ?? null;
  const before = titleRow?.previousElementSibling ?? null;
  const after = titleRow?.nextElementSibling ?? null;

  const lists = Array.from(main.querySelectorAll('[aria-label="Page actions"]'))
    .filter(rendered)
    .map((list) => ({
      box: toBox(list.getBoundingClientRect()),
      items: Array.from(list.querySelectorAll(":scope > li")).filter(rendered).map(part),
      pills: Array.from(list.querySelectorAll('[data-slot="quick-action"], [data-slot="page-more-trigger"]'))
        .filter(rendered)
        .map(part),
    }));

  return {
    viewportWidth: window.innerWidth,
    contentLeft: content.getBoundingClientRect().left,
    visibleChips: visibleChips.length,
    chip: visibleChips[0] ? toBox(visibleChips[0].getBoundingClientRect()) : null,
    h1: h1 ? toBox(h1.getBoundingClientRect()) : null,
    h1Text: (h1?.textContent ?? "").trim(),
    eyebrow: rendered(before) ? toBox(before.getBoundingClientRect()) : null,
    description: rendered(after) && after.tagName === "P" ? toBox(after.getBoundingClientRect()) : null,
    lists,
  };
}

/**
 * The title box of the first visible PageHeaderSkeleton: the second of the two
 * placeholders in its title row (the first is the chip placeholder). Runs IN
 * THE PAGE: `page.evaluate(measureSkeletonTitle)`. Null when no skeleton is
 * on screen.
 */
export function measureSkeletonTitle(): { left: number; top: number; width: number; height: number } | null {
  const roots = Array.from(document.querySelectorAll('[data-slot="page-header-skeleton"]'));
  const root = roots.find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  if (!root) return null;
  // Skeleton root > title column > [eyebrow?, title row, description, meta?].
  const column = root.querySelector(":scope > div");
  const row = Array.from(column?.children ?? []).find(
    (el) => el.children.length === 2 && Array.from(el.children).every((c) => c.getAttribute("data-slot") === "skeleton")
  );
  const title = row?.lastElementChild;
  if (!title) return null;
  const r = title.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}
