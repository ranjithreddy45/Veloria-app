"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { webformSchema, type WebformInput } from "@/schemas/webform.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import type { Prisma } from "@prisma/client";

// ============================================================
// Helper: Generate slug from name
// ============================================================

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ============================================================
// Get Webforms (Paginated + Filters)
// ============================================================

export async function getWebforms(params?: {
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const skip = (page - 1) * limit;
    const search = params?.search?.trim();

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    const [webforms, total] = await Promise.all([
      prisma.webform.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          _count: {
            select: { submissions: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.webform.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        data: serialize(webforms),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_WEBFORMS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch webforms" };
  }
}

// ============================================================
// Get Single Webform
// ============================================================

export async function getWebform(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const webform = await prisma.webform.findUnique({
      where: { id },
      include: {
        _count: {
          select: { submissions: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!webform) {
      return { success: false as const, error: "Webform not found" };
    }

    return { success: true as const, data: serialize(webform) };
  } catch (error) {
    console.error("[GET_WEBFORM_ERROR]", error);
    return { success: false as const, error: "Failed to fetch webform" };
  }
}

// ============================================================
// Get Webform by Slug (Public — No Auth Required)
// ============================================================

export async function getWebformBySlug(slug: string) {
  try {
    const webform = await prisma.webform.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        fields: true,
        styling: true,
        thankYouUrl: true,
        thankYouMessage: true,
        honeypotField: true,
        isActive: true,
      },
    });

    if (!webform) {
      return { success: false as const, error: "Webform not found" };
    }

    return { success: true as const, data: serialize(webform) };
  } catch (error) {
    console.error("[GET_WEBFORM_BY_SLUG_ERROR]", error);
    return { success: false as const, error: "Failed to fetch webform" };
  }
}

// ============================================================
// Create Webform
// ============================================================

export async function createWebform(input: WebformInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = webformSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Validation failed";
      return { success: false as const, error: firstError };
    }

    const data = parsed.data;

    // Generate slug if not provided
    let slug = data.slug?.trim() || generateSlug(data.name);

    // Ensure slug uniqueness
    const existing = await prisma.webform.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const webform = await prisma.webform.create({
      data: {
        name: data.name,
        slug,
        description: data.description || null,
        fields: data.fields as unknown as Prisma.InputJsonValue,
        styling: (data.styling as Prisma.InputJsonValue) ?? undefined,
        thankYouUrl: data.thankYouUrl || null,
        thankYouMessage: data.thankYouMessage || null,
        notifyUserIds: data.notifyUserIds ?? [],
        autoAssignTo: data.autoAssignTo || null,
        defaultSource: data.defaultSource,
        honeypotField: data.honeypotField || null,
        isActive: data.isActive,
        createdById: session.user.id,
      },
    });

    // Log activity
    logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "Webform",
      entityId: webform.id,
      changes: { name: webform.name, slug: webform.slug },
    });

    revalidatePath("/settings/webforms");

    return { success: true as const, data: serialize(webform) };
  } catch (error) {
    console.error("[CREATE_WEBFORM_ERROR]", error);
    return { success: false as const, error: "Failed to create webform" };
  }
}

// ============================================================
// Update Webform
// ============================================================

export async function updateWebform(id: string, input: WebformInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = webformSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Validation failed";
      return { success: false as const, error: firstError };
    }

    const data = parsed.data;

    // Check existence
    const existing = await prisma.webform.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Webform not found" };
    }

    // Handle slug if changed
    let slug = data.slug?.trim() || existing.slug;
    if (slug !== existing.slug) {
      const slugExists = await prisma.webform.findFirst({
        where: { slug, id: { not: id } },
      });
      if (slugExists) {
        slug = `${slug}-${Date.now().toString(36)}`;
      }
    }

    const webform = await prisma.webform.update({
      where: { id },
      data: {
        name: data.name,
        slug,
        description: data.description || null,
        fields: data.fields as unknown as Prisma.InputJsonValue,
        styling: (data.styling as Prisma.InputJsonValue) ?? undefined,
        thankYouUrl: data.thankYouUrl || null,
        thankYouMessage: data.thankYouMessage || null,
        notifyUserIds: data.notifyUserIds ?? [],
        autoAssignTo: data.autoAssignTo || null,
        defaultSource: data.defaultSource,
        honeypotField: data.honeypotField || null,
        isActive: data.isActive,
      },
    });

    // Log activity
    logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "Webform",
      entityId: webform.id,
      changes: { name: webform.name, slug: webform.slug },
    });

    revalidatePath("/settings/webforms");
    revalidatePath(`/settings/webforms/${id}`);

    return { success: true as const, data: serialize(webform) };
  } catch (error) {
    console.error("[UPDATE_WEBFORM_ERROR]", error);
    return { success: false as const, error: "Failed to update webform" };
  }
}

