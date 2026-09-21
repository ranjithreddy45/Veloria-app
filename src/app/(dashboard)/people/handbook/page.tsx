import type { Metadata } from "next";
import { BookOpenIcon, DownloadIcon } from "lucide-react";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getHandbookMeta } from "@/actions/handbook.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { HandbookAdmin } from "./_components/handbook-admin";

export const metadata: Metadata = { title: "Employee Handbook" };

// ============================================================
// Employee Handbook — readable by EVERY staff member (route override in
// permissions.ts maps /people/handbook to dashboard:read, ahead of the
// hr:read gate on /people). The PDF itself is an HR-managed document: HR
// (hr:write) uploads, replaces or removes it right here; it is stored in the
// database and streamed by /api/hr/handbook.
// ============================================================

const HANDBOOK_URL = "/api/hr/handbook";

export default async function EmployeeHandbookPage() {
  const [session, meta] = await Promise.all([auth(), getHandbookMeta()]);
  const canManage =
    !!session?.user?.role && hasPermission(session.user.role, "hr:write");
  const doc = meta.success ? meta.data : null;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BookOpenIcon}
        accent="brand"
        eyebrow="People · Policies"
        title="Employee Handbook"
        description={
          doc
            ? `${doc.name} — issued by Human Resources. Updated ${new Date(doc.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.`
            : "Issued by Human Resources."
        }
      >
        {doc && (
          <Button asChild>
            <a href={HANDBOOK_URL} download={doc.fileName}>
              <DownloadIcon className="size-3.5" />
              Download PDF
            </a>
          </Button>
        )}
        {canManage && <HandbookAdmin hasHandbook={!!doc} />}
      </PageHeader>

      {doc ? (
        <>
          <p className="max-w-2xl text-body text-muted-foreground">
            This handbook is a plain-language summary. The complete and binding
            rules are in the HR Policy Manual, available from Human Resources.
            Kannada and Hindi editions are available — ask HR for the version you
            want.
          </p>

          {/* Inline viewer — object with open-in-new-tab fallback; the download
              button above always works even where inline rendering isn't
              available (iOS). */}
          <div className="overflow-hidden surface-glass rounded-[22px]">
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
        </>
      ) : (
        <EmptyState
          icon={<BookOpenIcon className="size-5" />}
          title="No handbook is published"
          description={
            canManage
              ? "Upload the PDF above to publish it for every staff member."
              : "Human Resources has not published a handbook yet. Check back soon, or ask HR."
          }
        />
      )}
    </div>
  );
}
