import Link from "next/link";
import type { Metadata } from "next";
import {
  MapPin,
  Users,
  Kanban,
  History,
  Building2,
  ArrowRight,
  Plug,
  Bell,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Settings" };

const settingsSections = [
  {
    title: "Venues",
    description: "Manage event venues, capacities, and availability.",
    href: "/settings/venues",
    icon: MapPin,
    color: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  },
  {
    title: "Pipeline Stages",
    description: "Configure sales pipeline stages and deal workflow.",
    href: "/settings/pipeline",
    icon: Kanban,
    color:
      "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
  },
  {
    title: "User Management",
    description: "Manage team members, assign roles, and control access.",
    href: "/settings/users",
    icon: Users,
    color:
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  },
  {
    title: "Activity Log",
    description: "View all system activity and audit trail.",
    href: "/settings/activity-log",
    icon: History,
    color:
      "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  },
  {
    title: "Integrations",
    description: "Connect third-party services like Tally, WhatsApp, and more.",
    href: "/settings/integrations",
    icon: Plug,
    color:
      "bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400",
  },
  {
    title: "Notifications",
    description: "Configure email and SMS notification preferences.",
    href: "/settings/notifications",
    icon: Bell,
    color:
      "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your venue, team, pipeline, and system configuration."
      />

      {/* Company Info Card */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
            <Building2 className="size-6" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">Veloria Grand</CardTitle>
            <CardDescription>
              Premium Event & Banquet Services — Bangalore, Karnataka
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      {/* Settings Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href}>
              <Card className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800">
                <CardContent className="flex items-center gap-4 p-5">
                  <div
                    className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${section.color}`}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">
                      {section.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                      {section.description}
                    </p>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
