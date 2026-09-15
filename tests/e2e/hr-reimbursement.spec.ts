import { test, expect, type Page } from "@playwright/test";
import {
  ADMIN,
  createEmployee,
  expectToast,
  inputByLabel,
  selectRadixOption,
  uniqueName,
} from "./helpers";

// /me/reimbursements → "New claim" dialog → listed as "Awaiting 1st approval"
// → History dialog → /me/approvals → Approve → status moves on.
//
// Precondition the seed does NOT provide: the admin User must be linked to an
// Employee record (submitReimbursement looks up employee.userId). The first
// attempt detects the "isn't linked to an employee record" error, creates an
// employee whose work email is the admin's login (hr:admin auto-links it),
// then retries. Idempotent: the employee is only created when the link is
// missing.
test.describe("HR — reimbursement claim & approval", () => {
  const NOT_LINKED = /isn't linked to an employee record/i;

  async function openNewClaimDialog(page: Page) {
    await page.goto("/me/reimbursements");
    await expect(page.getByRole("heading", { level: 1, name: "My reimbursements" })).toBeVisible();
    await page.getByRole("button", { name: "New claim" }).click();
    const dialog = page.getByRole("dialog").filter({ hasText: "New reimbursement claim" });
    await expect(dialog).toBeVisible();
    return dialog;
  }

  async function fillAndSubmitClaim(page: Page, title: string, amount: string) {
    const dialog = await openNewClaimDialog(page);
    await selectRadixOption(dialog, "Category", "Travel");
    await inputByLabel(dialog, "Description").fill(title);
    await inputByLabel(dialog, /^Amount/).fill(amount);
    // Claim date is prefilled with today; leave it.
    await dialog.getByRole("button", { name: "Submit claim" }).click();

    // Either the dialog closes (success) or an inline error appears.
    const error = dialog.getByText(NOT_LINKED);
    const outcome = await Promise.race([
      dialog.waitFor({ state: "hidden" }).then(() => "submitted" as const),
      error.waitFor({ state: "visible" }).then(() => "not-linked" as const),
    ]);
    if (outcome === "not-linked") await page.keyboard.press("Escape");
    return outcome;
  }

  test("submit a claim, view its history, approve it as the admin", async ({ page }) => {
    test.slow();

    const title = uniqueName("Claim");
    const amount = "1234";

    await test.step("submit a claim (self-heal the employee link if needed)", async () => {
      let outcome = await fillAndSubmitClaim(page, title, amount);
      if (outcome === "not-linked") {
        await createEmployee(page, {
          firstName: "E2E",
          lastName: "Admin",
          workEmail: ADMIN.email,
        });
        outcome = await fillAndSubmitClaim(page, title, amount);
      }
      expect(outcome, "claim should submit once the admin has an employee record").toBe("submitted");
    });

    const row = () => page.getByRole("row").filter({ hasText: title }).first();

    await test.step("listed as awaiting first approval", async () => {
      await expect(row()).toBeVisible();
      await expect(row()).toContainText("Awaiting 1st approval");
      await expect(row()).toContainText("Travel");
    });

    await test.step("History dialog opens", async () => {
      await row().getByRole("button", { name: "History" }).click();
      const trail = page.getByRole("dialog").filter({ hasText: "Claim details & approval trail" });
      await expect(trail).toBeVisible();
      await expect(trail).toContainText(/Travel/i);
      await page.keyboard.press("Escape");
      await expect(trail).toBeHidden();
    });

    await test.step("the claim is waiting in /me/approvals and Approve moves it on", async () => {
      await page.goto("/me/approvals");
      await expect(page.getByRole("heading", { level: 1, name: "My approvals" })).toBeVisible();

      const approvalRow = page.getByRole("row").filter({ hasText: title }).first();
      await expect(approvalRow).toBeVisible();
      await expect(approvalRow).toContainText("1st-level");
      await approvalRow.getByRole("button", { name: "Approve", exact: true }).click();

      const decision = page.getByRole("dialog").filter({ hasText: /Give .* approval/ });
      await expect(decision).toBeVisible();
      await decision.getByRole("button", { name: "Approve", exact: true }).click();
      await expectToast(page, /^Approved — /);
      await expect(decision).toBeHidden();
    });

    await test.step("status has moved past first approval", async () => {
      await page.goto("/me/reimbursements");
      await expect(row()).toBeVisible();
      await expect(row()).not.toContainText("Awaiting 1st approval");
      // Second-level rule configured → "Awaiting 2nd approval"; otherwise
      // it goes straight to Finance.
      await expect(row()).toContainText(/Awaiting 2nd approval|Approved · with Finance/);
    });

    await test.step("cleanup: withdraw while still withdrawable", async () => {
      const withdraw = row().getByRole("button", { name: "Withdraw" });
      if (await withdraw.isVisible().catch(() => false)) {
        await withdraw.click();
        await expect(row()).not.toContainText(/Awaiting/, { timeout: 15_000 }).catch(() => {});
      }
    });
  });
});
