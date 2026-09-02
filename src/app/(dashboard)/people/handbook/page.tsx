import type { Metadata } from "next";
import { BookOpenIcon, DownloadIcon } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Employee Handbook" };

// ============================================================
// Employee Handbook — readable by EVERY staff member (route override in
// permissions.ts maps /people/handbook to dashboard:read, ahead of the
// hr:read gate on /people). The PDF itself ships in /public/hr — replace the
// file and bump the version line below when HR issues a new edition.
// ============================================================

const HANDBOOK_URL = "/hr/employee-handbook-v1.1.pdf";

export default function EmployeeHandbookPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={BookOpenIcon}
        accent="brand"
        eyebrow="People · Policies"
        title="Employee Handbook"
        description="Everything you need to know, in plain language. Version 1.1 — issued by Human Resources."
      >
        <Button asChild>
          <a href={HANDBOOK_URL} download="Veloria-Grand-Employee-Handbook-v1.1.pdf">
            <DownloadIcon className="size-3.5" />
            Download PDF
          </a>
        </Button>
      </PageHeader>

      <p className="max-w-2xl text-body text-muted-foreground">
        This handbook is a plain-language summary. The complete and binding rules
        are in the HR Policy Manual, Version 1.1, available from Human Resources.
        Kannada and Hindi editions are available — ask HR for the version you want.
      </p>

      {/* Inline viewer — object with iframe fallback; the download button above
          always works even where inline PDF rendering is unavailable (iOS). */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
        <object
          data={HANDBOOK_URL}
          type="application/pdf"
          className="h-[75vh] min-h-[480px] w-full"
          aria-label="Employee Handbook PDF"
        >
          <div className="flex h-[40vh] flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-body text-muted-foreground">
              Your browser can&rsquo;t display the PDF inline.
            </p>
            <Button asChild variant="outline">
              <a href={HANDBOOK_URL} target="_blank" rel="noopener noreferrer">
                Open the handbook in a new tab
              </a>
            </Button>
          </div>
        </object>
      </div>
    </div>
  );
}
