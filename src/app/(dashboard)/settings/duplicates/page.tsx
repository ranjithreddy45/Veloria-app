import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { findDuplicates } from "@/actions/dedup.actions";
import { getUniqueGuardStatus } from "@/actions/unique-guards.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MergeGroup } from "./_components/merge-group";
import { DatabaseGuards } from "./_components/database-guards";

export const metadata: Metadata = { title: "Duplicate finder" };

export default async function DuplicatesPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!["SUPER_ADMIN", "ADMIN"].includes(role ?? "")) {
    redirect("/not-authorized");
  }

  const [{ groups }, guardStatus] = await Promise.all([findDuplicates(), getUniqueGuardStatus()]);
  const total = groups.reduce((n, g) => n + g.members.length, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Duplicate finder"
        description="Records that share a phone number or email (format-insensitive). Review each group, keep one, and delete or merge the extras. Once a table is clean, lock it with the database guards below so duplicates can never be created again."
      />

      <div id="duplicate-groups" className="scroll-mt-24" />

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
                  {g.entity === "Contacts" ? (
                    <MergeGroup members={g.members} />
                  ) : (
                    <ul className="divide-y divide-border/60">
                      {g.members.map((m) => (
                        <li key={m.id} className="flex items-center justify-between py-2">
                          <span className="text-body">
                            {m.label}
                            {m.detail && (
                              <span className="block text-meta text-muted-foreground">{m.detail}</span>
                            )}
                          </span>
                          <Link
                            href={m.href}
                            className="text-body font-medium text-primary hover:underline"
                          >
                            Open →
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <DatabaseGuards
        guards={guardStatus.success ? guardStatus.data : []}
        loadError={guardStatus.success ? undefined : guardStatus.error}
      />
    </div>
  );
}
