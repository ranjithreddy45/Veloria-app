import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, ExternalLinkIcon, FileTextIcon } from "lucide-react";

import {
  getWebform,
  getSubmissions,
  getSubmissionStats,
  generateEmbedCode,
} from "@/actions/webform.actions";
import { PageHeader } from "@/components/layout/page-header";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { WebformDetailTabs } from "../_components/webform-detail-tabs";
import { EmbedCodeDialog } from "../_components/embed-code-dialog";
import type { WebformField } from "@/schemas/webform.schema";

export const metadata: Metadata = { title: "Webform Details" };

// ============================================================
// Webform Detail Page
// ============================================================

interface WebformDetailPageProps {
  params: Promise<{ webformId: string }>;
}

export default async function WebformDetailPage({
  params,
}: WebformDetailPageProps) {
  const { webformId } = await params;

  const [webformResult, submissionsResult, statsResult, embedResult] =
    await Promise.all([
      getWebform(webformId),
      getSubmissions(webformId, { limit: 50 }),
      getSubmissionStats(webformId),
      generateEmbedCode(webformId),
    ]);

  if (!webformResult.success || !webformResult.data) {
    notFound();
  }

  const webform = webformResult.data;
  const submissions = submissionsResult.success
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (submissionsResult.data.data as any[])
    : [];
  const stats = statsResult.success ? statsResult.data : null;
  const embedData = embedResult.success ? embedResult.data : null;

  return (
    <div className="space-y-6">
      {/* Back */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="-ml-2 h-8 text-muted-foreground hover:text-foreground"
        >
          <Link href="/settings/webforms">
            <ArrowLeftIcon className="mr-1 size-4" />
            Back to Webforms
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow="Settings · Lead Capture"
        icon={FileTextIcon}
        accent="blue"
        title={webform.name}
        description={`Public at /form/${webform.slug} — every submission lands in your leads inbox.`}
      >
        <StatusPill
          label={webform.isActive ? "Accepting submissions" : "Inactive"}
          hue={webform.isActive ? "emerald" : "slate"}
        />
        {embedData && (
          <EmbedCodeDialog
            formUrl={embedData.formUrl}
            iframe={embedData.iframe}
            jsEmbed={embedData.jsEmbed}
          />
        )}
        <Button variant="outline" asChild>
          <Link
            href={`/form/${webform.slug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLinkIcon className="mr-2 size-4" />
            View Form
          </Link>
        </Button>
      </PageHeader>

      {/* Submission summary */}
      {stats && (
        <div className="rounded-2xl border bg-card shadow-card">
          <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0">
            {[
              { label: "Total Submissions", value: stats.total, accent: false },
              { label: "Today", value: stats.today, accent: false },
              { label: "This Week", value: stats.thisWeek, accent: false },
              { label: "Spam Blocked", value: stats.spam, accent: true },
            ].map((s) => (
              <div key={s.label} className="px-5 py-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </p>
                <p
                  className={`numeric mt-1.5 text-2xl font-semibold tabular-nums ${
                    s.accent && s.value > 0
                      ? "text-destructive"
                      : "text-foreground"
                  }`}
                >
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabbed Content — client component for interactivity */}
      <WebformDetailTabs
        webform={{
          id: webform.id,
          name: webform.name,
          slug: webform.slug,
          description: webform.description || "",
          fields: webform.fields as WebformField[],
          thankYouUrl: webform.thankYouUrl || "",
          thankYouMessage: webform.thankYouMessage || "",
          notifyUserIds: webform.notifyUserIds || [],
          autoAssignTo: webform.autoAssignTo || "",
          defaultSource: (webform.defaultSource as "WEBSITE") || "WEBSITE",
          honeypotField: webform.honeypotField || "",
          isActive: webform.isActive,
        }}
        submissions={submissions}
        embedData={embedData}
      />
    </div>
  );
}
