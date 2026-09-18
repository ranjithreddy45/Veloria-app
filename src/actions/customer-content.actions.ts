"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";
import { diffFields } from "@/app/(dashboard)/settings/business-contact/_lib/contact-rules";
import {
  POLICY_KEYS,
  POLICY_META,
  isPolicyKey,
  nextFaqOrder,
  nextPolicyVersion,
  planFaqMove,
  policyDraftKey,
  policyPath,
  sortByOrder,
  validateFaqInput,
  validatePolicyDraft,
  type FaqField,
  type FaqInput,
  type PolicyDraftField,
  type PolicyKey,
} from "@/app/(dashboard)/settings/customer-content/_lib/content-rules";

// ============================================================
// Settings → Customer content: policies (draft → preview → publish) and FAQs.
// The customer app reads the same rows through src/lib/public/policies.ts.
// Gated exactly like Settings → Venues: settings:venues.
//
// A policy's live text is the row keyed by the policy key; its draft is a
// separate row keyed "DRAFT:<KEY>" that is never published, so customers keep
// reading the live version until the team publishes the draft. Publishing
// bumps the version, stamps publishedAt and writes the full published text to
// ActivityLog, so every version that was ever live can be read back.
// ============================================================

export interface TeamPolicyLive {
  title: string;
  body: string;
  version: number;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
  updatedByName: string | null;
}
export interface TeamPolicyDraft {
  title: string;
  body: string;
  updatedAt: string;
  updatedByName: string | null;
}
export interface TeamPolicy {
  key: PolicyKey;
  label: string;
  teamHint: string;
  path: string;
  live: TeamPolicyLive | null;
  draft: TeamPolicyDraft | null;
  /** The version number publishing the draft will create. */
  nextVersion: number;
}
export interface TeamFaq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  venueId: string | null;
  order: number;
  isPublished: boolean;
  updatedAt: string;
}
export interface TeamHall {
  id: string;
  name: string;
  /** Active and top-level: the halls the customer app lists. */
  visibleToCustomers: boolean;
}
export interface CustomerContentData {
  policies: TeamPolicy[];
  faqs: TeamFaq[];
  halls: TeamHall[];
}

type Result<T> = { success: true; data: T } | { success: false; error: string };
type FormResult<T, F extends string> = { success: true; data: T } | { success: false; error: string; fieldErrors?: Partial<Record<F, string>> };
type Gate = { ok: true; userId: string } | { ok: false; error: string };

async function requireVenueSettings(): Promise<Gate> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
  if (!hasPermission(session.user.role, "settings:venues")) return { ok: false, error: "Insufficient permissions" };
  return { ok: true, userId: session.user.id };
}

