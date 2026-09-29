/**
 * Ported to vitest (the repo's runner) from the node:test file that shipped in
 * the AiSensy package. Only the harness changed — every assertion is the
 * original one, so this still proves what the package's author tested.
 */
import { expect, test } from "vitest";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { AiSensyClient, AiSensyError, buildTemplatePayload, normalizePhone } from "./client";
import { parseAiSensyNotification, shouldApplyStatus, verifyAiSensySignature } from "./webhook";
import { handleAiSensyWebhook } from "./handler";
import type { AiSensySink, InboundLogEntry } from "./sink";

// ---------------------------------------------------------------- helpers
type Call = { url: string; init: RequestInit };
function mockFetch(status: number, body: unknown) {
  const calls: Call[] = [];
  const fn = async (url: string, init?: RequestInit) => {
    calls.push({ url, init: init ?? {} });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  };
  return { fn, calls };
}
const cfg = { projectId: '6ab3d281ead0bf4ba64af375', apiPassword: 'pwd-123' };

// ---------------------------------------------------------------- phone
test('normalizePhone handles Indian formats', () => {
  assert.equal(normalizePhone('+91 91877 00778'), '919187700778');
  assert.equal(normalizePhone('9187700778'), '919187700778');
  assert.equal(normalizePhone('09187700778'), '919187700778');
  assert.equal(normalizePhone('0091-91877-00778'), '919187700778');
  assert.equal(normalizePhone('447458197537'), '447458197537');
  assert.throws(() => normalizePhone('12345'), AiSensyError);
  assert.throws(() => normalizePhone(''), AiSensyError);
});

test('normalizePhone: "+"/00 + 10 digits is never re-prefixed into a stranger\'s Indian number', () => {
  // Was 916591234567 — a plausible, valid-looking stranger's Indian mobile.
  assert.throws(() => normalizePhone('+65 9123 4567'), AiSensyError);
  assert.throws(() => normalizePhone('0065 9123 4567'), AiSensyError);
  assert.throws(() => normalizePhone('+98765 43210'), AiSensyError); // ambiguous: +98 or stray "+"
  assert.equal(normalizePhone('+1 415 555 2671'), '14155552671');
  assert.equal(normalizePhone('+9187700778'), '919187700778'); // stray "+", unambiguous
});

test('normalizePhone: "+91 0…" trunk zero is dropped; malformed Indian numbers throw', () => {
  assert.equal(normalizePhone('+91 0 91877 00778'), '919187700778'); // was 9109187700778
  assert.equal(normalizePhone('+91-09187700778'), '919187700778');
  assert.throws(() => normalizePhone('91987654321'), AiSensyError); // 91 + 9 digits, was accepted
  assert.throws(() => normalizePhone('9198765432101'), AiSensyError); // 91 + 11 digits
});

// ---------------------------------------------------------------- client
test('sendText posts Cloud-API body with auth header and returns ids', async () => {
  const m = mockFetch(200, { messaging_product: 'whatsapp', contacts: [{ input: '919187700778', wa_id: '919187700778' }], messages: [{ id: 'wamid.ABC' }] });
  const c = new AiSensyClient(cfg, m.fn);
  const r = await c.sendText('+91 91877 00778', 'Hello');
  assert.equal(m.calls[0].url, 'https://apis.aisensy.com/project-apis/v1/project/6ab3d281ead0bf4ba64af375/messages');
  assert.equal(m.calls[0].init.method, 'POST');
  assert.equal((m.calls[0].init.headers as any)['X-AiSensy-Project-API-Pwd'], 'pwd-123');
  const body = JSON.parse(String(m.calls[0].init.body));
  assert.deepEqual(body, { messaging_product: 'whatsapp', recipient_type: 'individual', to: '919187700778', type: 'text', text: { body: 'Hello', preview_url: false } });
  assert.equal(r.messageId, 'wamid.ABC');
  assert.equal(r.waId, '919187700778');
});

test('send tolerates AiSensy returning messages:[{}] (no id)', async () => {
  const m = mockFetch(200, { messaging_product: 'whatsapp', contacts: [{ input: '918851944381', wa_id: '918851944381' }], messages: [{}] });
  const r = await new AiSensyClient(cfg, m.fn).sendText('8851944381', 'x');
  assert.equal(r.messageId, undefined);
  assert.equal(r.to, '918851944381');
});

