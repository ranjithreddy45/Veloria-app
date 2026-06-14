import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { LoadSampleDataButton } from "./_components/load-sample-data-button";
import { SettingsHub } from "./_components/settings-hub";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        eyebrow="System · Configuration"
        help={<PageHelp id="settings" />}
        description="Everything you can configure — security, sales, automation, templates, integrations and data."
      />

      {/* Company Info Card */}
      <Card>
        <CardContent className="flex flex-row items-center gap-4 py-1">
          <div className="flex size-12 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
            <Building2 className="size-6" />
          </div>
          <div className="flex-1">
            <p className="text-lg font-semibold">Veloria Grand</p>
            <p className="text-sm text-muted-foreground">
              Premium Event &amp; Banquet Services — Bangalore, Karnataka
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Categorized, searchable setup hub */}
      <SettingsHub />

      {/* Developer / Admin tools */}
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-start justify-between gap-4 py-1 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-[13.5px] font-semibold text-foreground">Demo data</h3>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Populate the app with realistic Indian sample contacts, leads, and
              calls to evaluate workflows. Safe to re-run; additive only.
            </p>
          </div>
          <LoadSampleDataButton />
        </CardContent>
      </Card>
    </div>
  );
}
