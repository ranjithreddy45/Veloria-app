import { test, expect, type Locator, type Page } from "@playwright/test";
import { visibleOnly } from "./helpers";
import { disconnectDb, escapeRegExp, publishedHalls, whenInteractive, type PublishedHall } from "./customer-app-data";

// ============================================================
// Browsing halls in the customer app: the feed (/app/venues), its search
// sheet, one hall's own page, and the home screen that opens on all three.
//
// Every expectation is derived rather than typed in. The halls come from the
// database (publishedHalls — the rows getStorefrontVenues lists, by the same
// rule); the searched date comes from the calendar the customer picked it on;
// the capacity band comes from the chip's own URL. Nothing here knows how many
// halls the seed ships or what they are called, so a changed seed moves the
// numbers without touching a spec.
//
// Selectors are roles, accessible names and visible copy (README.md). Heading
// LEVELS are deliberately not asserted except for the one <h1> a screen must
// have, because the outline moves when a screen is re-laid-out. Where
// structure is unavoidable it is a contract rather than a layout: the
// /app/venues?cap=… and /app/venues/<id> URLs, the "Find a hall" dialog, the
// "Days in <month>" day grid, aria-busy on a calendar still reading
// availability. No class, wrapper or grid shape is ever matched.
//
// Signed out and at phone width, which is what a customer browsing has: it
// also proves the halls are public, and keeps a staff session from adding its
// own event strip to the screens under test.
// ============================================================

test.use({
  storageState: { cookies: [], origins: [] },
  viewport: { width: 390, height: 844 },
});

// ------------------------------------------------------------ what the screens promise

/** A capacity band the feed filters by, keyed as it appears in the URL. Disjoint, so every hall falls in exactly one. */
interface CapBand {
  key: string;
  min: number;
  /** Inclusive; null = no ceiling. */
  max: number | null;
}

const CAP_BANDS: CapBand[] = [
  { key: "upto-100", min: 0, max: 100 },
  { key: "100-200", min: 101, max: 200 },
  { key: "200-500", min: 201, max: 500 },
  { key: "500-plus", min: 501, max: null },
];

function inBand(capacity: number, band: CapBand): boolean {
  return capacity >= band.min && (band.max === null || capacity <= band.max);
}

function bandText(band: CapBand): string {
  return `${band.min}–${band.max ?? "∞"}`;
}

/** A card's capacity line, and its price line — a real figure or the honest fallback. */
const CAPACITY_LINE = /^Up to [\d,]+ guests$/;
const PRICE_LINE = /^(from ₹.+|Price on request)$/;

/** Every verdict a card may carry about a searched date; a busy hall is labelled, never hidden. */
const AVAILABILITY_CHIP =
  /^(Free all day|Fully booked|Some slots taken|\d+ slots free|(?:Morning|Afternoon|Evening|Full Day) (?:free|taken))$/;

/** The one chip that says nothing is left that day. */
const FULLY_BOOKED = "Fully booked";

/** The feed sorts free halls first: 0 before 1 before 2. */
function availabilityRank(chip: string): number {
  if (chip === "Free all day") return 0;
  return chip === FULLY_BOOKED ? 2 : 1;
}

// ------------------------------------------------------------ dates, in the app's own wording

const SHORT_MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG_MONTH = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Today on the Indian calendar — the clock the feed measures its date window against. */
function istTodayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * A day to search: about a week out, and deliberately kept inside this month,
 * because a hall page's calendar opens on the current month. That keeps the
 * cross-check on a calendar that has been loading since its first byte (see
 * whenAvailabilityLoaded) rather than one paging between months.
 */
function browseDate(): string {
  const [y, m, d] = istTodayISO().split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return isoDate(y, m, Math.min(d + 7, lastDay));
}

function dayOf(dateISO: string): number {
  return Number(dateISO.slice(8, 10));
}

/** "17 Sep", and "17 Sep 2027" past this year — how the pill and the count line print a searched date. */
function searchDateLabel(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  return `${d} ${SHORT_MONTH[m - 1]}${String(y) === istTodayISO().slice(0, 4) ? "" : ` ${y}`}`;
}

