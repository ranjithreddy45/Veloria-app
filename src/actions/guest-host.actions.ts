"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { getVerifiedContactIds } from "@/lib/portal-identity";
import { notify } from "@/lib/notify";
import { generateUniqueCode, buildReferralLink } from "@/lib/referral-code";
import { buildDefaultRunOfShow } from "@/lib/ops/beo-content";
import { submitReview } from "@/actions/review.actions";

// ============================================================
// Guest app — SIGNED-IN reads and writes for a host's own event.
//
// Identity resolves through the portal's verified-contact choke-point, so a
// stranger who mints an account with a customer's email sees nothing. Every
// query is scoped to those contact ids; there is no "all bookings" path here.
//
// Writes never touch operations directly. A host's request (a package, a
// redemption, a message) becomes a Task in the booking owner's real work
// queue plus a notification — so it lands where the team already looks,
// and the host can see it was received.
// ============================================================

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function me(): Promise<{ id: string; name: string | null } | null> {
  const s = await auth();
  return s?.user?.id ? { id: s.user.id, name: s.user.name ?? null } : null;
}

const BOOKING_SELECT = {
  id: true, bookingNumber: true, eventName: true, eventType: true, date: true, timeSlot: true,
  status: true, guestCount: true, venueId: true, createdById: true,
  venue: { select: { name: true } },
} as const;

export interface GuestBooking {
  id: string; bookingNumber: string; eventName: string; eventType: string;
  date: string; timeSlot: string; status: string; guestCount: number;
  venueId: string; venueName: string;
}
function shapeBooking(b: { id: string; bookingNumber: string; eventName: string; eventType: string; date: Date; timeSlot: string; status: string; guestCount: number; venueId: string; venue: { name: string } }): GuestBooking {
  return { id: b.id, bookingNumber: b.bookingNumber, eventName: b.eventName, eventType: b.eventType, date: b.date.toISOString(), timeSlot: b.timeSlot, status: b.status, guestCount: b.guestCount, venueId: b.venueId, venueName: b.venue.name };
}

/** The host's bookings (not cancelled), soonest upcoming first, then past. */
async function myBookings(uid: string) {
  const contactIds = await getVerifiedContactIds(uid);
  if (contactIds.length === 0) return [];
  const rows = await prisma.booking.findMany({
    where: { contactId: { in: contactIds }, status: { not: "CANCELLED" } },
    select: BOOKING_SELECT,
    orderBy: { date: "asc" },
  });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = rows.filter((r) => r.date >= today);
  const past = rows.filter((r) => r.date < today).reverse();
  return [...upcoming, ...past];
}

async function pickBooking(uid: string, bookingId?: string) {
  const all = await myBookings(uid);
  const b = bookingId ? all.find((x) => x.id === bookingId) : all[0];
  return { all, b: b ?? null };
}

async function readiness(bookingId: string): Promise<{ pct: number | null; open: number; done: number; total: number }> {
  const plan = await prisma.executionPlan.findUnique({
    where: { bookingId },
    select: { phases: { select: { tasks: { select: { status: true } } } } },
  });
  let total = 0, done = 0;
  if (plan) {
    for (const ph of plan.phases) for (const t of ph.tasks) { total++; if (t.status === "COMPLETED") done++; }
  } else {
    const tasks = await prisma.task.findMany({ where: { bookingId }, select: { status: true } });
    total = tasks.length; done = tasks.filter((t) => t.status === "DONE").length;
  }
  return { pct: total > 0 ? Math.round((done / total) * 100) : null, open: total - done, done, total };
}

async function guestStats(bookingId: string) {
  const guests = await prisma.guest.findMany({ where: { guestList: { bookingId } }, select: { rsvpStatus: true, plusOnes: true } });
  const heads = (g: { plusOnes: number }) => 1 + (g.plusOnes ?? 0);
  return {
    confirmed: guests.filter((g) => g.rsvpStatus === "ACCEPTED").reduce((a, g) => a + heads(g), 0),
    declined: guests.filter((g) => g.rsvpStatus === "DECLINED").reduce((a, g) => a + heads(g), 0),
    pending: guests.filter((g) => g.rsvpStatus === "PENDING").reduce((a, g) => a + heads(g), 0),
    total: guests.reduce((a, g) => a + heads(g), 0),
    families: guests.length,
  };
}

