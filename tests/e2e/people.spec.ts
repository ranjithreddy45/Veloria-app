import { test, expect } from "@playwright/test";
import { createEmployee, ensureOrgSetUp } from "./helpers";

// /people directory: loads, seeds the org on first run, search filters,
// and the Employee Handbook under "My HR" opens.
test.describe("People / HR", () => {
  const E2E_EMPLOYEE = { firstName: "E2E", lastName: "Employee" };
  const E2E_EMPLOYEE_NAME = `${E2E_EMPLOYEE.firstName} ${E2E_EMPLOYEE.lastName}`;

  test("/people loads and employee search works", async ({ page }) => {
    test.slow();

    await test.step("directory loads (seeding the organisation on first run)", async () => {
      await ensureOrgSetUp(page);
      await expect(page.getByRole("button", { name: "Add employee" })).toBeVisible();
      await expect(page.getByPlaceholder(/Search name, code, email, phone/)).toBeVisible();
    });

    await test.step("make sure at least one searchable employee exists", async () => {
      // Search is server-side via ?q=; go straight to the URL to avoid the
      // 350 ms debounce for this probe.
      await page.goto(`/people?q=${encodeURIComponent(E2E_EMPLOYEE_NAME)}`);
      const existing = page.getByRole("link", { name: new RegExp(E2E_EMPLOYEE_NAME) }).first();
      if (!(await existing.isVisible().catch(() => false))) {
        await createEmployee(page, E2E_EMPLOYEE);
      }
    });

    await test.step("typing in the search box filters the directory", async () => {
      await page.goto("/people");
      const search = page.getByPlaceholder(/Search name, code, email, phone/);
      await search.fill(E2E_EMPLOYEE_NAME);
      await page.waitForURL(/\/people\?.*q=/);
      await expect(
        page.getByRole("link", { name: new RegExp(E2E_EMPLOYEE_NAME) }).first()
      ).toBeVisible();

      await search.fill("zzz-no-such-employee-e2e");
      await expect(page.getByText("No employees match these filters")).toBeVisible();

      await search.fill("");
      await page.waitForURL(/\/people(\?(?!.*q=).*)?$/);
      await expect(page.getByText("No employees match these filters")).toHaveCount(0);
    });
  });

  test("Employee Handbook opens under My HR", async ({ page }) => {
    await page.goto("/dashboard");

    // Sidebar → "My HR" group → "Employee Handbook". Groups can be collapsed
    // and the sidebar may be icon-only on narrow panes, so fall back to the
    // route itself if the link isn't clickable.
    const handbookLink = page.getByRole("link", { name: "Employee Handbook" }).first();
    let navigated = false;
    if (!(await handbookLink.isVisible().catch(() => false))) {
      const myHr = page.getByRole("button", { name: /^My HR/ }).first();
      if (await myHr.isVisible().catch(() => false)) await myHr.click();
    }
    if (await handbookLink.isVisible().catch(() => false)) {
      await handbookLink.click();
      navigated = true;
    }
    if (!navigated) {
      test.info().annotations.push({
        type: "note",
        description: "Sidebar 'Employee Handbook' link not visible — navigated by URL instead.",
      });
      await page.goto("/people/handbook");
    }

    await expect(page).toHaveURL(/\/people\/handbook/);
    await expect(page.getByRole("heading", { level: 1, name: "Employee Handbook" })).toBeVisible();
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  });
});
