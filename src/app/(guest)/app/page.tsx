import Link from "next/link";
import {
  Search,
  MapPin,
  Star,
  ArrowRight,
  Users,
  ChevronRight,
  ShieldCheck,
  Wallet,
  UtensilsCrossed,
  Sparkles,
  HeartHandshake,
  Gem,
  Cake,
  Briefcase,
  CalendarHeart,
  PartyPopper,
} from "lucide-react";
import { getStorefrontVenues } from "@/actions/storefront.actions";
import { BrandLogo } from "@/components/layout/brand-logo";
import { VenueImage } from "../_components/venue-image";
import { formatPrice } from "../_components/format";

const OCCASIONS = [
  { label: "Wedding", icon: HeartHandshake, type: "Wedding", bg: "bg-rose-100", fg: "text-rose-600" },
  { label: "Reception", icon: Gem, type: "Reception", bg: "bg-violet-100", fg: "text-violet-600" },
  { label: "Birthday", icon: Cake, type: "Birthday Party", bg: "bg-amber-100", fg: "text-amber-600" },
  { label: "Corporate", icon: Briefcase, type: "Corporate Event", bg: "bg-sky-100", fg: "text-sky-600" },
  { label: "Engagement", icon: CalendarHeart, type: "Engagement", bg: "bg-pink-100", fg: "text-pink-600" },
  { label: "Sangeet", icon: PartyPopper, type: "Social Gathering", bg: "bg-emerald-100", fg: "text-emerald-600" },
];

const TRUST = [
  { icon: ShieldCheck, label: "Verified venue", sub: "4.8★ · 500+ events" },
  { icon: Wallet, label: "Transparent pricing", sub: "No hidden charges" },
  { icon: UtensilsCrossed, label: "Your caterer", sub: "Outside food allowed" },
];

// Revalidate the storefront every 60s so venue/pricing edits surface fast.
export const revalidate = 60;

export default async function GuestHomePage() {
  const venues = await getStorefrontVenues();

  return (
    <div className="bg-zinc-50">
      {/* ---- Sticky top bar: location + search ---- */}
      <header className="sticky top-0 z-30 bg-gradient-to-br from-violet-700 via-violet-600 to-fuchsia-600 px-4 pb-4 pt-[calc(var(--sat)+0.9rem)] text-white shadow-lg shadow-violet-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandLogo
              className="h-7 w-auto max-w-[130px] rounded-md bg-white/95 px-2 py-1 object-contain"
              fallback={
                <>
                  <MapPin className="size-4 text-white/90" />
                  <div className="text-[13px] font-bold leading-tight">Veloria Grand</div>
                </>
              }
            />
            <div className="text-[11px] leading-tight text-white/75">Bangalore · Premium venues</div>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm">
            <Star className="size-3 fill-amber-300 text-amber-300" /> 4.8
          </span>
        </div>

        {/* Search pill */}
        <Link
          href="/app/venues"
          className="mt-3.5 flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3 shadow-sm"
        >
          <Search className="size-4.5 text-violet-600" />
          <span className="text-[13.5px] text-zinc-500">
            Search halls, occasions…
          </span>
        </Link>
      </header>

      {/* ---- Promo banner ---- */}
      <section className="px-4 pt-4">
        <Link
          href="/app/book"
          className="sheen-sweep hover-lift relative block overflow-hidden rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 p-4 text-white shadow-md"
        >
          <div
            aria-hidden
            className="absolute -right-6 -top-8 size-32 rounded-full bg-white/10 blur-xl"
          />
          <div className="relative">
            <div className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide">
              <Sparkles className="size-3" /> Now booking 2026
            </div>
            <h2 className="mt-2 text-[18px] font-extrabold leading-tight">
              Plan your dream event in minutes
            </h2>
            <p className="mt-0.5 text-[12.5px] text-white/85">
              Free site visit · instant quote · best dates going fast
            </p>
            <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-[12.5px] font-bold text-violet-700">
              Check availability <ArrowRight className="size-3.5" />
            </span>
          </div>
        </Link>
      </section>

      {/* ---- Occasions ---- */}
      <section className="px-4 pt-5">
        <h2 className="text-[16px] font-extrabold tracking-tight text-zinc-900">
          Book by occasion
        </h2>
        <div className="mt-3 grid grid-cols-4 gap-2.5">
          {OCCASIONS.map((o) => {
            const Icon = o.icon;
            return (
              <Link
                key={o.label}
                href={`/app/book?occasion=${encodeURIComponent(o.type)}`}
                className="flex flex-col items-center gap-1.5"
              >
                <span
                  className={`flex size-14 items-center justify-center rounded-2xl ${o.bg} ${o.fg} shadow-sm`}
                >
                  <Icon className="size-6" strokeWidth={2.2} />
                </span>
                <span className="text-[11px] font-semibold text-zinc-700">
                  {o.label}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ---- Venues ---- */}
      <section className="px-4 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-extrabold tracking-tight text-zinc-900">
            Our halls
          </h2>
          <Link
            href="/app/venues"
            className="inline-flex items-center gap-0.5 text-[12.5px] font-bold text-violet-600"
          >
            See all <ChevronRight className="size-4" />
          </Link>
        </div>

        {venues.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center text-[13px] text-zinc-500">
            Venues will appear here once published.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {venues.map((v, i) => (
              <Link
                key={v.id}
                href={`/app/venues/${v.id}`}
                className="sheen-sweep hover-lift block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100 transition active:scale-[0.99]"
              >
                <div className="relative">
                  <VenueImage
                    seed={v.id}
                    alt={v.name}
                    priority={i === 0}
                    className="h-44 w-full"
                  />
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-bold text-zinc-800 shadow-sm">
                    <Star className="size-3 fill-amber-400 text-amber-400" /> 4.8
                  </span>
                  {i === 0 && (
                    <span className="absolute right-3 top-3 rounded-full bg-fuchsia-600 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white shadow-sm">
                      Popular
                    </span>
                  )}
                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                    <h3 className="text-[17px] font-extrabold text-white drop-shadow">
                      {v.name}
                    </h3>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[12.5px] text-zinc-500">
                      <Users className="size-3.5" /> Up to {v.capacity} guests
                    </div>
                    {v.description && (
                      <p className="mt-0.5 line-clamp-1 text-[12px] text-zinc-400">
                        {v.description}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10.5px] text-zinc-400">from</div>
                    <div className="text-[15px] font-extrabold text-violet-700">
                      {formatPrice(v.pricePerSlot)}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ---- Trust strip ---- */}
      <section className="px-4 pt-6">
        <div className="grid grid-cols-3 gap-2.5">
          {TRUST.map((t) => {
            const Icon = t.icon;
            return (
              <div
                key={t.label}
                className="hover-lift rounded-2xl bg-white p-3 text-center shadow-sm ring-1 ring-zinc-100"
              >
                <Icon className="mx-auto size-5 text-violet-600" strokeWidth={2.2} />
                <div className="mt-1.5 text-[11.5px] font-bold leading-tight text-zinc-800">
                  {t.label}
                </div>
                <div className="mt-0.5 text-[10px] leading-tight text-zinc-400">
                  {t.sub}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- Call CTA ---- */}
      <section className="px-4 pb-3 pt-5">
        <a
          href="tel:+919876543210"
          className="flex items-center justify-center gap-2 rounded-2xl border-2 border-violet-200 bg-violet-50 px-5 py-3 text-[13.5px] font-bold text-violet-700"
        >
          📞 Talk to our events team
        </a>
      </section>
    </div>
  );
}
