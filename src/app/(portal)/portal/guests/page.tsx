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
    <div className="space-y-8">
      <PageHeader title="Guest List" description="Invite your guests and track their RSVPs, per event." />

      {bookings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <CalendarX className="size-8 text-muted-foreground/60" />
            </div>
            <h3 className="mt-4 text-base font-semibold">No events yet</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Once your event is booked, you&apos;ll be able to build your guest list and send invitations here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bookings.map((b) => {
            const eventDate = new Date(b.date);
            const guestCount = b.guestList?._count?.guests ?? 0;
            return (
              <Link key={b.id} href={`/portal/guests/${b.id}`}>
                <Card className="group transition-all duration-200 hover:border-indigo-200 hover:shadow-md dark:hover:border-indigo-800">
                  <CardContent className="p-0">
                    <div className="flex items-center gap-3 rounded-t-xl bg-indigo-50/50 px-5 py-3 dark:bg-indigo-950/20">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{eventDate.getDate()}</p>
                        <p className="text-xs font-medium uppercase text-indigo-500">{eventDate.toLocaleDateString("en-IN", { month: "short" })}</p>
                      </div>
                      <div className="h-8 w-px bg-border" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{b.eventName}</p>
                        <p className="text-xs text-muted-foreground">{b.venue?.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-5 py-3">
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="size-4 text-muted-foreground/60" /> {guestCount} guest{guestCount === 1 ? "" : "s"}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-medium text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-indigo-400">
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
