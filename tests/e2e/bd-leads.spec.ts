import { test, expect, type Page } from "@playwright/test";
import { expectToast, inputByLabel, uniqueMobile, uniqueName, visibleOnly } from "./helpers";

// BD / Acquisition CRM inbox at /bd/leads: "New Lead" dialog → row appears →
// pipeline-stage chip filter → search → detail page → delete.
test.describe("BD CRM — leads inbox", () => {
  test("create a BD lead, filter by stage chip, open detail", async ({ page }) => {
    test.slow();

    const propertyName = uniqueName("Property");
    const ownerName = uniqueName("Owner");

    // Row link for the property (desktop table; a hidden mobile twin may exist).
    const leadLink = (p: Page) =>
      visibleOnly(p.getByRole("link", { name: propertyName, exact: true }));
    // Stage chips read "<label> <count>" — never confused with the "New Lead" button.
    const chip = (p: Page, label: string) =>
      visibleOnly(p.getByRole("button", { name: new RegExp(`^${label}\\s*\\d+$`) }));

    await test.step("open the inbox", async () => {
      await page.goto("/bd/leads");
      await expect(page.getByRole("heading", { level: 1, name: "Leads" })).toBeVisible();
    });

    await test.step("create a lead through the New Lead dialog", async () => {
      await visibleOnly(page.getByRole("button", { name: "New Lead" })).click();
      const dialog = page.getByRole("dialog").filter({ hasText: "New Lead" });
      await expect(dialog).toBeVisible();

      // Required: owner name, primary mobile, property name, city, locality.
      // Owner type / property type / lead source default to their first enum.
      await inputByLabel(dialog, "Owner name").fill(ownerName);
      await inputByLabel(dialog, "Primary mobile").fill(uniqueMobile());
      await inputByLabel(dialog, "Property name").fill(propertyName);
      await inputByLabel(dialog, "City").fill("Hyderabad");
      await inputByLabel(dialog, "Locality").fill("Banjara Hills");

      const submit = dialog.getByRole("button", { name: "Create lead" });
      await expect(submit).toBeEnabled();
      await submit.click();
      await expectToast(page, "Lead created");
      await expect(dialog).toBeHidden();
    });

    await test.step("the new lead is listed", async () => {
      await expect(leadLink(page)).toBeVisible();
    });

    await test.step("filter by the 'New' pipeline stage chip", async () => {
      // A fresh lead sits in NEW.
      await chip(page, "New").click();
      await expect(leadLink(page)).toBeVisible();

      // A stage the lead cannot be in hides it; "All" brings it back.
      await chip(page, "Won").click();
      await expect(page.getByRole("link", { name: propertyName, exact: true })).toHaveCount(0);
      await chip(page, "All").click();
      await expect(leadLink(page)).toBeVisible();
    });

    await test.step("search narrows the inbox", async () => {
      const search = visibleOnly(page.getByPlaceholder(/Search owner, property, city/));
      await search.fill(propertyName);
      await expect(leadLink(page)).toBeVisible();
      await search.fill("");
    });

    await test.step("open the detail page", async () => {
      await leadLink(page).click();
      await page.waitForURL(/\/bd\/leads\/[^/?]+$/);
      await expect(page.getByRole("heading", { level: 1, name: propertyName })).toBeVisible();
      await expect(page.getByText(ownerName).first()).toBeVisible();
    });

    await test.step("cleanup: delete the lead when permitted", async () => {
      const deleteButton = visibleOnly(page.getByRole("button", { name: "Delete", exact: true }));
      if (!(await deleteButton.isVisible().catch(() => false))) {
        test.info().annotations.push({
          type: "note",
          description: `No Delete on BD lead detail for this role — left "${propertyName}" in place.`,
        });
        return;
      }
      await deleteButton.click();
      const dialog = page.getByRole("dialog").filter({ hasText: "Delete this lead?" });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Delete lead" }).click();
      await page.waitForURL(/\/bd\/leads(\?|$)/);
    });
  });
});