async function money(contactIds: string[]) {
  const inv = await prisma.invoice.findMany({
    where: { contactId: { in: contactIds }, status: { notIn: ["CANCELLED", "DRAFT"] } },
    select: { totalAmount: true, paidAmount: true, balanceDue: true },
  });
  const total = inv.reduce((a, i) => a + Number(i.totalAmount), 0);
  const paid = inv.reduce((a, i) => a + Number(i.paidAmount), 0);
  const balance = inv.reduce((a, i) => a + Number(i.balanceDue), 0);
  return { total, paid, balance };
}

// ------------------------------------------------------------ overview (Home)
export interface GuestOverview {
  user: { id: string; name: string | null };
  verified: boolean;
  unread: number;
  booking: GuestBooking | null;
  readiness: number | null;
  openTasks: number;
  guests: { confirmed: number; total: number };
  balanceDue: number;
  nextTask: { title: string; dueDate: string | null } | null;
  loyalty: { points: number; tier: string } | null;
}
export async function getGuestOverview(): Promise<GuestOverview | null> {
  const u = await me(); if (!u) return null;
  const contactIds = await getVerifiedContactIds(u.id);
  const unread = await prisma.notification.count({ where: { userId: u.id, isRead: false } });
  if (contactIds.length === 0) {
    return { user: u, verified: false, unread, booking: null, readiness: null, openTasks: 0, guests: { confirmed: 0, total: 0 }, balanceDue: 0, nextTask: null, loyalty: null };
  }
  const { b } = await pickBooking(u.id);
  const [r, g, m, loyalty, nextTask] = await Promise.all([
    b ? readiness(b.id) : Promise.resolve({ pct: null, open: 0, done: 0, total: 0 }),
    b ? guestStats(b.id) : Promise.resolve({ confirmed: 0, total: 0, declined: 0, pending: 0, families: 0 }),
    money(contactIds),
    prisma.loyaltyAccount.findFirst({ where: { contactId: { in: contactIds } }, select: { points: true, tier: true } }),
    b ? prisma.task.findFirst({ where: { bookingId: b.id, status: { not: "DONE" }, dueDate: { not: null } }, orderBy: { dueDate: "asc" }, select: { title: true, dueDate: true } }) : Promise.resolve(null),
  ]);
  return {
    user: u, verified: true, unread, booking: b ? shapeBooking(b) : null,
    readiness: r.pct, openTasks: r.open, guests: { confirmed: g.confirmed, total: g.total }, balanceDue: m.balance,
    nextTask: nextTask ? { title: nextTask.title, dueDate: nextTask.dueDate?.toISOString() ?? null } : null,
    loyalty: loyalty ? { points: loyalty.points, tier: String(loyalty.tier) } : null,
  };
}

