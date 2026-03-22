/**
 * Smoke test: hits every HTTP endpoint in a realistic order.
 * Run with server already up: npm run test:api
 *
 * Env:
 *   API_BASE_URL   default http://localhost:3000
 *   SKIP_REGISTER  if "1", use TEST_EMAIL + TEST_PASSWORD (login only)
 *   TEST_EMAIL     for SKIP_REGISTER
 *   TEST_PASSWORD  for SKIP_REGISTER
 */
import 'dotenv/config';

const BASE = process.env.API_BASE_URL ?? 'http://localhost:3000';

type Check = { name: string; ok: boolean; detail?: string };

const checks: Check[] = [];

function record(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
  const icon = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function req(
  method: string,
  path: string,
  opts?: {
    token?: string;
    body?: unknown;
    expect?: number | number[];
  }
): Promise<{ status: number; json: unknown }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts?.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let json: unknown = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  const expected = opts?.expect;
  if (expected !== undefined) {
    const list = Array.isArray(expected) ? expected : [expected];
    if (!list.includes(res.status)) {
      throw new Error(`expected status ${list.join('|')}, got ${res.status}: ${text.slice(0, 200)}`);
    }
  }
  return { status: res.status, json };
}

function getData<T>(json: unknown): T {
  const o = json as { success?: boolean; data?: T };
  if (!o?.success || o.data === undefined) throw new Error(`bad response: ${JSON.stringify(json).slice(0, 300)}`);
  return o.data;
}

