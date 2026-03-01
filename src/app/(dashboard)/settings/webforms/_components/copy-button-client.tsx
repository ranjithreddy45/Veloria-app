"use client";

import * as React from "react";
import { CopyIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// ============================================================
// Copy Button Client Component
// ============================================================

interface CopyButtonClientProps {
  text: string;
}

export function CopyButtonClient({ text }: CopyButtonClientProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
    >
      {copied ? (
        <>
          <CheckIcon className="mr-2 size-4 text-emerald-500" />
          Copied!
        </>
      ) : (
        <>
          <CopyIcon className="mr-2 size-4" />
          Copy
        </>
      )}
    </Button>
  );
}
