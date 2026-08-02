import type { Metadata } from "next";
import { CodeIcon } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButtonClient } from "@/app/(dashboard)/settings/webforms/_components/copy-button-client";

export const metadata: Metadata = { title: "Website enquiry form" };

// ============================================================
// The copy-paste snippet for putting the enquiry form on the marketing site or
// a campaign landing page. Deliberately a plain page rather than a dialog: the
// person doing this is usually in a website builder in another tab and wants
// something they can copy once and hand to whoever edits the site.
// ============================================================

/** Public origin of this app — the snippet must point at the deployed host. */
function appOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://app.theveloriagrand.com");
  return raw.replace(/\/$/, "");
}

export default function WebsiteFormPage() {
  const origin = appOrigin();

  const snippet = `<!-- Veloria Grand enquiry form -->
<div id="veloria-enquiry"></div>
<script src="${origin}/embed/enquiry-form.js" defer></script>`;

  const customised = `<div id="veloria-enquiry"
     data-title="Plan your celebration with us"
     data-subtitle="Share a few details and we'll call you back."
     data-events="Wedding,Reception,Engagement,Corporate"
     data-accent="#006742"></div>
<script src="${origin}/embed/enquiry-form.js" defer></script>`;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CodeIcon}
        accent="gold"
        eyebrow="Integrations · Website"
        title="Website enquiry form"
        description="Paste one snippet into your website or landing page. Every submission lands in the CRM as a contact and a lead, with its campaign attribution attached."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paste this where the form should appear</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <pre className="overflow-x-auto rounded-xl border bg-muted/40 p-3 text-detail leading-relaxed">
            <code>{snippet}</code>
          </pre>
          <CopyButtonClient text={snippet} />
          <p className="text-muted-foreground text-detail leading-relaxed">
            Works on any site — WordPress, Wix, Squarespace, Webflow or plain HTML. It renders a
            real form on your page rather than an iframe, so nothing is blocked by browser framing
            rules and the form sizes itself to your layout.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Optional — change the wording or colour</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <pre className="overflow-x-auto rounded-xl border bg-muted/40 p-3 text-detail leading-relaxed">
            <code>{customised}</code>
          </pre>
          <CopyButtonClient text={customised} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What happens to a submission</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-body leading-relaxed text-muted-foreground">
          <p>
            <span className="text-foreground font-medium">It becomes a CRM lead immediately.</span>{" "}
            A contact is created (or matched to an existing one, ignoring how the phone number was
            written), a lead is raised against it, an owner is assigned by your routing rules, and
            the enquiry appears in Leads straight away.
          </p>
          <p>
            <span className="text-foreground font-medium">Campaign attribution is preserved.</span>{" "}
            Any <code>utm_*</code> parameters and the Google <code>gclid</code> on the visitor&apos;s
            URL travel with the enquiry, so paid traffic stays measurable.
          </p>
          <p>
            <span className="text-foreground font-medium">Overseas enquiries work.</span> A visitor
            can enter a ten-digit Indian mobile, or any international number with its country code.
          </p>
          <p>
            <span className="text-foreground font-medium">Your domain must be allow-listed.</span>{" "}
            veloriagrand.com and theveloriagrand.com (with or without <code>www</code>) already are.
            To add another — a campaign microsite, say — set{" "}
            <code>LANDING_LEAD_ORIGINS</code> to a comma-separated list of origins; no code change
            is needed. Submissions from an unlisted domain are refused by the browser, so add the
            domain before you launch the page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
