import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { WebformForm } from "../_components/webform-form";

export const metadata: Metadata = { title: "New Webform" };

// ============================================================
// New Webform Page
// ============================================================

export default function NewWebformPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Webform"
        description="Build a new lead capture form for your website."
      />
      <Card>
        <CardHeader>
          <CardTitle>Form Details</CardTitle>
        </CardHeader>
        <CardContent>
          <WebformForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