// ============================================================
// Delete Webform
// ============================================================

export async function deleteWebform(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.webform.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Webform not found" };
    }

    await prisma.webform.delete({ where: { id } });

    // Log activity
    logActivity({
      userId: session.user.id,
      action: "deleted",
      entityType: "Webform",
      entityId: id,
      changes: { name: existing.name },
    });

    revalidatePath("/settings/webforms");

    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_WEBFORM_ERROR]", error);
    return { success: false as const, error: "Failed to delete webform" };
  }
}

// ============================================================
// Toggle Webform Active Status
// ============================================================

export async function toggleWebform(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.webform.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Webform not found" };
    }

    const webform = await prisma.webform.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "Webform",
      entityId: id,
      changes: { isActive: webform.isActive },
    });

    revalidatePath("/settings/webforms");
    revalidatePath(`/settings/webforms/${id}`);

    return { success: true as const, data: serialize(webform) };
  } catch (error) {
    console.error("[TOGGLE_WEBFORM_ERROR]", error);
    return { success: false as const, error: "Failed to toggle webform" };
  }
}

// ============================================================
// Get Submissions (Paginated)
// ============================================================

export async function getSubmissions(
  webformId: string,
  params?: {
    page?: number;
    limit?: number;
    isSpam?: boolean;
  }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { webformId };

    if (params?.isSpam !== undefined) {
      where.isSpam = params.isSpam;
    }

    const [submissions, total] = await Promise.all([
      prisma.webformSubmission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.webformSubmission.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        data: serialize(submissions),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_SUBMISSIONS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch submissions" };
  }
}

// ============================================================
// Get Submission Stats
// ============================================================

export async function getSubmissionStats(webformId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const [total, today, thisWeek, spam] = await Promise.all([
      prisma.webformSubmission.count({ where: { webformId } }),
      prisma.webformSubmission.count({
        where: { webformId, createdAt: { gte: todayStart } },
      }),
      prisma.webformSubmission.count({
        where: { webformId, createdAt: { gte: weekStart } },
      }),
      prisma.webformSubmission.count({
        where: { webformId, isSpam: true },
      }),
    ]);

    return {
      success: true as const,
      data: { total, today, thisWeek, spam },
    };
  } catch (error) {
    console.error("[GET_SUBMISSION_STATS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch stats" };
  }
}

// ============================================================
// Generate Embed Code
// ------------------------------------------------------------
// NOTE: this module is "use server" — it may only EXPORT async
// functions. The helpers below are intentionally NOT exported.
// ============================================================

/** Escape a value for safe interpolation into a single-quoted JS string. */
function jsStr(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, " ")
    .replace(/</g, "\\x3C"); // never let a </script> escape the block
}

/** Escape a value for safe interpolation into a double-quoted HTML attribute. */
function htmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Escape a value for an HTML comment (no `--`, no `<`/`>`). */
function htmlComment(value: string): string {
  return value.replace(/-{2,}/g, "-").replace(/[<>]/g, "").trim();
}