async function main() {
  console.log(`\nAPI smoke test → ${BASE}\n`);

  try {
    await req('GET', '/health', { expect: 200 });
    record('GET /health (server up)', true);
  } catch (e) {
    record('GET /health', false, String(e));
    console.error('\nStart the API first (e.g. npm start), then run npm run test:api again.\n');
    process.exit(1);
  }

  try {
    const { json } = await req('GET', '/', { expect: 200 });
    record('GET /', Boolean((json as { ok?: boolean }).ok));
  } catch (e) {
    record('GET /', false, String(e));
  }

  let token: string;
  let userEmail: string;

  if (process.env.SKIP_REGISTER === '1') {
    const email = process.env.TEST_EMAIL;
    const password = process.env.TEST_PASSWORD;
    if (!email || !password) {
      console.error('SKIP_REGISTER=1 requires TEST_EMAIL and TEST_PASSWORD');
      process.exit(1);
    }
    try {
      const { status, json } = await req('POST', '/api/auth/login', {
        body: { email, password },
        expect: 200,
      });
      if (status !== 200) throw new Error(String(json));
      token = getData<{ token: string }>(json).token;
      userEmail = email;
      record('POST /api/auth/login (existing user)', true);
    } catch (e) {
      record('POST /api/auth/login', false, String(e));
      process.exit(1);
    }
  } else {
    userEmail = `smoke-${Date.now()}@test.local`;
    const password = 'smoke-test-pass-12';
    try {
      const { json } = await req('POST', '/api/auth/register', {
        body: { email: userEmail, password },
        expect: 201,
      });
      token = getData<{ token: string }>(json).token;
      record('POST /api/auth/register', true, userEmail);
    } catch (e) {
      record('POST /api/auth/register', false, String(e));
      process.exit(1);
    }

    try {
      await req('POST', '/api/auth/login', {
        body: { email: userEmail, password },
        expect: 200,
      });
      record('POST /api/auth/login', true);
    } catch (e) {
      record('POST /api/auth/login', false, String(e));
      process.exit(1);
    }

    try {
      await req('POST', '/api/auth/register', {
        body: { email: userEmail, password },
        expect: 409,
      });
      record('POST /api/auth/register duplicate (expect 409)', true);
    } catch (e) {
      record('POST /api/auth/register duplicate', false, String(e));
    }
  }

  let sessionId: string;
  try {
    const { json } = await req('POST', '/api/sessions', {
      token,
      body: { label: 'smoke-session' },
      expect: 201,
    });
    sessionId = getData<{ sessionId: string }>(json).sessionId;
    record('POST /api/sessions', true, sessionId);
  } catch (e) {
    record('POST /api/sessions', false, String(e));
    process.exit(1);
  }

  try {
    const { json } = await req('GET', '/api/sessions', { token, expect: 200 });
    const list = getData<unknown[]>(json);
    record('GET /api/sessions', Array.isArray(list) && list.length >= 1);
  } catch (e) {
    record('GET /api/sessions', false, String(e));
  }

  try {
    const { json } = await req('GET', `/api/sessions/${sessionId}`, { token, expect: 200 });
    const s = getData<{ sessionId: string }>(json);
    record('GET /api/sessions/:sessionId', s.sessionId === sessionId);
  } catch (e) {
    record('GET /api/sessions/:sessionId', false, String(e));
  }

  try {
    await req('POST', `/api/sessions/${sessionId}/start`, { token, expect: 200 });
    record('POST /api/sessions/:sessionId/start', true);
  } catch (e) {
    record('POST /api/sessions/:sessionId/start', false, String(e));
  }

  try {
    await req('POST', `/api/sessions/${sessionId}/stop`, { token, expect: 200 });
    record('POST /api/sessions/:sessionId/stop', true);
  } catch (e) {
    record('POST /api/sessions/:sessionId/stop', false, String(e));
  }

  try {
    const { status } = await req('POST', `/api/contacts/${sessionId}/sync`, { token });
    const ok = status === 200 || status === 409;
    record(
      'POST /api/contacts/:sessionId/sync',
      ok,
      status === 409 ? '409 SESSION_OFFLINE (expected if WA not linked)' : undefined
    );
  } catch (e) {
    record('POST /api/contacts/:sessionId/sync', false, String(e));
  }

  try {
    const { json } = await req('GET', `/api/contacts/${sessionId}?limit=10&page=1`, {
      token,
      expect: 200,
    });
    const data = getData<{ items: unknown[]; total: number }>(json);
    record('GET /api/contacts/:sessionId', Array.isArray(data.items));
  } catch (e) {
    record('GET /api/contacts/:sessionId', false, String(e));
  }

  const fakeGeminiKey = 'a'.repeat(40);
  try {
    await req('PUT', `/api/sessions/${sessionId}/ai-agent`, {
      token,
      body: {
        geminiApiKey: fakeGeminiKey,
        businessName: 'Smoke Co',
        businessDescription: 'Test business for API smoke.',
        languagePreference: 'en',
        toneOfVoice: 'professional',
        enabled: false,
        modelName: 'gemini-1.5-flash',
      },
      expect: 200,
    });
    record('PUT /api/sessions/:sessionId/ai-agent', true);
  } catch (e) {
    record('PUT /api/sessions/:sessionId/ai-agent', false, String(e));
  }

  try {
    const { json } = await req('GET', `/api/sessions/${sessionId}/ai-agent`, { token, expect: 200 });
    const d = getData<{ sessionPublicId: string; enabled: boolean }>(json);
    record('GET /api/sessions/:sessionId/ai-agent', d.sessionPublicId === sessionId);
  } catch (e) {
    record('GET /api/sessions/:sessionId/ai-agent', false, String(e));
  }

  try {
    const { json } = await req('GET', '/api/ai-agents', { token, expect: 200 });
    record('GET /api/ai-agents', Array.isArray(getData(json)));
  } catch (e) {
    record('GET /api/ai-agents', false, String(e));
  }

  try {
    await req('PATCH', `/api/sessions/${sessionId}/ai-agent`, {
      token,
      body: { enabled: true },
      expect: 200,
    });
    record('PATCH /api/sessions/:sessionId/ai-agent', true);
  } catch (e) {
    record('PATCH /api/sessions/:sessionId/ai-agent', false, String(e));
  }

  try {
    const { status } = await req('POST', `/api/sessions/${sessionId}/send`, {
      token,
      body: { to: '20101234567890', text: 'smoke' },
    });
    const ok = status === 200 || status === 409;
    record(
      'POST /api/sessions/:sessionId/send',
      ok,
      status === 409 ? '409 SESSION_OFFLINE (expected if WA not linked)' : undefined
    );
  } catch (e) {
    record('POST /api/sessions/:sessionId/send', false, String(e));
  }

  try {
    const { json } = await req('GET', `/api/contacts/${sessionId}?limit=5&page=1`, { token, expect: 200 });
    const data = getData<{ items: { id: string }[] }>(json);
    const firstId = data.items[0]?.id;
    if (firstId) {
      await req('DELETE', `/api/contacts/${firstId}`, { token, expect: 200 });
      record('DELETE /api/contacts/:contactId', true);
    } else {
      record('DELETE /api/contacts/:contactId', true, 'skipped (no contacts)');
    }
  } catch (e) {
    record('DELETE /api/contacts/:contactId', false, String(e));
  }

  try {
    await req('DELETE', `/api/sessions/${sessionId}`, { token, expect: 200 });
    record('DELETE /api/sessions/:sessionId (cleanup)', true);
  } catch (e) {
    record('DELETE /api/sessions/:sessionId', false, String(e));
  }

  const passed = checks.filter((c) => c.ok).length;
  const failed = checks.filter((c) => !c.ok).length;
  console.log(`\n── Summary: ${passed} passed, ${failed} failed ──\n`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