test('sendTemplate builds body/header/button components', async () => {
  const m = mockFetch(200, { messages: [{ id: 'wamid.T' }] });
  await new AiSensyClient(cfg, m.fn).sendTemplate('9187700778', 'booking_update', {
    language: 'en',
    bodyParams: ['Ranjith', '', 25000],
    headerMedia: { kind: 'image', link: 'https://x/y.jpg' },
    urlButtonParams: { 0: 'bk_123' },
  });
  const body = JSON.parse(String(m.calls[0].init.body));
  assert.equal(body.type, 'template');
  assert.deepEqual(body.template.language, { policy: 'deterministic', code: 'en' });
  assert.deepEqual(body.template.components, [
    { type: 'header', parameters: [{ type: 'image', image: { link: 'https://x/y.jpg' } }] },
    { type: 'body', parameters: [{ type: 'text', text: 'Ranjith' }, { type: 'text', text: '-' }, { type: 'text', text: '25000' }] },
    { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: 'bk_123' }] },
  ]);
});

test('template params: newlines/tabs/5+ spaces collapsed (WhatsApp 132018), header params too', () => {
  const t = buildTemplatePayload('x', { headerTextParams: [''], bodyParams: ['Line1\nLine2', 'a\tb', 'x     y'] });
  assert.deepEqual(t.components, [
    { type: 'header', parameters: [{ type: 'text', text: '-' }] },
    { type: 'body', parameters: [{ type: 'text', text: 'Line1 Line2' }, { type: 'text', text: 'a b' }, { type: 'text', text: 'x y' }] },
  ]);
});

test('template without params sends empty components', () => {
  assert.deepEqual(buildTemplatePayload('thank_you_static'), { name: 'thank_you_static', language: { policy: 'deterministic', code: 'en' }, components: [] });
});

test('AiSensy error body is surfaced', async () => {
  const m = mockFetch(401, { name: 'ERR401', message: 'Invalid password' });
  await assert.rejects(new AiSensyClient(cfg, m.fn).getProject(), (e: any) => {
    assert.ok(e instanceof AiSensyError);
    assert.equal(e.status, 401);
    assert.equal(e.code, 'ERR401');
    assert.ok(e.isAuthError);
    assert.match(e.message, /Invalid password/);
    return true;
  });
});

test('Meta-style error passthrough is surfaced', async () => {
  const m = mockFetch(400, { error: { message: 'Re-engagement message', code: 131047 } });
  await assert.rejects(new AiSensyClient(cfg, m.fn).sendText('9187700778', 'hi'), (e: any) => e.code === '131047' && /Re-engagement/.test(e.message));
});

test('network failure maps to retryable AiSensyError', async () => {
  const c = new AiSensyClient(cfg, async () => { throw new TypeError('fetch failed'); });
  await assert.rejects(c.getProject(), (e: any) => e instanceof AiSensyError && e.status === 0 && e.isRetryable);
});

test('timeout covers a stalled response body and is NOT retryable (send may have landed)', { timeout: 5000 }, async () => {
  const stalled = async (_u: string, init?: RequestInit) => {
    const body = new ReadableStream({
      start(ctrl) {
        ctrl.enqueue(new TextEncoder().encode('{"messages":'));
        init?.signal?.addEventListener('abort', () => ctrl.error(new DOMException('aborted', 'AbortError')));
      },
    });
    return new Response(body, { status: 200 });
  };
  const c = new AiSensyClient({ ...cfg, timeoutMs: 50 }, stalled);
  const t0 = Date.now();
  await assert.rejects(c.sendText('9187700778', 'hi'), (e: any) => e instanceof AiSensyError && e.code === 'TIMEOUT' && e.isRetryable === false);
  assert.ok(Date.now() - t0 < 2000, 'must not hang past the timeout');
});

test('validation errors reject (not sync-throw) so fire-and-forget .catch() catches them', async () => {
  const c = new AiSensyClient(cfg, mockFetch(200, {}).fn);
  let p: Promise<unknown> | undefined;
  assert.doesNotThrow(() => { p = c.sendText('9187700778', ''); });
  await assert.rejects(p!, AiSensyError);
  assert.doesNotThrow(() => { p = c.sendTemplate('9187700778', ' '); });
  await assert.rejects(p!, AiSensyError);
  assert.doesNotThrow(() => { p = c.sendText('12', 'hi'); });
  await assert.rejects(p!, AiSensyError);
  assert.doesNotThrow(() => { p = c.createContact('A', '12'); });
  await assert.rejects(p!, AiSensyError);
});