// ------------------------------------------------------------ my event hub
export interface GuestEvent {
  booking: GuestBooking;
  bookings: { id: string; eventName: string; date: string }[];
  readiness: number | null;
  openTasks: number;
  docsToSign: number;
  guests: { confirmed: number; total: number };
  balanceDue: number;
  requests: number;
  team: { initials: string; name: string; role: string }[];
  runOfShow: { time: string; activity: string; status: "DONE" | "IN_PROGRESS" | "PENDING" | "SKIPPED" | "PLANNED" }[];
}
export async function getGuestEvent(bookingId?: string): Promise<GuestEvent | null> {
  const u = await me(); if (!u) return null;
  const { all, b } = await pickBooking(u.id, bookingId);
  if (!b) return null;
  const contactIds = await getVerifiedContactIds(u.id);
  const [r, g, m, docsToSign, requests, op, timeline] = await Promise.all([
    readiness(b.id), guestStats(b.id), money(contactIds),
    prisma.signatureRequest.count({ where: { bookingId: b.id, status: { in: ["SENT", "VIEWED"] } } }),
    prisma.task.count({ where: { bookingId: b.id, taskType: "CLIENT_REQUEST", status: { not: "DONE" } } }),
    prisma.eventOperation.findUnique({
      where: { bookingId: b.id },
      select: { runOfShow: true, staffAssignments: { select: { role: true, user: { select: { name: true } } }, take: 4 } },
    }),
    prisma.eventTimeline.findUnique({ where: { bookingId: b.id }, select: { items: { orderBy: { order: "asc" }, select: { time: true, activity: true, status: true } } } }),
  ]);
  const owner = await prisma.user.findUnique({ where: { id: b.createdById }, select: { name: true } });
  const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "V";
  const team: GuestEvent["team"] = [];
  if (owner?.name) team.push({ initials: initials(owner.name), name: owner.name, role: "Your coordinator" });
  for (const s of op?.staffAssignments ?? []) if (s.user.name && !team.some((t) => t.name === s.user.name)) team.push({ initials: initials(s.user.name), name: s.user.name, role: s.role });

  let runOfShow: GuestEvent["runOfShow"] = [];
  if (timeline && timeline.items.length > 0) {
    runOfShow = timeline.items.map((i) => ({ time: i.time, activity: i.activity, status: i.status as GuestEvent["runOfShow"][number]["status"] }));
  } else if (op?.runOfShow && op.runOfShow.length > 0) {
    runOfShow = (op.runOfShow as { time?: string; activity?: string; title?: string }[]).map((r) => ({ time: r.time ?? "", activity: r.activity ?? r.title ?? "", status: "PLANNED" as const })).filter((r) => r.activity);
  } else {
    runOfShow = buildDefaultRunOfShow(b.timeSlot).map((r) => ({ time: r.time, activity: r.activity, status: "PLANNED" as const }));
  }

  return {
    booking: shapeBooking(b),
    bookings: all.map((x) => ({ id: x.id, eventName: x.eventName, date: x.date.toISOString() })),
    readiness: r.pct, openTasks: r.open, docsToSign, guests: { confirmed: g.confirmed, total: g.total },
    balanceDue: m.balance, requests, team: team.slice(0, 3), runOfShow,
  };
}

// ------------------------------------------------------------ checklist (read-only view of the team's plan)
export interface GuestChecklist {
  done: number; total: number; pct: number | null;
  groups: { title: string; due: string | null; items: { id: string; label: string; owner: string; done: boolean }[] }[];
}
export async function getGuestChecklist(bookingId: string): Promise<GuestChecklist | null> {
  const u = await me(); if (!u) return null;
  const { b } = await pickBooking(u.id, bookingId); if (!b) return null;
  const plan = await prisma.executionPlan.findUnique({
    where: { bookingId: b.id },
    select: { phases: { orderBy: { order: "asc" }, select: { name: true, plannedEnd: true, tasks: { orderBy: { order: "asc" }, select: { id: true, title: true, status: true, assignee: { select: { name: true } }, vendor: { select: { name: true } } } } } } },
  });
  let groups: GuestChecklist["groups"] = [];
  if (plan && plan.phases.length > 0) {
    groups = plan.phases.filter((p) => p.tasks.length > 0).map((p) => ({
      title: p.name, due: p.plannedEnd?.toISOString() ?? null,
      items: p.tasks.map((t) => ({ id: t.id, label: t.title, owner: t.vendor?.name ?? t.assignee?.name ?? "Veloria team", done: t.status === "COMPLETED" })),
    }));
  } else {
    const tasks = await prisma.task.findMany({ where: { bookingId: b.id }, orderBy: [{ dueDate: "asc" }, { order: "asc" }], select: { id: true, title: true, status: true, dueDate: true, assignee: { select: { name: true } } } });
    const byMonth = new Map<string, typeof tasks>();
    for (const t of tasks) { const k = t.dueDate ? t.dueDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "No date yet"; byMonth.set(k, [...(byMonth.get(k) ?? []), t]); }
    groups = [...byMonth.entries()].map(([title, items]) => ({ title, due: null, items: items.map((t) => ({ id: t.id, label: t.title, owner: t.assignee?.name ?? "Veloria team", done: t.status === "DONE" })) }));
  }
  const r = await readiness(b.id);
  return { done: r.done, total: r.total, pct: r.pct, groups };
}

