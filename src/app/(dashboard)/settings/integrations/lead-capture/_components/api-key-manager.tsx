"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Copy, Check, Key, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { generateApiKey, revokeApiKey } from "@/actions/api-key.actions";

interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  isActive: boolean;
  lastUsedAt: Date | string | null;
  createdAt: Date | string;
}

interface Props {
  initialKeys: ApiKeyItem[];
}

export function ApiKeyManager({ initialKeys }: Props) {
  const [keys, setKeys] = useState<ApiKeyItem[]>(initialKeys);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function handleGenerate() {
    if (!newKeyName.trim()) {
      toast.error("Please enter a name for the API key");
      return;
    }

    startTransition(async () => {
      const result = await generateApiKey(newKeyName.trim());
      if (result.success && result.data) {
        setGeneratedKey(result.data.key);
        setKeys((prev) => [
          {
            id: result.data!.id,
            name: result.data!.name,
            prefix: result.data!.prefix,
            isActive: true,
            lastUsedAt: null,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        toast.success("API key generated");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleRevoke(id: string) {
    startTransition(async () => {
      const result = await revokeApiKey(id);
      if (result.success) {
        setKeys((prev) =>
          prev.map((k) => (k.id === id ? { ...k, isActive: false } : k))
        );
        toast.success("API key revoked");
      } else {
        toast.error(result.error);
      }
    });
  }

  function copyKey() {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      toast.success("API key copied");
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function closeDialog() {
    setDialogOpen(false);
    setNewKeyName("");
    setGeneratedKey(null);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">API Keys</CardTitle>
            <CardDescription>
              Manage API keys for the generic lead capture endpoint.
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) closeDialog(); else setDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Generate Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{generatedKey ? "API Key Generated" : "Generate API Key"}</DialogTitle>
              </DialogHeader>

              {!generatedKey ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Key Name</Label>
                    <Input
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g. IndiaMart Integration"
                    />
                  </div>
                  <Button onClick={handleGenerate} disabled={isPending} className="w-full">
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Key className="mr-2 h-4 w-4" />}
                    Generate
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 rounded-md bg-warning/10 p-3 text-sm text-warning">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      Copy this key now. It will <strong>not be shown again</strong>.
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={generatedKey}
                      readOnly
                      className="bg-muted font-mono text-xs"
                    />
                    <Button variant="outline" size="icon" onClick={copyKey}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use this key in the <code>x-api-key</code> header when calling <code>/api/leads/capture</code>
                  </p>
                  <Button variant="outline" onClick={closeDialog} className="w-full">
                    Done
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {keys.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No API keys yet. Generate one to start capturing leads via the generic API.
          </p>
        ) : (
          <div className="space-y-2">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between border border-border/50 rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{key.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {key.prefix}{"••••••••"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={
                      key.isActive
                        ? "bg-success/10 text-success border-success/20"
                        : "bg-destructive/10 text-destructive border-destructive/20"
                    }
                  >
                    {key.isActive ? "Active" : "Revoked"}
                  </Badge>
                  {key.isActive && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRevoke(key.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
