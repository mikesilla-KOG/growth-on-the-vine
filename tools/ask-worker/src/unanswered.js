// Log of questions the Worker could NOT answer from the sermons (only those), plus a read-only admin endpoint.
// Stored in KV namespace UNANSWERED: key "u:<ISO timestamp>:<random>", TTL 1 year. No IP, no headers, no cookies.
// Question text is anonymised (emails / links / phone numbers / @handles removed) and trimmed to 300 chars.

const YEAR = 365 * 86400;
// obvious prompt-injection / jailbreak phrasing: never stored
const INJECT_RX = /(ignore|disregard|forget|override|bypass)\b.{0,40}\b(previous|prior|above|earlier|all|any|your|the)\b.{0,30}\b(instruction|prompt|rule|direction|guideline|command)s?|\b(system|developer|hidden|initial) (prompt|message|instruction)s?|\b(reveal|show|print|repeat|leak)\b.{0,30}\b(prompt|instruction|secret|api[- ]?key|token)s?|jailbreak|developer mode|\bDAN\b|you are now\b|pretend (to be|you are)|act as (an? )?(unrestricted|unfiltered)|\[\[|<\/?(script|system|assistant)|\{\{/i;
const CRISIS_RX2 = /\b988\b|suicid|kill(ing)? myself|self[- ]?harm|end(ing)? my (own )?life|want(ed)? to die/i;

export function anon(q) {
  return String(q).replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]').replace(/https?:\/\/\S+/g, '[link]').replace(/\+?\d[\d\s().-]{6,}\d/g, '[number]').replace(/@\w+/g, '[handle]').slice(0, 300);
}
export function skippable(q) { return INJECT_RX.test(q) || CRISIS_RX2.test(q); }

// Fire-and-forget: never throws, never awaited by the caller except through ctx.waitUntil.
export function logUnanswered(env, ctx, q, reason, top) {
  try {
    if (!env.UNANSWERED || skippable(q)) return;
    const ts = new Date().toISOString();
    const rec = { ts, q: anon(q), reason };
    if (top && top.title) rec.top = { title: String(top.title).slice(0, 120), score: top.score ?? null };
    const key = 'u:' + ts + ':' + crypto.randomUUID().slice(0, 6);
    const p = env.UNANSWERED.put(key, JSON.stringify(rec), { expirationTtl: YEAR }).catch(e => console.log('unanswered log failed:', String(e && e.message || e).slice(0, 100)));
    ctx.waitUntil(p);
  } catch (e) { console.log('unanswered log error:', String(e && e.message || e).slice(0, 100)); }
}

function eq(a, b) { // constant-time string compare
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b); let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] || 0) ^ (y[i] || 0);
  return d === 0;
}
const J = (o, s) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

// GET /admin/unanswered?since=<iso>&after=<key>&limit=<n<=40>   Authorization: Bearer <ADMIN_TOKEN>   (read-only)
export async function adminUnanswered(req, env, url) {
  if (!env.ADMIN_TOKEN || !env.UNANSWERED) return J({ ok: false, error: 'not_found' }, 404);
  const m = /^Bearer (.+)$/.exec(req.headers.get('Authorization') || '');
  if (!m || !eq(m[1], env.ADMIN_TOKEN)) return J({ ok: false, error: 'unauthorized' }, 401);
  if (req.method !== 'GET') return J({ ok: false, error: 'method_not_allowed' }, 405);
  const since = url.searchParams.get('since') || ''; const after = url.searchParams.get('after') || '';
  if (since && isNaN(Date.parse(since))) return J({ ok: false, error: 'bad_since' }, 400);
  const sinceIso = since ? new Date(since).toISOString() : '';
  const limit = Math.max(1, Math.min(40, parseInt(url.searchParams.get('limit') || '40', 10) || 40));
  // keys sort by timestamp; list (<=1000/page, a few pages) then fetch values only for the page we return
  const names = []; let cursor;
  for (let i = 0; i < 10; i++) {
    const r = await env.UNANSWERED.list({ prefix: 'u:', cursor, limit: 1000 });
    for (const k of r.keys) if ((!sinceIso || k.name.slice(2, 26) >= sinceIso) && (!after || k.name > after)) names.push(k.name);
    if (r.list_complete) break; cursor = r.cursor;
  }
  names.sort();
  const page = names.slice(0, limit);
  const vals = await Promise.all(page.map(async k => { try { const v = await env.UNANSWERED.get(k); return v ? { key: k, ...JSON.parse(v) } : null; } catch { return null; } }));
  const items = vals.filter(Boolean);
  return J({ ok: true, count: items.length, more: names.length > page.length, next_after: page.length ? page[page.length - 1] : (after || null), items }, 200);
}
