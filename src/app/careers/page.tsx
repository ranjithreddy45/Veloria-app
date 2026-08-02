import type { Metadata } from "next";
import { Briefcase } from "lucide-react";
import { getOpenRoles } from "@/actions/recruit-public.actions";
import { CareersShell } from "./_components/careers-shell";
import { RoleCard } from "./_components/role-card";

export const metadata: Metadata = {
  title: "Careers — Veloria Grand",
  description: "Join the team behind Veloria Grand. Explore open roles and apply.",
};

export const dynamic = "force-dynamic";

export default async function CareersPage() {
  const roles = await getOpenRoles();

  return (
    <CareersShell>
      <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
        {/* Hero */}
        <div className="max-w-2xl">
          <p className="text-detail font-medium uppercase tracking-[0.14em] text-primary">
            Join us
          </p>
          <h1 className="mt-2 text-h2 font-semibold leading-[1.15] tracking-[-0.025em] text-foreground sm:text-h1">
            Build unforgettable moments at Veloria Grand
          </h1>
          <p className="mt-3 text-copy leading-relaxed text-muted-foreground">
            We&apos;re a team of hospitality, events, and operations specialists crafting premium
            experiences. If that sounds like you, we&apos;d love to hear from you.
          </p>
        </div>

        {/* Roles */}
        <div className="mt-10">
          <h2 className="text-body font-medium uppercase tracking-[0.1em] text-muted-foreground">
            Open roles {roles.length > 0 && <span className="text-foreground/70">· {roles.length}</span>}
          </h2>

          {roles.length === 0 ? (
            <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/80 bg-card/60 px-6 py-16 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Briefcase className="size-5" />
              </span>
              <h3 className="text-copy font-semibold tracking-[-0.01em] text-foreground">
                No open roles right now
              </h3>
              <p className="max-w-sm text-body leading-relaxed text-muted-foreground">
                We don&apos;t have any openings at the moment — but we&apos;re always growing. Please
                check back soon.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {roles.map((role) => (
                <RoleCard key={role.id} role={role} />
              ))}
            </div>
          )}
        </div>
      </div>
    </CareersShell>
  );
}
