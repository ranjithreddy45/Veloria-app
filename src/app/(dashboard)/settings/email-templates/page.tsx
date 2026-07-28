import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { PlusIcon, MailIcon, PencilIcon, TrashIcon } from "lucide-react";

import { getEmailTemplates } from "@/actions/email-template.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeleteTemplateButton } from "./_components/delete-template-button";

export const metadata: Metadata = {
  title: "Email Templates",
};

// ============================================================
// Email Templates List Page
// ============================================================

export default async function EmailTemplatesPage() {
  const result = await getEmailTemplates();
  const templates = result.success ? result.data ?? [] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email Templates"
        help={<PageHelp id="email-templates" />}
        description="Manage reusable email templates for campaigns and notifications."
      >
        <Button asChild>
          <Link href="/settings/email-templates/new">
            <PlusIcon className="mr-2 size-4" />
            New Template
          </Link>
        </Button>
      </PageHeader>

      {templates.length === 0 ? (
        <Card className="border-border shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <MailIcon className="size-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">
              No templates yet
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Create your first email template to streamline campaign creation.
            </p>
            <Button asChild className="mt-4">
              <Link href="/settings/email-templates/new">
                <PlusIcon className="mr-2 size-4" />
                Create Template
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card
              key={template.id}
              className="border-border shadow-sm transition-all hover:shadow-md"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-foreground truncate">
                        {template.name}
                      </h3>
                      <Badge
                        variant="outline"
                        className={
                          template.isActive
                            ? "bg-success/15 text-success border-success/20"
                            : "bg-muted text-foreground border-border"
                        }
                      >
                        {template.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground truncate">
                      {template.subject}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {template.category && (
                    <Badge variant="secondary" className="text-[10px]">
                      {template.category}
                    </Badge>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(template.createdAt), "dd MMM yyyy")}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-xs" asChild>
                      <Link
                        href={`/settings/email-templates/${template.id}/edit`}
                      >
                        <PencilIcon className="size-3.5" />
                      </Link>
                    </Button>
                    <DeleteTemplateButton
                      templateId={template.id}
                      templateName={template.name}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
