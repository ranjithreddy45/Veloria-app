import { test, expect } from "@playwright/test";
import { ADMIN, dismissTour, login, signOut } from "./helpers";

// Auth specs must NOT start from the shared signed-in storage state.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Authentication", () => {
  test("wrong password shows an error and stays on /sign-in", async ({ page }) => {
    await login(page, ADMIN.email, "definitely-not-the-password");

    // signInAction returns { error: "Invalid email or password" } which the
    // form surfaces as a sonner toast.
    await expect(page.getByText("Invalid email or password").first()).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  });

  test("correct login lands on the dashboard", async ({ page }) => {
    await login(page);
    await page.waitForURL(/\/dashboard/);
    await dismissTour(page);

    // Dashboard h1 is "{Good morning|afternoon|evening}, {first name}".
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /Good (morning|afternoon|evening)/
    );
    // The signed-in user is shown in the header user menu / sidebar footer.
    await expect(page.getByText(ADMIN.name).first()).toBeVisible();
  });

  test("sign-out returns to /sign-in and protects the dashboard", async ({ page }) => {
    await login(page);
    await page.waitForURL(/\/dashboard/);
    await dismissTour(page);

    await signOut(page);
    await expect(page).toHaveURL(/\/sign-in/);

    // The session is gone: a protected route bounces back to sign-in.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
