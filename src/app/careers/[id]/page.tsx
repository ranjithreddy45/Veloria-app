import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getOpenRole } from "@/actions/recruit-public.actions";
import { CareersShell } from "../_components/careers-shell";
import { ApplyForm } from "../_components/apply-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const role = await getOpenRole(id);
  return {
    title: role ? `${role.title} — Careers — Veloria Grand` : "Careers — Veloria Grand",
  };
}

export default async function CareerRolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const role = await getOpenRole(id);
  if (!role) notFound();

  return (
    <CareersShell>
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-6">
          <Link href="/careers">
            <ArrowLeft className="size-3.5" />
            All roles
          </Link>
        </Button>

        {/* Role header */}
        <header>
          <h1 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.025em] text-foreground sm:text-[30px]">
            {role.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted-foreground">
            {role.department && (
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-4" />
                {role.department}
              </span>
            )}
            {role.city && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" />
                {role.city}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4" />
              {role.positions} {role.positions === 1 ? "opening" : "openings"}
            </span>
          </div>
        </header>

        {/* Description */}
        {role.description && (
          <div className="mt-8 whitespace-pre-line text-[14px] leading-relaxed text-foreground/85">
            {role.description}
          </div>
        )}

        {/* Apply */}
        <div className="mt-10">
          <ApplyForm jobOpeningId={role.id} roleTitle={role.title} />
        </div>
      </div>
    </CareersShell>
  );
}
