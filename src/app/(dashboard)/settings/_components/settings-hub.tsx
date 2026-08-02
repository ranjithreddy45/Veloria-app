"use client";

// ============================================================
// Settings hub — a Zoho-style categorized, searchable Setup landing. Surfaces
// every configuration area grouped into clear categories, with a live "Search
// settings" filter. Items link to their existing routes (unchanged).
// ============================================================

import * as React from "react";
import Link from "next/link";
import {
  Search, Building2, MapPin, Bell, Users, ShieldCheck, History, Siren,
  Kanban, Target, UserCheck, GitBranch, Percent, Gift, Workflow, CheckSquare, SlidersHorizontal,
  AlertOctagon, Zap, FileText, FileSignature, ClipboardCheck, FileInput,
  Plug, MessageCircle, Phone, Calendar, Share2, Calculator, IndianRupee,
  Trash2, ChevronRight, Route, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Item { label: string; href: string; icon: LucideIcon; desc?: string }
interface Category { title: string; icon: LucideIcon; accent: string; items: Item[] }

const CATEGORIES: Category[] = [
  {
    title: "General", icon: Building2, accent: "text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-300",
    items: [
      { label: "Venues", href: "/settings/venues", icon: MapPin, desc: "Halls, capacities & availability" },
      { label: "Notifications", href: "/settings/notifications", icon: Bell, desc: "Email & SMS preferences" },
    ],
  },
  {
    title: "Security & Access", icon: ShieldCheck, accent: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300",
    items: [
      { label: "Users", href: "/settings/users", icon: Users, desc: "Team members & invites" },
      { label: "Roles & Permissions", href: "/settings/roles", icon: ShieldCheck, desc: "Who can do what" },
      { label: "Activity Log", href: "/settings/activity-log", icon: History, desc: "Full audit trail" },
      { label: "Emergency Response", href: "/settings/emergency", icon: Siren, desc: "Venue safety protocols & incident log" },
    ],
  },
  {
    title: "Sales & Pipeline", icon: Kanban, accent: "text-violet-600 bg-violet-50 dark:bg-violet-950/50 dark:text-violet-300",
    items: [
      { label: "Pipeline Stages", href: "/settings/pipeline", icon: Kanban, desc: "Deal stages & flow" },
      { label: "Scoring Rules", href: "/settings/scoring-rules", icon: Target, desc: "Lead scoring" },
      { label: "Assignment Rules", href: "/settings/assignment-rules", icon: UserCheck, desc: "Auto-route leads" },
      { label: "Smart Routing", href: "/settings/routing", icon: Route, desc: "Route to the available, lightest-loaded, best-matched rep" },
      { label: "Rep Availability", href: "/settings/rep-availability", icon: UserCheck, desc: "Live rep availability & load" },
      { label: "Blueprints", href: "/settings/blueprints", icon: GitBranch, desc: "Stage process guards" },
      { label: "Commissions", href: "/settings/commissions", icon: Percent, desc: "Payout rules" },
      { label: "Referral Rules", href: "/settings/referral-rules", icon: Gift, desc: "Referral rewards" },
      { label: "BD CRM Config", href: "/settings/bd-config", icon: SlidersHorizontal, desc: "Acquisition floors & sign-off thresholds" },
    ],
  },
  {
    title: "Automation", icon: Zap, accent: "text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300",
    items: [
      { label: "Workflows", href: "/settings/workflows", icon: Workflow, desc: "Trigger-based automation" },
      { label: "Approval Rules", href: "/settings/approval-rules", icon: CheckSquare, desc: "Sign-off gates" },
      { label: "Escalation Rules", href: "/settings/escalation-rules", icon: AlertOctagon, desc: "SLA escalations" },
      { label: "Macros", href: "/settings/macros", icon: Zap, desc: "One-click action sets" },
    ],
  },
  {
    title: "Templates", icon: FileText, accent: "text-pink-600 bg-pink-50 dark:bg-pink-950/50 dark:text-pink-300",
    items: [
      { label: "Email Templates", href: "/settings/email-templates", icon: FileText, desc: "Reusable emails" },
      { label: "Contract Templates", href: "/settings/contract-templates", icon: FileSignature, desc: "Agreements" },
      { label: "SOP Templates", href: "/settings/sop-templates", icon: ClipboardCheck, desc: "Ops checklists" },
      { label: "Webforms", href: "/settings/webforms", icon: FileInput, desc: "Lead capture forms" },
    ],
  },
  {
    title: "Channels & Integrations", icon: Plug, accent: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/50 dark:text-cyan-300",
    items: [
      { label: "All Integrations", href: "/settings/integrations", icon: Plug, desc: "Connected services" },
      { label: "WhatsApp", href: "/settings/integrations/whatsapp", icon: MessageCircle },
      { label: "WhatsApp Auto-Catalog", href: "/settings/whatsapp-catalog", icon: MessageCircle, desc: "Catalog funnel auto-replies" },
      { label: "Telephony", href: "/settings/integrations/telephony", icon: Phone },
      { label: "Google Calendar", href: "/settings/integrations/google-calendar", icon: Calendar },
      { label: "Social", href: "/settings/integrations/social", icon: Share2 },
      { label: "Tally", href: "/settings/integrations/tally", icon: Calculator },
      { label: "Currency", href: "/settings/integrations/currency", icon: IndianRupee },
    ],
  },
  {
    title: "Data Administration", icon: Trash2, accent: "text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300",
    items: [
      { label: "Recycle Bin", href: "/settings/trash", icon: Trash2, desc: "Restore deleted records" },
    ],
  },
];

export function SettingsHub() {
  const [q, setQ] = React.useState("");
  const query = q.trim().toLowerCase();

  const categories = React.useMemo(() => {
    if (!query) return CATEGORIES;
    return CATEGORIES
      .map((c) => ({
        ...c,
        items: c.items.filter(
          (it) => it.label.toLowerCase().includes(query) || it.desc?.toLowerCase().includes(query) || c.title.toLowerCase().includes(query),
        ),
      }))
      .filter((c) => c.items.length > 0);
  }, [query]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search settings…"
          className="h-10 w-full rounded-lg border border-border/70 bg-card pl-9 pr-3 text-sm shadow-card focus-ring placeholder:text-muted-foreground"
        />
      </div>

      {categories.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No settings match &ldquo;{q}&rdquo;.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <div key={cat.title} className="rounded-xl border border-border/70 bg-card p-4 shadow-card transition-shadow duration-200 hover:shadow-card-hover">
              <div className="mb-2.5 flex items-center gap-2.5">
                <span className={cn("flex size-8 items-center justify-center rounded-lg", cat.accent)}>
                  <cat.icon className="size-4" />
                </span>
                <h2 className="text-copy font-semibold tracking-normal">{cat.title}</h2>
              </div>
              <ul className="-mx-1.5">
                {cat.items.map((it) => (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className="group flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-premium hover:bg-muted/50"
                    >
                      <it.icon className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.9} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-medium leading-tight">{it.label}</span>
                        {it.desc && <span className="block truncate text-meta text-muted-foreground">{it.desc}</span>}
                      </span>
                      <ChevronRight className="size-3.5 shrink-0 text-transparent transition-colors group-hover:text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
