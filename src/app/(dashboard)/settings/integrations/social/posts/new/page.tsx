import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { SocialPostForm } from "../../_components/social-post-form";

export const metadata: Metadata = { title: "New Social Post" };

// ============================================================
// New Social Post Page
// ============================================================

export default function NewSocialPostPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New Social Post"
        description="Create a new social media post draft."
      >
        <Link href="/settings/integrations/social/posts">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 size-4" />
            Back to Posts
          </Button>
        </Link>
      </PageHeader>

      <SocialPostForm />
    </div>
  );
}