test('baseUrl override must be an https aisensy.com host (shared column with Weflux)', () => {
  assert.throws(() => new AiSensyClient({ ...cfg, baseUrl: 'https://api.weflux.io/v1' }), AiSensyError);
  assert.throws(() => new AiSensyClient({ ...cfg, baseUrl: 'http://apis.aisensy.com/project-apis/v1' }), AiSensyError);
  assert.throws(() => new AiSensyClient({ ...cfg, baseUrl: 'https://evilaisensy.com/x' }), AiSensyError);
  assert.doesNotThrow(() => new AiSensyClient({ ...cfg, baseUrl: 'https://apis.aisensy.com/project-apis/v1/' }));
  assert.doesNotThrow(() => new AiSensyClient({ ...cfg, baseUrl: '  ' }));
});

test('getContactByMobile returns null on 404, ensureContact creates', async () => {
  let n = 0;
  const calls: Call[] = [];
  const fn = async (url: string, init?: RequestInit) => {
    calls.push({ url, init: init ?? {} });
    n++;
    return n === 1 ? new Response(JSON.stringify({ name: 'ERR404', message: 'Contact not found' }), { status: 404 }) : new Response(JSON.stringify({ phone_number: '919187700778' }), { status: 200 });
  };
  const c = new AiSensyClient(cfg, fn);
  const r = await c.ensureContact('Asha', '9187700778');
  assert.equal(r.phone_number, '919187700778');
  assert.match(calls[0].url, /contact\?action=FetchContact&mobile_number=919187700778$/);
  assert.equal(calls[1].init.method, 'POST');
  assert.deepEqual(JSON.parse(String(calls[1].init.body)), { name: 'Asha', mobile_number: '919187700778' });
});

test('listTemplates accepts array response', async () => {
  const m = mockFetch(200, [{ id: 't1', name: 'first_message', status: 'APPROVED' }]);
  const rows = await new AiSensyClient(cfg, m.fn).listTemplates();
  assert.equal(rows.length, 1);
  assert.match(m.calls[0].url, /wa_template\/\?limit=100$/);
});

test('listTemplates stops when the API ignores the cursor (no 20x duplicate pages)', async () => {
  const page = Array.from({ length: 100 }, (_, i) => ({ id: `t${i}`, name: `tpl_${i}` }));
  const m = mockFetch(200, page);
  const rows = await new AiSensyClient(cfg, m.fn).listTemplates();
  assert.equal(rows.length, 100);
  assert.equal(m.calls.length, 2);
  assert.match(m.calls[1].url, /after=t99/);
});

test('listTemplates follows a Meta-style paging cursor when the API returns one', async () => {
  const p1 = { data: Array.from({ length: 100 }, (_, i) => ({ id: `a${i}`, name: `a_${i}` })), paging: { cursors: { after: 'CUR2' } } };
  const p2 = { data: [{ id: 'b0', name: 'b_0' }] };
  let k = 0;
  const calls: string[] = [];
  const fn = async (url: string) => (calls.push(url), new Response(JSON.stringify(k++ === 0 ? p1 : p2), { status: 200 }));
  const rows = await new AiSensyClient(cfg, fn).listTemplates();
  assert.equal(rows.length, 101);
  assert.match(calls[1], /after=CUR2/);
});

test('constructor rejects missing credentials', () => {
  assert.throws(() => new AiSensyClient({ projectId: '', apiPassword: 'x' }), AiSensyError);
  assert.throws(() => new AiSensyClient({ projectId: 'x', apiPassword: ' ' }), AiSensyError);
});

// ---------------------------------------------------------------- signature
const secret = 'shh-secret';
const sign = (s: string) => createHmac('sha256', secret).update(s).digest('hex');

test('signature: raw body match', () => {
  const raw = '{"id":"n1","topic":"message.sender.user"}';
  assert.ok(verifyAiSensySignature(raw, sign(raw), secret));
  assert.ok(verifyAiSensySignature(raw, 'sha256=' + sign(raw).toUpperCase(), secret));
});

test('signature: pretty-printed body signed as compact JSON (AiSensy sample behaviour)', () => {
  const obj = { id: 'n1', topic: 'message.sender.user', data: { a: 1 } };
  const pretty = JSON.stringify(obj, null, 2);
  assert.ok(verifyAiSensySignature(pretty, sign(JSON.stringify(obj)), secret));
});

