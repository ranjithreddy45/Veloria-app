import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, ArrowUpRight, CalendarX } from "lucide-react";
import { auth } from "@/../auth";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { getPortalGuestBookings } from "@/actions/portal-guest.actions";

export const metadata: Metadata = { title: "Guest List" };

export default async function PortalGuestsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const bookings = await getPortalGuestBookings();

  // One event → jump straight into managing its guests.
  if (bookings.length === 1) redirect(`/portal/guests/${bookings[0].id}`);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Your account"
        title="Guest List"
        description="Invite your guests and follow their replies, event by event."
      />

      {bookings.length === 0 ? (
        <Card className="shadow-card rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="bg-muted flex size-16 items-center justify-center rounded-2xl">
              <CalendarX className="text-muted-foreground/60 size-8" />
            </div>
            <h3 className="font-editorial text-foreground mt-5 text-xl font-semibold">
              No one to invite just yet
            </h3>
            <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
              Once your event is booked, you can build your guest list and send
              invitations from right here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {bookings.map((b) => {
            const eventDate = new Date(b.date);
            const guestCount = b.guestList?._count?.guests ?? 0;
            return (
              <Link key={b.id} href={`/portal/guests/${b.id}`} className="block">
                <Card className="group shadow-card hover:shadow-card-hover h-full overflow-hidden rounded-2xl py-0 transition-all duration-200">
                  <CardContent className="p-0">
                    <div className="bg-primary/[0.05] flex items-center gap-4 px-5 py-4">
                      <div className="text-center">
                        <p className="numeric text-primary text-[26px] font-semibold leading-none">
                          {eventDate.getDate()}
                        </p>
                        <p className="text-primary/70 mt-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
                          {eventDate.toLocaleDateString("en-IN", { month: "short" })}
                        </p>
                      </div>
                      <div className="bg-border h-9 w-px" />
                      <div className="min-w-0 flex-1">
                        <p className="font-editorial text-foreground truncate text-[16px] font-semibold">
                          {b.eventName}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {b.venue?.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t px-5 py-3.5">
                      <span className="text-muted-foreground flex items-center gap-2 text-sm">
                        <Users className="text-muted-foreground/50 size-4" />
                        <span className="numeric">{guestCount}</span> guest
                        {guestCount === 1 ? "" : "s"}
                      </span>
                      <span className="text-primary flex items-center gap-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
                        Manage <ArrowUpRight className="size-3" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
