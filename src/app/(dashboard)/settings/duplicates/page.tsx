import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { findDuplicates } from "@/actions/dedup.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Duplicate finder" };

export default async function DuplicatesPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!["SUPER_ADMIN", "ADMIN"].includes(role ?? "")) {
    redirect("/not-authorized");
  }

  const { groups } = await findDuplicates();
  const total = groups.reduce((n, g) => n + g.members.length, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Duplicate finder"
        description="Records that share a phone number or email (format-insensitive). Review each group, keep one, and delete or merge the extras. Once clean, we can lock these with hard database constraints so duplicates can never be created again."
      />

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            🎉 No duplicates found across contacts, vendors, hall owners, or BD leads.
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Found <span className="font-semibold text-foreground">{groups.length}</span> duplicate
            group{groups.length === 1 ? "" : "s"} ({total} records).
          </p>
          <div className="space-y-4">
            {groups.map((g, i) => (
              <Card key={`${g.entity}-${g.keyType}-${i}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Badge variant="secondary">{g.entity}</Badge>
                    <span className="text-muted-foreground">
                      same {g.keyType}: <span className="font-medium text-foreground">{g.key}</span>
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y divide-border/60">
                    {g.members.map((m) => (
                      <li key={m.id} className="flex items-center justify-between py-2">
                        <span className="text-body">{m.label}</span>
                        <Link
                          href={m.href}
                          className="text-body font-medium text-primary hover:underline"
                        >
                          Open →
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