function revalidateCustomerContent() {
  revalidatePath("/settings/customer-content");
  revalidatePath("/app", "layout"); // help, policy pages, hall pages and any screen quoting a policy
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** A publish that must not go ahead; the message is shown to the team as-is. */
class PublishRefused extends Error {}

// ------------------------------------------------------------
// Read
// ------------------------------------------------------------

export async function getCustomerContentForTeam(): Promise<Result<CustomerContentData>> {
  const gate = await requireVenueSettings();
  if (!gate.ok) return { success: false, error: gate.error };
  try {
    const keys = [...POLICY_KEYS, ...POLICY_KEYS.map(policyDraftKey)];
    const [docs, faqs, venues] = await Promise.all([
      prisma.policyDocument.findMany({ where: { key: { in: keys } } }),
      prisma.faqItem.findMany(),
      prisma.venue.findMany({ select: { id: true, name: true, isActive: true, parentVenueId: true }, orderBy: { name: "asc" } }),
    ]);
    const editorIds = [...new Set(docs.map((d) => d.updatedById).filter((id): id is string => !!id))];
    const editors = editorIds.length
      ? await prisma.user.findMany({ where: { id: { in: editorIds } }, select: { id: true, name: true, email: true } })
      : [];
    const nameOf = (id: string | null) => {
      const user = id ? editors.find((e) => e.id === id) : undefined;
      return user ? (user.name ?? user.email) : null;
    };

    const policies: TeamPolicy[] = POLICY_KEYS.map((key) => {
      const live = docs.find((d) => d.key === key) ?? null;
      const draft = docs.find((d) => d.key === policyDraftKey(key)) ?? null;
      return {
        key,
        label: POLICY_META[key].label,
        teamHint: POLICY_META[key].teamHint,
        path: policyPath(key),
        live: live
          ? {
              title: live.title,
              body: live.body,
              version: live.version,
              isPublished: live.isPublished,
              publishedAt: live.publishedAt?.toISOString() ?? null,
              updatedAt: live.updatedAt.toISOString(),
              updatedByName: nameOf(live.updatedById),
            }
          : null,
        draft: draft
          ? { title: draft.title, body: draft.body, updatedAt: draft.updatedAt.toISOString(), updatedByName: nameOf(draft.updatedById) }
          : null,
        nextVersion: nextPolicyVersion(live),
      };
    });

    return {
      success: true,
      data: {
        policies,
        faqs: sortByOrder(faqs).map((f) => ({
          id: f.id,
          question: f.question,
          answer: f.answer,
          category: f.category,
          venueId: f.venueId,
          order: f.order,
          isPublished: f.isPublished,
          updatedAt: f.updatedAt.toISOString(),
        })),
        halls: venues.map((v) => ({ id: v.id, name: v.name, visibleToCustomers: v.isActive && v.parentVenueId === null })),
      },
    };
  } catch (error) {
    console.error("[GET_CUSTOMER_CONTENT_ERROR]", error);
    return { success: false, error: "Couldn't load customer content." };
  }
}

// ------------------------------------------------------------
// Policies
// ------------------------------------------------------------

export async function savePolicyDraft(input: {
  key: string;
  title: string;
  body: string;
}): Promise<FormResult<{ updatedAt: string }, PolicyDraftField>> {
  const gate = await requireVenueSettings();
  if (!gate.ok) return { success: false, error: gate.error };
  const key = input?.key;
  if (!isPolicyKey(key)) return { success: false, error: "Unknown policy." };
  const parsed = validatePolicyDraft(input);
  if (!parsed.ok) return { success: false, error: "Please fix the highlighted fields.", fieldErrors: parsed.errors };

  try {
    const live = await prisma.policyDocument.findUnique({ where: { key } });
    const draftKey = policyDraftKey(key);
    const version = nextPolicyVersion(live);
    const row = await prisma.policyDocument.upsert({
      where: { key: draftKey },
      create: { key: draftKey, ...parsed.data, version, isPublished: false, publishedAt: null, updatedById: gate.userId },
      update: { ...parsed.data, version, isPublished: false, publishedAt: null, updatedById: gate.userId },
    });
    await logActivity({
      userId: gate.userId,
      action: "draft_saved",
      entityType: "PolicyDocument",
      entityId: row.id,
      changes: { key, title: parsed.data.title, characters: parsed.data.body.length, forVersion: version },
    });
    revalidatePath("/settings/customer-content");
    return { success: true, data: { updatedAt: row.updatedAt.toISOString() } };
  } catch (error) {
    if (isUniqueViolation(error)) return { success: false, error: "Someone saved this draft at the same moment. Reload and try again." };
    console.error("[SAVE_POLICY_DRAFT_ERROR]", error);
    return { success: false, error: "Couldn't save the draft." };
  }
}

export async function discardPolicyDraft(rawKey: string): Promise<Result<null>> {
  const gate = await requireVenueSettings();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!isPolicyKey(rawKey)) return { success: false, error: "Unknown policy." };
  try {
    const draftKey = policyDraftKey(rawKey);
    const draft = await prisma.policyDocument.findUnique({ where: { key: draftKey }, select: { id: true, title: true } });
    if (!draft) return { success: true, data: null };
    await prisma.policyDocument.deleteMany({ where: { key: draftKey } });
    await logActivity({ userId: gate.userId, action: "draft_discarded", entityType: "PolicyDocument", entityId: draft.id, changes: { key: rawKey, title: draft.title } });
    revalidatePath("/settings/customer-content");
    return { success: true, data: null };
  } catch (error) {
    console.error("[DISCARD_POLICY_DRAFT_ERROR]", error);
    return { success: false, error: "Couldn't discard the draft." };
  }
}

/**
 * Publish the draft the team previewed. `draftUpdatedAt` is the draft's
 * updatedAt as shown in the preview: if anyone saved the draft since, the
 * publish is refused so nobody publishes text they haven't seen.
 */
