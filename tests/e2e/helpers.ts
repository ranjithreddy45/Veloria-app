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
