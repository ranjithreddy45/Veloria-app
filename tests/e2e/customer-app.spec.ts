import { test, expect, type Page } from "@playwright/test";
import { expectToast } from "./helpers";
import {
  CANCELLATION_POLICY,
  MONEY,
  asCustomer,
  cleanupCustomerWorld,
  disconnectDb,
  escapeRegExp,
  moneyText,
  newCustomerContext,
  restoreBusinessProfiles,
  restorePolicyRows,
  seedCustomerWorld,
  snapshotBusinessProfiles,
  snapshotPolicyRows,
  uniqueIndianMobile,
  whenInteractive,
  type CustomerWorld,
} from "./customer-app-data";

// ============================================================
// One source of truth: the customer app (/app, mobile-first) and the team
// side (the dashboard) read and write the same records under the same rules.
// Each test enters a fact on one side and checks the other side shows it
// identically.
//
// `page` is the seeded SUPER_ADMIN (global setup). A customer gets a separate,
// phone-sized browser signed in through /sign-in (asCustomer). The booking,
// logins and invoices come from customer-app-data.ts: seeded once per worker
// and removed in afterAll. The two settings tests put back the rows they
// change.
// ============================================================

test.describe("Customer app and team side share one source of truth", () => {
  let world: CustomerWorld | undefined;

  function seeded(): CustomerWorld {
    if (!world) throw new Error("customer-app data was not seeded (see beforeAll)");
    return world;
  }

  test.beforeAll(async () => {
    world = await seedCustomerWorld();
  });

  test.afterAll(async () => {
    if (world) {
      const leftovers = await cleanupCustomerWorld(world);
      if (leftovers.length > 0) {
        console.warn(`[customer-app e2e] rows left behind (all carry the E2E prefix):\n- ${leftovers.join("\n- ")}`);
      }
      world = undefined;
    }
    await disconnectDb();
  });

  test("contact details saved in Settings → Business contact are what the customer Help screen shows", async ({
    page,
    browser,
    baseURL,
  }) => {
    test.slow();
    const w = seeded();
    const phone = uniqueIndianMobile(9);
    const whatsapp = uniqueIndianMobile(8);
    const hours = `E2E ${w.stamp}: Mon-Sat, 10 am to 7 pm`;
    // formatPhoneForDisplay(), used by both screens: "+91 98765 43210".
    const shown = (digits: string) => `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
    const before = await snapshotBusinessProfiles();

    try {
      await test.step("team saves phone, WhatsApp and team hours", async () => {
        await page.goto("/settings/business-contact");
        await expect(page.getByRole("heading", { level: 1, name: "Business Contact" })).toBeVisible();
        const save = page.getByRole("button", { name: "Save", exact: true });
        await whenInteractive(save);
        await page.getByLabel("Phone for calls", { exact: true }).fill(phone);
        await page.getByLabel("WhatsApp number", { exact: true }).fill(whatsapp);
        await page.getByLabel("Team hours", { exact: true }).fill(hours);
        await save.click();
        await expectToast(page, "Saved. Customer screens now show these details.");
      });

      await test.step("team screen reads back what customers now see", async () => {
        await expect(page.getByLabel("Phone for calls", { exact: true })).toHaveValue(shown(phone));
        const live = page.locator('[data-slot="card"]').filter({ hasText: "What customers see now" });
        await expect(live).toContainText(shown(phone));
        await expect(live).toContainText(shown(whatsapp));
        await expect(live).toContainText(hours);
      });

      await asCustomer(browser, baseURL, w.host, async (app) => {
        await test.step("customer Help screen shows the same details", async () => {
          await app.goto("/app/help");
          await expect(app.getByText("Talk to us", { exact: true })).toBeVisible();
          await expect(app.getByText(shown(phone), { exact: true })).toBeVisible();
          await expect(app.getByText(shown(whatsapp), { exact: true })).toBeVisible();
          await expect(app.getByText(hours)).toBeVisible();
          await expect(app.getByRole("link", { name: "Call us" })).toHaveAttribute("href", `tel:+91${phone}`);
          await expect(app.getByRole("link", { name: "WhatsApp us" })).toHaveAttribute(
            "href",
            new RegExp(`^https://wa\\.me/91${whatsapp}(\\?|$)`)
          );
        });
      });
    } finally {
      await restoreBusinessProfiles(before);
    }
  });

  test("a policy published in Settings → Customer content is the text on the customer policy page", async ({
    page,
    browser,
    baseURL,
  }) => {
    test.slow();
    const w = seeded();
    const title = `E2E Cancellation and refunds ${w.stamp}`;
    const intro = `E2E ${w.stamp}: this cancellation and refund policy was published from Settings.`;
    const rule1 = "Cancel 60 or more days before the event and 75% of the advance is refunded.";
    const rule2 = "Cancel within 60 days of the event and the advance is not refunded.";
    const body = `${intro}\n\n- ${rule1}\n- ${rule2}`;
    const keys = [CANCELLATION_POLICY.key, CANCELLATION_POLICY.draftKey];
    const before = await snapshotPolicyRows(keys);
    const card = page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByText(CANCELLATION_POLICY.label, { exact: true }) });
    let version = "";

    try {
      await test.step("team writes and saves a draft", async () => {
        await page.goto("/settings/customer-content");
        await expect(page.getByRole("heading", { level: 1, name: "Customer Content" })).toBeVisible();
        // Whatever state the policy is in: a first draft, a new draft over a live version, or an open draft.
        const edit = card.getByRole("button", { name: /Edit draft|Write this policy|Start a new draft/ });
        await whenInteractive(edit);
        await edit.click();
        await card.getByLabel("Title customers see").fill(title);
        await card.getByLabel("Policy text").fill(body);
        await card.getByRole("button", { name: "Save draft" }).click();
        await expectToast(page, /Draft saved/);
      });

      await test.step("team previews it as customers will see it and publishes", async () => {
        await card.getByRole("button", { name: "Preview & publish" }).click();
        const preview = page.getByRole("dialog", { name: /^Preview\b.*Cancellation & refund policy$/ });
        await expect(preview).toBeVisible();
        await expect(preview.getByRole("heading", { level: 1, name: title })).toBeVisible();
        const publish = preview.getByRole("button", { name: /^Publish version \d+$/ });
        version = /\d+/.exec((await publish.textContent()) ?? "")?.[0] ?? "";
        expect(version, "the publish button names the version it creates").not.toBe("");
        await publish.click();
        await expectToast(page, `Version ${version} is live for customers.`);
        await expect(preview).toBeHidden();
        await expect(card.getByText(`Live · v${version}`)).toBeVisible();
        await expect(card.getByRole("link", { name: "View in customer app" })).toHaveAttribute(
          "href",
          CANCELLATION_POLICY.path
        );
      });

      await asCustomer(browser, baseURL, w.host, async (app) => {
        await test.step("customer Help lists the same version", async () => {
          await app.goto("/app/help");
          const row = app.getByRole("link", { name: new RegExp(escapeRegExp(title)) });
          await expect(row).toHaveAttribute("href", CANCELLATION_POLICY.path);
          await expect(row).toContainText(`v${version}`);
        });

        await test.step("customer policy page shows the same title, version and text", async () => {
          await app.goto(CANCELLATION_POLICY.path);
          await expect(app.getByRole("heading", { level: 1, name: title })).toBeVisible();
          await expect(app.getByText(`Version ${version}`, { exact: true })).toBeVisible();
          await expect(app.getByText(intro, { exact: true })).toBeVisible();
          await expect(app.getByRole("listitem").filter({ hasText: rule1 })).toBeVisible();
          await expect(app.getByRole("listitem").filter({ hasText: rule2 })).toBeVisible();
        });
      });
    } finally {
      await restorePolicyRows(keys, before);
    }
  });

  test("a concierge message from the app reaches the team inbox, and the team's reply reaches the app", async ({
    page,
    browser,
    baseURL,
  }) => {
    test.slow();
    const w = seeded();
    const question = `E2E question ${w.stamp}: can our own decorator set up the stage?`;
    const reply = `E2E reply ${w.stamp}: yes, from 2 pm on the day.`;
    const conciergeUrl = `/app/concierge?booking=${w.booking.id}`;

    await asCustomer(browser, baseURL, w.host, async (app) => {
      await test.step("customer writes to the team from the app", async () => {
        await app.goto(conciergeUrl);
        await expect(app.getByRole("heading", { level: 1, name: "Concierge" })).toBeVisible();
        const box = app.getByRole("textbox", { name: "Message the team" });
        await whenInteractive(box);
        await box.fill(question);
        await app.getByRole("button", { name: "Send", exact: true }).click();
        await expect(app.getByText(question, { exact: true })).toBeVisible();
        await expect(app.getByText("Sent", { exact: true })).toBeVisible();
      });

      await test.step("team finds the same message in /concierge", async () => {
        await page.goto("/concierge");
        await expect(page.getByRole("heading", { level: 1, name: "Customer Concierge" })).toBeVisible();
        const search = page.getByRole("textbox", { name: "Search conversations" });
        await whenInteractive(search);
        await search.fill(w.stamp);
        const row = page.getByRole("button", { name: new RegExp(escapeRegExp(w.contact.fullName)) });
        await expect(row).toBeVisible();
        await expect(row).toContainText(w.booking.bookingNumber);
        await row.click();
        await expect(inboxThread(page).getByText(question, { exact: true })).toBeVisible();
      });

      await test.step("team replies from the inbox", async () => {
        const thread = inboxThread(page);
        await thread.getByRole("textbox", { name: "Reply to the customer" }).fill(reply);
        await thread.getByRole("button", { name: "Send reply" }).click();
        await expect(thread.getByText(/^Reply saved/)).toBeVisible();
        await expect(thread.getByText(reply, { exact: true })).toBeVisible();
      });

      await test.step("customer sees the team's reply in the same conversation", async () => {
        await expect(async () => {
          await app.goto(conciergeUrl);
          await expect(app.getByText(reply, { exact: true })).toBeVisible({ timeout: 5_000 });
        }).toPass({ timeout: 45_000 });
        await expect(app.getByText(/Veloria team$/).first()).toBeVisible();
        await expect(app.getByText(question, { exact: true })).toBeVisible();
      });
    });
  });

  test("balance due is the same on the team booking page and in the customer's Payments; the draft invoice stays off the customer side", async ({
    page,
    browser,
    baseURL,
  }) => {
    test.slow();
    const w = seeded();
    let teamPending = "";

    await test.step("team booking page: Payment summary counts issued invoices only", async () => {
      await page.goto(`/bookings/${w.booking.id}`);
      const summary = page
        .getByText("Payment summary", { exact: true })
        .locator("xpath=ancestor::*[@data-slot='card'][1]");
      await expect(summary).toBeVisible();
      const figure = (label: string) =>
        summary.getByText(label, { exact: true }).locator("xpath=following-sibling::p[1]");
      await expect(figure("Pending")).toHaveText(MONEY.issued.shownBalance);
      await expect(figure("Total invoiced")).toHaveText(MONEY.issued.shownTotal);
      await expect(figure("Collected")).toHaveText(MONEY.issued.shownPaid);
      teamPending = moneyText(await figure("Pending").textContent());
    });

    await test.step("team Invoices tab lists both invoices, the draft included", async () => {
      const tab = page.getByRole("tab", { name: /^Invoices/ });
      await whenInteractive(tab);
      await tab.click();
      const panel = page.getByRole("tabpanel", { name: /^Invoices/ });
      await expect(panel.getByText(w.invoices.issued.number, { exact: true })).toBeVisible();
      await expect(panel.getByText(w.invoices.draft.number, { exact: true })).toBeVisible();
    });

    await asCustomer(browser, baseURL, w.host, async (app) => {
      await test.step("customer Payments shows the same balance due", async () => {
        await app.goto(`/app/payments?b=${w.booking.id}`);
        const balance = app.getByText("Balance due", { exact: true }).locator("xpath=following-sibling::div[1]");
        await expect(balance).toHaveText(MONEY.issued.shownBalance);
        expect(moneyText(await balance.textContent()), "customer balance due equals the team's Pending").toBe(
          teamPending
        );
        await expect(
          app.getByText(`Paid ${MONEY.issued.shownPaid} of ${MONEY.issued.shownTotal} · 1 invoice`)
        ).toBeVisible();
        await expect(app.getByText(`Invoice ${w.invoices.issued.number}`, { exact: true })).toBeVisible();
      });

      await test.step("the draft invoice is not shown to the customer", async () => {
        await expect(app.getByText(w.invoices.draft.number)).toHaveCount(0);
        await expect(app.getByText(MONEY.draft.shownTotal)).toHaveCount(0);
      });

      await test.step("the event hub's Payments tile carries the same figure", async () => {
        await app.goto(`/app/event?b=${w.booking.id}`);
        await expect(app.getByRole("link", { name: /^Payments/ })).toContainText(`${MONEY.issued.shownBalance} due`);
      });
    });
  });

  test("a guest the customer adds in the app is on the team's guest list with the same plus-ones and category", async ({
    page,
    browser,
    baseURL,
  }) => {
    test.slow();
    const w = seeded();
    const guestName = `E2E Guest ${w.stamp}`;

    await asCustomer(browser, baseURL, w.host, async (app) => {
      await test.step("customer adds a Family guest with two plus-ones", async () => {
        await app.goto(`/app/event/guests?b=${w.booking.id}`);
        await expect(app.getByText("Add a guest", { exact: true })).toBeVisible();
        const name = app.getByRole("textbox", { name: "Guest name" });
        await whenInteractive(name);
        await name.fill(guestName);
        const more = app.getByRole("button", { name: "One more plus-one" });
        await more.click();
        await more.click();
        await expect(
          app.getByRole("button", { name: "One fewer plus-one" }).locator("xpath=following-sibling::span[1]")
        ).toHaveText("2");
        await app.getByRole("button", { name: "Family", exact: true }).click();
        await app.getByRole("button", { name: "Add guest", exact: true }).click();
        const row = app.getByRole("button", { name: new RegExp(escapeRegExp(guestName)) });
        await expect(row).toBeVisible();
        await expect(row).toContainText("Family · 3 people");
      });
    });

    await test.step("team Guest Management shows the same guest, plus-ones and category", async () => {
      await page.goto(`/bookings/${w.booking.id}/guests`);
      await expect(page.getByRole("heading", { level: 1, name: "Guest Management" })).toBeVisible();
      const search = page.getByPlaceholder("Search guests...");
      await whenInteractive(search);
      await search.fill(guestName);
      const row = page.getByRole("row").filter({ hasText: guestName });
      await expect(row).toHaveCount(1);
      const headers = (await page.getByRole("columnheader").allTextContents()).map((text) => text.trim());
      const cell = (header: string) => {
        const index = headers.indexOf(header);
        expect(index, `the team guest table has a "${header}" column`).toBeGreaterThanOrEqual(0);
        return row.getByRole("cell").nth(index);
      };
      await expect(cell("Name")).toContainText(guestName);
      await expect(cell("+Ones")).toHaveText("2");
      await expect(cell("Category")).toContainText("Family");
    });
  });

  test("the customer can't open team pages, and a signed-out visitor is sent to sign in", async ({
    browser,
    baseURL,
  }) => {
    test.slow();
    const w = seeded();

    await asCustomer(browser, baseURL, w.host, async (app) => {
      for (const path of ["/concierge", "/dashboard", `/bookings/${w.booking.id}`]) {
        await test.step(`the customer opening ${path} is sent away`, async () => {
          await app.goto(path);
          await expect(app).not.toHaveURL(new RegExp(`${escapeRegExp(path)}(\\?|$)`));
          await expect(app).toHaveURL(/\/(not-authorized|app)(\/|\?|$)/);
          await expect(app.getByRole("heading", { level: 1, name: "Customer Concierge" })).toHaveCount(0);
          await expect(app.getByText(w.booking.bookingNumber)).toHaveCount(0);
        });
      }
    });

    await test.step("a signed-out visitor opening /app/event is sent to sign in first", async () => {
      const context = await newCustomerContext(browser, baseURL);
      try {
        const visitor = await context.newPage();
        await visitor.goto("/app/event");
        await expect(visitor).toHaveURL(/\/(app\/welcome|sign-in)\?/);
        expect(decodeURIComponent(new URL(visitor.url()).search), "comes back to the event screen after sign-in").toContain(
          "/app/event"
        );
        await expect(visitor.getByRole("heading", { level: 1, name: "My event" })).toHaveCount(0);
      } finally {
        await context.close();
      }
    });
  });

  test("a VIEWER co-host can open the shared event but sees no payments or documents and can't add guests", async ({
    browser,
    baseURL,
  }) => {
    test.slow();
    const w = seeded();

    await asCustomer(browser, baseURL, w.viewer, async (app) => {
      await test.step("the shared event opens for the viewer", async () => {
        await app.goto(`/app/event?b=${w.booking.id}`);
        await expect(app.getByRole("heading", { level: 1, name: "My event" })).toBeVisible();
        await expect(app.getByText(w.booking.eventName, { exact: true })).toBeVisible();
        await expect(app.getByRole("link", { name: /^Guest list/ })).toBeVisible();
        await expect(app.getByRole("link", { name: /^Checklist/ })).toBeVisible();
      });

      await test.step("no Payments, Documents or Share tiles", async () => {
        await expect(app.getByRole("link", { name: /^Payments/ })).toHaveCount(0);
        await expect(app.getByRole("link", { name: /^Documents/ })).toHaveCount(0);
        await expect(app.getByRole("link", { name: /^Share/ })).toHaveCount(0);
      });

      await test.step("the guest list is read-only", async () => {
        await app.goto(`/app/event/guests?b=${w.booking.id}`);
        await expect(
          app.getByText("You can see this guest list. Only the host or a co-host can make changes.")
        ).toBeVisible();
        await expect(app.getByText("Add a guest", { exact: true })).toHaveCount(0);
        await expect(app.getByRole("textbox", { name: "Guest name" })).toHaveCount(0);
        await expect(app.getByRole("button", { name: "Add guest", exact: true })).toHaveCount(0);
      });

      await test.step("the booking's payments stay with the host", async () => {
        await app.goto(`/app/payments?b=${w.booking.id}`);
        await expect(app.getByText(`Payments for ${w.booking.eventName} are handled by its host`)).toBeVisible();
        await expect(app.getByText(w.invoices.issued.number)).toHaveCount(0);
        await expect(app.getByText(MONEY.issued.shownBalance)).toHaveCount(0);
      });
    });
  });
});

/** The open conversation in the team inbox (the pane with the reply box), not the list beside it. */
function inboxThread(page: Page) {
  return page.locator("section").filter({ has: page.getByRole("textbox", { name: "Reply to the customer" }) });
}