export async function publishPolicyDraft(input: {
  key: string;
  draftUpdatedAt: string;
}): Promise<Result<{ version: number; publishedAt: string }>> {
  const gate = await requireVenueSettings();
  if (!gate.ok) return { success: false, error: gate.error };
  const key = input?.key;
  if (!isPolicyKey(key)) return { success: false, error: "Unknown policy." };
  if (typeof input.draftUpdatedAt !== "string" || !input.draftUpdatedAt) {
    return { success: false, error: "Preview the draft before publishing." };
  }
  const draftKey = policyDraftKey(key);

  try {
    const { saved, previousVersion } = await prisma.$transaction(async (tx) => {
      const draft = await tx.policyDocument.findUnique({ where: { key: draftKey } });
      if (!draft) throw new PublishRefused("There is no draft to publish. It may have just been published or discarded.");
      if (draft.updatedAt.toISOString() !== input.draftUpdatedAt) {
        throw new PublishRefused("The draft changed after you previewed it. Preview it again before publishing.");
      }
      const parsed = validatePolicyDraft(draft);
      if (!parsed.ok) throw new PublishRefused("The draft is incomplete. Add a title and the policy text first.");

      // Claim the draft: of two simultaneous publishes, only one can delete it.
      const claimed = await tx.policyDocument.deleteMany({ where: { id: draft.id, updatedAt: draft.updatedAt } });
      if (claimed.count !== 1) throw new PublishRefused("Someone else just published or changed this draft. Reload to see the latest.");

      const live = await tx.policyDocument.findUnique({ where: { key } });
      const data = {
        title: parsed.data.title,
        body: parsed.data.body,
        version: nextPolicyVersion(live),
        isPublished: true,
        publishedAt: new Date(),
        updatedById: gate.userId,
      };
      const row = live
        ? await tx.policyDocument.update({ where: { id: live.id }, data })
        : await tx.policyDocument.create({ data: { key, ...data } });
      return { saved: row, previousVersion: live && (live.isPublished || live.publishedAt) ? live.version : null };
    });

    const publishedAt = (saved.publishedAt ?? new Date()).toISOString();
    await logActivity({
      userId: gate.userId,
      action: "published",
      entityType: "PolicyDocument",
      entityId: saved.id,
      changes: { key, version: saved.version, previousVersion, publishedAt, title: saved.title, body: saved.body },
    });
    revalidateCustomerContent();
    return { success: true, data: { version: saved.version, publishedAt } };
  } catch (error) {
    if (error instanceof PublishRefused) return { success: false, error: error.message };
    console.error("[PUBLISH_POLICY_ERROR]", error);
    return { success: false, error: "Couldn't publish the policy." };
  }
}

/** Take the live version offline; customers then see the honest "not published yet" screen. */
export async function unpublishPolicy(rawKey: string): Promise<Result<null>> {
  const gate = await requireVenueSettings();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!isPolicyKey(rawKey)) return { success: false, error: "Unknown policy." };
  try {
    const live = await prisma.policyDocument.findUnique({ where: { key: rawKey } });
    if (!live || !live.isPublished) return { success: false, error: "This policy isn't published." };
    await prisma.policyDocument.update({ where: { id: live.id }, data: { isPublished: false, updatedById: gate.userId } });
    await logActivity({ userId: gate.userId, action: "unpublished", entityType: "PolicyDocument", entityId: live.id, changes: { key: rawKey, version: live.version } });
    revalidateCustomerContent();
    return { success: true, data: null };
  } catch (error) {
    console.error("[UNPUBLISH_POLICY_ERROR]", error);
    return { success: false, error: "Couldn't unpublish the policy." };
  }
}

// ------------------------------------------------------------
// FAQs
// ------------------------------------------------------------

async function hallError(venueId: string | null): Promise<string | null> {
  if (!venueId) return null;
  const hall = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true } });
  return hall ? null : "That hall no longer exists. Pick another hall or All halls.";
}

export async function createFaq(input: FaqInput & { isPublished?: boolean }): Promise<FormResult<{ id: string }, FaqField>> {
  const gate = await requireVenueSettings();
  if (!gate.ok) return { success: false, error: gate.error };
  const parsed = validateFaqInput(input);
  if (!parsed.ok) return { success: false, error: "Please fix the highlighted fields.", fieldErrors: parsed.errors };
  try {
    const badHall = await hallError(parsed.data.venueId);
    if (badHall) return { success: false, error: badHall, fieldErrors: { venueId: badHall } };
    const orders = await prisma.faqItem.findMany({ select: { order: true } });
    const row = await prisma.faqItem.create({
      data: { ...parsed.data, order: nextFaqOrder(orders), isPublished: input?.isPublished === true },
    });
    await logActivity({ userId: gate.userId, action: "created", entityType: "FaqItem", entityId: row.id, changes: { ...parsed.data, isPublished: row.isPublished } });
    revalidateCustomerContent();
    return { success: true, data: { id: row.id } };
  } catch (error) {
    console.error("[CREATE_FAQ_ERROR]", error);
    return { success: false, error: "Couldn't add the FAQ." };
  }
}

