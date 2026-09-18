import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { BackButton, NavLink } from "../../../../_components/nav-transition";
import { Card, EmptyNote, ProgressBar, Screen } from "../../../../_components/ui";
import { getStorefrontVenue } from "@/actions/storefront.actions";
import { getGuestVenueReviews } from "@/actions/guest-public.actions";

// Every approved public review of a hall — the same Review rows the team
// approves at /reviews. Nothing else is counted or shown.

type Params = Promise<{ venueId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { venueId } = await params;
  const venue = await getStorefrontVenue(venueId);
  return { title: venue ? `Reviews of ${venue.name} — Veloria Grand` : "Reviews — Veloria Grand" };
}

function Stars({ value, className }: { value: number; className?: string }) {
  const full = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className={className} role="img" aria-label={`${value} out of 5 stars`}>
      {"★".repeat(full)}
      {"☆".repeat(5 - full)}
    </span>
  );
}

const pageLink = "inline-flex min-h-10 items-center rounded-full border border-black/[.08] bg-white px-4 py-2 text-detail font-semibold text-[#1d1d1f]";

export default async function VenueReviewsPage({ params, searchParams }: { params: Params; searchParams: Promise<{ page?: string }> }) {
  const [{ venueId }, { page }] = await Promise.all([params, searchParams]);
  const venue = await getStorefrontVenue(venueId);
  if (!venue) notFound();
  const data = await getGuestVenueReviews(venue.id, Number(page) || 1);
  const base = `/app/venues/${venue.id}/reviews`;

  return (
    <Screen flush className="vg-gutter gap-4 pb-6 pt-[calc(var(--sat)+0.5rem)]">
      {/* A real h1 — ScreenHeader's title is a styled div. */}
      <div className="flex items-center gap-3">
        <BackButton href={`/app/venues/${venue.id}`} />
        <div className="min-w-0 flex-1">
          <h1 className="text-copy font-semibold">Reviews</h1>
          <div className="text-meta text-[#6e6e73]">{venue.name}</div>
        </div>
      </div>

      {data.rating == null ? (
        <EmptyNote>No published reviews for {venue.name} yet.</EmptyNote>
      ) : (
        <>
          <Card className="flex items-center gap-5 p-4 lg:max-w-2xl">
            <div className="shrink-0 text-center">
              <div className="numeric font-editorial text-[40px] font-semibold leading-none">{data.rating}</div>
              <Stars value={data.rating} className="mt-1.5 block text-meta tracking-[2px] text-[#b88513]" />
              <div className="mt-1 text-meta text-[#6e6e73]">
                {data.count} review{data.count === 1 ? "" : "s"}
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              {data.distribution.map((d) => (
                <div key={d.stars} className="flex items-center gap-2 text-meta text-[#6e6e73]">
                  <span className="numeric w-2.5 text-right">{d.stars}</span>
                  <Star className="size-3 shrink-0 fill-[#b88513] text-[#b88513]" aria-hidden />
                  <ProgressBar pct={(d.count / data.count) * 100} className="h-1.5 flex-1" fill="bg-[#b88513]" />
                  <span className="numeric w-6 text-right">{d.count}</span>
                </div>
              ))}
            </div>
          </Card>
          <p className="max-w-[70ch] text-meta leading-[1.5] text-[#636368]">
            Reviews from hosts of events at {venue.name}, published after our team checked them.
          </p>

          {/* Two columns on a laptop: a review read across 1,000px is unreadable. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {data.reviews.map((r) => (
              <Card key={r.id} as="section" className="flex flex-col gap-2 p-4">
                <Stars value={r.rating} className="text-meta tracking-[2px] text-[#b88513]" />
                {r.title && <div className="text-body font-semibold">{r.title}</div>}
                <p className="whitespace-pre-line text-detail leading-[1.55] text-[#3a3a3c]">{r.text}</p>
                <div className="text-meta text-[#6e6e73]">
                  <span className="font-semibold text-[#1d1d1f]">{r.who}</span> · {r.when}
                </div>
              </Card>
            ))}
          </div>

          {data.pageCount > 1 && (
            <nav className="flex items-center justify-between gap-3" aria-label="Review pages">
              {data.page > 1 ? (
                <NavLink href={data.page === 2 ? base : `${base}?page=${data.page - 1}`} kind="pop" className={pageLink}>
                  Newer
                </NavLink>
              ) : (
                <span />
              )}
              <span className="text-meta text-[#6e6e73]">
                Page {data.page} of {data.pageCount}
              </span>
              {data.page < data.pageCount ? (
                <NavLink href={`${base}?page=${data.page + 1}`} kind="push" className={pageLink}>
                  Older
                </NavLink>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </Screen>
  );
}