test('signature: rejects wrong secret, missing, malformed', () => {
  const raw = '{"id":"n1"}';
  assert.equal(verifyAiSensySignature(raw, createHmac('sha256', 'other').update(raw).digest('hex'), secret), false);
  assert.equal(verifyAiSensySignature(raw, null, secret), false);
  assert.equal(verifyAiSensySignature(raw, 'abc', secret), false);
  assert.equal(verifyAiSensySignature(raw, sign(raw), ''), false);
});

// ---------------------------------------------------------------- parsing
const inbound = {
  id: 'notif-1',
  created_at: 1727600000000,
  topic: 'message.sender.user',
  delivery_attempt: 1,
  project_id: '6ab3d281ead0bf4ba64af375',
  data: {
    message: {
      type: 'message',
      id: 'ais-msg-1',
      phone_number: '+919876543210',
      contact_id: 'c1',
      sender: 'USER',
      userName: 'Priya',
      message_type: 'TEXT',
      message_content: { text: 'Is 14 Dec available for 300 guests?' },
      sent_at: 1727600000123,
      messageId: 'wamid.IN1',
    },
  },
};

test('parse inbound text', () => {
  const e = parseAiSensyNotification(inbound as any);
  assert.equal(e.kind, 'inbound_message');
  if (e.kind !== 'inbound_message') return;
  assert.equal(e.phone, '919876543210');
  assert.equal(e.contactName, 'Priya');
  assert.equal(e.text, 'Is 14 Dec available for 300 guests?');
  assert.equal(e.waMessageId, 'wamid.IN1');
  assert.equal(e.timestamp, 1727600000123);
});

test('parse inbound image with caption', () => {
  const n = structuredClone(inbound) as any;
  n.data.message.message_type = 'IMAGE';
  n.data.message.message_content = { url: 'https://cdn/x.jpg', caption: 'our decor ref' };
  const e = parseAiSensyNotification(n);
  assert.equal(e.kind, 'inbound_message');
  if (e.kind === 'inbound_message') {
    assert.equal(e.mediaUrl, 'https://cdn/x.jpg');
    assert.equal(e.text, 'our decor ref');
  }
});

test('parse status: failed wins, read with seconds timestamp', () => {
  const failed = parseAiSensyNotification({ id: 'n2', topic: 'message.status.updated', data: { message: { id: 'm', messageId: 'wamid.X', phone_number: '919876543210', status: 'FAILED', failed_at: 1727600001000, failureResponse: { code: 131047, reason: 'Re-engagement message' } } } });
  assert.equal(failed.kind, 'status');
  if (failed.kind === 'status') {
    assert.equal(failed.status, 'FAILED');
    assert.equal(failed.failure?.code, 131047);
  }
  const read = parseAiSensyNotification({ id: 'n3', topic: 'message.status.updated', data: { message: { messageId: 'wamid.X', status: 'READ', read_at: 1727600002 } } });
  if (read.kind === 'status') {
    assert.equal(read.status, 'READ');
    assert.equal(read.at, 1727600002000);
  } else assert.fail('expected status');
});

test('timestamps: numeric strings are epoch values, not Date.parse years', () => {
  const at = (read_at: unknown) => {
    const e = parseAiSensyNotification({ id: 'n', topic: 'message.status.updated', data: { message: { status: 'READ', read_at } } });
    return e.kind === 'status' ? e.at : NaN;
  };
  assert.equal(at('1727600002'), 1727600002000);
  assert.equal(at('1727600002123'), 1727600002123);
  assert.equal(at('2026-09-29T10:00:00Z'), Date.parse('2026-09-29T10:00:00Z'));
  // V8's Date.parse('12') is a 2001 date; a numeric string must never go through it.
  assert.equal(at('12'), 12000);
  assert.notEqual(at('12'), Date.parse('12'));
  const inb = structuredClone(inbound) as any;
  inb.data.message.sent_at = '1727600000';
  const e = parseAiSensyNotification(inb);
  assert.equal(e.kind === 'inbound_message' && e.timestamp, 1727600000000);
});

