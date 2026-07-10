import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { COMPANY_LEGAL_LINE, COMPANY_ADDRESS, COMPANY_GSTIN } from "@/lib/constants";
import {
  getDailyMuster, getMonthlyRegister,
  type MusterStatus,
} from "@/actions/hr-attendance-register.actions";

export const runtime = "nodejs";

// ============================================================
// Attendance Muster — branded, print-to-PDF report.
//
// GET /api/hr/muster?date=YYYY-MM-DD          → the daily muster
// GET /api/hr/muster?fy=2025-26&month=7       → the monthly register grid
//
// AUTH: the request must carry a signed-in session (401 otherwise) whose role
// holds `hr:read` (403 otherwise) — the exact gate the on-screen muster uses.
// Data is pulled through the same read-only actions so the report never diverges
// from the grid. There is NO PDF library in this app; "PDF" here means a
// print-ready HTML document (window.print / Save-as-PDF), the established pattern.
// ============================================================

const PLUM = "#2D1B3D";
const GOLD = "#C9A96E";
const IVORY = "#FAF7F2";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Register glyph + colour per status, mirroring STATUS_META in the on-screen grid.
const STATUS_PRINT: Record<MusterStatus, { label: string; code: string; bg: string; fg: string }> = {
  PRESENT:  { label: "Present",  code: "P", bg: "#d1fae5", fg: "#047857" },
  WFH:      { label: "WFH",      code: "W", bg: "#cffafe", fg: "#0e7490" },
  HALF_DAY: { label: "Half day", code: "½", bg: "#fef3c7", fg: "#b45309" },
  ON_LEAVE: { label: "On leave", code: "L", bg: "#dbeafe", fg: "#1d4ed8" },
  ABSENT:   { label: "Absent",   code: "A", bg: "#ffe4e6", fg: "#be123c" },
  HOLIDAY:  { label: "Holiday",  code: "H", bg: "#ede9fe", fg: "#6d28d9" },
  WEEKEND:  { label: "Weekend",  code: "•", bg: "#f1f5f9", fg: "#64748b" },
};

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

