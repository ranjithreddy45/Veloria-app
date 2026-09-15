import { test, expect } from "@playwright/test";
import {
  ADMIN,
  createSalesLead,
  deleteSalesLead,
  expectToast,
  openSalesLeadByTitle,
  selectRadixOptionOn,
  uniqueName,
} from "./helpers";

// One journey, several steps: create → find → open → status → note → owner → delete.
// Kept as a single test so a mid-way failure leaves an obvious "E2E …" lead
// behind rather than a half-run chain of skipped tests.
test.describe("Sales CRM — leads", () => {
  test("create, find, work and delete a lead", async ({ page }) => {
    test.slow(); // seven server round-trips; generous on a `next dev` server

    const title = uniqueName("Lead");
    let leadUrl = "";

    await test.step("create a lead via /leads/new", async () => {
      await createSalesLead(page, { title, guestCount: "150", estimatedValue: "450000" });
    });

    await test.step("find it in the list search and open it", async () => {
      leadUrl = await openSalesLeadByTitle(page, title);
    });

    await test.step("change status New → Contacted", async () => {
      // The status Select sits in the page header next to Edit/Delete and
      // currently shows the "New" label. Other comboboxes on the page (lead
      // quality, owner) never read exactly "New".
      const statusTrigger = page.getByRole("combobox").filter({ hasText: /^New$/ }).first();
      await expect(statusTrigger).toBeVisible();
      await selectRadixOptionOn(statusTrigger, "Contacted");
      await expectToast(page, /Status updated to contacted/i);
      await expect(page.getByRole("combobox").filter({ hasText: /^Contacted$/ })).toBeVisible();
    });

    await test.step("add a note", async () => {
      const noteText = `${title} — note added by the e2e suite`;
      const noteBox = page.getByPlaceholder("Add a note…");
      await expect(noteBox).toBeVisible();
      await noteBox.fill(noteText);
      await page.getByRole("button", { name: "Add note" }).click();
      await expect(page.getByText(noteText).first()).toBeVisible();
    });

    await test.step("assign an owner", async () => {
      // "Owner" is a plain <p> caption above the Select (no <label>).
      const ownerTrigger = page
        .getByText("Owner", { exact: true })
        .first()
        .locator("xpath=..")
        .getByRole("combobox");
      await expect(ownerTrigger).toBeVisible();

      const before = ((await ownerTrigger.textContent()) ?? "").trim();
      await ownerTrigger.click();
      const listbox = page.getByRole("listbox").first();
      await expect(listbox).toBeVisible();

      // Prefer the admin; otherwise the first real person that differs from
      // the current value (so the change actually fires a save).
      const adminOption = listbox.getByRole("option", { name: ADMIN.name, exact: true });
      let chosen: string;
      if ((await adminOption.count()) > 0 && before !== ADMIN.name) {
        chosen = ADMIN.name;
        await adminOption.click();
      } else {
        let candidates = listbox.getByRole("option").filter({ hasNotText: /^Unassigned$/ });
        if (before) candidates = candidates.filter({ hasNotText: before });
        const candidate = candidates.first();
        chosen = ((await candidate.textContent()) ?? "").trim();
        await candidate.click();
      }
      await expect(listbox).toBeHidden();
      await expectToast(page, "Owner updated");
      await expect(ownerTrigger).toHaveText(chosen);
    });

    await test.step("cleanup: delete the lead", async () => {
      await deleteSalesLead(page, leadUrl);
      await expect(page).toHaveURL(/\/leads(\?|$)/);
    });
  });

  test("the leads list renders with its primary actions", async ({ page }) => {
    await page.goto("/leads?scope=all");
    await expect(page.getByRole("heading", { level: 1, name: "Leads" })).toBeVisible();
    await expect(page.getByRole("link", { name: /New lead/i }).first()).toBeVisible();
    await expect(page.getByPlaceholder(/Search name, email or phone/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Import/ }).first()).toBeVisible();
  });
});
