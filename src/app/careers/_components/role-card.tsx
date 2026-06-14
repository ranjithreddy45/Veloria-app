import Link from "next/link";
import { ArrowRight, Building2, MapPin, Users } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { OpenRole } from "@/actions/recruit-public.actions";

export function RoleCard({ role }: { role: OpenRole }) {
  const meta = [role.department, role.city].filter(Boolean).join(" · ");
  return (
    <Card className="group flex flex-col transition-shadow hover:shadow-md">
      <CardHeader>
        <CardTitle className="text-[15.5px] tracking-[-0.01em]">{role.title}</CardTitle>
        {meta && (
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted-foreground">
            {role.department && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="size-3.5" />
                {role.department}
              </span>
            )}
            {role.city && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {role.city}
              </span>
            )}
          </p>
        )}
      </CardHeader>
      <CardContent className="flex-1">
        {role.description ? (
          <p className="text-[13px] leading-relaxed text-muted-foreground">{role.description}</p>
        ) : (
          <p className="text-[13px] italic text-muted-foreground/70">
            We&apos;d love to tell you more — view the role to learn what we&apos;re looking for.
          </p>
        )}
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground">
          <Users className="size-3.5" />
          {role.positions} {role.positions === 1 ? "opening" : "openings"}
        </span>
        <Button asChild size="sm" variant="outline">
          <Link href={`/careers/${role.id}`}>
            View &amp; apply
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