test('status: empty failureResponse placeholder is not a failure', () => {
  const e = parseAiSensyNotification({ id: 'n', topic: 'message.status.updated', data: { message: { messageId: 'wamid.X', status: 'DELIVERED', delivered_at: 1727600002123, failureResponse: {} } } });
  assert.equal(e.kind === 'status' && e.status, 'DELIVERED');
  assert.equal(e.kind === 'status' && e.failure, undefined);
  const n = parseAiSensyNotification({ id: 'n', topic: 'message.status.updated', data: { message: { status: 'SENT', sent_at: 1727600002123, failureResponse: { code: null, reason: null } } } });
  assert.equal(n.kind === 'status' && n.status, 'SENT');
  // failed_at: "0" placeholder — Date.parse("0") is a year-2000 date, which turned every status into FAILED.
  const z = parseAiSensyNotification({ id: 'n', topic: 'message.status.updated', data: { message: { status: 'DELIVERED', delivered_at: 1727600002123, failed_at: '0' } } });
  assert.equal(z.kind === 'status' && z.status, 'DELIVERED');
});

test('message.created from USER is ignored (no double insert), from AGENT is an echo', () => {
  const u = parseAiSensyNotification({ ...inbound, topic: 'message.created' } as any);
  assert.equal(u.kind, 'ignored');
  const a = structuredClone(inbound) as any;
  a.topic = 'message.created';
  a.data.message.sender = 'AGENT';
  a.data.message.agent_id = 'ag1';
  const e = parseAiSensyNotification(a);
  assert.equal(e.kind, 'outbound_echo');
});

test('unknown topic and garbage never throw', () => {
  assert.equal(parseAiSensyNotification({ id: 'x', topic: 'order.placed', data: {} }).kind, 'ignored');
  assert.equal(parseAiSensyNotification(null as any).kind, 'ignored');
});

test('status ordering: late SENT never downgrades READ', () => {
  assert.equal(shouldApplyStatus('READ', 'SENT'), false);
  assert.equal(shouldApplyStatus('SENT', 'DELIVERED'), true);
  assert.equal(shouldApplyStatus(null, 'SENT'), true);
  assert.equal(shouldApplyStatus('SENT', 'FAILED'), true);
  assert.equal(shouldApplyStatus('READ', 'FAILED'), false);
});

test('status ordering: result is independent of arrival order for FAILED vs DELIVERED/READ', () => {
  // DELIVERED then FAILED → stays DELIVERED; FAILED then DELIVERED must also end DELIVERED.
  assert.equal(shouldApplyStatus('DELIVERED', 'FAILED'), false);
  assert.equal(shouldApplyStatus('FAILED', 'DELIVERED'), true);
  assert.equal(shouldApplyStatus('FAILED', 'READ'), true);
  assert.equal(shouldApplyStatus('FAILED', 'SENT'), false); // late SENT must not clear a failure
});

// ---------------------------------------------------------------- handler
function fakeSink(overrides: Partial<AiSensySink> = {}) {
  const logs: InboundLogEntry[] = [];
  const seen = new Set<string>();
  const inbound: any[] = [];
  const sink: AiSensySink = {
    loadSettings: async () => ({ provider: 'AISENSY', projectId: '6ab3d281ead0bf4ba64af375', apiPassword: 'p', webhookSecret: secret, verifyToken: 'tok' }),
    alreadyProcessed: async (id) => seen.has(id),
    markProcessed: async (id) => void seen.add(id),
    log: async (e) => void logs.push(e),
    onInbound: async (e) => (inbound.push(e), 'contact-42'),
    onOutboundEcho: async () => {},
    onStatus: async () => {},
    onContact: async () => {},
    ...overrides,
  };
  return { sink, logs, inbound };
}
const now = (fn: () => Promise<void>) => void fn();

test('handler: happy path acks 200, processes once, logs match', async () => {
  const raw = JSON.stringify(inbound);
  const { sink, logs, inbound: got } = fakeSink();
  const h = { 'x-aisensy-signature': sign(raw), 'x-aisensy-project-id': '6ab3d281ead0bf4ba64af375' };
  const r1 = await handleAiSensyWebhook({ rawBody: raw, headers: h, token: 'tok' }, sink, now);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(r1.status, 200);
  assert.equal(got.length, 1);
  assert.equal(logs.at(-1)?.matchedContactId, 'contact-42');
  // redelivery
  await handleAiSensyWebhook({ rawBody: raw, headers: h, token: 'tok' }, sink, now);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(got.length, 1, 'duplicate must not be processed twice');
  assert.match(String(logs.at(-1)?.error), /duplicate/);
});

