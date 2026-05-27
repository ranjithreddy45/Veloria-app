"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, MessageCircle } from "lucide-react";
import {
  upsertAutoWelcomeConfig,
  deleteAutoWelcomeConfig,
} from "@/actions/auto-welcome.actions";
import { toast } from "sonner";
import { LEAD_SOURCE_LABELS } from "@/lib/constants";

interface WelcomeConfig {
  id: string;
  leadSource: string;
  isEnabled: boolean;
  templateName: string;
  delayMinutes: number;
}

interface Props {
  initialConfigs: WelcomeConfig[];
}

const LEAD_SOURCES = [
  "WEBSITE",
  "REFERRAL",
  "SOCIAL_MEDIA",
  "WALK_IN",
  "PHONE_INQUIRY",
  "EMAIL",
  "EVENT",
  "PARTNER",
  "ADVERTISEMENT",
  "FACEBOOK_ADS",
  "GOOGLE_ADS",
  "INDIAMART",
  "JUSTDIAL",
  "OTHER",
];

export function AutoWelcomeConfig({ initialConfigs }: Props) {
  const [configs, setConfigs] = useState<WelcomeConfig[]>(initialConfigs);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // New config form
  const [newSource, setNewSource] = useState("");
  const [newTemplate, setNewTemplate] = useState("");
  const [newDelay, setNewDelay] = useState("0");

  const handleAdd = () => {
    if (!newSource || !newTemplate) {
      toast.error("Source and template name are required");
      return;
    }

    startTransition(async () => {
      const result = await upsertAutoWelcomeConfig({
        leadSource: newSource,
        isEnabled: true,
        templateName: newTemplate,
        delayMinutes: parseInt(newDelay || "0"),
      });

      if (result.success) {
        setConfigs((prev) => [...prev.filter((c) => c.leadSource !== newSource), result.data]);
        toast.success("Welcome config saved");
        setDialogOpen(false);
        setNewSource("");
        setNewTemplate("");
        setNewDelay("0");
      } else {
        toast.error(result.error || "Failed to save");
      }
    });
  };

  const handleToggle = (config: WelcomeConfig) => {
    startTransition(async () => {
      const result = await upsertAutoWelcomeConfig({
        id: config.id,
        leadSource: config.leadSource,
        isEnabled: !config.isEnabled,
        templateName: config.templateName,
        delayMinutes: config.delayMinutes,
      });

      if (result.success) {
        setConfigs((prev) =>
          prev.map((c) => (c.id === config.id ? result.data : c))
        );
        toast.success(result.data.isEnabled ? "Enabled" : "Disabled");
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteAutoWelcomeConfig(id);
      if (result.success) {
        setConfigs((prev) => prev.filter((c) => c.id !== id));
        toast.success("Deleted");
      } else {
        toast.error(result.error || "Failed to delete");
      }
    });
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Auto Welcome Messages
            </CardTitle>
            <CardDescription>
              Automatically send WhatsApp welcome messages when leads are captured from specific sources
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Auto Welcome Rule</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Lead Source</Label>
                  <Select value={newSource} onValueChange={setNewSource}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_SOURCES.filter(
                        (s) => !configs.some((c) => c.leadSource === s)
                      ).map((source) => (
                        <SelectItem key={source} value={source}>
                          {LEAD_SOURCE_LABELS[source] || source}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp Template Name</Label>
                  <Input
                    placeholder="e.g., welcome_lead_v1"
                    value={newTemplate}
                    onChange={(e) => setNewTemplate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Delay (minutes)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newDelay}
                    onChange={(e) => setNewDelay(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    0 = send immediately
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAdd} disabled={isPending}>
                  {isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {configs.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            No auto-welcome rules configured yet.
          </div>
        ) : (
          <div className="space-y-3">
            {configs.map((config) => (
              <div
                key={config.id}
                className="flex items-center justify-between border border-border/50 rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  <Switch
                    checked={config.isEnabled}
                    onCheckedChange={() => handleToggle(config)}
                    disabled={isPending}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">
                        {LEAD_SOURCE_LABELS[config.leadSource] || config.leadSource}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {config.templateName}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {config.delayMinutes === 0
                        ? "Send immediately"
                        : `Send after ${config.delayMinutes} min`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleDelete(config.id)}
                  disabled={isPending}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
