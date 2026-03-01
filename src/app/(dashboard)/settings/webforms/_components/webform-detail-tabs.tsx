"use client";

import {
  PencilIcon,
  ExternalLinkIcon,
  CodeIcon,
} from "lucide-react";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WebformForm } from "./webform-form";
import { FormPreview } from "./form-preview";
import { SubmissionsTable } from "./submissions-table";
import { CopyButtonClient } from "./copy-button-client";
import type { WebformField, WebformInput } from "@/schemas/webform.schema";

// ============================================================
// Types
// ============================================================

interface Submission {
  id: string;
  data: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  isSpam: boolean;
  createdAt: string;
  contactId: string | null;
  leadId: string | null;
}

interface EmbedData {
  formUrl: string;
  apiUrl: string;
  iframe: string;
  jsEmbed: string;
}

interface WebformDetailTabsProps {
  webform: {
    id: string;
    name: string;
    slug: string;
    description: string;
    fields: WebformField[];
    thankYouUrl: string;
    thankYouMessage: string;
    notifyUserIds: string[];
    autoAssignTo: string;
    defaultSource: string;
    honeypotField: string;
    isActive: boolean;
  };
  submissions: Submission[];
  embedData: EmbedData | null;
}

// ============================================================
// Webform Detail Tabs (Client Component)
// ============================================================

export function WebformDetailTabs({
  webform,
  submissions,
  embedData,
}: WebformDetailTabsProps) {
  return (
    <Tabs defaultValue="submissions" className="space-y-4">
      <TabsList>
        <TabsTrigger value="submissions">Submissions</TabsTrigger>
        <TabsTrigger value="configuration">Configuration</TabsTrigger>
        <TabsTrigger value="preview">Preview</TabsTrigger>
        <TabsTrigger value="embed">Embed Code</TabsTrigger>
      </TabsList>

      {/* Submissions Tab */}
      <TabsContent value="submissions">
        <SubmissionsTable
          data={submissions}
          fields={webform.fields}
        />
      </TabsContent>

      {/* Configuration Tab */}
      <TabsContent value="configuration">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PencilIcon className="size-4" />
              Edit Webform
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WebformForm
              mode="edit"
              webformId={webform.id}
              defaultValues={{
                name: webform.name,
                slug: webform.slug,
                description: webform.description,
                fields: webform.fields,
                thankYouUrl: webform.thankYouUrl,
                thankYouMessage: webform.thankYouMessage,
                notifyUserIds: webform.notifyUserIds,
                autoAssignTo: webform.autoAssignTo,
                defaultSource: webform.defaultSource as WebformInput["defaultSource"],
                honeypotField: webform.honeypotField,
                isActive: webform.isActive,
              }}
            />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Preview Tab */}
      <TabsContent value="preview">
        <Card>
          <CardHeader>
            <CardTitle>Form Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <FormPreview fields={webform.fields} />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Embed Code Tab */}
      <TabsContent value="embed">
        <div className="space-y-4">
          {embedData && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ExternalLinkIcon className="size-4" />
                    Direct Link
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 overflow-x-auto rounded-lg border bg-zinc-50 p-3 text-sm dark:bg-zinc-900">
                      {embedData.formUrl}
                    </code>
                    <CopyButtonClient text={embedData.formUrl} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CodeIcon className="size-4" />
                    Iframe Embed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="overflow-x-auto rounded-lg border bg-zinc-50 p-3 text-xs dark:bg-zinc-900">
                    {embedData.iframe}
                  </pre>
                  <div className="mt-2 flex justify-end">
                    <CopyButtonClient text={embedData.iframe} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CodeIcon className="size-4" />
                    JavaScript Embed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="overflow-x-auto rounded-lg border bg-zinc-50 p-3 text-xs dark:bg-zinc-900">
                    {embedData.jsEmbed}
                  </pre>
                  <div className="mt-2 flex justify-end">
                    <CopyButtonClient text={embedData.jsEmbed} />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
          {!embedData && (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-muted-foreground text-sm">
                Embed code could not be generated.
              </p>
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