function istTime(d: Date): string {
  return new Date(d).toLocaleTimeString("en-IN", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
}

function prettyDay(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00.000Z`).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

function statusChip(st: MusterStatus): string {
  const m = STATUS_PRINT[st];
  return `<span class="chip" style="background:${m.bg};color:${m.fg}" title="${esc(m.label)}">${m.code}</span>`;
}

function pageShell(title: string, subtitle: string, inner: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>${esc(title)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: ${PLUM}; background: ${IVORY}; margin: 0; padding: 24px; }
  .doc { max-width: 1100px; margin: 0 auto; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid ${GOLD}; padding-bottom: 14px; }
  .brand { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
  .brand small { display:block; font-size: 11px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: ${GOLD}; }
  .title { font-size: 15px; font-weight: 700; text-align: right; }
  .title small { display:block; font-weight: 500; color: #6b5b73; }
  h2 { font-size: 13px; margin: 18px 0 8px; padding: 6px 10px; background: ${PLUM}; color: ${IVORY}; border-radius: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(45,27,61,.08); }
  th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #efe7dd; }
  th { background: ${PLUM}; color: ${IVORY}; font-weight: 600; font-size: 10.5px; }
  td.r, th.r { text-align: right; white-space: nowrap; }
  td.c, th.c { text-align: center; }
  td.muted { color: #6b5b73; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10.5px; color: #6b5b73; }
  .chip { display:inline-flex; width: 18px; height: 18px; align-items:center; justify-content:center; border-radius: 4px; font-size: 10px; font-weight: 700; }
  .legend { display:flex; flex-wrap:wrap; gap: 10px; margin: 10px 0; font-size: 11px; color:#4a3d52; }
  .legend span.item { display:inline-flex; align-items:center; gap:5px; }
  .footer { margin-top: 22px; padding-top: 12px; border-top: 1px solid #e6dccb; font-size: 10.5px; color: #6b5b73; display:flex; justify-content: space-between; }
  .actions { text-align:center; margin: 8px 0 18px; }
  .actions button { background:${PLUM}; color:${IVORY}; border:0; padding:9px 18px; border-radius:8px; font-weight:600; cursor:pointer; }
  @media print { .actions { display:none; } body { padding: 0; } }
</style></head>
<body>
  <div class="doc">
    <div class="actions"><button onclick="window.print()">Save as PDF / Print</button></div>
    <div class="header">
      <div class="brand"><img src="/logo.png" alt="Veloria Grand" style="height:44px;width:auto;display:block;margin-bottom:6px" onerror="this.style.display='none'"/>Veloria Grand<small>${esc(COMPANY_LEGAL_LINE)}</small><small>${esc(COMPANY_ADDRESS)}</small>${COMPANY_GSTIN ? `<small>GSTIN: ${esc(COMPANY_GSTIN)}</small>` : ""}</div>
      <div class="title">Attendance Muster<small>${esc(subtitle)}</small></div>
    </div>
    ${inner}
    <div class="footer">
      <span>This is a computer-generated attendance report.</span>
      <span>${esc(COMPANY_LEGAL_LINE)}</span>
    </div>
  </div>
</body></html>`;
}

function htmlResponse(html: string, filename: string): Response {
  const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${safe}.html"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: Request) {
  // 1) Authentication — must be signed in.
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Please sign in to view this report.", { status: 401 });
  }
  // 2) Authorisation — same gate as the on-screen muster.
  if (!hasPermission(session.user.role ?? "", "hr:read")) {
    return new Response("You are not allowed to view the attendance muster.", { status: 403 });
  }

  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  const fyParam = url.searchParams.get("fy");
  const monthParam = url.searchParams.get("month");

  // ---- Daily muster ----
  if (dateParam) {
    const muster = await getDailyMuster({ date: dateParam });
    if (!muster) return new Response("Muster not available for that day.", { status: 404 });

    const rows = muster.rows.map((r) => `<tr>
      <td class="mono">${esc(r.empCode)}</td>
      <td>${esc(r.name)}</td>
      <td class="muted">${esc(r.department ?? "—")}</td>
      <td class="c">${statusChip(r.status)} ${esc(STATUS_PRINT[r.status]?.label ?? r.status)}</td>
      <td class="c">${r.checkInAt ? esc(istTime(r.checkInAt)) : "—"}</td>
      <td class="c">${r.checkOutAt ? esc(istTime(r.checkOutAt)) : "—"}</td>
      <td class="r">${r.workedMinutes > 0 ? `${Math.floor(r.workedMinutes / 60)}h ${r.workedMinutes % 60}m` : "—"}</td>
      <td class="c">${r.flagged ? "⚑" : ""}</td>
    </tr>`).join("");

    const s = muster.summary;
    const inner = `
      <h2>Daily muster · ${esc(prettyDay(muster.date))}</h2>
      <p class="legend">
        <span class="item"><strong>Headcount</strong> ${s.headcount}</span>
        <span class="item"><strong>Present</strong> ${s.present}</span>
        <span class="item"><strong>WFH</strong> ${s.wfh}</span>
        <span class="item"><strong>On leave</strong> ${s.onLeave}</span>
        <span class="item"><strong>Absent</strong> ${s.absent}</span>
        <span class="item"><strong>Flagged</strong> ${s.flagged}</span>
      </p>
      <table>
        <thead><tr>
          <th>Code</th><th>Employee</th><th>Department</th><th class="c">Status</th>
          <th class="c">Check-in</th><th class="c">Check-out</th><th class="r">Worked</th><th class="c">Flag</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="8" class="muted">No employees on the roster.</td></tr>`}</tbody>
      </table>`;

    return htmlResponse(
      pageShell(`Muster — ${muster.date}`, prettyDay(muster.date), inner),
      `Muster-${muster.date}`,
    );
  }

  // ---- Monthly register ----
  if (fyParam && monthParam) {
    const month = Number(monthParam);
    const reg = await getMonthlyRegister({ fy: fyParam, month });
    if (!reg) return new Response("Register not available for that period.", { status: 404 });

    const dayNums = Array.from({ length: reg.daysInMonth }, (_, i) => i + 1);
    const dayHeads = dayNums.map((d) => `<th class="c">${d}</th>`).join("");

    const bodyRows = reg.rows.map((r) => {
      const cells = dayNums.map((d) => {
        const st = r.days[d];
        return `<td class="c">${st ? statusChip(st) : "·"}</td>`;
      }).join("");
      const vals = Object.values(r.days);
      const present = vals.filter((v) => v === "PRESENT" || v === "HALF_DAY").length;
      const absent = vals.filter((v) => v === "ABSENT").length;
      const leave = vals.filter((v) => v === "ON_LEAVE").length;
      const wfh = vals.filter((v) => v === "WFH").length;
      return `<tr>
        <td><div>${esc(r.name)}</div><div class="mono">${esc(r.empCode)}</div></td>
        ${cells}
        <td class="r">${present}</td><td class="r">${absent}</td><td class="r">${leave}</td><td class="r">${wfh}</td>
      </tr>`;
    }).join("");

    const legend = (Object.keys(STATUS_PRINT) as MusterStatus[])
      .map((k) => `<span class="item">${statusChip(k)} ${esc(STATUS_PRINT[k].label)}</span>`)
      .join("");

    const label = `${MONTHS[(month - 1 + 12) % 12]} ${reg.year} · FY ${reg.fy}`;
    const inner = `
      <h2>Monthly register · ${esc(label)}</h2>
      <p class="legend">${legend}</p>
      <table>
        <thead><tr>
          <th>Employee</th>${dayHeads}
          <th class="r">P</th><th class="r">A</th><th class="r">L</th><th class="r">W</th>
        </tr></thead>
        <tbody>${bodyRows || `<tr><td colspan="${reg.daysInMonth + 5}" class="muted">No employees on the roster.</td></tr>`}</tbody>
      </table>`;

    return htmlResponse(
      pageShell(`Register — ${label}`, label, inner),
      `Muster-Register-${reg.fy}-${String(reg.month).padStart(2, "0")}`,
    );
  }

  return new Response("Provide ?date=YYYY-MM-DD or ?fy=YYYY-YY&month=M.", { status: 400 });
}
