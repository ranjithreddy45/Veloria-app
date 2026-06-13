"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp, Trophy, Sparkles, Target, Loader2, Medal, ArrowUp, Settings2, Gem,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/shared/status-pill";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { seedVelosConfig, updateVelosPoints } from "@/actions/velos.actions";
import { giveKudos } from "@/actions/velos-peer.actions";
import { joinQuest, createQuest, seedStarterQuests } from "@/actions/velos-quests.actions";
import { Target as TargetIcon, Users as UsersIcon, LifeBuoy } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart } from "lucide-react";

interface Pace { thisPeriod: number; lastPeriod: number; projected: number; goal: number; onTrack: boolean; pctOfGoal: number }
interface Team { team: number; target: number; pct: number }
interface Identity { lifetime: number; tierKey: string; identity: string; unlock: string; hue: string; next: { key: string; identity: string; unlock: string; toNext: number } | null; pctToNext: number }
interface LbRow { userId: string; name: string; image: string | null; points: number; delta: number }
interface Cfg { id: string; eventType: string; points: number; label: string; category: string; clawbackEligible: boolean; isEffort: boolean }

const TIER_HUE: Record<string, string> = { BRONZE: "text-amber-700 bg-amber-50 ring-amber-200", SILVER: "text-slate-600 bg-slate-50 ring-slate-200", GOLD: "text-amber-600 bg-amber-50 ring-amber-200", PLATINUM: "text-violet-700 bg-violet-50 ring-violet-200" };

interface KudosItem { id: string; note: string; from: string; fromImg: string | null; to: string; toImg: string | null }
interface Teammate { id: string; name: string | null; image: string | null }
interface QuestItem { id: string; title: string; scope: string; metric: string; target: number; current: number; pct: number; rewardPoints: number; rewardNote: string | null; selfSelectable: boolean; isRecovery: boolean; joined: boolean; completed: boolean }