/** "September 2026" — what a month calendar calls the month it is showing. */
function monthLabel(dateISO: string): string {
  const [y, m] = dateISO.split("-").map(Number);
  return `${LONG_MONTH[m - 1]} ${y}`;
}

/** The heading of a calendar on that month — "Check a date · September 2026", however it punctuates the two. */
function monthHeading(dateISO: string): RegExp {
  const [y, m] = dateISO.split("-").map(Number);
  return new RegExp(`·\\s*${LONG_MONTH[m - 1]}\\W*${y}$`);
}

/** The month a calendar heading names, read back off the screen. */
function parseMonthLabel(heading: string): { year: number; month: number } {
  const parts = /([A-Za-z]+)\s+(\d{4})\s*$/.exec(heading.trim());
  const month = parts ? LONG_MONTH.indexOf(parts[1]) + 1 : 0;
  expect(month, `"${heading}" names a month and a year`).toBeGreaterThan(0);
  return { year: Number(parts?.[2]), month };
}

/** The count line above the results when nothing has been filtered out. */
function spacesLine(count: number): string {
  return `${count} ${count === 1 ? "space" : "spaces"}`;
}

// ------------------------------------------------------------ the screens

type Root = Page | Locator;

/**
 * The search entry: one button on the feed (sticky) and on the home screen
 * (inline). Found by the line the design gives screen readers, which says what
 * the control does rather than what it currently shows — so it survives both a
 * restyle and a change to the placeholder text beside it.
 */
function searchPill(root: Root): Locator {
  return root.getByRole("button", { name: /Change the date, guest count and filters/ });
}

/** One hall, as a card: the <article> HallCard renders on the feed and in the home rail alike. */
function hallCards(root: Root): Locator {
  return root.getByRole("article");
}

/** A card's own heading — its hall's name. Level-agnostic: a card is the only thing inside a card with a heading. */
function cardTitle(card: Locator): Locator {
  return card.getByRole("heading");
}

/** The card for one named hall. */
function cardFor(page: Page, name: string): Locator {
  return hallCards(page).filter({ has: page.getByRole("heading", { name, exact: true }) });
}

/**
 * A capacity chip, found by the URL it writes. An unfiltered feed (and the
 * home screen) writes exactly one parameter, so this is unambiguous there;
 * once a search is on, every chip carries the rest of it too and a chip is
 * found by its own label instead.
 */
function capChip(page: Page, key: string): Locator {
  return page.locator(`a[href="/app/venues?cap=${key}"]`);
}

async function text(locator: Locator): Promise<string> {
  return ((await locator.textContent()) ?? "").trim();
}

async function cardCapacity(card: Locator): Promise<number> {
  const line = await text(card.getByText(CAPACITY_LINE).first());
  const digits = line.replace(/\D/g, "");
  expect(digits, `a card's capacity line reads "${line}"`).not.toBe("");
  return Number(digits);
}

/** Where a card goes — the hall's own page. */
async function cardHref(card: Locator): Promise<string> {
  const href = await card.getByRole("link").first().getAttribute("href");
  expect(href, "the card links to one hall's page").toMatch(/^\/app\/venues\/[^/?]+$/);
  return href as string;
}

/** The availability verdict a card carries for the searched date. */
async function cardAvailability(card: Locator): Promise<string> {
  const chip = card.getByText(AVAILABILITY_CHIP);
  await expect(chip, "a searched date gives every card an availability chip").toBeVisible();
  return text(chip);
}

/**
 * A month grid marks itself aria-busy while it reads live availability, and
 * offers every future day until that lands — so a day read too early looks
 * free whether it is or not. The grid renders busy from its first byte, which
 * is what makes waiting for the mark to GO a sound wait on a freshly opened
 * screen.
 */
async function whenAvailabilityLoaded(root: Root): Promise<void> {
  await expect(root.locator('[aria-busy="true"]')).toHaveCount(0);
}

