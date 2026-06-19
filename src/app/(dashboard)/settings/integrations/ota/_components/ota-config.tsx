"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Rss,
  Copy,
  Check,
  RefreshCw,
  Plus,
  Trash2,
  Pencil,
  X,
  ListChecks,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  otaChannelTypeValues,
  otaFeedFormatValues,
  leadSourceValues,
} from "@/schemas/ota.schema";
import {
  upsertOtaChannel,
  deleteOtaChannel,
  regenerateChannelToken,
  getOtaSyncLogs,
} from "@/actions/ota.actions";

interface ChannelItem {
  id: string;
  channelType: string;
  name: string;
  feedFormat: string;
  feedToken: string | null;
  inboundToken: string | null;
  venueId: string | null;
  defaultSource: string;
  fieldMapping: Record<string, string>;
  credentials: Record<string, string>;
  isActive: boolean;
  lastOutboundSyncAt: string | null;
  lastInboundSyncAt: string | null;
}

interface VenueItem {
  id: string;
  name: string;
}

interface SyncLogItem {
  id: string;
  direction: string;
  status: string;
  recordCount: number;
  errorCount: number;
  message: string | null;
  createdAt: string;
}

interface Props {
  baseUrl: string;
  channels: ChannelItem[];
  venues: VenueItem[];
  canManage: boolean;
}

interface FormState {
  id?: string;
  channelType: string;
  name: string;
  feedFormat: string;
  venueId: string;
  defaultSource: string;
  isActive: boolean;
  inboundSecret: string;
  mappingRows: { key: string; value: string }[];
}

const MAPPING_KEYS = [
  "name",
  "phone",
  "email",
  "message",
  "eventType",
  "eventDate",
  "guestCount",
  "estimatedValue",
  "perPlateBudget",
  "venueId",
  "id",
];

function emptyForm(): FormState {
  return {
    channelType: "GENERIC",
    name: "",
    feedFormat: "JSON",
    venueId: "",
    defaultSource: "OTHER",
    isActive: true,
    inboundSecret: "",
    mappingRows: [
      { key: "name", value: "" },
      { key: "phone", value: "" },
      { key: "email", value: "" },
    ],
  };
}

