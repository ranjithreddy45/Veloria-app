"use client";

import * as React from "react";
import { Loader2Icon, PlusIcon, TrashIcon } from "lucide-react";
import { toast } from "sonner";

import {
  deleteCampaignRoute,
  saveCampaignRoute,
  savePropertyRow,
  type CampaignRow,
  type PropertyRoutingData,
  type PropertyRow,
} from "@/actions/property-routing.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Mirrors PROPERTY_KEYS in src/lib/crm/property-routing.ts (kept local: that
// module imports prisma and must stay server-only).
const KEYS: { key: string; name: string; terms: string; corporateOnly?: boolean }[] = [
  { key: "hosa_road", name: "Veloria Grand Hosa Road", terms: "hosa road, singasandra" },
  { key: "electronic_city", name: "Veloria Grand Electronic City", terms: "electronic city, e city, ecity" },
  { key: "hsr", name: "Veloria Grand HSR Layout", terms: "hsr layout" },
  { key: "indiranagar", name: "Veloria Grand Indiranagar", terms: "indiranagar, indira nagar, old airport road" },
  { key: "bellandur", name: "Veloria Grand Bellandur", terms: "bellandur, outer ring road", corporateOnly: true },
  { key: "yelahanka", name: "Veloria Grand Yelahanka", terms: "yelahanka" },
  { key: "kr_puram", name: "Veloria Grand KR Puram", terms: "k r puram, krishnarajapuram" },
  { key: "other", name: "Shared queue (no property)", terms: "" },
];

const selectCls =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Draft = Omit<PropertyRow, "id" | "matchTerms"> & { id: string | null; matchTerms: string };

function toDraft(key: string, rows: PropertyRow[]): Draft {
  const r = rows.find((x) => x.key === key);
  const d = KEYS.find((k) => k.key === key)!;
  return r
    ? { ...r, matchTerms: r.matchTerms.join(", ") }
    : {
        id: null,
        key,
        name: d.name,
        matchTerms: d.terms,
        corporateOnly: !!d.corporateOnly,
        ownerId: null,
        venueId: null,
        isActive: true,
      };
}

