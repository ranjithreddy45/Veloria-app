import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, ArrowLeft } from "lucide-react";
import { getSocialPosts } from "@/actions/social.actions";
import {
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_POST_STATUS_COLORS,
} from "@/lib/constants";

export const metadata: Metadata = { title: "Social Posts" };

// ============================================================
// Social Posts List Page
// ============================================================

export default async function SocialPostsPage() {
  const result = await getSocialPosts();
  const posts = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Social Posts"
        description="Manage your social media post drafts, scheduled, and published posts."
      >
        <div className="flex items-center gap-2">
          <Link href="/settings/integrations/social">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 size-4" />
              Back
            </Button>
          </Link>
          <Link href="/settings/integrations/social/posts/new">
            <Button size="sm">
              <Plus className="mr-2 size-4" />
              New Post
            </Button>
          </Link>
        </div>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No social posts yet. Create your first post to get started.
              </p>
              <Link href="/settings/integrations/social/posts/new">
                <Button size="sm" className="mt-4">
                  <Plus className="mr-2 size-4" />
                  Create Post
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead className="min-w-[250px]">Content</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Posted</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map(
                  (post: {
                    id: string;
                    platform: string;
                    content: string;
                    status: string;
                    scheduledAt: string | null;
                    postedAt: string | null;
                    createdAt: string;
                  }) => (
                    <TableRow key={post.id}>
                      <TableCell>
                        <Badge variant="outline">
                          {SOCIAL_PLATFORM_LABELS[post.platform] ??
                            post.platform}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm line-clamp-2">
                          {post.content}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            SOCIAL_POST_STATUS_COLORS[post.status] ?? ""
                          }
                        >
                          {post.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {post.scheduledAt
                          ? new Date(post.scheduledAt).toLocaleDateString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )
                          : "--"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {post.postedAt
                          ? new Date(post.postedAt).toLocaleDateString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )
                          : "--"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(post.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