export function VelosSurface({
  pace, team, identity, leaderboard, config, myId, canAdmin, needsSeed,
  kudosFeed, kudosRemaining, teammates, quests, questsCanManage, silverPlus, configMetrics,
}: {
  pace: Pace | null; team: Team | null; identity: Identity | null; leaderboard: LbRow[];
  config: Cfg[]; myId: string; canAdmin: boolean; needsSeed: boolean;
  kudosFeed: KudosItem[]; kudosRemaining: number; teammates: Teammate[];
  quests: QuestItem[]; questsCanManage: boolean; silverPlus: boolean; configMetrics: { eventType: string; label: string }[];
}) {
  if (needsSeed) {
    return canAdmin ? <SeedPanel /> : (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        Velos isn’t set up yet. Ask an admin to initialise the points configuration.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Personal Pace — the primary view (motivates all eight) */}
      {pace && (
        <div className="rounded-2xl border bg-gradient-to-br from-[#2D1B3D] to-[#43295c] p-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[12.5px] font-medium text-white/70"><TrendingUp className="size-4" /> Your pace this month</div>
            <StatusPill label={pace.onTrack ? "On track" : "Push needed"} hue={pace.onTrack ? "emerald" : "amber"} size="sm" />
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <div className="text-[36px] font-bold leading-none tabular-nums">{pace.thisPeriod}</div>
              <div className="mt-1 text-[11.5px] text-white/60">Velos this month</div>
            </div>
            <div>
              <div className="text-xl font-semibold tabular-nums text-white/90">{pace.lastPeriod}</div>
              <div className="text-[11.5px] text-white/60">Your last month</div>
            </div>
            <div>
              <div className="text-xl font-semibold tabular-nums text-white/90">{pace.projected}</div>
              <div className="text-[11.5px] text-white/60">Projected end of month</div>
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-[11px] text-white/60"><span>vs your goal ({pace.goal})</span><span>{pace.pctOfGoal}%</span></div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-[#C9A96E] transition-all" style={{ width: `${Math.min(100, pace.pctOfGoal)}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Identity arc */}
        {identity && (
          <div className="rounded-xl border bg-card p-5">
            <div className="mb-3 flex items-center gap-2 text-[12.5px] font-semibold text-muted-foreground"><Sparkles className="size-4 text-[#C9A96E]" /> Your journey</div>
            <div className="flex items-center gap-3">
              <div className={cn("flex size-12 items-center justify-center rounded-xl ring-1 ring-inset", TIER_HUE[identity.tierKey])}>
                <Gem className="size-5" />
              </div>
              <div>
                <div className="text-lg font-semibold">{identity.identity}</div>
                <div className="text-[12px] text-muted-foreground">{identity.tierKey[0] + identity.tierKey.slice(1).toLowerCase()} · {identity.lifetime} lifetime Velos</div>
              </div>
            </div>
            <p className="mt-3 text-[12.5px] text-muted-foreground">Unlocked: <span className="text-foreground">{identity.unlock}</span></p>
            {identity.next ? (
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[11px] text-muted-foreground"><span>Next: {identity.next.identity}</span><span>{identity.next.toNext} to go</span></div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${identity.pctToNext}%` }} />
                </div>
                <p className="mt-1.5 text-[11.5px] text-muted-foreground">Unlocks: {identity.next.unlock}</p>
              </div>
            ) : <p className="mt-3 text-[12.5px] font-medium text-violet-700">Top tier reached — Rainmaker 🏆</p>}
          </div>
        )}

        {/* Team vs Target */}
        {team && (
          <div className="rounded-xl border bg-card p-5">
            <div className="mb-3 flex items-center gap-2 text-[12.5px] font-semibold text-muted-foreground"><Target className="size-4" /> Team vs target</div>
            <div className="flex items-end justify-between">
              <div className="text-3xl font-bold tabular-nums">{team.team}</div>
              <div className="text-[12.5px] text-muted-foreground">target {team.target}</div>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${team.pct}%` }} />
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">{team.pct}% of the team’s shared goal — we hit this together.</p>
          </div>
        )}
      </div>

      {/* Leaderboard (light touch) */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b px-4 py-3 text-[13px] font-semibold"><Trophy className="size-4 text-[#C9A96E]" /> This month (recognition)</div>
        {leaderboard.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No Velos earned yet this month. As the team works the pipeline, leads and tasks, points appear here.</div>
        ) : (
          <div className="divide-y">
            {leaderboard.map((r, i) => {
              const mostImproved = leaderboard.length > 1 && r.delta === Math.max(...leaderboard.map((x) => x.delta)) && r.delta > 0;
              return (
                <div key={r.userId} className={cn("flex items-center gap-3 px-4 py-2.5", r.userId === myId && "bg-primary/5")}>
                  <span className="w-5 text-center text-[13px] font-semibold text-muted-foreground tabular-nums">{i + 1}</span>
                  <Avatar size="sm"><AvatarImage src={r.image || undefined} /><AvatarFallback className="bg-primary/10 text-[10px] text-primary">{r.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{r.name}{r.userId === myId && <span className="ml-1.5 text-[11px] text-muted-foreground">(you)</span>}</span>
                  {mostImproved && <StatusPill label="Most improved" hue="emerald" size="xs" />}
                  {r.delta !== 0 && <span className={cn("inline-flex items-center gap-0.5 text-[11.5px]", r.delta > 0 ? "text-emerald-600" : "text-muted-foreground")}>{r.delta > 0 && <ArrowUp className="size-3" />}{r.delta > 0 ? `+${r.delta}` : r.delta}</span>}
                  <span className="w-12 text-right text-[14px] font-semibold tabular-nums">{r.points}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <QuestsBoard quests={quests} canManage={questsCanManage} silverPlus={silverPlus} configMetrics={configMetrics} />

      <KudosWall feed={kudosFeed} remaining={kudosRemaining} teammates={teammates} />

      {canAdmin && <ConfigPanel config={config} />}
    </div>
  );
}

function QuestsBoard({ quests, canManage, silverPlus, configMetrics }: { quests: QuestItem[]; canManage: boolean; silverPlus: boolean; configMetrics: { eventType: string; label: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function join(id: string) {
    setBusy(id); await joinQuest(id); setBusy(null); router.refresh();
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold"><TargetIcon className="size-4 text-[#C9A96E]" /> Quests &amp; team goals</div>
        {canManage && <CreateQuestControls configMetrics={configMetrics} hasQuests={quests.length > 0} />}
      </div>
      {quests.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">No active quests. {canManage ? "Seed the starter quests or create one." : "Check back soon."}</div>
      ) : (
        <div className="divide-y">
          {quests.map((q) => (
            <div key={q.id} className="px-4 py-3">
              <div className="flex items-center gap-2">
                {q.isRecovery ? <LifeBuoy className="size-3.5 text-emerald-600" /> : q.scope === "TEAM" ? <UsersIcon className="size-3.5 text-muted-foreground" /> : <TargetIcon className="size-3.5 text-muted-foreground" />}
                <span className="font-medium">{q.title}</span>
                {q.scope === "TEAM" && <StatusPill label="Team" hue="violet" size="xs" />}
                {q.isRecovery && <StatusPill label="Recovery" hue="emerald" size="xs" />}
                {q.completed && <StatusPill label="Done" hue="emerald" size="xs" />}
                <span className="ml-auto text-[12px] text-muted-foreground">
                  {q.rewardPoints > 0 ? `+${q.rewardPoints}` : ""}{q.rewardNote ? ` · ${q.rewardNote}` : ""}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${q.pct}%` }} />
                </div>
                <span className="w-14 text-right text-[11.5px] tabular-nums text-muted-foreground">{q.current}/{q.target}</span>
                {q.selfSelectable && !q.joined && q.scope === "INDIVIDUAL" && (
                  <Button size="sm" className="h-7" disabled={!silverPlus || busy === q.id} onClick={() => join(q.id)} title={silverPlus ? "" : "Reach Silver to opt in"}>
                    {busy === q.id ? <Loader2 className="size-3.5 animate-spin" /> : "Join"}
                  </Button>
                )}
                {q.joined && q.scope === "INDIVIDUAL" && <span className="text-[11.5px] text-emerald-600">Joined</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateQuestControls({ configMetrics, hasQuests }: { configMetrics: { eventType: string; label: string }[]; hasQuests: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [seeding, setSeeding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState("");
  const [scope, setScope] = React.useState("INDIVIDUAL");
  const [metric, setMetric] = React.useState("");
  const [target, setTarget] = React.useState("5");
  const [reward, setReward] = React.useState("40");
  const [rewardNote, setRewardNote] = React.useState("");
  const [selfSel, setSelfSel] = React.useState(true);

  async function seed() {
    setSeeding(true); await seedStarterQuests(); setSeeding(false); router.refresh();
  }
  async function save() {
    setError(null);
    if (!title.trim() || !metric) { setError("Title and metric required."); return; }
    setBusy(true);
    const res = await createQuest({ title, scope, metric, targetCount: parseInt(target, 10) || 1, rewardPoints: parseInt(reward, 10) || 0, rewardNote: rewardNote || undefined, selfSelectable: selfSel });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setOpen(false); setTitle(""); setMetric(""); router.refresh();
  }

  return (
    <div className="flex gap-2">
      {!hasQuests && <Button variant="ghost" size="sm" onClick={seed} disabled={seeding}>{seeding ? <Loader2 className="size-3.5 animate-spin" /> : "Seed starters"}</Button>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm" className="gap-1.5"><TargetIcon className="size-3.5" /> New quest</Button></DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New quest</DialogTitle><DialogDescription>Maps to a Velos trigger; progress advances as those events fire.</DialogDescription></DialogHeader>
          <div className="space-y-3 py-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. 5 site visits this week)" />
            <div className="grid grid-cols-2 gap-3">
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="INDIVIDUAL">Individual</SelectItem><SelectItem value="TEAM">Team</SelectItem></SelectContent>
              </Select>
              <Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Target" />
            </div>
            <Select value={metric} onValueChange={setMetric}>
              <SelectTrigger><SelectValue placeholder="Metric (trigger event)" /></SelectTrigger>
              <SelectContent>{configMetrics.map((m) => <SelectItem key={m.eventType} value={m.eventType}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" value={reward} onChange={(e) => setReward(e.target.value)} placeholder="Reward points" />
              <Input value={rewardNote} onChange={(e) => setRewardNote(e.target.value)} placeholder="Reward note" />
            </div>
            {scope === "INDIVIDUAL" && (
              <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={selfSel} onChange={(e) => setSelfSel(e.target.checked)} className="size-4" /> Self-selectable (Silver+ can opt in)</label>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={save} disabled={busy} className="gap-1.5">{busy && <Loader2 className="size-4 animate-spin" />} Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KudosWall({ feed, remaining, teammates }: { feed: KudosItem[]; remaining: number; teammates: Teammate[] }) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold"><Heart className="size-4 text-rose-500" /> Kudos wall</div>
        <GiveKudosDialog remaining={remaining} teammates={teammates} />
      </div>
      {feed.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">No kudos yet. Recognise a teammate who helped you out — it carries a small Velos reward.</div>
      ) : (
        <div className="divide-y">
          {feed.map((k) => (
            <div key={k.id} className="flex items-start gap-3 px-4 py-2.5">
              <Avatar size="sm"><AvatarImage src={k.fromImg || undefined} /><AvatarFallback className="bg-primary/10 text-[10px] text-primary">{k.from.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1 text-[13px]">
                <span className="font-medium">{k.from}</span> <span className="text-muted-foreground">recognised</span> <span className="font-medium">{k.to}</span>
                <p className="text-[12.5px] text-muted-foreground">“{k.note}”</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GiveKudosDialog({ remaining, teammates }: { remaining: number; teammates: Teammate[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [to, setTo] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!to) { setError("Pick a teammate."); return; }
    if (!note.trim()) { setError("Add a short note."); return; }
    setBusy(true);
    const res = await giveKudos(to, note);
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setOpen(false); setTo(""); setNote(""); router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5" disabled={remaining <= 0}><Heart className="size-3.5" /> Give kudos{remaining > 0 ? ` (${remaining} left)` : " (none left)"}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Give kudos</DialogTitle>
          <DialogDescription>Recognise a teammate. They get a small Velos reward. {remaining} left this week.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Select value={to} onValueChange={setTo}>
            <SelectTrigger><SelectValue placeholder="Teammate" /></SelectTrigger>
            <SelectContent>{teammates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name ?? "—"}</SelectItem>)}</SelectContent>
          </Select>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Saved the Sharma wedding setup…" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gap-1.5">{busy && <Loader2 className="size-4 animate-spin" />} Send</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SeedPanel() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  async function run() {
    setBusy(true); const res = await seedVelosConfig(); setBusy(false);
    setMsg(res.success ? `Seeded ${res.data.created} point rules.` : res.error); router.refresh();
  }
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-dashed p-10 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Sparkles className="size-6" /></div>
      <h3 className="mt-4 text-lg font-semibold">Set up Velos</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">Seed the default point values for every trigger (pipeline, lead-SLA, ops, finance, peer, recovery). All tunable afterwards.</p>
      <Button onClick={run} disabled={busy} className="mt-5 gap-1.5">{busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Set up Velos</Button>
      {msg && <p className="mt-3 text-[13px] text-muted-foreground">{msg}</p>}
    </div>
  );
}

function ConfigPanel({ config }: { config: Cfg[] }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold"><Settings2 className="size-4" /> Point configuration <span className="text-[11.5px] font-normal text-muted-foreground">— retune anytime, no redeploy</span></div>
      <div className="grid gap-2 sm:grid-cols-2">
        {config.map((c) => <ConfigRow key={c.id} cfg={c} />)}
      </div>
    </div>
  );
}

function ConfigRow({ cfg }: { cfg: Cfg }) {
  const router = useRouter();
  const [points, setPoints] = React.useState(cfg.points.toString());
  const [busy, setBusy] = React.useState(false);
  const dirty = points !== cfg.points.toString();
  async function save() {
    setBusy(true); await updateVelosPoints(cfg.eventType, parseInt(points, 10) || 0); setBusy(false); router.refresh();
  }
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-medium">{cfg.label}</div>
        <div className="text-[10.5px] text-muted-foreground">{cfg.category}{cfg.isEffort ? " · effort" : ""}{cfg.clawbackEligible ? " · clawback" : ""}</div>
      </div>
      <Input value={points} onChange={(e) => setPoints(e.target.value)} className="h-7 w-16 text-center" />
      {dirty && <Button size="sm" className="h-7" disabled={busy} onClick={save}>{busy ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}</Button>}
    </div>
  );
}
