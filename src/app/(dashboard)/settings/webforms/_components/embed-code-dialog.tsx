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

// ============================================================
// JS Embed Panel — live Google Ads conversion injection
// ------------------------------------------------------------
// The server-generated snippet carries a single configurable line:
//   var VELORIA_ADS_CONVERSION = '';
// We rewrite that literal client-side as the user types, so the copied
// snippet is ready to paste. No schema change, no env var.
// ============================================================

const CONVERSION_LINE = /VELORIA_ADS_CONVERSION = '[^']*'/;

/** Strip anything that isn't valid in an `AW-XXXX/label` send_to value. */
function sanitizeConversionId(raw: string): string {
  return raw.trim().replace(/[^A-Za-z0-9_\-/.]/g, "");
}

export function JsEmbedPanel({ jsEmbed }: { jsEmbed: string }) {
  const [conversionId, setConversionId] = React.useState("");

  const safeId = sanitizeConversionId(conversionId);
  const snippet = React.useMemo(
    () =>
      jsEmbed.replace(
        CONVERSION_LINE,
        `VELORIA_ADS_CONVERSION = '${safeId}'`
      ),
    [jsEmbed, safeId]
  );

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label
          htmlFor="veloria-gads-conversion"
          className="text-sm font-medium"
        >
          Google Ads conversion (optional)
        </label>
        <input
          id="veloria-gads-conversion"
          value={conversionId}
          onChange={(e) => setConversionId(e.target.value)}
          placeholder="AW-123456789/AbC-D_efGhIjK"
          spellCheck={false}
          autoComplete="off"
          className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
        <p className="text-muted-foreground text-xs">
          Paste your Google Ads conversion <span className="font-medium">send_to</span>{" "}
          value to fire a conversion when a lead is submitted — leave it blank
          and the snippet simply skips conversion firing.
        </p>
      </div>
      <pre className="overflow-x-auto rounded-lg border bg-muted p-3 text-xs">
        {snippet}
      </pre>
      <div className="flex justify-end">
        <CopyBtn text={snippet} label="Copy Code" />
      </div>
    </div>
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
              <code className="flex-1 overflow-x-auto rounded-lg border bg-muted p-3 text-sm">
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
            <pre className="overflow-x-auto rounded-lg border bg-muted p-3 text-xs">
              {iframe}
            </pre>
            <div className="flex justify-end">
              <CopyBtn text={iframe} label="Copy Code" />
            </div>
          </TabsContent>

          {/* JavaScript */}
          <TabsContent value="js" className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Recommended. This snippet forwards <code>gclid</code>/UTM params
              from your landing page into the form, auto-sizes the iframe, and
              can fire a Google Ads conversion on submit.
            </p>
            <JsEmbedPanel jsEmbed={jsEmbed} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
