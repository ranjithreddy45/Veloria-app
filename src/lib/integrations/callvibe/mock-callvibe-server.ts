import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

// ============================================================
// A local stand-in for CallVibe, for tests only. Built on node:http so no
// mocking dependency is needed.
//
// It follows CallVibe's published OpenAPI document where that document is
// specific (paths, methods, request fields, FastAPI's 422 shape) and makes the
// UNDOCUMENTED behaviour controllable, so tests can prove we handle each case:
// an expired token (401), throttling (429 + Retry-After), a rejected phone, an
// unknown agent. Response bodies are our assumption — CallVibe publishes none.
// ============================================================

export interface MockLead {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  status: string | null;
  assigned_to: string | null;
  source: string | null;
  custom_fields: Record<string, unknown> | null;
  notes: string[];
  createdAt: number;
  updatedAt: number;
}

export interface MockCallVibe {
  baseUrl: string;
  leads: Map<string, MockLead>;
  requests: { method: string; path: string; authorization?: string; body?: unknown }[];
  signIns: number;
  agents: { name: string; phone: string }[];
  /** Tokens the server currently accepts. Clear it to simulate expiry. */
  validTokens: Set<string>;
  /** The next N lead/agent requests answer 429 with this Retry-After (seconds). */
  throttleNext(n: number, retryAfterSeconds?: number): void;
  /** The next N requests answer with this status (e.g. 503). */
  failNext(n: number, status: number): void;
  close(): Promise<void>;
}

export const MOCK_CREDENTIALS = { email: "integration@example.test", password: "not-a-real-password" };

function pick<T>(body: Record<string, unknown>, key: string, current: T | undefined): T | null {
  return key in body ? ((body[key] as T) ?? null) : (current ?? null);
}

export async function startMockCallVibe(): Promise<MockCallVibe> {
  const leads = new Map<string, MockLead>();
  const requests: MockCallVibe["requests"] = [];
  const validTokens = new Set<string>();
  const agents = [
    { name: "Asha Rao", phone: "+919800000001" },
    { name: "Vikram Nair", phone: "+919800000002" },
  ];
  let signIns = 0;
  let throttle = 0;
  let throttleAfter = 1;
  let failures = 0;
  let failureStatus = 503;
  let ids = 0;

  const json = (res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
    res.writeHead(status, { "Content-Type": "application/json", ...headers });
    res.end(body === undefined ? "" : JSON.stringify(body));
  };

  const readBody = (req: IncomingMessage) =>
    new Promise<unknown>((resolve) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        try {
          resolve(raw ? JSON.parse(raw) : undefined);
        } catch {
          resolve(raw);
        }
      });
    });

  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://mock");
    const path = decodeURIComponent(url.pathname);
    const body = await readBody(req);
    requests.push({ method: req.method ?? "", path, authorization: req.headers.authorization, body });

    if (req.method === "POST" && path === "/auth/signin") {
      const b = (body ?? {}) as Record<string, string>;
      if (b.email !== MOCK_CREDENTIALS.email || b.password !== MOCK_CREDENTIALS.password) {
        return json(res, 401, { detail: "Invalid login credentials" });
      }
      signIns++;
      const token = `mock-token-${signIns}`;
      validTokens.add(token);
      return json(res, 200, { access_token: token, refresh_token: `mock-refresh-${signIns}`, expires_in: 3600 });
    }

    const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    if (!validTokens.has(token)) return json(res, 401, { detail: "Invalid or expired token" });

    if (failures > 0) {
      failures--;
      return json(res, failureStatus, { detail: "Temporary failure" });
    }
    if (throttle > 0) {
      throttle--;
      return json(res, 429, { detail: "Too many requests" }, { "Retry-After": String(throttleAfter) });
    }

    if (req.method === "GET" && path === "/agent-list") return json(res, 200, agents);

    const m = /^\/api\/leads\/([^/]+)(\/notes)?$/.exec(path);
    if (m) {
      const phone = m[1]!;
      if (!/^\d{8,15}$/.test(phone)) {
        return json(res, 422, { detail: [{ loc: ["path", "phone"], msg: "Phone must be 8-15 digits", type: "value_error" }] });
      }
      if (m[2]) {
        const lead = leads.get(phone);
        if (!lead) return json(res, 404, { detail: "Lead not found" });
        lead.notes.push(String(((body ?? {}) as Record<string, unknown>).note_text ?? ""));
        return json(res, 200, { ok: true });
      }
      if (req.method === "GET") {
        const lead = leads.get(phone);
        return lead ? json(res, 200, lead) : json(res, 404, { detail: "Lead not found" });
      }
      if (req.method === "PUT") {
        const b = (body ?? {}) as Record<string, unknown>;
        if (b.assigned_to && !agents.some((a) => a.name === b.assigned_to)) {
          return json(res, 422, { detail: [{ loc: ["body", "assigned_to"], msg: "Unknown agent", type: "value_error" }] });
        }
        const now = Date.now();
        const existing = leads.get(phone);
        const lead: MockLead = {
          id: existing?.id ?? `lead_${++ids}`,
          phone,
          // A key the request leaves out keeps its stored value.
          name: pick(b, "name", existing?.name),
          email: pick(b, "email", existing?.email),
          status: pick(b, "status", existing?.status),
          assigned_to: pick(b, "assigned_to", existing?.assigned_to),
          source: pick(b, "source", existing?.source),
          custom_fields: pick(b, "custom_fields", existing?.custom_fields),
          notes: existing?.notes ?? [],
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        leads.set(phone, lead);
        return json(res, 200, lead);
      }
    }
    return json(res, 404, { detail: "Not Found" });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    leads,
    requests,
    get signIns() {
      return signIns;
    },
    agents,
    validTokens,
    throttleNext(n, retryAfterSeconds = 1) {
      throttle = n;
      throttleAfter = retryAfterSeconds;
    },
    failNext(n, status) {
      failures = n;
      failureStatus = status;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
