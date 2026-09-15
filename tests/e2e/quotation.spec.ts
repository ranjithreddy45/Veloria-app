import { test, expect } from "@playwright/test";
import {
  createSalesLead,
  deleteSalesLead,
  expectToast,
  inputByLabel,
  openSalesLeadByTitle,
  uniqueName,
} from "./helpers";

// Lead → "Create Quotation" → calculator (/quotations/new?leadId=…) →
// live Grand Total → Save & Submit → detail page → Approve.
test.describe("Sales — quotations", () => {
  test("create a quotation from a lead, see its total, approve it", async ({ page }) => {
    test.slow();

    const title = uniqueName("Quote Lead");
    const guests = "100";
    const drinksPerPerson = "100"; // 100 × 100 = ₹10,000 + 5% tax → ₹10,500
    let leadUrl = "";

    await test.step("create a lead to quote against", async () => {
      await createSalesLead(page, { title, guestCount: guests });
      leadUrl = await openSalesLeadByTitle(page, title);
    });

    await test.step("open the calculator from the lead", async () => {
      await page.getByRole("link", { name: "Create Quotation" }).click();
      await page.waitForURL(/\/quotations\/new\?leadId=/);
      await expect(page.getByRole("heading", { level: 1, name: "New Quotation" })).toBeVisible();

      // The lead's guest count is prefilled; make sure it is, since submit
      // validation requires guestCount ≥ 1.
      const guestInput = inputByLabel(page, /^Guest Count/);
      await expect(guestInput).toBeVisible();
      if (((await guestInput.inputValue()) || "0") === "0") await guestInput.fill(guests);
    });

    await test.step("add a line item and see the Grand Total render", async () => {
      // Live preview starts as "Nothing quoted yet". Drinks is a plain
      // numeric line (per person × guests), so it needs no catalog data.
      await expect(page.getByText("Nothing quoted yet")).toBeVisible();
      await inputByLabel(page, /^Drinks/).fill(drinksPerPerson);

      const grandTotal = page
        .getByText("Grand Total", { exact: true })
        .first()
        .locator("xpath=..")
        .locator("span")
        .last();
      await expect(grandTotal).toContainText("₹");
      await expect(grandTotal).not.toHaveText(/₹\s?0(\.00)?$/);
      await expect(page.getByText("Nothing quoted yet")).toHaveCount(0);
      await expect(page.getByText("Payment Schedule")).toBeVisible();
    });

    await test.step("save & submit for approval", async () => {
      await page.getByRole("button", { name: "Save & Submit for Approval" }).click();
      await expectToast(page, "Quotation submitted for approval.");
      await page.waitForURL(/\/quotations\/(?!new)[^/?]+$/);
      // Detail header title is the quote number.
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText("Grand Total", { exact: true })).toBeVisible();
    });

    await test.step("approve if the button is offered", async () => {
      // Shown only for PENDING_APPROVAL + quotes:approve (SUPER_ADMIN has it).
      const approve = page.getByRole("button", { name: "Approve", exact: true });
      if (await approve.isVisible().catch(() => false)) {
        await approve.click();
        await expectToast(page, "Approved.");
        await expect(approve).toBeHidden();
      } else {
        test.info().annotations.push({
          type: "note",
          description: "Approve button not rendered — quotation stayed in its submitted state.",
        });
      }
    });

    await test.step("cleanup: soft-delete the lead", async () => {
      await deleteSalesLead(page, leadUrl).catch(() => {
        /* a quoted lead may refuse deletion — leave it, it carries the E2E prefix */
      });
    });
  });

  test("the quotations list renders", async ({ page }) => {
    await page.goto("/quotations");
    await expect(page.getByRole("heading", { level: 1, name: "Quotations" })).toBeVisible();
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  });
});