// ------------------------------------------------------------ guest list
export interface GuestListRow { id: string; name: string; category: string; plusOnes: number; rsvpStatus: "PENDING" | "ACCEPTED" | "DECLINED"; dietary: string | null; invited: boolean }
export async function getGuestGuestList(bookingId: string): Promise<{ stats: Awaited<ReturnType<typeof guestStats>>; guests: GuestListRow[] } | null> {
  const u = await me(); if (!u) return null;
  const { b } = await pickBooking(u.id, bookingId); if (!b) return null;
  const rows = await prisma.guest.findMany({
    where: { guestList: { bookingId: b.id } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, category: true, plusOnes: true, rsvpStatus: true, dietaryRestrictions: true, invitation: { select: { sentAt: true } } },
  });
  return {
    stats: await guestStats(b.id),
    guests: rows.map((g) => ({ id: g.id, name: g.name, category: String(g.category), plusOnes: g.plusOnes, rsvpStatus: g.rsvpStatus as GuestListRow["rsvpStatus"], dietary: g.dietaryRestrictions, invited: !!g.invitation?.sentAt })),
  };
}

export async function addGuestQuick(bookingId: string, name: string, plusOnes = 0): Promise<Result<{ id: string }>> {
  const u = await me(); if (!u) return { success: false, error: "Please sign in." };
  const { b } = await pickBooking(u.id, bookingId); if (!b) return { success: false, error: "Not authorized." };
  const clean = name.trim().slice(0, 120); if (clean.length < 2) return { success: false, error: "Enter a name." };
  const list = await prisma.guestList.upsert({ where: { bookingId: b.id }, update: {}, create: { bookingId: b.id }, select: { id: true } });
  const g = await prisma.guest.create({ data: { guestListId: list.id, name: clean, category: "OTHER", plusOnes: Math.max(0, Math.min(20, plusOnes)) }, select: { id: true } });
  return { success: true, data: { id: g.id } };
}

// ------------------------------------------------------------ documents
export interface GuestDocuments {
  toSign: { token: string; title: string; sentAt: string | null }[];
  contracts: { id: string; title: string; status: string; signedAt: string | null }[];
  invoices: { id: string; number: string; status: string; total: number; balance: number; issued: string }[];
}
export async function getGuestDocuments(): Promise<GuestDocuments | null> {
  const u = await me(); if (!u) return null;
  const contactIds = await getVerifiedContactIds(u.id); if (contactIds.length === 0) return null;
  const [sigs, contracts, invoices] = await Promise.all([
    prisma.signatureRequest.findMany({ where: { booking: { contactId: { in: contactIds } }, status: { in: ["SENT", "VIEWED"] } }, select: { token: true, documentTitle: true, sentAt: true }, orderBy: { createdAt: "desc" } }),
    prisma.contract.findMany({ where: { contactId: { in: contactIds } }, select: { id: true, title: true, status: true, signedAt: true }, orderBy: { createdAt: "desc" } }),
    prisma.invoice.findMany({ where: { contactId: { in: contactIds }, status: { not: "DRAFT" } }, select: { id: true, invoiceNumber: true, status: true, totalAmount: true, balanceDue: true, issueDate: true }, orderBy: { issueDate: "desc" } }),
  ]);
  return {
    toSign: sigs.map((s) => ({ token: s.token, title: s.documentTitle, sentAt: s.sentAt?.toISOString() ?? null })),
    contracts: contracts.map((c) => ({ id: c.id, title: c.title, status: String(c.status), signedAt: c.signedAt?.toISOString() ?? null })),
    invoices: invoices.map((i) => ({ id: i.id, number: i.invoiceNumber, status: String(i.status), total: Number(i.totalAmount), balance: Number(i.balanceDue), issued: i.issueDate.toISOString() })),
  };
}