/** Page the hall page's calendar forward until it is on the month of `dateISO` (browseDate needs none). */
async function showCalendarMonth(page: Page, dateISO: string): Promise<void> {
  const heading = page.getByRole("heading", { name: monthHeading(dateISO) });
  for (let step = 0; step <= 12; step++) {
    await whenAvailabilityLoaded(page);
    if ((await heading.count()) > 0) break;
    await page.getByRole("button", { name: "Next month" }).click();
  }
  await expect(heading, `the calendar reaches ${monthLabel(dateISO)}`).toBeVisible();
  await whenAvailabilityLoaded(page);
}

/** One day cell on the hall page's calendar, which names its days by their number. */
function calendarDay(page: Page, dateISO: string): Locator {
  return page.getByRole("button", { name: String(dayOf(dateISO)), exact: true });
}

// ------------------------------------------------------------ the specs

test.describe("Customer app — browsing halls", () => {
  let halls: PublishedHall[] = [];

  test.beforeAll(async () => {
    halls = await publishedHalls();
    if (halls.length === 0) {
      throw new Error("No published hall in the database (an active, top-level Venue). Run pnpm db:seed.");
    }
  });

  test.afterAll(async () => {
    await disconnectDb();
  });

  test("the feed opens on a search pill, size chips, an honest count and real hall cards", async ({ page }) => {
    await page.goto("/app/venues");
    await expect(page.getByRole("heading", { level: 1, name: "Our halls" })).toBeVisible();

    await test.step("the search pill offers a date and a party size, and claims neither", async () => {
      const pill = searchPill(page);
      await expect(pill).toBeVisible();
      await expect(pill).toContainText("Add dates");
      await expect(pill).toContainText("Add guests");
    });

    await test.step("a size chip for every band a hall falls into, and none that leads nowhere", async () => {
      const offered = CAP_BANDS.filter((band) => halls.some((hall) => inBand(hall.capacity, band)));
      expect(offered.length, "the published halls fall into at least one size band").toBeGreaterThan(0);
      for (const band of offered) {
        await expect(capChip(page, band.key), `the ${band.key} chip`).toBeVisible();
      }
      for (const band of CAP_BANDS.filter((b) => !offered.includes(b))) {
        await expect(capChip(page, band.key), `no ${band.key} chip — no hall is that size`).toHaveCount(0);
      }
    });

    await test.step("a card for every published hall, and a count line that says so", async () => {
      const cards = hallCards(page);
      await expect(cards).toHaveCount(halls.length);
      await expect(page.getByText(spacesLine(halls.length), { exact: true })).toBeVisible();

      const shown = (await cardTitle(cards).allTextContents()).map((t) => t.trim()).sort();
      expect(shown, "the feed shows the published halls, and only those").toEqual(halls.map((h) => h.name).sort());
    });

    await test.step("every card carries a name, a capacity and a price", async () => {
      const cards = hallCards(page);
      for (let i = 0; i < (await cards.count()); i++) {
        const card = cards.nth(i);
        const name = await text(cardTitle(card));
        expect(name, `card ${i + 1} is named`).not.toBe("");
        await expect(card.getByText(CAPACITY_LINE), `${name} says how many it seats`).toBeVisible();
        await expect(card.getByText(PRICE_LINE), `${name} prices itself, or says price on request`).toBeVisible();
      }
    });
  });

  test("a size chip filters the feed to halls of that size", async ({ page }) => {
    await page.goto("/app/venues");

    // A band that leaves some halls out proves the filter; any offered band is
    // still worth checking when every hall is one size.
    const offered = CAP_BANDS.filter((band) => halls.some((hall) => inBand(hall.capacity, band)));
    const band = offered.find((b) => halls.some((hall) => !inBand(hall.capacity, b))) ?? offered[0];
    const expected = halls.filter((hall) => inBand(hall.capacity, band));

    const chip = capChip(page, band.key);
    const label = await text(chip);
    expect(label, "the size chip is labelled").not.toBe("");
    await chip.click();
    await page.waitForURL(new RegExp(`/app/venues\\?[^#]*cap=${escapeRegExp(band.key)}(?:&|$)`));

    await test.step(`every card on screen seats ${bandText(band)}`, async () => {
      const cards = hallCards(page);
      await expect(cards).toHaveCount(expected.length);
      for (let i = 0; i < (await cards.count()); i++) {
        const card = cards.nth(i);
        const name = await text(cardTitle(card));
        const capacity = await cardCapacity(card);
        expect(inBand(capacity, band), `${name} seats ${capacity}, inside ${bandText(band)}`).toBe(true);
      }
    });

    await test.step("the count line counts what was filtered out", async () => {
      const line =
        expected.length < halls.length ? `${expected.length} of ${halls.length} spaces` : spacesLine(halls.length);
      await expect(page.getByText(line, { exact: true })).toBeVisible();
    });

    await test.step("the chip now clears itself, and so does Clear all", async () => {
      await expect(page.getByRole("link", { name: label, exact: true })).toHaveAttribute("href", "/app/venues");
      await expect(page.getByRole("link", { name: "Clear all", exact: true })).toHaveAttribute("href", "/app/venues");
    });
  });

  test("the search sheet writes the chosen date into the URL, the pill, the count line and every card", async ({
    page,
  }) => {
    test.slow();
    await page.goto("/app/venues");

    const pill = searchPill(page);
    // The sheet is React state: a tap that lands before hydration is lost.
    await whenInteractive(pill);
    await pill.click();

    const sheet = page.getByRole("dialog", { name: "Find a hall" });
    await expect(sheet).toBeVisible();
    // Days others hold are struck out only once the live read lands; picking
    // before then could choose a day the calendar was about to withdraw.
    await whenAvailabilityLoaded(sheet);

    // The calendar names its own month, and its grid names itself: every
    // button inside "Days in <month>" is a day of that month.
    const month = parseMonthLabel(await text(sheet.getByRole("heading", { name: /^[A-Za-z]+ \d{4}$/ }).first()));
    const day = sheet.getByRole("group", { name: /^Days in / }).getByRole("button", { disabled: false }).first();
    const dateISO = isoDate(month.year, month.month, Number(await text(day)));
    expect(dateISO >= istTodayISO(), `${dateISO} is still offered, so it has not passed`).toBe(true);

    await day.click();
    await expect(day, "the picked day is marked chosen").toHaveAttribute("aria-pressed", "true");
    await sheet.getByRole("button", { name: "Show halls" }).click();

    const label = searchDateLabel(dateISO);

    await test.step("the search lands in the URL, so the screen is shareable", async () => {
      await page.waitForURL(new RegExp(`[?&]date=${escapeRegExp(dateISO)}(?:&|$)`));
      await expect(sheet).toBeHidden();
    });

    await test.step("the pill says what is being searched", async () => {
      await expect(searchPill(page)).toContainText(label);
    });

    await test.step("the count line is about that date", async () => {
      await expect(
        page.getByText(
          new RegExp(`^(?:\\d+ free on|None fully free on) ${escapeRegExp(label)}(?: · \\d+ spaces? listed)?$`)
        )
      ).toBeVisible();
      await expect(page.getByText("Free halls first", { exact: true })).toBeVisible();
    });

    await test.step("every card says where it stands on that date", async () => {
      const cards = hallCards(page);
      await expect(cards, "a date never hides a hall").toHaveCount(halls.length);
      for (let i = 0; i < (await cards.count()); i++) await cardAvailability(cards.nth(i));
    });
  });

  test("no card claims a date is free that the hall's own calendar has taken", async ({ page }) => {
    test.slow();
    const dateISO = browseDate();
    await page.goto(`/app/venues?date=${dateISO}`);

    const cards = hallCards(page);
    await expect(cards).toHaveCount(halls.length);

    const shown: { name: string; href: string; chip: string }[] = [];
    for (let i = 0; i < (await cards.count()); i++) {
      const card = cards.nth(i);
      shown.push({
        name: await text(cardTitle(card)),
        href: await cardHref(card),
        chip: await cardAvailability(card),
      });
    }

    await test.step("free halls come first, and busy ones are labelled rather than hidden", async () => {
      const ranks = shown.map((hall) => availabilityRank(hall.chip));
      expect(
        ranks.every((rank, i) => i === 0 || ranks[i - 1] <= rank),
        `free first, then partly free, then booked: ${shown.map((h) => `${h.name} (${h.chip})`).join(", ")}`
      ).toBe(true);
    });

    // The hall page's calendar strikes a day out only when nothing is left on
    // it — exactly what "Fully booked" claims on a card, and exactly what
    // every other chip denies. Cross-check one card of each kind the day
    // offers; the free claim is the one that must never be wrong.
    const free = shown.find((hall) => hall.chip !== FULLY_BOOKED);
    const booked = shown.find((hall) => hall.chip === FULLY_BOOKED);

    if (free) {
      await test.step(`${free.name} says "${free.chip}", so its calendar still offers ${dateISO}`, async () => {
        await page.goto(free.href);
        await showCalendarMonth(page, dateISO);
        const cell = calendarDay(page, dateISO);
        await expect(cell, `one calendar cell for ${dateISO}`).toHaveCount(1);
        await expect(cell).toBeEnabled();
      });
    }

    if (booked) {
      await test.step(`${booked.name} says "${FULLY_BOOKED}", so its calendar has struck ${dateISO} out`, async () => {
        await page.goto(booked.href);
        await showCalendarMonth(page, dateISO);
        const cell = calendarDay(page, dateISO);
        await expect(cell, `one calendar cell for ${dateISO}`).toHaveCount(1);
        await expect(cell).toBeDisabled();
      });
    } else {
      test.info().annotations.push({
        type: "not exercised",
        description: `No hall is fully booked on ${dateISO}, so the struck-out half of the cross-check had nothing to check.`,
      });
    }
  });

  test("opening a card lands on that hall's page, with its name, its size, what it offers and a way to reserve it", async ({
    page,
  }) => {
    test.slow();
    // A hall that lists amenities, so a card and its page can be compared on one.
    const hall = halls.find((h) => h.amenities.length > 0) ?? halls[0];
    const amenity: string | null = hall.amenities[0] ?? null;

    await page.goto("/app/venues");
    const card = cardFor(page, hall.name);
    await expect(card, `one card for ${hall.name}`).toHaveCount(1);
    expect(await cardCapacity(card), "the card's capacity is the hall's own").toBe(hall.capacity);
    if (amenity) await expect(card.getByText(amenity, { exact: true })).toBeVisible();

    const link = card.getByRole("link").first();
    await expect(link, "the card links to this hall's record").toHaveAttribute("href", `/app/venues/${hall.id}`);
    await link.click();
    await page.waitForURL(new RegExp(`/app/venues/${escapeRegExp(hall.id)}(?:\\?|$)`));

    await test.step("the page is about this hall and nothing else", async () => {
      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1, "one first-level heading").toHaveCount(1);
      await expect(h1).toHaveText(hall.name);
      await expect(
        page.getByText(`Up to ${hall.capacity.toLocaleString("en-IN")} guests`, { exact: true })
      ).toBeVisible();
    });

    if (amenity) {
      await test.step(`"What this space offers" lists ${amenity}, the amenity the card showed`, async () => {
        await expect(page.getByRole("heading", { name: "What this space offers" })).toBeVisible();
        await expect(
          page.getByRole("listitem").filter({ has: page.getByText(amenity, { exact: true }) }).first()
        ).toBeVisible();
      });
    } else {
      test.info().annotations.push({
        type: "not exercised",
        description: `${hall.name} lists no amenities, so there was none to carry from the card to the page.`,
      });
    }

    if (!hall.hasPublicReviews) {
      await test.step("no approved review, so the page claims no rating", async () => {
        await expect(page.getByRole("link", { name: /\breviews?\b/i })).toHaveCount(0);
        await expect(page.getByRole("heading", { name: "What hosts say" })).toHaveCount(0);
      });
    }

    await test.step("Reserve carries this hall into the reserve flow", async () => {
      // The phone's sticky bar and the laptop's card are both rendered; only
      // the one this viewport shows is in the accessibility tree.
      const reserve = visibleOnly(
        page.getByRole("link", { name: new RegExp(`^Reserve .+ at ${escapeRegExp(hall.name)}$`) })
      );
      await expect(reserve).toBeVisible();
      await expect(reserve).toHaveText("Reserve");
      await reserve.click();
      await page.waitForURL(/\/app\/book\?/);
      expect(new URL(page.url()).searchParams.get("venueId"), "the reserve flow opens on this hall").toBe(hall.id);
      await expect(page.getByText("Reserve a date", { exact: true })).toBeVisible();
    });
  });

  test("a hall with no published photo says so — on its card and on its page", async ({ page }) => {
    await page.goto("/app/venues");

    const illustrated = hallCards(page).filter({ has: page.getByText("Illustration", { exact: true }) });
    if ((await illustrated.count()) === 0) {
      test.info().annotations.push({
        type: "not exercised",
        description: "Every published hall has a photo, so no illustration was on screen to check.",
      });
      return;
    }

    const card = illustrated.first();
    const name = await text(cardTitle(card));
    const href = await cardHref(card);

    await test.step(`${name}'s card labels its picture an illustration`, async () => {
      await expect(card.getByText("Illustration", { exact: true })).toBeVisible();
      await expect(
        card.getByRole("img", { name: new RegExp(`^Illustration, not a photo of ${escapeRegExp(name)}`) })
      ).toBeVisible();
      // And the feed says, in words, what that label means.
      await expect(page.getByText(/^Pictures marked .Illustration. are not photos of our halls\./)).toBeVisible();
    });

    await test.step("its own page carries the same label and says the photos aren't published yet", async () => {
      await page.goto(href);
      await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
      await expect(visibleOnly(page.getByText("Illustration", { exact: true }))).toBeVisible();
      await expect(page.getByText(new RegExp(`We haven.t published photos of ${escapeRegExp(name)} yet`))).toBeVisible();
      // Nothing that would read as a photo set of a hall we have no photo of.
      await expect(page.getByRole("link", { name: "Show all photos" })).toHaveCount(0);
    });
  });

  test("the home screen opens on browsing: a heading, the same search, real halls and a size shortcut", async ({
    page,
  }) => {
    await page.goto("/app");

    await test.step("the screen opens on the halls", async () => {
      await expect(page.getByRole("heading", { level: 1, name: "Find your space." })).toBeVisible();
      await expect(searchPill(page)).toBeVisible();
    });

    await test.step("the rail shows real halls and counts the rest honestly", async () => {
      const cards = hallCards(page);
      expect(await cards.count(), "at least one hall on the home screen").toBeGreaterThan(0);
      const published = halls.map((h) => h.name);
      for (const shown of await cardTitle(cards).allTextContents()) {
        expect(published, `"${shown.trim()}" is a published hall`).toContain(shown.trim());
      }
      const spaces = `space${halls.length === 1 ? "" : "s"}`;
      await expect(
        page.getByRole("link", { name: `See all ${halls.length.toLocaleString("en-IN")} ${spaces}` })
      ).toBeVisible();
    });

    await test.step("a size chip opens the feed already filtered", async () => {
      const chips = page.getByRole("navigation", { name: "Browse spaces by guest count" }).getByRole("link");
      if ((await chips.count()) === 0) {
        test.info().annotations.push({
          type: "not exercised",
          description: "The published halls fall into a single size band, so the home screen offers no size shortcut.",
        });
        return;
      }

      const href = (await chips.first().getAttribute("href")) ?? "";
      const key = new URL(href, "http://localhost").searchParams.get("cap") ?? "";
      const band = CAP_BANDS.find((b) => b.key === key);
      expect(band, `the chip filters by a real band (it asked for "${key}")`).toBeTruthy();
      const expected = halls.filter((hall) => inBand(hall.capacity, band as CapBand));

      await chips.first().click();
      await page.waitForURL(new RegExp(`/app/venues\\?[^#]*cap=${escapeRegExp(key)}(?:&|$)`));

      const cards = hallCards(page);
      await expect(cards).toHaveCount(expected.length);
      for (let i = 0; i < (await cards.count()); i++) {
        const capacity = await cardCapacity(cards.nth(i));
        expect(inBand(capacity, band as CapBand), `a ${key} hall seats ${capacity}`).toBe(true);
      }
    });
  });
});
