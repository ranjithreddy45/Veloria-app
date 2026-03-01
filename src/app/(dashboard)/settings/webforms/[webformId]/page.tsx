import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";

import {
  getWebform,
  getSubmissions,
  getSubmissionStats,
  generateEmbedCode,
} from "@/actions/webform.actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const submissions = submissionsResult.success
    ? (submissionsResult.data.data as any[])
    : [];
  const stats = statsResult.success ? statsResult.data : null;
  const embedData = embedResult.success ? embedResult.data : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {webform.name}
            </h1>
            <Badge variant={webform.isActive ? "default" : "secondary"}>
              {webform.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            /form/{webform.slug}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                Total Submissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.today}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.thisWeek}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                Spam
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-500">{stats.spam}</p>
            </CardContent>
          </Card>
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