// ------------------------------------------------------------ event-day live
export interface GuestLive {
  booking: GuestBooking; isEventDay: boolean; daysToGo: number;
  arrived: number; invited: number; staffOnDuty: number; vendorsConfirmed: number; vendorsTotal: number;
  stations: { name: string; note: string | null; status: string }[];
}
export async function getGuestLive(bookingId: string): Promise<GuestLive | null> {
  const u = await me(); if (!u) return null;
  const { b } = await pickBooking(u.id, bookingId); if (!b) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(b.date); d.setHours(0, 0, 0, 0);
  const [guests, op, vendors, timeline] = await Promise.all([
    prisma.guest.findMany({ where: { guestList: { bookingId: b.id } }, select: { isCheckedIn: true, plusOnes: true, rsvpStatus: true } }),
    prisma.eventOperation.findUnique({ where: { bookingId: b.id }, select: { staffAssignments: { select: { id: true } } } }),
    prisma.bookingVendor.groupBy({ by: ["status"], where: { bookingId: b.id }, _count: true }),
    prisma.eventTimeline.findUnique({ where: { bookingId: b.id }, select: { items: { orderBy: { order: "asc" }, select: { time: true, activity: true, status: true, notes: true } } } }),
  ]);
  return {
    booking: shapeBooking(b), isEventDay: d.getTime() === today.getTime(), daysToGo: Math.round((d.getTime() - today.getTime()) / 86400000),
    arrived: guests.filter((g) => g.isCheckedIn).reduce((a, g) => a + 1 + (g.plusOnes ?? 0), 0),
    invited: guests.filter((g) => g.rsvpStatus === "ACCEPTED").reduce((a, g) => a + 1 + (g.plusOnes ?? 0), 0),
    staffOnDuty: op?.staffAssignments.length ?? 0,
    vendorsConfirmed: vendors.find((v) => v.status === "CONFIRMED")?._count ?? 0,
    vendorsTotal: vendors.reduce((a, v) => a + v._count, 0),
    stations: (timeline?.items ?? []).map((i) => ({ name: i.activity, note: i.notes ? i.notes : i.time, status: String(i.status) })),
  };
}

// ------------------------------------------------------------ packages & partners
export interface GuestPackage { id: string; name: string; category: string; vendorName: string; price: number; priceUnit: string; description: string | null; imageUrl: string | null }
export async function getGuestPackages(venueId?: string): Promise<GuestPackage[]> {
  const u = await me(); if (!u) return [];
  try {
    const rows = await prisma.vendorPackage.findMany({
      where: { status: "ACTIVE", vendor: { status: "ACTIVE" }, ...(venueId ? { OR: [{ allVenues: true }, { venueIds: { has: venueId } }] } : {}) },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      take: 60,
      select: { id: true, name: true, category: true, price: true, customerPrice: true, priceUnit: true, description: true, coverImageId: true, vendor: { select: { name: true } }, images: { orderBy: { sortOrder: "asc" }, take: 3, select: { id: true, url: true } } },
    });
    return rows.map((p) => {
      const cover = p.images.find((i) => i.id === p.coverImageId) ?? p.images[0];
      return { id: p.id, name: p.name, category: p.category, vendorName: p.vendor.name, price: Number(p.customerPrice ?? p.price), priceUnit: String(p.priceUnit), description: p.description, imageUrl: cover && cover.url.length < 400_000 ? cover.url : null };
    });
  } catch { return []; }
}

// ------------------------------------------------------------ requests → the team's queue
export type RequestKind = "MESSAGE" | "PACKAGES" | "REDEEM";
export async function requestFromConcierge(bookingId: string, text: string, kind: RequestKind = "MESSAGE"): Promise<Result<{ id: string }>> {
  const u = await me(); if (!u) return { success: false, error: "Please sign in." };
  const { b } = await pickBooking(u.id, bookingId); if (!b) return { success: false, error: "Not authorized." };
  const clean = text.trim().slice(0, 1000); if (!clean) return { success: false, error: "Type a message first." };
  const prefix = kind === "PACKAGES" ? "Packages requested" : kind === "REDEEM" ? "Reward redemption" : "Message from host";
  const t = await prisma.task.create({
    data: {
      title: `${prefix} · ${b.eventName}`.slice(0, 200), description: clean, status: "TODO", priority: "MEDIUM",
      taskType: "CLIENT_REQUEST", bookingId: b.id, creatorId: u.id, assigneeId: b.createdById,
      metadata: { kind, fromUserId: u.id, via: "guest-app" },
    },
    select: { id: true },
  });
  notify({ userId: b.createdById, type: "TASK_ASSIGNED", title: `${prefix} — ${b.eventName}`, message: clean.slice(0, 180), actionUrl: `/bookings/${b.id}` });
  return { success: true, data: { id: t.id } };
}

export interface GuestRequest { id: string; text: string; kind: string; createdAt: string; status: string }
export async function getGuestRequests(bookingId: string): Promise<GuestRequest[]> {
  const u = await me(); if (!u) return [];
  const { b } = await pickBooking(u.id, bookingId); if (!b) return [];
  const rows = await prisma.task.findMany({ where: { bookingId: b.id, taskType: "CLIENT_REQUEST" }, orderBy: { createdAt: "asc" }, take: 50, select: { id: true, description: true, status: true, createdAt: true, metadata: true } });
  return rows.map((r) => ({ id: r.id, text: r.description ?? "", kind: String((r.metadata as { kind?: string } | null)?.kind ?? "MESSAGE"), createdAt: r.createdAt.toISOString(), status: String(r.status) }));
}

