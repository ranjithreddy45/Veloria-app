"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Copy, Check, Key, Trash2, Loader2, AlertTriangle, RefreshCw, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { generateApiKey, revokeApiKey, rotateApiKey } from "@/actions/api-key.actions";

interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  isActive: boolean;
  lastUsedAt: Date | string | null;
  createdAt: Date | string;
  scopes?: string[];
  source?: string | null;
  expiresAt?: Date | string | null;
  revokedAt?: Date | string | null;
}

interface Props {
  initialKeys: ApiKeyItem[];
}

const EXPIRY_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
];

function isPushKey(key: ApiKeyItem) {
  return (key.scopes ?? []).includes("leads:create");
}

function keyState(key: ApiKeyItem): "active" | "revoked" | "expired" {
  if (!key.isActive || key.revokedAt) return "revoked";
  if (key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now()) return "expired";
  return "active";
}

const shortDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function ApiKeyManager({ initialKeys }: Props) {
  const [keys, setKeys] = useState<ApiKeyItem[]>(initialKeys);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [pushApi, setPushApi] = useState(true);
  const [source, setSource] = useState("");
  const [expiry, setExpiry] = useState("never");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generatedIsPush, setGeneratedIsPush] = useState(true);
  const [rotationNote, setRotationNote] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function handleGenerate() {
    if (!newKeyName.trim()) {
      toast.error("Please enter a name for the API key");
      return;
    }

    startTransition(async () => {
      const result = await generateApiKey(newKeyName.trim(), {
        pushApi,
        source: source.trim() || undefined,
        expiresInDays: expiry === "never" ? null : Number(expiry),
      });
      if (result.success && result.data) {
        const data = result.data;
        setGeneratedKey(data.key);
        setGeneratedIsPush(pushApi);
        setRotationNote(null);
        setKeys((prev) => [
          {
            id: data.id,
            name: data.name,
            prefix: data.prefix,
            isActive: true,
            lastUsedAt: null,
            createdAt: new Date().toISOString(),
            scopes: data.scopes,
            source: data.source,
            expiresAt: data.expiresAt,
            revokedAt: null,
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
          prev.map((k) => (k.id === id ? { ...k, isActive: false, revokedAt: new Date().toISOString() } : k))
        );
        toast.success("API key revoked");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleRotate(key: ApiKeyItem) {
    startTransition(async () => {
      const result = await rotateApiKey(key.id);
      if (result.success && result.data) {
        const data = result.data;
        setKeys((prev) => [
          {
            id: data.id,
            name: data.name,
            prefix: data.prefix,
            isActive: true,
            lastUsedAt: null,
            createdAt: new Date().toISOString(),
            scopes: data.scopes,
            source: data.source,
            expiresAt: data.expiresAt,
            revokedAt: null,
          },
          ...prev.map((k) => (k.id === key.id ? { ...k, expiresAt: data.oldKeyExpiresAt } : k)),
        ]);
        setGeneratedKey(data.key);
        setGeneratedIsPush(true);
        setRotationNote(
          `The old key (${key.prefix}…) keeps working until ${new Date(data.oldKeyExpiresAt).toLocaleString("en-IN")}. Switch the integration to this key before then.`
        );
        setDialogOpen(true);
        toast.success("Key rotated");
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
    setSource("");
    setExpiry("never");
    setPushApi(true);
    setGeneratedKey(null);
    setRotationNote(null);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">API Keys</CardTitle>
            <CardDescription>
              Keys for systems that send leads in: the Push API (<code>/api/v1/push/leads</code>) and the older
              capture endpoint.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <a href="/api/v1/docs" target="_blank" rel="noopener noreferrer">
                <BookOpen className="h-4 w-4" />
                API docs
              </a>
            </Button>
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
                      <Label htmlFor="api-key-name">Key name</Label>
                      <Input
                        id="api-key-name"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="e.g. Meta lead ads sync"
                      />
                    </div>
                    <label className="flex items-start gap-2.5 rounded-md border border-border/60 p-3">
                      <Checkbox
                        checked={pushApi}
                        onCheckedChange={(v) => setPushApi(v === true)}
                        className="mt-0.5"
                      />
                      <span className="text-sm">
                        <span className="font-medium">Push API access</span>
                        <span className="block text-xs text-muted-foreground">
                          Grants <code>leads:create</code> on <code>/api/v1/push/leads</code>. Untick for a legacy
                          key that only works with <code>/api/leads/capture</code>.
                        </span>
                      </span>
                    </label>
                    {pushApi && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="api-key-source">Source (optional)</Label>
                          <Input
                            id="api-key-source"
                            value={source}
                            onChange={(e) => setSource(e.target.value)}
                            placeholder="meta_ads"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Expires</Label>
                          <Select value={expiry} onValueChange={setExpiry}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {EXPIRY_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
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
                      <Input value={generatedKey} readOnly className="bg-muted font-mono text-xs" />
                      <Button variant="outline" size="icon" onClick={copyKey} aria-label="Copy API key">
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    {rotationNote && <p className="text-xs text-muted-foreground">{rotationNote}</p>}
                    <p className="text-xs text-muted-foreground">
                      {generatedIsPush ? (
                        <>
                          Send it as <code>Authorization: Bearer &lt;key&gt;</code> to{" "}
                          <code>/api/v1/push/leads</code>. See the API docs for the request format.
                        </>
                      ) : (
                        <>
                          Use this key in the <code>x-api-key</code> header when calling <code>/api/leads/capture</code>.
                        </>
                      )}
                    </p>
                    <Button variant="outline" onClick={closeDialog} className="w-full">
                      Done
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {keys.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No API keys yet. Generate one to start receiving leads from another system.
          </p>
        ) : (
          <div className="space-y-2">
            {keys.map((key) => {
              const state = keyState(key);
              const push = isPushKey(key);
              return (
                <div
                  key={key.id}
                  className="flex flex-wrap items-center justify-between gap-3 border border-border/50 rounded-lg p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Key className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{key.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {key.prefix}{"••••••••"}
                        {key.source ? <span className="font-sans"> · {key.source}</span> : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {key.lastUsedAt ? `Last used ${shortDate(key.lastUsedAt)}` : "Never used"}
                        {state === "active" && key.expiresAt ? ` · Expires ${shortDate(key.expiresAt)}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{push ? "Push API" : "Capture API"}</Badge>
                    <Badge
                      variant="outline"
                      className={
                        state === "active"
                          ? "bg-success/10 text-success border-success/20"
                          : "bg-destructive/10 text-destructive border-destructive/20"
                      }
                    >
                      {state === "active" ? "Active" : state === "expired" ? "Expired" : "Revoked"}
                    </Badge>
                    {state === "active" && push && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => handleRotate(key)}
                        disabled={isPending}
                        aria-label={`Rotate ${key.name}`}
                        title="Rotate key"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                    {state !== "revoked" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRevoke(key.id)}
                        disabled={isPending}
                        aria-label={`Revoke ${key.name}`}
                        title="Revoke key"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