test('handler: bad token / bad signature / wrong project → 401 and logged', async () => {
  const raw = JSON.stringify(inbound);
  const { sink, logs } = fakeSink();
  assert.equal((await handleAiSensyWebhook({ rawBody: raw, headers: { 'x-aisensy-signature': sign(raw) }, token: 'nope' }, sink, now)).status, 401);
  assert.equal((await handleAiSensyWebhook({ rawBody: raw, headers: { 'x-aisensy-signature': 'f'.repeat(64) }, token: 'tok' }, sink, now)).status, 401);
  assert.equal((await handleAiSensyWebhook({ rawBody: raw, headers: { 'x-aisensy-signature': sign(raw), 'x-aisensy-project-id': 'other' }, token: 'tok' }, sink, now)).status, 401);
  assert.equal(logs.length, 3);
  assert.ok(logs.every((l) => l.authOk === false));
});

test('handler: provider not AiSensy → 200 no-op (never 410)', async () => {
  const { sink, inbound: got } = fakeSink({ loadSettings: async () => ({ provider: 'WEFLUX' } as any) });
  const r = await handleAiSensyWebhook({ rawBody: '{}', headers: {}, token: null }, sink, now);
  assert.equal(r.status, 200);
  assert.equal(got.length, 0);
});

test('handler: provider not active but delivery verifies → 200, not processed, logged for replay', async () => {
  const raw = JSON.stringify(inbound);
  const settings = { provider: 'WEFLUX', projectId: 'p', apiPassword: 'p', webhookSecret: secret, verifyToken: 'tok' };
  const { sink, logs, inbound: got } = fakeSink({ loadSettings: async () => settings });
  const r = await handleAiSensyWebhook({ rawBody: raw, headers: { 'x-aisensy-signature': sign(raw) }, token: 'tok' }, sink, now);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(r.status, 200);
  assert.equal(got.length, 0);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].authOk, true);
  assert.equal(logs[0].notificationId, 'notif-1');
  assert.match(String(logs[0].error), /not the active provider/);
  // Unverified traffic while inactive: still 200 (never 401 → no AiSensy auto-disable), nothing logged.
  const r2 = await handleAiSensyWebhook({ rawBody: raw, headers: { 'x-aisensy-signature': 'f'.repeat(64) }, token: 'tok' }, sink, now);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(r2.status, 200);
  assert.equal(logs.length, 1);
});

test('handler: two concurrent deliveries of the same id are processed once', async () => {
  const raw = JSON.stringify(inbound);
  const seen = new Set<string>();
  const got: any[] = [];
  // Realistic async store: check and mark each take a tick, so check-then-mark can interleave.
  const tick = () => new Promise((r) => setTimeout(r, 2));
  const { sink, logs } = fakeSink({
    alreadyProcessed: async (id) => (await tick(), seen.has(id)),
    markProcessed: async (id) => { await tick(); seen.add(id); },
    onInbound: async (e) => { await tick(); got.push(e); return 'c'; },
  });
  const h = { 'x-aisensy-signature': sign(raw) };
  const jobs: Promise<void>[] = [];
  const sched = (fn: () => Promise<void>) => void jobs.push(fn());
  await Promise.all([
    handleAiSensyWebhook({ rawBody: raw, headers: h, token: 'tok' }, sink, sched),
    handleAiSensyWebhook({ rawBody: raw, headers: h, token: 'tok' }, sink, sched),
  ]);
  await Promise.all(jobs);
  assert.equal(got.length, 1, 'concurrent duplicate must not reach onInbound twice');
  assert.ok(logs.some((l) => /duplicate/.test(String(l.error))));
});

test('handler: secret / project id with pasted whitespace still verify', async () => {
  const raw = JSON.stringify(inbound);
  const { sink, inbound: got } = fakeSink({
    loadSettings: async () => ({ provider: 'AISENSY', projectId: '6ab3d281ead0bf4ba64af375\n', apiPassword: 'p', webhookSecret: ` ${secret}\n`, verifyToken: 'tok' }),
  });
  const r = await handleAiSensyWebhook({ rawBody: raw, headers: { 'x-aisensy-signature': sign(raw), 'x-aisensy-project-id': '6ab3d281ead0bf4ba64af375' }, token: 'tok' }, sink, now);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(r.status, 200);
  assert.equal(got.length, 1);
});

test('handler: sink failure is logged, still 200 (no retry storm)', async () => {
  const raw = JSON.stringify(inbound);
  const { sink, logs } = fakeSink({ onInbound: async () => { throw new Error('db down'); } });
  const r = await handleAiSensyWebhook({ rawBody: raw, headers: { 'x-aisensy-signature': sign(raw) }, token: 'tok' }, sink, now);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(r.status, 200);
  assert.match(String(logs.at(-1)?.error), /db down/);
});
