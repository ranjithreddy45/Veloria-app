import type { Metadata } from "next";
import { CalendarCheck, CreditCard, Users, Bell } from "lucide-react";
import { InstallAppCard } from "@/components/pwa/install-app-card";

export const metadata: Metadata = {
  title: "Get the app — Veloria Grand",
  description:
    "Install Veloria Grand on your phone for one-tap access to your bookings, invoices, guest list and event updates.",
};

const PERKS = [
  { icon: CalendarCheck, title: "Your event, always to hand", body: "Bookings, dates and venue details a tap from your home screen." },
  { icon: CreditCard, title: "Pay and track", body: "Settle invoices securely and watch your payment schedule." },
  { icon: Users, title: "Guest list on the go", body: "Add guests, send invitations and follow RSVPs from anywhere." },
  { icon: Bell, title: "Event-day updates", body: "Reminders as your celebration gets close." },
];

export default function GetAppPage() {
  return (
    <div className="mx-auto max-w-lg space-y-8">
      <header className="text-center">
        <p className="text-muted-foreground text-meta font-semibold uppercase tracking-[0.18em]">
          Veloria Grand
        </p>
        <h1 className="text-foreground mt-3 text-h1 sm:text-h1">
          Take your event with you
        </h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-md text-copy leading-relaxed">
          Install Veloria Grand on your phone — it opens full-screen with its own icon,
          just like an app from the store.
        </p>
      </header>

      <InstallAppCard />

      <ul className="grid gap-3 sm:grid-cols-2">
        {PERKS.map((p) => (
          <li key={p.title} className="bg-card shadow-card rounded-2xl border p-4">
            <p.icon className="text-primary size-5" />
            <p className="text-foreground mt-3 text-sm font-semibold">{p.title}</p>
            <p className="text-muted-foreground mt-1 text-body leading-relaxed">{p.body}</p>
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground text-center text-xs leading-relaxed">
        Works on iPhone and Android. Nothing to download from an app store — it installs
        straight from your browser and updates itself.
      </p>
    </div>
  );
}
