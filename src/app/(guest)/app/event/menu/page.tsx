import { ChevronRight, UtensilsCrossed } from "lucide-react";
import { requireGuest } from "@/lib/guest-session";
import { getGuestMenu, submitMenuSelection, withdrawMenuSelection } from "@/actions/guest-menu.actions";
import { NavLink } from "../../../_components/nav-transition";
import { Screen, ScreenHeader, Card, EmptyNote, PrimaryButton, IconTile } from "../../../_components/ui";
import { inr, fmtDate } from "../../../_components/format";
import { groupByMenuCategory } from "./_lib/menu-rules";
import { MenuSelector } from "./_components/menu-selector";
import { MenuRequestList } from "./_components/menu-request-list";

export const metadata = { title: "Your menu — Veloria Grand" };
export const dynamic = "force-dynamic";

export default async function EventMenuPage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const { b } = await searchParams;
  const q = b ? `?b=${encodeURIComponent(b)}` : "";
  await requireGuest(`/app/event/menu${q}`);
  const view = await getGuestMenu(b);

  if (!view) {
    return (
      <Screen className="gap-4">
        <ScreenHeader title="Menu" backHref={`/app/event${q}`} />
        <EmptyNote>No booking is linked to this account yet. Once your date is held, you can choose your menu here.</EmptyNote>
        <PrimaryButton href="/app/book">Reserve a date</PrimaryButton>
      </Screen>
    );
  }

  const { booking, rules, bookingMenu, requests } = view;
  const latest = requests[0];
  // Start the picker from the host's last picks when those went nowhere; else from the menu on the booking.
  const initialItems =
    latest && (latest.status === "WITHDRAWN" || latest.status === "DECLINED")
      ? latest.items.map((i) => ({ menuItemId: i.menuItemId, note: i.note }))
      : (bookingMenu?.selections ?? []).map((s) => ({ menuItemId: s.menuItemId, note: null }));

  return (
    <Screen className="gap-4">
      <ScreenHeader title="Menu" sub={`${booking.eventName} · ${fmtDate(booking.date)}`} backHref={`/app/event?b=${encodeURIComponent(booking.id)}`} />

      {view.preview && (
        <div className="rounded-xl border border-[#b88513]/35 bg-[#faf3e1] px-3.5 py-2.5 text-detail text-[#6e4f0e]">
          <span className="font-semibold">Staff preview.</span> You&apos;re seeing the host&apos;s menu screen. Sending and withdrawing are turned off.
        </div>
      )}

      {rules.packageId && rules.perPlate != null ? (
        <Card className="px-4 py-3.5">
          <div className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-[#b88513]">Your package · from your quotation</div>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <div className="text-body font-semibold">{rules.packageLabel}</div>
            <div className="numeric text-detail font-semibold text-[#6d1b52]">{inr(rules.perPlate)} <span className="text-meta font-medium text-[#8a8a8e]">per plate</span></div>
          </div>
          {rules.vegOnly && <p className="mt-1.5 text-meta leading-[1.45] text-[#6e6e73]">A vegetarian package: dishes the team marks non-vegetarian aren&apos;t offered.</p>}
        </Card>
      ) : rules.foodMode === "HALL_ONLY" ? (
        <Card className="px-4 py-3.5 text-meta leading-[1.45] text-[#6e6e73]">
          Your quotation is for the hall without Veloria catering. You can still share menu picks; the team will confirm any catering price with you before anything changes.
        </Card>
      ) : null}

      {!view.collaborator && (
        <NavLink href={view.tastingHref} kind="push" className="vg-card vg-press flex items-center gap-3 rounded-2xl px-4 py-3">
          <IconTile size={34}><UtensilsCrossed className="size-4" strokeWidth={1.9} /></IconTile>
          <span className="min-w-0 flex-1">
            <span className="block text-body font-semibold">Taste before you decide</span>
            <span className="block text-meta text-[#6e6e73]">Book a menu tasting{booking.venueName ? ` at ${booking.venueName}` : ""}</span>
          </span>
          <ChevronRight className="size-4 text-[#c7c7cc]" />
        </NavLink>
      )}

      {bookingMenu && bookingMenu.selections.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between">
            <div className="text-copy font-semibold">Your menu, as the team has it</div>
            <div className="text-meta text-[#6e6e73]">Updated {fmtDate(bookingMenu.updatedAt, { day: "numeric", month: "short" })}</div>
          </div>
          <Card className="mt-2.5 px-4 py-3">
            <div className="text-meta text-[#6e6e73]">For {bookingMenu.guestCount.toLocaleString("en-IN")} guests · {bookingMenu.selections.length} {bookingMenu.selections.length === 1 ? "dish" : "dishes"}</div>
            <div className="mt-2 flex flex-col gap-2.5">
              {groupByMenuCategory(bookingMenu.selections).map((g) => (
                <div key={g.category}>
                  <div className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-[#b88513]">{g.category}</div>
                  <div className="mt-0.5 text-body leading-[1.5]">{g.rows.map((s) => (s.quantity > 1 ? `${s.name} × ${s.quantity}` : s.name)).join(", ")}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {requests.length > 0 && <MenuRequestList requests={requests} preview={view.preview} withdrawAction={withdrawMenuSelection} />}

      {view.blockedReason ? (
        <EmptyNote>{view.blockedReason}</EmptyNote>
      ) : (
        <MenuSelector
          bookingId={booking.id}
          guestCount={booking.guestCount}
          catalog={view.catalog}
          rules={rules}
          preview={view.preview}
          initialItems={initialItems}
          submitAction={submitMenuSelection}
        />
      )}
    </Screen>
  );
}