// ------------------------------------------------------------ rewards & referrals
export interface GuestReferral { id: string; name: string; status: string; createdAt: string }
export interface GuestRewards { points: number; tier: string; totalEarned: number; activity: { what: string; when: string; pts: number }[]; referrals: GuestReferral[]; bookingId: string | null }
export async function getGuestRewards(): Promise<GuestRewards | null> {
  const u = await me(); if (!u) return null;
  const contactIds = await getVerifiedContactIds(u.id); if (contactIds.length === 0) return null;
  const [acct, referrals, { b }] = await Promise.all([
    prisma.loyaltyAccount.findFirst({ where: { contactId: { in: contactIds } }, select: { points: true, tier: true, totalEarned: true, transactions: { orderBy: { createdAt: "desc" }, take: 10, select: { description: true, points: true, createdAt: true } } } }),
    prisma.referral.findMany({ where: { referrerContactId: { in: contactIds } }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, referredName: true, status: true, createdAt: true } }),
    pickBooking(u.id),
  ]);
  return {
    points: acct?.points ?? 0, tier: acct ? String(acct.tier) : "Member", totalEarned: acct?.totalEarned ?? 0,
    activity: (acct?.transactions ?? []).map((t) => ({ what: t.description, when: t.createdAt.toISOString(), pts: t.points })),
    referrals: referrals.map((r) => ({ id: r.id, name: r.referredName, status: String(r.status), createdAt: r.createdAt.toISOString() })),
    bookingId: b?.id ?? null,
  };
}

/**
 * A host introduces a friend. This creates a real Referral (source GUEST) in
 * the referral engine — the same object staff create — so conversion and
 * rewards are tracked by the existing rules. No share link is offered: the
 * public /refer/<code> page resolves partner codes, not these.
 */
export async function submitGuestReferral(name: string, phone: string, email?: string): Promise<Result<{ id: string }>> {
  const u = await me(); if (!u) return { success: false, error: "Please sign in." };
  const contactIds = await getVerifiedContactIds(u.id); if (contactIds.length === 0) return { success: false, error: "Your account isn't linked to a booking yet." };
  const referredName = name.trim().slice(0, 120); const referredPhone = phone.trim().slice(0, 30);
  if (referredName.length < 2) return { success: false, error: "Enter your friend's name." };
  if (referredPhone.replace(/\D/g, "").length < 7) return { success: false, error: "Enter a valid phone number." };
  const dup = await prisma.referral.findFirst({ where: { referrerContactId: { in: contactIds }, referredPhone }, select: { id: true } });
  if (dup) return { success: false, error: "You have already introduced this number." };
  const referralCode = await generateUniqueCode();
  const r = await prisma.referral.create({
    data: { referrerContactId: contactIds[0], referrerUserId: u.id, referredName, referredPhone, referredEmail: email?.trim() || null, source: "GUEST", status: "PENDING", referralCode, referralLink: buildReferralLink(referralCode) },
    select: { id: true },
  });
  const { b } = await pickBooking(u.id);
  if (b) notify({ userId: b.createdById, type: "LEAD_ASSIGNED", title: `Referral from ${u.name ?? "a host"}: ${referredName}`, message: `${referredPhone}${email ? ` · ${email.trim()}` : ""} — introduced via the guest app.`, actionUrl: "/referrals" });
  return { success: true, data: { id: r.id } };
}

