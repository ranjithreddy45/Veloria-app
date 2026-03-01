"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  CopyIcon,
  CheckIcon,
  MailIcon,
  MessageCircleIcon,
  ShareIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ShareWidgetProps {
  referralCode: string;
  referralLink: string;
  referrerName?: string;
}

export function ShareWidget({
  referralCode,
  referralLink,
  referrerName,
}: ShareWidgetProps) {
  const [copied, setCopied] = useState(false);

  const shareMessage = referrerName
    ? `Hi! ${referrerName} has invited you to check out Veloria Grand for your next event. Use referral code: ${referralCode}\n\n${referralLink}`
    : `Check out Veloria Grand for your next event! Use referral code: ${referralCode}\n\n${referralLink}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy.");
    }
  }

  function handleWhatsApp() {
    const encoded = encodeURIComponent(shareMessage);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  }

  function handleEmail() {
    const subject = encodeURIComponent("You're invited to Veloria Grand!");
    const body = encodeURIComponent(shareMessage);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  }

  function handleNativeShare() {
    if (navigator.share) {
      navigator.share({
        title: "Veloria Grand Referral",
        text: shareMessage,
        url: referralLink,
      });
    } else {
      handleCopy();
    }
  }

  return (
    <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShareIcon className="size-4 text-primary" />
          Share Referral
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Code Display */}
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
          <span className="text-xs font-medium text-muted-foreground">
            CODE:
          </span>
          <span className="font-mono text-lg font-bold tracking-wider flex-1">
            {referralCode}
          </span>
        </div>

        {/* Link with Copy */}
        <div className="flex items-center gap-2">
          <Input readOnly value={referralLink} className="text-xs" />
          <Button variant="outline" size="icon" onClick={handleCopy}>
            {copied ? (
              <CheckIcon className="size-4 text-emerald-500" />
            ) : (
              <CopyIcon className="size-4" />
            )}
          </Button>
        </div>

        {/* Share Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            onClick={handleWhatsApp}
          >
            <MessageCircleIcon className="mr-1.5 size-4" />
            WhatsApp
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            onClick={handleEmail}
          >
            <MailIcon className="mr-1.5 size-4" />
            Email
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleNativeShare}
          >
            <ShareIcon className="mr-1.5 size-4" />
            Share
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