export function OtaConfig({ baseUrl, channels, venues, canManage }: Props) {
  const [editing, setEditing] = useState<FormState | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [logsFor, setLogsFor] = useState<string | null>(null);
  const [logs, setLogs] = useState<SyncLogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const venueName = (id: string | null) =>
    id ? venues.find((v) => v.id === id)?.name ?? "Unknown venue" : "— not set —";

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const startCreate = () => setEditing(emptyForm());

  const startEdit = (c: ChannelItem) => {
    const mappingRows = Object.entries(c.fieldMapping).map(([key, value]) => ({ key, value }));
    setEditing({
      id: c.id,
      channelType: c.channelType,
      name: c.name,
      feedFormat: c.feedFormat,
      venueId: c.venueId ?? "",
      defaultSource: c.defaultSource,
      isActive: c.isActive,
      inboundSecret: c.credentials?.inboundSecret ?? "",
      mappingRows: mappingRows.length > 0 ? mappingRows : [{ key: "name", value: "" }],
    });
  };

  const save = () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast.error("Name is required");
      return;
    }

    const fieldMapping: Record<string, string> = {};
    for (const row of editing.mappingRows) {
      if (row.key.trim() && row.value.trim()) {
        fieldMapping[row.key.trim()] = row.value.trim();
      }
    }

    const credentials: Record<string, string> = {};
    if (editing.inboundSecret.trim()) {
      credentials.inboundSecret = editing.inboundSecret.trim();
    }

    startTransition(async () => {
      const res = await upsertOtaChannel({
        id: editing.id,
        channelType: editing.channelType as (typeof otaChannelTypeValues)[number],
        name: editing.name.trim(),
        feedFormat: editing.feedFormat as (typeof otaFeedFormatValues)[number],
        venueId: editing.venueId || null,
        defaultSource: editing.defaultSource as (typeof leadSourceValues)[number],
        fieldMapping,
        credentials,
        isActive: editing.isActive,
      });
      if (res.success) {
        toast.success(editing.id ? "Channel updated" : "Channel created");
        setEditing(null);
      } else {
        toast.error(res.error);
      }
    });
  };

  const remove = (id: string) => {
    if (!confirm("Delete this channel? Its public feed and inbound URLs will stop working.")) return;
    startTransition(async () => {
      const res = await deleteOtaChannel(id);
      if (res.success) toast.success("Channel deleted");
      else toast.error(res.error);
    });
  };

  const regenerate = (id: string, which: "feed" | "inbound") => {
    if (!confirm(`Regenerate the ${which} token? The existing ${which} URL will stop working immediately.`)) return;
    startTransition(async () => {
      const res = await regenerateChannelToken(id, which);
      if (res.success) toast.success(`${which === "feed" ? "Feed" : "Inbound"} token regenerated`);
      else toast.error(res.error);
    });
  };

  const loadLogs = async (channelId: string) => {
    if (logsFor === channelId) {
      setLogsFor(null);
      setLogs([]);
      return;
    }
    setLogsFor(channelId);
    setLogsLoading(true);
    const res = await getOtaSyncLogs(channelId, 1);
    if (res.success) {
      setLogs(
        res.data.logs.map((l) => ({
          id: l.id,
          direction: l.direction,
          status: l.status,
          recordCount: l.recordCount,
          errorCount: l.errorCount,
          message: l.message,
          createdAt: new Date(l.createdAt).toISOString(),
        }))
      );
    } else {
      toast.error(res.error);
      setLogs([]);
    }
    setLogsLoading(false);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      SUCCESS: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
      PARTIAL: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
      FAILED: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
    };
    return map[status] ?? "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {channels.length} channel{channels.length === 1 ? "" : "s"} configured
        </p>
        {canManage && !editing && (
          <Button onClick={startCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" /> New Channel
          </Button>
        )}
      </div>

      {/* Editor */}
      {editing && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              {editing.id ? "Edit Channel" : "New Channel"}
            </CardTitle>
            <CardDescription>
              Configure the marketplace channel, its outbound feed venue, and the inbound
              field mapping.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g. WedMeGood — Grand Ballroom"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Channel Type</Label>
                <Select
                  value={editing.channelType}
                  onValueChange={(v) => setEditing({ ...editing, channelType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {otaChannelTypeValues.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Outbound Feed Venue</Label>
                <Select
                  value={editing.venueId || "none"}
                  onValueChange={(v) => setEditing({ ...editing, venueId: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a venue" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— none (inbound only) —</SelectItem>
                    {venues.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Feed Format</Label>
                <Select
                  value={editing.feedFormat}
                  onValueChange={(v) => setEditing({ ...editing, feedFormat: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {otaFeedFormatValues.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Inbound Lead Source</Label>
                <Select
                  value={editing.defaultSource}
                  onValueChange={(v) => setEditing({ ...editing, defaultSource: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {leadSourceValues.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Inbound Shared Secret (optional)</Label>
                <Input
                  value={editing.inboundSecret}
                  onChange={(e) => setEditing({ ...editing, inboundSecret: e.target.value })}
                  placeholder="Require x-ota-secret header"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={editing.isActive}
                onCheckedChange={(v) => setEditing({ ...editing, isActive: v })}
              />
              <Label className="cursor-pointer">Active</Label>
            </div>

            {/* Field mapping editor */}
            <div className="space-y-2">
              <Label>Inbound Field Mapping</Label>
              <p className="text-xs text-muted-foreground">
                Map each lead field to a dot-path in the aggregator&apos;s payload, e.g.{" "}
                <code className="font-mono">customer.full_name</code>. <code className="font-mono">name</code> or{" "}
                <code className="font-mono">phone</code> must resolve, or the lead is rejected.
              </p>
              <div className="space-y-2">
                {editing.mappingRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select
                      value={row.key}
                      onValueChange={(v) => {
                        const rows = [...editing.mappingRows];
                        rows[i] = { ...rows[i], key: v };
                        setEditing({ ...editing, mappingRows: rows });
                      }}
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MAPPING_KEYS.map((k) => (
                          <SelectItem key={k} value={k}>
                            {k}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={row.value}
                      placeholder="payload dot-path"
                      className="font-mono text-xs"
                      onChange={(e) => {
                        const rows = [...editing.mappingRows];
                        rows[i] = { ...rows[i], value: e.target.value };
                        setEditing({ ...editing, mappingRows: rows });
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => {
                        const rows = editing.mappingRows.filter((_, j) => j !== i);
                        setEditing({ ...editing, mappingRows: rows.length ? rows : [{ key: "name", value: "" }] });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setEditing({
                    ...editing,
                    mappingRows: [...editing.mappingRows, { key: "email", value: "" }],
                  })
                }
              >
                <Plus className="h-4 w-4 mr-1" /> Add mapping
              </Button>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button onClick={save} disabled={isPending}>
                {isPending ? "Saving…" : "Save Channel"}
              </Button>
              <Button variant="ghost" onClick={() => setEditing(null)} disabled={isPending}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Channel list */}
      {channels.length === 0 && !editing && (
        <Card className="border-border/50">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Rss className="h-8 w-8 mx-auto mb-2 opacity-40" />
            No OTA channels yet. Create one to publish availability feeds or ingest aggregator leads.
          </CardContent>
        </Card>
      )}

      {channels.map((c) => {
        const feedUrl = c.feedToken ? `${baseUrl}/api/ota/feed/${c.feedToken}` : null;
        const inboundUrl = c.inboundToken ? `${baseUrl}/api/ota/inbound/${c.inboundToken}` : null;
        return (
          <Card key={c.id} className="border-border/50">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {c.name}
                    <Badge variant="outline">{c.channelType}</Badge>
                    {c.isActive ? (
                      <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Inactive
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Venue: {venueName(c.venueId)} · Feed: {c.feedFormat} · Inbound source: {c.defaultSource}
                  </CardDescription>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(c.id)} disabled={isPending}>
                      <Trash2 className="h-4 w-4 text-rose-500" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Outbound feed URL */}
              <div className="space-y-1.5">
                <Label className="text-xs">Public Feed URL {c.venueId ? "" : "(set a venue to enable)"}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={feedUrl ?? "—"}
                    className="font-mono text-xs bg-muted/30"
                  />
                  {feedUrl && (
                    <Button variant="outline" size="icon" className="shrink-0" onClick={() => copy(feedUrl, `feed-${c.id}`)}>
                      {copiedKey === `feed-${c.id}` ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  )}
                  {canManage && (
                    <Button variant="outline" size="icon" className="shrink-0" onClick={() => regenerate(c.id, "feed")} disabled={isPending} title="Regenerate feed token">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Inbound URL */}
              <div className="space-y-1.5">
                <Label className="text-xs">Public Inbound URL (POST)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={inboundUrl ?? "—"}
                    className="font-mono text-xs bg-muted/30"
                  />
                  {inboundUrl && (
                    <Button variant="outline" size="icon" className="shrink-0" onClick={() => copy(inboundUrl, `inbound-${c.id}`)}>
                      {copiedKey === `inbound-${c.id}` ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  )}
                  {canManage && (
                    <Button variant="outline" size="icon" className="shrink-0" onClick={() => regenerate(c.id, "inbound")} disabled={isPending} title="Regenerate inbound token">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Last outbound: {c.lastOutboundSyncAt ? new Date(c.lastOutboundSyncAt).toLocaleString() : "never"} ·
                  Last inbound: {c.lastInboundSyncAt ? new Date(c.lastInboundSyncAt).toLocaleString() : "never"}
                </span>
                <Button variant="ghost" size="sm" onClick={() => loadLogs(c.id)}>
                  <ListChecks className="h-4 w-4 mr-1" />
                  {logsFor === c.id ? "Hide logs" : "Sync logs"}
                </Button>
              </div>

              {/* Sync log table */}
              {logsFor === c.id && (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  {logsLoading ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
                  ) : logs.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">No sync activity yet.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>When</TableHead>
                          <TableHead>Direction</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Records</TableHead>
                          <TableHead className="text-right">Errors</TableHead>
                          <TableHead>Message</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((l) => (
                          <TableRow key={l.id}>
                            <TableCell className="whitespace-nowrap text-xs">
                              {new Date(l.createdAt).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{l.direction}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={statusBadge(l.status)}>{l.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{l.recordCount}</TableCell>
                            <TableCell className="text-right tabular-nums">{l.errorCount}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                              {l.message ?? "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
