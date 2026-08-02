"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileText } from "lucide-react";

// ============================================================
// WhatsApp Template List
// ============================================================

interface Template {
  name: string;
  label: string;
  params: string[];
}

interface WhatsAppTemplateListProps {
  templates: Template[];
}

export function WhatsAppTemplateList({ templates }: WhatsAppTemplateListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Message Templates</CardTitle>
        <CardDescription>
          Pre-configured WhatsApp message templates for common event management
          scenarios.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {templates.map((template) => (
            <div
              key={template.name}
              className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/15 text-success">
                <FileText className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{template.label}</p>
                <p className="text-xs text-muted-foreground">
                  Template: {template.name}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {template.params.map((param) => (
                    <Badge
                      key={param}
                      variant="secondary"
                      className="text-meta"
                    >
                      {`{{${param}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