export async function updateFaq(id: string, input: FaqInput): Promise<FormResult<{ changed: boolean }, FaqField>> {
  const gate = await requireVenueSettings();
  if (!gate.ok) return { success: false, error: gate.error };
  const parsed = validateFaqInput(input);
  if (!parsed.ok) return { success: false, error: "Please fix the highlighted fields.", fieldErrors: parsed.errors };
  try {
    const existing = await prisma.faqItem.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "This FAQ no longer exists." };
    const changes = diffFields(
      { question: existing.question, answer: existing.answer, category: existing.category, venueId: existing.venueId },
      { question: parsed.data.question, answer: parsed.data.answer, category: parsed.data.category, venueId: parsed.data.venueId }
    );
    if (Object.keys(changes).length === 0) return { success: true, data: { changed: false } };
    if (changes.venueId) {
      const badHall = await hallError(parsed.data.venueId);
      if (badHall) return { success: false, error: badHall, fieldErrors: { venueId: badHall } };
    }
    await prisma.faqItem.update({ where: { id }, data: parsed.data });
    await logActivity({ userId: gate.userId, action: "updated", entityType: "FaqItem", entityId: id, changes });
    revalidateCustomerContent();
    return { success: true, data: { changed: true } };
  } catch (error) {
    console.error("[UPDATE_FAQ_ERROR]", error);
    return { success: false, error: "Couldn't save the FAQ." };
  }
}

export async function setFaqPublished(id: string, isPublished: boolean): Promise<Result<null>> {
  const gate = await requireVenueSettings();
  if (!gate.ok) return { success: false, error: gate.error };
  if (typeof isPublished !== "boolean") return { success: false, error: "Invalid request." };
  try {
    const existing = await prisma.faqItem.findUnique({ where: { id }, select: { id: true, isPublished: true, question: true } });
    if (!existing) return { success: false, error: "This FAQ no longer exists." };
    if (existing.isPublished === isPublished) return { success: true, data: null };
    await prisma.faqItem.update({ where: { id }, data: { isPublished } });
    await logActivity({
      userId: gate.userId,
      action: isPublished ? "published" : "unpublished",
      entityType: "FaqItem",
      entityId: id,
      changes: { question: existing.question },
    });
    revalidateCustomerContent();
    return { success: true, data: null };
  } catch (error) {
    console.error("[SET_FAQ_PUBLISHED_ERROR]", error);
    return { success: false, error: "Couldn't change the FAQ." };
  }
}

/** Move one FAQ a step, computed from the database (not a possibly stale screen). */
export async function moveFaq(id: string, direction: "up" | "down"): Promise<Result<{ moved: boolean }>> {
  const gate = await requireVenueSettings();
  if (!gate.ok) return { success: false, error: gate.error };
  if (direction !== "up" && direction !== "down") return { success: false, error: "Invalid request." };
  try {
    const plan = await prisma.$transaction(async (tx) => {
      const all = await tx.faqItem.findMany({ select: { id: true, order: true, createdAt: true } });
      const writes = planFaqMove(all, id, direction);
      for (const w of writes) await tx.faqItem.update({ where: { id: w.id }, data: { order: w.order } });
      return writes;
    });
    if (plan.length === 0) return { success: true, data: { moved: false } };
    await logActivity({ userId: gate.userId, action: "reordered", entityType: "FaqItem", entityId: id, changes: { direction, orders: plan } });
    revalidateCustomerContent();
    return { success: true, data: { moved: true } };
  } catch (error) {
    console.error("[MOVE_FAQ_ERROR]", error);
    return { success: false, error: "Couldn't reorder the FAQs." };
  }
}

export async function deleteFaq(id: string): Promise<Result<null>> {
  const gate = await requireVenueSettings();
  if (!gate.ok) return { success: false, error: gate.error };
  try {
    const existing = await prisma.faqItem.findUnique({ where: { id } });
    if (!existing) return { success: true, data: null };
    await prisma.faqItem.deleteMany({ where: { id } });
    await logActivity({
      userId: gate.userId,
      action: "deleted",
      entityType: "FaqItem",
      entityId: id,
      changes: { question: existing.question, answer: existing.answer, category: existing.category, venueId: existing.venueId, wasPublished: existing.isPublished },
    });
    revalidateCustomerContent();
    return { success: true, data: null };
  } catch (error) {
    console.error("[DELETE_FAQ_ERROR]", error);
    return { success: false, error: "Couldn't delete the FAQ." };
  }
}
