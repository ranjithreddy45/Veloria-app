"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CopyIcon,
  CheckIcon,
  Loader2Icon,
  LinkIcon,
  RefreshCwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateReferralCode } from "@/actions/referral-engine.actions";

interface ReferralCodeGeneratorProps {
  contactId?: string;
  userId?: string;
  vendorId?: string;
}

export function ReferralCodeGenerator({
  contactId,
  userId,
  vendorId,
}: ReferralCodeGeneratorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [source, setSource] = useState<string>("GUEST");
  const [generatedCode, setGeneratedCode] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [copied, setCopied] = useState(false);

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateReferralCode({
        contactId,
        userId,
        vendorId,
        source: source as "GUEST" | "PLANNER" | "VENDOR_REF" | "EMPLOYEE",
      });

      if (result.success && result.data) {
        setGeneratedCode(result.data.code);
        setGeneratedLink(result.data.link);
        toast.success("Referral code generated!");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to generate referral code.");
      }
    });
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy.");
    }
  }

  return (
    <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <LinkIcon className="size-4 text-primary" />
          Generate Referral Code
        </CardTitle>
        <CardDescription>
          Create a unique referral code and shareable link.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Source</label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GUEST">Guest</SelectItem>
              <SelectItem value="PLANNER">Planner</SelectItem>
              <SelectItem value="VENDOR_REF">Vendor</SelectItem>
              <SelectItem value="EMPLOYEE">Employee</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={isPending}
          className="w-full"
        >
          {isPending ? (
            <Loader2Icon className="mr-2 size-4 animate-spin" />
          ) : (
            <RefreshCwIcon className="mr-2 size-4" />
          )}
          Generate Code
        </Button>

        {generatedCode && (
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Referral Code
              </label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={generatedCode}
                  className="font-mono text-lg font-bold tracking-wider text-center"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(generatedCode)}
                >
                  {copied ? (
                    <CheckIcon className="size-4 text-emerald-500" />
                  ) : (
                    <CopyIcon className="size-4" />
                  )}
                </Button>
              </div>
            </div>

            {generatedLink && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Shareable Link
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={generatedLink}
                    className="text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(generatedLink)}
                  >
                    <CopyIcon className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
