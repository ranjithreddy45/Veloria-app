"use client";

import type * as React from "react";
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
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { WebformForm } from "./webform-form";
import { FormPreview } from "./form-preview";
import { SubmissionsTable } from "./submissions-table";
import { CopyButtonClient } from "./copy-button-client";
import { JsEmbedPanel } from "./embed-code-dialog";
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
  nativeHtml?: string;
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
// Section — the settings surface used across /settings
// ============================================================

function Section({
  icon,
  title,
  description,
  children,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("rounded-2xl border bg-card shadow-card", className)}
    >
      <div className="border-b px-5 py-4">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
          {icon}
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
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
        <Section
          icon={<PencilIcon className="size-4 text-muted-foreground" />}
          title="Form Configuration"
          description="Fields, routing and the thank-you experience. Changes go live on the public form immediately."
        >
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
        </Section>
      </TabsContent>

      {/* Preview Tab */}
      <TabsContent value="preview">
        <Section
          title="Form Preview"
          description="Exactly what a visitor sees at your public form URL."
        >
          <FormPreview fields={webform.fields} />
        </Section>
      </TabsContent>

      {/* Embed Code Tab */}
      <TabsContent value="embed">
        <div className="space-y-4">
          {embedData && (
            <>
              <Section
                icon={<ExternalLinkIcon className="size-4 text-muted-foreground" />}
                title="Direct Link"
                description="Share this URL anywhere — no code required."
              >
                <div className="flex items-center gap-2">
                  <code className="numeric flex-1 overflow-x-auto rounded-lg border bg-muted/40 p-3 text-sm">
                    {embedData.formUrl}
                  </code>
                  <CopyButtonClient text={embedData.formUrl} />
                </div>
              </Section>

              {embedData.nativeHtml && (
                <Section
                  icon={<CodeIcon className="size-4 text-muted-foreground" />}
                  title="Native form — your own design"
                  description="Best for a landing page: real HTML you can restyle to match your brand."
                >
                  <p className="mb-3 text-[13px] leading-relaxed text-muted-foreground">
                    No iframe, so every element is yours to style (each class is
                    prefixed <code>vg-</code>). Leads still land in this app and
                    Google click ids are read straight from the landing-page URL.
                    To fire a Google Ads conversion, put your ID in the{" "}
                    <code>ADS_CONVERSION</code> line at the top of the script.
                  </p>
                  <pre className="numeric max-h-80 overflow-auto rounded-lg border bg-muted/40 p-3 text-xs">
                    {embedData.nativeHtml}
                  </pre>
                  <div className="mt-3 flex justify-end">
                    <CopyButtonClient text={embedData.nativeHtml} />
                  </div>
                </Section>
              )}

              <Section
                icon={<CodeIcon className="size-4 text-muted-foreground" />}
                title="JavaScript Embed"
                description="Recommended for ad traffic — carries attribution through to the lead."
              >
                <p className="mb-3 text-[13px] leading-relaxed text-muted-foreground">
                  Forwards gclid / gbraid / wbraid / fbclid and UTM params from
                  the landing page into the form, auto-sizes the iframe, and can
                  fire a Google Ads conversion on submit.
                </p>
                <JsEmbedPanel jsEmbed={embedData.jsEmbed} />
              </Section>

              <Section
                icon={<CodeIcon className="size-4 text-muted-foreground" />}
                title="Iframe Embed"
                description="Simple fallback — does not forward ad click ids, so prefer the JavaScript embed for paid traffic."
              >
                <pre className="numeric overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs">
                  {embedData.iframe}
                </pre>
                <div className="mt-3 flex justify-end">
                  <CopyButtonClient text={embedData.iframe} />
                </div>
              </Section>
            </>
          )}
          {!embedData && (
            <div className="rounded-2xl border border-dashed bg-card shadow-card">
              <EmptyState
                icon={<CodeIcon />}
                title="Embed code unavailable"
                description="We couldn't generate embed snippets for this form. Check that it has a slug and try reloading."
              />
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