// ------------------------------------------------------------ payments
export interface GuestPayments {
  total: number; paid: number; balance: number;
  invoices: { id: string; number: string; status: string; eventName: string | null; total: number; paid: number; balance: number; dueDate: string }[];
  installments: { id: string; label: string; amount: number; dueDate: string; status: string; invoiceId: string; payable: boolean }[];
}
export async function getGuestPayments(): Promise<GuestPayments | null> {
  const u = await me(); if (!u) return null;
  const contactIds = await getVerifiedContactIds(u.id); if (contactIds.length === 0) return null;
  const invoices = await prisma.invoice.findMany({
    where: { contactId: { in: contactIds }, status: { notIn: ["DRAFT", "CANCELLED"] } },
    orderBy: { issueDate: "desc" },
    select: { id: true, invoiceNumber: true, status: true, totalAmount: true, paidAmount: true, balanceDue: true, dueDate: true, booking: { select: { eventName: true } } },
  });
  const inst = await prisma.installment.findMany({
    where: { invoice: { contactId: { in: contactIds }, status: { notIn: ["DRAFT", "CANCELLED"] } } },
    orderBy: [{ dueDate: "asc" }, { order: "asc" }],
    select: { id: true, label: true, amount: true, dueDate: true, status: true, invoiceId: true },
  });
  const m = await money(contactIds);
  let firstUnpaidSeen = false;
  return {
    ...m,
    invoices: invoices.map((i) => ({ id: i.id, number: i.invoiceNumber, status: String(i.status), eventName: i.booking?.eventName ?? null, total: Number(i.totalAmount), paid: Number(i.paidAmount), balance: Number(i.balanceDue), dueDate: i.dueDate.toISOString() })),
    installments: inst.map((x) => {
      const paid = x.status === "COMPLETED";
      const payable = !paid && !firstUnpaidSeen; if (!paid) firstUnpaidSeen = true;
      return { id: x.id, label: x.label, amount: Number(x.amount), dueDate: x.dueDate.toISOString(), status: String(x.status), invoiceId: x.invoiceId, payable };
    }),
  };
}

// ------------------------------------------------------------ notifications
export interface GuestNotification { id: string; type: string; title: string; message: string; isRead: boolean; actionUrl: string | null; createdAt: string }
export async function getGuestNotifications(): Promise<GuestNotification[]> {
  const u = await me(); if (!u) return [];
  const rows = await prisma.notification.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 40 });
  return rows.map((n) => ({ id: n.id, type: String(n.type), title: n.title, message: n.message, isRead: n.isRead, actionUrl: n.actionUrl, createdAt: n.createdAt.toISOString() }));
}
export async function markGuestNotificationsRead(ids?: string[]): Promise<void> {
  const u = await me(); if (!u) return;
  await prisma.notification.updateMany({ where: { userId: u.id, isRead: false, ...(ids?.length ? { id: { in: ids } } : {}) }, data: { isRead: true } });
}

// ------------------------------------------------------------ rating
export async function submitGuestRating(bookingId: string, rating: number, tags: string[], content: string): Promise<Result<{ id: string }>> {
  const text = [tags.length ? `Highlights: ${tags.join(", ")}.` : "", content.trim()].filter(Boolean).join(" ");
  const res = await submitReview({ bookingId, rating, isPublic: true, title: tags[0] ? `${tags[0]} — ${rating}/5` : undefined, content: text || `${rating} out of 5.` });
  if (!res.success) return { success: false, error: res.error ?? "Couldn't send your rating." };
  const id = (res as { data?: { id?: string } }).data?.id ?? "";
  return { success: true, data: { id } };
}

// ------------------------------------------------------------ account
export interface GuestAccount { name: string | null; email: string | null; phone: string | null; tier: string | null; points: number; bookings: number; verified: boolean }
export async function getGuestAccount(): Promise<GuestAccount | null> {
  const u = await me(); if (!u) return null;
  const contactIds = await getVerifiedContactIds(u.id);
  const [user, contact, acct, bookings] = await Promise.all([
    prisma.user.findUnique({ where: { id: u.id }, select: { name: true, email: true } }),
    contactIds.length ? prisma.contact.findFirst({ where: { id: { in: contactIds } }, select: { phone: true } }) : Promise.resolve(null),
    contactIds.length ? prisma.loyaltyAccount.findFirst({ where: { contactId: { in: contactIds } }, select: { points: true, tier: true } }) : Promise.resolve(null),
    contactIds.length ? prisma.booking.count({ where: { contactId: { in: contactIds }, status: { not: "CANCELLED" } } }) : Promise.resolve(0),
  ]);
  return { name: user?.name ?? u.name, email: user?.email ?? null, phone: contact?.phone ?? null, tier: acct ? String(acct.tier) : null, points: acct?.points ?? 0, bookings, verified: contactIds.length > 0 };
}
