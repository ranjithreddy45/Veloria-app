"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";
import { createSocialPost } from "@/actions/social.actions";

// ============================================================
// Character Limits per Platform
// ============================================================

const CHAR_LIMITS: Record<string, number> = {
  INSTAGRAM: 2200,
  FACEBOOK: 2000,
  TWITTER: 280,
  LINKEDIN: 1300,
};

const PLATFORMS = [
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "TWITTER", label: "Twitter" },
  { value: "LINKEDIN", label: "LinkedIn" },
];

// ============================================================
// Social Post Form
// ============================================================

export function SocialPostForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [platform, setPlatform] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [error, setError] = useState("");

  const charLimit = CHAR_LIMITS[platform] ?? 2200;
  const charCount = content.length;
  const isOverLimit = charCount > charLimit;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!platform) {
      setError("Please select a platform");
      return;
    }

    if (!content.trim()) {
      setError("Post content is required");
      return;
    }

    if (isOverLimit) {
      setError(`Content exceeds the ${charLimit} character limit for ${platform}`);
      return;
    }

    startTransition(async () => {
      const result = await createSocialPost({
        platform: platform as "INSTAGRAM" | "FACEBOOK" | "TWITTER" | "LINKEDIN",
        content: content.trim(),
        imageUrl: imageUrl.trim() || undefined,
        scheduledAt: scheduledAt || null,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      router.push("/settings/integrations/social/posts");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Create Social Post</CardTitle>
        <CardDescription>
          Compose a new post for your social media channels.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Platform Select */}
          <div className="space-y-2">
            <Label htmlFor="platform">Platform</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger>
                <SelectValue placeholder="Select a platform" />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="content">Content</Label>
              <span
                className={`text-xs ${
                  isOverLimit
                    ? "font-medium text-red-600 dark:text-red-400"
                    : "text-muted-foreground"
                }`}
              >
                {charCount}/{charLimit}
              </span>
            </div>
            <Textarea
              id="content"
              placeholder="Write your social media post..."
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            {platform === "TWITTER" && (
              <p className="text-xs text-muted-foreground">
                Twitter has a 280-character limit.
              </p>
            )}
          </div>

          {/* Image URL */}
          <div className="space-y-2">
            <Label htmlFor="imageUrl">Image URL (optional)</Label>
            <Input
              id="imageUrl"
              type="url"
              placeholder="https://example.com/image.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </div>

          {/* Schedule */}
          <div className="space-y-2">
            <Label htmlFor="scheduledAt">Schedule For (optional)</Label>
            <Input
              id="scheduledAt"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to save as draft. Posts can be scheduled or published
              later.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isPending || isOverLimit}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Draft"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/settings/integrations/social/posts")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