export function PropertyRoutingManager({ initial }: { initial: PropertyRoutingData }) {
  const [props, setProps] = React.useState<Draft[]>(() => KEYS.map((k) => toDraft(k.key, initial.properties)));
  const [campaigns, setCampaigns] = React.useState<CampaignRow[]>(initial.campaigns);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [newCamp, setNewCamp] = React.useState({ campaignId: "", campaignName: "", propertyKey: "" });

  const userName = (id: string | null) => initial.users.find((u) => u.id === id)?.name ?? null;
  const saved = new Set(initial.properties.map((p) => p.key).concat(props.filter((p) => p.id).map((p) => p.key)));
  const liveOwners = props.filter((p) => p.id && p.ownerId).length;
  const queue = props.find((p) => p.key === "other");

  const patch = (key: string, change: Partial<Draft>) =>
    setProps((list) => list.map((p) => (p.key === key ? { ...p, ...change } : p)));

  async function saveProp(p: Draft) {
    setBusy(`p:${p.key}`);
    const res = await savePropertyRow({
      key: p.key,
      name: p.name,
      matchTerms: p.matchTerms,
      corporateOnly: p.corporateOnly,
      ownerId: p.ownerId,
      venueId: p.venueId,
      isActive: p.isActive,
    });
    setBusy(null);
    if (!res.success) return toast.error(res.error);
    patch(p.key, { ...res.data, matchTerms: res.data.matchTerms.join(", ") });
    toast.success(`${res.data.name} saved`);
  }

  async function saveCamp(c: { campaignId: string; campaignName: string | null; propertyKey: string | null; isActive: boolean }) {
    setBusy(`c:${c.campaignId}`);
    const res = await saveCampaignRoute(c);
    setBusy(null);
    if (!res.success) return toast.error(res.error);
    setCampaigns((list) => {
      const rest = list.filter((x) => x.campaignId !== res.data.campaignId);
      return [...rest, res.data].sort((a, b) => (a.campaignName ?? "").localeCompare(b.campaignName ?? ""));
    });
    toast.success(`Campaign ${res.data.campaignId} saved`);
    return true;
  }

  async function removeCamp(c: CampaignRow) {
    if (!window.confirm(`Remove campaign ${c.campaignId} from routing?`)) return;
    setBusy(`c:${c.campaignId}`);
    const res = await deleteCampaignRoute(c.id);
    setBusy(null);
    if (!res.success) return toast.error(res.error);
    setCampaigns((list) => list.filter((x) => x.id !== c.id));
  }

  return (
    <div className="space-y-8">
      <div
        className={
          liveOwners > 0
            ? "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-body"
            : "rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-body"
        }
      >
        {liveOwners > 0 ? (
          <>
            <span className="font-semibold">Property routing is on.</span> New leads go to the property owner below.
            {!queue?.ownerId && (
              <> No shared-queue owner is set, so leads without a property still use the old assignment chain.</>
            )}
          </>
        ) : (
          <>
            <span className="font-semibold">Property routing is off.</span> It switches on when the first property
            with an owner is saved. Until then leads are assigned exactly as before.
          </>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Properties and owners</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Property</th>
                <th className="px-3 py-2 font-medium">Display name</th>
                <th className="px-3 py-2 font-medium">Owner</th>
                <th className="px-3 py-2 font-medium">Venue (optional)</th>
                <th className="px-3 py-2 font-medium">Match words</th>
                <th className="px-3 py-2 font-medium">Corporate only</th>
                <th className="px-3 py-2 font-medium">Active</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {props.map((p) => (
                <tr key={p.key} className="border-t align-top">
                  <td className="px-3 py-2 font-mono text-xs">
                    {p.key}
                    {!saved.has(p.key) && <div className="mt-1 text-[11px] text-amber-600">not saved yet</div>}
                  </td>
                  <td className="px-3 py-2">
                    <Input value={p.name} onChange={(e) => patch(p.key, { name: e.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className={selectCls}
                      value={p.ownerId ?? ""}
                      onChange={(e) => patch(p.key, { ownerId: e.target.value || null })}
                    >
                      <option value="">— nobody —</option>
                      {initial.users.map((u) => (
                        <option key={u.id} value={u.id} disabled={!u.isActive}>
                          {u.name ?? u.id} {u.isActive ? "" : "(inactive)"}
                        </option>
                      ))}
                    </select>
                    {p.key === "other" && (
                      <div className="mt-1 text-[11px] text-muted-foreground">Receives leads with no property, and non-corporate Bellandur leads.</div>
                    )}
                    {p.ownerId && !userName(p.ownerId) && (
                      <div className="mt-1 text-[11px] text-destructive">Owner no longer assignable</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className={selectCls}
                      value={p.venueId ?? ""}
                      onChange={(e) => patch(p.key, { venueId: e.target.value || null })}
                      disabled={p.key === "other"}
                    >
                      <option value="">—</option>
                      {initial.venues.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={p.matchTerms}
                      placeholder="comma-separated"
                      onChange={(e) => patch(p.key, { matchTerms: e.target.value })}
                      disabled={p.key === "other"}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={p.corporateOnly}
                      disabled={p.key === "other"}
                      onChange={(e) => patch(p.key, { corporateOnly: e.target.checked })}
                      aria-label={`${p.key} takes corporate enquiries only`}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={p.isActive}
                      onChange={(e) => patch(p.key, { isActive: e.target.checked })}
                      aria-label={`${p.key} active`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Button size="sm" onClick={() => saveProp(p)} disabled={busy === `p:${p.key}`}>
                      {busy === `p:${p.key}` ? <Loader2Icon className="size-4 animate-spin" /> : "Save"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Google Ads campaigns</h2>
        <p className="text-sm text-muted-foreground">
          The campaign ID is the number after <code>campaignId=</code> in the Google Ads URL. Leave the property empty
          for campaigns that cover every property (Wedding, Brand): those use the form&rsquo;s location answer, else the
          shared queue.
        </p>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Campaign ID</th>
                <th className="px-3 py-2 font-medium">Campaign name</th>
                <th className="px-3 py-2 font-medium">Property</th>
                <th className="px-3 py-2 font-medium">Active</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{c.campaignId}</td>
                  <td className="px-3 py-2">{c.campaignName ?? "—"}</td>
                  <td className="px-3 py-2">
                    <select
                      className={selectCls}
                      value={c.propertyKey ?? ""}
                      onChange={(e) =>
                        saveCamp({ campaignId: c.campaignId, campaignName: c.campaignName, propertyKey: e.target.value || null, isActive: c.isActive })
                      }
                      disabled={busy === `c:${c.campaignId}`}
                    >
                      <option value="">Location answer, else shared queue</option>
                      {props
                        .filter((p) => p.key !== "other" && saved.has(p.key))
                        .map((p) => (
                          <option key={p.key} value={p.key}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={c.isActive}
                      onChange={(e) =>
                        saveCamp({ campaignId: c.campaignId, campaignName: c.campaignName, propertyKey: c.propertyKey, isActive: e.target.checked })
                      }
                      aria-label={`Campaign ${c.campaignId} active`}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => removeCamp(c)} aria-label={`Remove campaign ${c.campaignId}`}>
                      <TrashIcon className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              <tr className="border-t bg-muted/20">
                <td className="px-3 py-2">
                  <Input
                    inputMode="numeric"
                    placeholder="24526650623"
                    value={newCamp.campaignId}
                    onChange={(e) => setNewCamp((n) => ({ ...n, campaignId: e.target.value }))}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    placeholder="VG | Search | …"
                    value={newCamp.campaignName}
                    onChange={(e) => setNewCamp((n) => ({ ...n, campaignName: e.target.value }))}
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    className={selectCls}
                    value={newCamp.propertyKey}
                    onChange={(e) => setNewCamp((n) => ({ ...n, propertyKey: e.target.value }))}
                  >
                    <option value="">Location answer, else shared queue</option>
                    {props
                      .filter((p) => p.key !== "other" && saved.has(p.key))
                      .map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </td>
                <td />
                <td className="px-3 py-2 text-right">
                  <Button
                    size="sm"
                    disabled={!newCamp.campaignId.trim() || busy === "c:new"}
                    onClick={async () => {
                      const ok = await saveCamp({
                        campaignId: newCamp.campaignId,
                        campaignName: newCamp.campaignName || null,
                        propertyKey: newCamp.propertyKey || null,
                        isActive: true,
                      });
                      if (ok) setNewCamp({ campaignId: "", campaignName: "", propertyKey: "" });
                    }}
                  >
                    <PlusIcon className="size-4" /> Add
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
