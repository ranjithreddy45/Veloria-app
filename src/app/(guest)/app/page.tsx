import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  Users,
  Star,
  Phone,
  CalendarHeart,
  PartyPopper,
  Briefcase,
  Cake,
  Gem,
  HeartHandshake,
} from "lucide-react";
import { getStorefrontVenues } from "@/actions/storefront.actions";
import { VenueCover } from "../_components/venue-cover";
import { formatPrice } from "../_components/format";

const OCCASIONS = [
  { label: "Wedding", icon: HeartHandshake, type: "Wedding" },
  { label: "Reception", icon: Gem, type: "Reception" },
  { label: "Birthday", icon: Cake, type: "Birthday Party" },
  { label: "Corporate", icon: Briefcase, type: "Corporate Event" },
  { label: "Engagement", icon: CalendarHeart, type: "Engagement" },
  { label: "Sangeet", icon: PartyPopper, type: "Social Gathering" },
];

export default async function GuestHomePage() {
  const venues = await getStorefrontVenues();

  return (
    <div>
      {/* ---- Hero ---- */}
      <header className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-5 pb-8 pt-[calc(var(--sat)+1.5rem)] text-white">
        <div
          aria-hidden
          className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_20%_10%,white_0,transparent_40%),radial-gradient(circle_at_90%_80%,white_0,transparent_35%)]"
        />
        <div className="relative">
          <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.1em] text-white/80">
            <Gem className="size-3.5" />
            Veloria Grand
          </div>
          <h1 className="mt-3 font-serif text-[28px] font-semibold leading-tight">
            Celebrate your big day at Bangalore&apos;s premium venue
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-white/85">
            Three elegant halls · 50–300 guests · transparent pricing · your
            caterer, your way.
          </p>

          {/* trust row */}
          <div className="mt-4 flex items-center gap-4 text-[12.5px] text-white/90">
            <span className="inline-flex items-center gap-1">
              <Star className="size-3.5 fill-amber-300 text-amber-300" />
              4.8 Google rating
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" />
              500+ events hosted
            </span>
          </div>

          <Link
            href="/app/book"
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-[14px] font-semibold text-indigo-700 shadow-sm transition active:scale-[0.99]"
          >
            <Sparkles className="size-4" />
            Check availability &amp; book
          </Link>
        </div>
      </header>

      {/* ---- Occasions ---- */}
      <section className="px-5 pt-6">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
          What are you planning?
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {OCCASIONS.map((o) => {
            const Icon = o.icon;
            return (
              <Link
                key={o.label}
                href={`/app/book?occasion=${encodeURIComponent(o.type)}`}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 text-center transition active:scale-[0.98]"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-5" strokeWidth={2} />
                </span>
                <span className="text-[12px] font-medium text-foreground">
                  {o.label}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ---- Venues ---- */}
      <section className="px-5 pt-7">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
            Our halls
          </h2>
          <Link
            href="/app/venues"
            className="inline-flex items-center gap-0.5 text-[12.5px] font-medium text-primary"
          >
            See all <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {venues.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-[13px] text-muted-foreground">
            Venues will appear here once they&apos;re published.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {venues.map((v) => (
              <Link
                key={v.id}
                href={`/app/venues/${v.id}`}
                className="block overflow-hidden rounded-2xl border border-border bg-card transition active:scale-[0.99]"
              >
                <VenueCover
                  name={v.name}
                  seed={v.id}
                  rounded={false}
                  className="h-40 w-full"
                />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[15px] font-semibold text-foreground">
                      {v.name}
                    </h3>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      from {formatPrice(v.pricePerSlot)}
                    </span>
                  </div>
                  {v.description && (
                    <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
                      {v.description}
                    </p>
                  )}
                  <div className="mt-2.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <Users className="size-3.5" />
                    Up to {v.capacity} guests
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ---- Help / call ---- */}
      <section className="px-5 pb-2 pt-7">
        <a
          href="tel:+919876543210"
          className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition active:scale-[0.99]"
        >
          <div>
            <p className="text-[13.5px] font-semibold text-foreground">
              Prefer to talk?
            </p>
            <p className="text-[12px] text-muted-foreground">
              Call our events team — we reply fast.
            </p>
          </div>
          <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Phone className="size-4.5" />
          </span>
        </a>
      </section>
    </div>
  );
}
