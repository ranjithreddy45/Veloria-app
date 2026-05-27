import Link from "next/link";
import type { Metadata } from "next";
import {
  Calculator,
  MessageSquare,
  Share2,
  ArrowRight,
  Calendar,
  Webhook,
  PhoneCall,
} from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Integrations" };

// ============================================================
// Integration Hub — Available Integrations
// ============================================================

const integrations = [
  {
    title: "Tally",
    description:
      "Sync invoices, payments, and payouts with Tally accounting software.",
    href: "/settings/integrations/tally",
    icon: Calculator,
    color:
      "bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400",
    status: "Placeholder",
    statusColor: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
  },
  {
    title: "WhatsApp Business",
    description:
      "Send booking confirmations, reminders, and updates via WhatsApp Cloud API.",
    href: "/settings/integrations/whatsapp",
    icon: MessageSquare,
    color:
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
    status: "Active",
    statusColor: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  },
  {
    title: "Google Calendar",
    description:
      "Sync bookings and events with Google Calendar for seamless scheduling.",
    href: "/settings/integrations/google-calendar",
    icon: Calendar,
    color:
      "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    status: "Preview",
    statusColor: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
  },
  {
    title: "Social Media",
    description:
      "Share events and promotions on Instagram, Facebook, Twitter, and LinkedIn.",
    href: "/settings/integrations/social",
    icon: Share2,
    color: "bg-pink-100 text-pink-600 dark:bg-pink-950 dark:text-pink-400",
    status: "Placeholder",
    statusColor: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
  },
  {
    title: "Lead Capture",
    description:
      "Auto-capture leads from Facebook Ads, Google Ads, IndiaMart, JustDial, and more via webhooks.",
    href: "/settings/integrations/lead-capture",
    icon: Webhook,
    color: "bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400",
    status: "Active",
    statusColor: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  },
  {
    title: "Cloud Telephony",
    description:
      "Connect Exotel, Knowlarity, or MyOperator for click-to-call and automatic call recording.",
    href: "/settings/integrations/telephony",
    icon: PhoneCall,
    color: "bg-cyan-100 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400",
    status: "Active",
    statusColor: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  },
];

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Connect third-party services to extend your event management workflow."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          const isActive = integration.status !== "Placeholder";

          const content = (
            <Card
              className={`group transition-all duration-200 ${
                isActive
                  ? "cursor-pointer hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800"
                  : "opacity-75"
              }`}
            >
              <CardContent className="flex flex-col gap-4 p-5">
                <div className="flex items-start justify-between">
                  <div
                    className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${integration.color}`}
                  >
                    <Icon className="size-5" />
                  </div>
                  <Badge
                    variant="outline"
                    className={integration.statusColor}
                  >
                    {integration.status}
                  </Badge>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {integration.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {integration.description}
                  </p>
                </div>
                {isActive && (
                  <div className="flex items-center text-xs font-medium text-indigo-600 dark:text-indigo-400">
                    Configure
                    <ArrowRight className="ml-1 size-3 transition-transform group-hover:translate-x-0.5" />
                  </div>
                )}
              </CardContent>
            </Card>
          );

          if (isActive) {
            return (
              <Link key={integration.title} href={integration.href}>
                {content}
              </Link>
            );
          }

          return <div key={integration.title}>{content}</div>;
        })}
      </div>
    </div>
  );
}
