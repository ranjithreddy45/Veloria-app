import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getCustomerContentForTeam } from "@/actions/customer-content.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PoliciesPanel } from "./_components/policies-panel";
import { FaqsPanel } from "./_components/faqs-panel";

export const metadata: Metadata = { title: "Customer Content | Settings" };
export const dynamic = "force-dynamic";

// ============================================================
// /settings/customer-content — the policies and FAQs customers read in the
// app (/app/help, /app/policies/*). Customers read the same rows through
// src/lib/public/policies.ts. Gated like Settings → Venues (settings:venues);
// the actions re-check it.
// ============================================================

export default async function CustomerContentPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await auth();
  if (!session?.user || !hasPermission(session.user.role, "settings:venues")) redirect("/not-authorized");

  const [{ tab }, res] = await Promise.all([searchParams, getCustomerContentForTeam()]);

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Customer Content"
        eyebrow="Settings · Customer app"
        icon={BookOpen}
        accent="pink"
        description="The policies and FAQs customers read in the app. A policy changes for customers only when you publish a draft; each publish creates a new version, stamps the date and is recorded in full in the Activity Log."
      />
      {res.success ? (
        <Tabs defaultValue={tab === "faqs" ? "faqs" : "policies"}>
          <TabsList>
            <TabsTrigger value="policies">
              Policies · {res.data.policies.filter((p) => p.live?.isPublished).length}/{res.data.policies.length} live
            </TabsTrigger>
            <TabsTrigger value="faqs">FAQs · {res.data.faqs.filter((f) => f.isPublished).length} published</TabsTrigger>
          </TabsList>
          <TabsContent value="policies" className="mt-4">
            <PoliciesPanel policies={res.data.policies} />
          </TabsContent>
          <TabsContent value="faqs" className="mt-4">
            <FaqsPanel faqs={res.data.faqs} halls={res.data.halls} />
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">{res.error}</CardContent>
        </Card>
      )}
    </div>
  );
}