export async function generateEmbedCode(webformId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const webform = await prisma.webform.findUnique({
      where: { id: webformId },
      select: { slug: true, name: true },
    });

    if (!webform) {
      return { success: false as const, error: "Webform not found" };
    }

    // Build base URL from environment or fallback
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000";

    const formUrl = `${baseUrl}/form/${webform.slug}`;
    const apiUrl = `${baseUrl}/api/webforms/${webform.slug}`;

    // The origin the iframe will post messages FROM. The embed snippet
    // hard-checks event.origin against this before acting on any message.
    let appOrigin = baseUrl;
    try {
      appOrigin = new URL(baseUrl).origin;
    } catch {
      appOrigin = baseUrl;
    }

    const safeName = htmlAttr(webform.name);
    const commentName = htmlComment(webform.name);
    const containerId = `veloria-form-${webform.slug}`;

    // ---- Plain iframe (fallback; no parent-page attribution) -------------
    const iframe = `<!-- ${commentName} - Embedded Form (simple fallback) -->
<!-- Note: this plain iframe does NOT forward gclid/utm from the parent page. -->
<!-- Use the JavaScript embed below for Google Ads attribution + conversions. -->
<iframe
  src="${formUrl}"
  width="100%"
  height="600"
  frameborder="0"
  style="border: none; max-width: 600px;"
  title="${safeName}"
></iframe>`;

    // ---- Smart JS embed --------------------------------------------------
    // Self-contained, dependency-free. Forwards the PARENT page's click ids
    // + utm params (plus landing_url / referrer) into the iframe src, sizes
    // the iframe from the child, and fires a Google Ads conversion on a
    // verified `veloria:lead:submitted` message.
    const jsEmbed = `<!-- ${commentName} - Veloria smart embed (attribution + Google Ads conversion) -->
<div id="${containerId}"></div>
<script>
(function () {
  var VELORIA_ADS_CONVERSION = ''; /* Google Ads conversion, e.g. AW-123456789/AbC-D_efGhIjK. Leave empty to skip conversion firing. */

  var APP_ORIGIN = '${jsStr(appOrigin)}';
  var FORM_URL = '${jsStr(formUrl)}';
  var SLUG = '${jsStr(webform.slug)}';
  var CONTAINER_ID = '${jsStr(containerId)}';
  var FORWARD = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

  var container = document.getElementById(CONTAINER_ID);
  if (!container || container.getAttribute('data-veloria-mounted') === '1') return;
  container.setAttribute('data-veloria-mounted', '1');

  function readParam(search, key) {
    try {
      var re = new RegExp('[?&]' + key.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&') + '=([^&#]*)');
      var m = re.exec(search || '');
      return m ? decodeURIComponent(m[1].replace(/\\+/g, ' ')) : '';
    } catch (e) { return ''; }
  }

  function buildSrc() {
    var parts = [];
    var search = '';
    try { search = window.location.search || ''; } catch (e) { search = ''; }
    for (var i = 0; i < FORWARD.length; i++) {
      var val = readParam(search, FORWARD[i]);
      if (val) parts.push(encodeURIComponent(FORWARD[i]) + '=' + encodeURIComponent(val));
    }
    try {
      if (window.location.href) parts.push('landing_url=' + encodeURIComponent(window.location.href));
    } catch (e) {}
    try {
      if (document.referrer) parts.push('referrer=' + encodeURIComponent(document.referrer));
    } catch (e) {}
    if (!parts.length) return FORM_URL;
    return FORM_URL + (FORM_URL.indexOf('?') === -1 ? '?' : '&') + parts.join('&');
  }

  var iframe = document.createElement('iframe');
  iframe.src = buildSrc();
  iframe.title = '${jsStr(webform.name)}';
  iframe.setAttribute('frameborder', '0');
  iframe.setAttribute('scrolling', 'no');
  iframe.setAttribute('allowtransparency', 'true');
  iframe.style.border = 'none';
  iframe.style.display = 'block';
  iframe.style.width = '100%';
  iframe.style.maxWidth = '600px';
  iframe.style.height = '600px';
  container.appendChild(iframe);

  function fireConversion() {
    if (!VELORIA_ADS_CONVERSION) return; /* not configured -> skip silently */
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'conversion', {
          send_to: VELORIA_ADS_CONVERSION,
          value: 0,
          currency: 'INR'
        });
      }
    } catch (e) { /* never break the host page */ }
  }

  window.addEventListener('message', function (event) {
    /* SECURITY: only trust messages from the Veloria app origin AND from
       this exact iframe. Any other frame/extension/ad script is ignored. */
    if (event.origin !== APP_ORIGIN) return;
    if (event.source !== iframe.contentWindow) return;

    var msg = event.data;
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'veloria:lead:submitted') {
      if (msg.slug && msg.slug !== SLUG) return;
      fireConversion();
    } else if (msg.type === 'veloria:resize') {
      var h = parseInt(msg.height, 10);
      if (h > 0 && h < 20000) iframe.style.height = h + 'px';
    }
  }, false);
})();
</script>`;

    return {
      success: true as const,
      data: {
        formUrl,
        apiUrl,
        iframe,
        jsEmbed,
      },
    };
  } catch (error) {
    console.error("[GENERATE_EMBED_CODE_ERROR]", error);
    return { success: false as const, error: "Failed to generate embed code" };
  }
}
