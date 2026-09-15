import { requireGuest } from "@/lib/guest-session";
import { BOOKING_STATUS_LABEL, customerLabel } from "@/lib/customer-app/status-labels";
import { getGuestRatingDetails, submitGuestReview, type GuestReviewView } from "@/actions/guest-account.actions";
import { Screen, ScreenHeader, Card, Chip, EmptyNote, Pill } from "../../_components/ui";
import { fmtDate } from "../../_components/format";
import { REVIEW_STATE_WORDS } from "./_lib/eligibility";
import { RateForm } from "./_components/rate-form";

export const dynamic = "force-dynamic";

const LONG_DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

function ReviewSummary({ review, firstName }: { review: GuestReviewView; firstName: string | null }) {
  const words = REVIEW_STATE_WORDS[review.state];
  const stars = Math.max(0, Math.min(5, Math.round(review.rating)));
  return (
    <>
      <h2 className="font-editorial text-[26px] font-medium leading-[1.15] tracking-[-.015em]">
        {review.recordedByTeam ? "Your feedback, as the team recorded it" : `Thank you${firstName ? `, ${firstName}` : ""}.`}
      </h2>
      <Card className="flex flex-col gap-3 rounded-[18px] p-[18px]">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[22px] leading-none" role="img" aria-label={`${stars} out of 5 stars`}>
            <span className="text-[#b88513]">{"★".repeat(stars)}</span>
            <span className="text-[#d1d1d6]">{"★".repeat(5 - stars)}</span>
          </div>
          <Pill tone={review.state === "WITH_TEAM" ? "amber" : "green"}>{words.label}</Pill>
        </div>
        <p className="whitespace-pre-line text-body leading-[1.6]">{review.content}</p>
        <p className="text-meta leading-[1.5] text-[#6e6e73]">
          {words.detail} Sent {fmtDate(review.createdAt, LONG_DATE)}.
        </p>
      </Card>
      {review.response && (
        <Card className="rounded-[18px] p-[18px]">
          <div className="text-meta font-semibold uppercase tracking-[.08em] text-[#6d1b52]">Reply from the team</div>
          <p className="mt-1.5 whitespace-pre-line text-body leading-[1.6]">{review.response}</p>
          {review.respondedAt && <div className="numeric mt-1.5 text-meta text-[#8a8a8e]">{fmtDate(review.respondedAt, LONG_DATE)}</div>}
        </Card>
      )}
    </>
  );
}

export default async function RatePage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  await requireGuest("/app/rate");
  const { b } = await searchParams;
  const d = await getGuestRatingDetails(b);
  const booking = d?.booking ?? null;

  return (
    <Screen className="gap-[18px]">
      <ScreenHeader title="After your event" backHref="/app/account" />

      {!d || !booking ? (
        <EmptyNote>
          {d?.sharedOnly
            ? "The bookings you can see were shared with you, and each one is rated by its host."
            : "There's no booking linked to this sign-in yet."}
        </EmptyNote>
      ) : (
        <>
          {d.preview && (
            <p className="rounded-2xl bg-[#fdf3e1] px-4 py-3 text-detail leading-[1.5] text-[#8a5a00]">
              Staff preview: reviews come from the host&apos;s own account, so nothing can be sent from here.
            </p>
          )}

          {d.bookings.length > 1 && (
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
              {d.bookings.map((x) => (
                <Chip key={x.id} href={`/app/rate?b=${x.id}`} active={x.id === booking.id}>
                  {x.eventName}
                </Chip>
              ))}
            </div>
          )}

          <div>
            <div className="text-copy font-semibold">{booking.eventName}</div>
            <div className="text-meta text-[#6e6e73]">
              {fmtDate(booking.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              {booking.venueName ? ` · ${booking.venueName}` : ""} · {customerLabel(BOOKING_STATUS_LABEL, booking.status)}
            </div>
          </div>

          {d.review ? (
            <ReviewSummary review={d.review} firstName={d.firstName} />
          ) : d.reviewsHidden ? (
            <EmptyNote>Reviews are hidden in this preview, because your role can&apos;t open them in the team app.</EmptyNote>
          ) : d.state === "OPEN" ? (
            <RateForm bookingId={booking.id} disabled={d.preview} action={submitGuestReview} />
          ) : (
            <EmptyNote>{d.blockedMessage}</EmptyNote>
          )}
        </>
      )}
    </Screen>
  );
}
