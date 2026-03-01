"use client";

import * as React from "react";
import { CodeIcon, CopyIcon, CheckIcon, LinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

// ============================================================
// Embed Code Dialog Component
// ============================================================

interface EmbedCodeDialogProps {
  formUrl: string;
  iframe: string;
  jsEmbed: string;
}

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
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
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? (
        <>
          <CheckIcon className="mr-2 size-4 text-emerald-500" />
          Copied!
        </>
      ) : (
        <>
          <CopyIcon className="mr-2 size-4" />
          {label || "Copy"}
        </>
      )}
    </Button>
  );
}

export function EmbedCodeDialog({
  formUrl,
  iframe,
  jsEmbed,
}: EmbedCodeDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <CodeIcon className="mr-2 size-4" />
          Embed Code
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Embed This Form</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="link" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="link">
              <LinkIcon className="mr-2 size-3.5" />
              Direct Link
            </TabsTrigger>
            <TabsTrigger value="iframe">
              <CodeIcon className="mr-2 size-3.5" />
              Iframe
            </TabsTrigger>
            <TabsTrigger value="js">
              <CodeIcon className="mr-2 size-3.5" />
              JavaScript
            </TabsTrigger>
          </TabsList>

          {/* Direct Link */}
          <TabsContent value="link" className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Share this link directly with your leads or link to it from your website.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-lg border bg-zinc-50 p-3 text-sm dark:bg-zinc-900">
                {formUrl}
              </code>
              <CopyBtn text={formUrl} label="Copy Link" />
            </div>
          </TabsContent>

          {/* Iframe */}
          <TabsContent value="iframe" className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Paste this HTML snippet into your website to embed the form in an iframe.
            </p>
            <pre className="overflow-x-auto rounded-lg border bg-zinc-50 p-3 text-xs dark:bg-zinc-900">
              {iframe}
            </pre>
            <div className="flex justify-end">
              <CopyBtn text={iframe} label="Copy Code" />
            </div>
          </TabsContent>

          {/* JavaScript */}
          <TabsContent value="js" className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Paste this JavaScript snippet to dynamically load the form on your website.
            </p>
            <pre className="overflow-x-auto rounded-lg border bg-zinc-50 p-3 text-xs dark:bg-zinc-900">
              {jsEmbed}
            </pre>
            <div className="flex justify-end">
              <CopyBtn text={jsEmbed} label="Copy Code" />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
