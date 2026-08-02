import type { Metadata } from "next";
import { Gem } from "lucide-react";
import { getCandidatePortal } from "@/actions/hr-journey.actions";
import { CandidateForm } from "./_components/candidate-form";

export const metadata: Metadata = { title: "Welcome — PropertyPlush Group" };

export default async function CandidatePortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await getCandidatePortal(token);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF7F2] p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border bg-white shadow-sm">
        {/* Brand band */}
        <div className="flex items-center gap-2.5 bg-[#2D1B3D] px-6 py-5 text-white">
          <div className="flex size-8 items-center justify-center rounded-md bg-[#C9A96E] text-[#2D1B3D]">
            <Gem className="size-4" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-copy font-semibold tracking-tight">PropertyPlush Group</div>
            <div className="text-meta text-white/60">Pre-joining</div>
          </div>
        </div>

        <div className="p-6">
          {!result.ok ? (
            <div className="py-6 text-center">
              <h2 className="text-lg font-semibold">
                {result.reason === "expired" ? "This link has expired" : result.reason === "used" ? "This link was already used" : "Invalid link"}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Please contact your PropertyPlush HR contact for a fresh invitation link.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold tracking-tight">Welcome, {result.employee.firstName}! 🎉</h1>
              <p className="mt-1 text-body text-muted-foreground">
                We’re excited to have you join {result.employee.legalEntity?.name ?? "the team"}. Please confirm your
                contact details to get started.
              </p>
              <div className="mt-5">
                <CandidateForm
                  token={token}
                  firstName={result.employee.firstName}
                  phone={result.employee.phone}
                  personalEmail={result.employee.personalEmail}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
