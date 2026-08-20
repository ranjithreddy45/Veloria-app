import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PlusIcon, EyeIcon, ExternalLinkIcon, FileImageIcon } from "lucide-react";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { formatINR } from "@/lib/utils";

import { getBrochures } from "@/actions/brochure.actions";

export const metadata: Metadata = {
  title: "Digital brochures",
  description: "Immersive single-link venue microsites at /v/<slug>",
};

// ============================================================
// Digital brochures — list (Server Component). Gated by marketing:read.
// ============================================================

export default async function BrochuresPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }
  if (!hasPermission(session.user.role as string, "marketing:read")) {
    redirect("/not-authorized");
  }

  const canManage = hasPermission(session.user.role as string, "marketing:manage");
  const res = await getBrochures();
  const rows = res.success ? res.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow="MARKETING · BROCHURES"
        title="Digital brochures"
        description="Shareable, proof-rich venue microsites with Hold-this-date and Book-a-visit CTAs."
      >
        {canManage && (
          <Button asChild>
            <Link href="/marketing/brochures/new">
              <PlusIcon className="mr-2 size-4" /> New brochure
            </Link>
          </Button>
        )}
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>All brochures</CardTitle>
          <CardDescription>
            The slug is the public access link; share /v/&lt;slug&gt; with prospects.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              icon={<FileImageIcon />}
              title="No brochures yet"
              description="Create an immersive microsite to share a single shareable link per venue or event type."
              action={
                canManage ? (
                  <Button asChild>
                    <Link href="/marketing/brochures/new">
                      <PlusIcon className="mr-2 size-4" /> New brochure
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">From</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Link
                        href={`/marketing/brochures/${b.id}`}
                        className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                      >
                        {b.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">/v/{b.slug}</div>
                    </TableCell>
                    <TableCell className="text-sm text-zinc-600 dark:text-zinc-300">
                      {b.venueName || (b.eventType ? `Event: ${b.eventType}` : "—")}
                    </TableCell>
                    <TableCell>
                      {b.isPublished ? (
                        <Badge variant="success">Published</Badge>
                      ) : (
                        <Badge variant="secondary">Draft</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{b.viewCount}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {b.startingFromAmount != null ? formatINR(b.startingFromAmount) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {b.isPublished && (
                          <a
                            href={`/v/${b.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                          >
                            <ExternalLinkIcon className="size-3.5" /> Preview
                          </a>
                        )}
                        <Link
                          href={`/marketing/brochures/${b.id}`}
                          className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:underline dark:text-zinc-300"
                        >
                          <EyeIcon className="size-3.5" /> Edit
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
