import { toks, shardOf } from './text.js';
const C = new Map();
export function getJSON(env, path) {
  if (C.has(path)) return C.get(path);
  const p = env.ASSETS.fetch('https://assets.local/' + path).then(r => { if (!r.ok) throw new Error('asset ' + path + ' ' + r.status); return r.json(); });
  C.set(path, p); p.catch(() => C.delete(path)); return p;
}
export async function meta(env) {
  const m = await getJSON(env, 'meta.json');
  if (!m._key) { m._key = new Map(m.ch.map((c, i) => [c[0] * 1000 + c[1], i])); m._starts = m.ch.map(c => c[2]); m._lc = m.books.map(b => b.toLowerCase().replace(/[^a-z0-9]/g, '')); }
  return m;
}
const chapter = (env, i) => getJSON(env, `bible/${i}.json`);
// ---- references
const ALIASES = { ps: 'psalm', psa: 'psalm', psalms: 'psalm', song: 'songofsolomon', sos: 'songofsolomon', songofsongs: 'songofsolomon', canticles: 'songofsolomon', rev: 'revelation', revelations: 'revelation', jn: 'john', mt: 'matthew', mk: 'mark', lk: 'luke', phil: 'philippians', php: 'philippians', phm: 'philemon', jas: 'james', heb: 'hebrews', gal: 'galatians', eph: 'ephesians', col: 'colossians', rom: 'romans', deut: 'deuteronomy', prov: 'proverbs', eccl: 'ecclesiastes', ecc: 'ecclesiastes', isa: 'isaiah', jer: 'jeremiah', ezek: 'ezekiel', dan: 'daniel', zech: 'zechariah' };
function findBook(m, raw) {
  let s = raw.toLowerCase().replace(/[^a-z0-9]/g, ''); s = s.replace(/^(i{1,3})(?=[a-z])/, x => ({ i: '1', ii: '2', iii: '3' }[x]));
  s = s.replace(/^first/, '1').replace(/^second/, '2').replace(/^third/, '3');
  const num = s.match(/^[1-3]/) ? s[0] : '', rest = s.replace(/^[1-3]/, ''); const a = ALIASES[rest] || rest; const name = num + a;
  let hit = m._lc.indexOf(name); if (hit >= 0) return hit;
  const c = []; m._lc.forEach((b, i) => { if (name.length >= 3 && (b.startsWith(name) || (name.startsWith(b) && name.length - b.length <= 1))) c.push(i); });
  return c.length === 1 ? c[0] : (c.length > 1 && name.length >= 4 ? c[0] : -1);
}
export function parseRef(m, str) {
  const r = String(str).replace(/[–—]/g, '-').trim().match(/^([1-3I]{0,3}\s*[A-Za-z][A-Za-z .]*?)\s+(\d{1,3})(?::(\d{1,3})(?:\s*-\s*(\d{1,3}))?)?\s*$/);
  if (!r) return null; const b = findBook(m, r[1]); if (b < 0) return null; if (!r[3]) return null;
  return { b, ch: +r[2], v1: +r[3], v2: r[4] ? +r[4] : +r[3] };
}
// passage = { c: chapterIdx, a, b (inclusive verse indexes in the chapter), why }
export async function passageFromRef(env, m, ref, maxV = 6) {
  const p = typeof ref === 'string' ? parseRef(m, ref) : ref; if (!p) return null;
  const c = m._key.get(p.b * 1000 + p.ch); if (c === undefined) return null; const d = await chapter(env, c);
  const a = d.n.indexOf(p.v1); if (a < 0) return null; let z = a; for (let i = a; i < d.n.length && d.n[i] <= Math.min(p.v2, p.v1 + maxV - 1); i++) z = i;
  return { c, a, b: z };
}
export async function render(env, m, ps) {
  const d = await chapter(env, ps.c); const ch = m.ch[ps.c]; const v1 = d.n[ps.a], v2 = d.n[ps.b];
  return { ref: `${m.books[ch[0]]} ${ch[1]}:${v1}${v2 > v1 ? '-' + v2 : ''}`, text: d.t.slice(ps.a, ps.b + 1).join(' ') };
}
function chapterOf(m, docId) { let lo = 0, hi = m._starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (m._starts[mid] <= docId) lo = mid; else hi = mid - 1; } return lo; }
// ---- BM25 over verses (precomputed weights in shards)
async function lookup(env, prefix, nsh, terms) {
  const need = new Map(); for (const t of terms.keys()) { const s = String(shardOf(t, nsh)).padStart(2, '0'); (need.get(s) || need.set(s, []).get(s)).push(t); }
  const out = new Map(); await Promise.all([...need].map(async ([s, ts]) => { const sh = await getJSON(env, `${prefix}/${s}.json`); for (const t of ts) if (sh[t]) out.set(t, sh[t]); }));
  return out;
}
export async function bibleSearch(env, m, terms, topN = 40) {
  const posts = await lookup(env, 'idx', 64, terms); const sc = new Map();
  for (const [t, [idf, dl, ws]] of posts) { if (ws.length > 7000) continue; const w = terms.get(t) * idf / 100; let id = 0; for (let k = 0; k < ws.length; k++) { id += dl[k]; sc.set(id, (sc.get(id) || 0) + w * ws[k]); } }
  return [...sc].sort((a, b) => b[1] - a[1]).slice(0, topN).map(([id, s]) => ({ id, s }));
}
export async function hitsToPassages(env, m, hits, maxPassages = 8) {
  const pos = hits.map(h => { const c = chapterOf(m, h.id); return { c, i: h.id - m.ch[c][2], s: h.s }; });
  const byC = new Map(); pos.forEach(p => (byC.get(p.c) || byC.set(p.c, []).get(p.c)).push(p));
  const ps = [];
  for (const [c, arr] of byC) { arr.sort((x, y) => x.i - y.i); let cur = null;
    for (const p of arr) { if (cur && p.i - cur.b <= 1 && p.i - cur.a < 3) { cur.b = p.i; cur.s = Math.max(cur.s, p.s) + 0.15 * Math.min(cur.s, p.s); } else { cur = { c, a: p.i, b: p.i, s: p.s }; ps.push(cur); } } }
  return ps.sort((x, y) => y.s - x.s).slice(0, maxPassages);
}
// ---- OpenBible topics
export async function topicPassages(env, m, qSet, plannerTopics, maxTopics = 3, perTopic = 4) {
  const names = await getJSON(env, 'topics/names.json'); const want = new Set(plannerTopics.map(t => t.toLowerCase().trim()));
  const scored = [];
  for (const [n, tk] of names) { const lower = n.toLowerCase(); let sc = 0;
    if (want.has(lower)) sc = 3; else { const ts = tk.split(' ').filter(Boolean); if (ts.length && ts.length <= 3 && ts.every(x => qSet.has(x))) sc = 1 + ts.length * 0.1; }
    if (sc) scored.push([sc, n]); }
  scored.sort((a, b) => b[0] - a[0]); const picked = scored.slice(0, maxTopics).map(x => x[1]);
  const by = new Map(); for (const n of picked) { const s = String(shardOf(n, 32)).padStart(2, '0'); (by.get(s) || by.set(s, []).get(s)).push(n); }
  const res = [];
  for (const [s, ns] of by) { const sh = await getJSON(env, `topics/${s}.json`); for (const n of ns) for (const [b, ch, v1, v2, sc] of (sh[n] || []).slice(0, perTopic)) res.push({ topic: n, p: { b, ch, v1, v2 }, sc }); }
  const out = []; for (const r of res) { const ps = await passageFromRef(env, m, r.p, 4); if (ps) out.push({ ...ps, topic: r.topic, s: r.sc }); }
  return { picked, passages: out };
}
// ---- sermons
const b64 = s => { const bin = atob(s), u = new Int8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i) << 24 >> 24; return u; };
export async function sermonSearch(env, terms, qvec, k = 6) {
  const S = await getJSON(env, 'sermons.json'); const sc = new Map();
  for (const [t, w0] of terms) { const p = S.idx[t]; if (!p) continue; const w = w0 * p[0] / 100; let id = 0; for (let j = 0; j < p[2].length; j++) { id += p[1][j]; sc.set(id, (sc.get(id) || 0) + w * p[2][j]); } }
  const bm = [...sc].sort((a, b) => b[1] - a[1]).slice(0, 15); const rank = new Map(); bm.forEach(([id], r) => rank.set(id, 1 / (60 + r)));
  const dense = []; if (qvec) { const E = await getJSON(env, 'sermons_emb.json'); E.v.forEach((v, id) => { const u = b64(v); let d = 0; for (let j = 0; j < u.length; j++) d += u[j] * qvec[j]; dense.push([id, d / 127]); });
    dense.sort((a, b) => b[1] - a[1]); dense.slice(0, 15).forEach(([id], r) => rank.set(id, (rank.get(id) || 0) + 1 / (60 + r))); }
  const dmap = new Map(dense);
  return [...rank].sort((a, b) => b[1] - a[1]).slice(0, k).map(([id, r]) => ({ doc: S.docs[id], rrf: r, bm25: sc.get(id) || 0, cos: dmap.get(id) ?? null }));
}
export function buildTerms(question, keywords, extra = '') {
  const t = new Map(); const add = (s, w) => { for (const x of toks(s)) t.set(x, Math.max(t.get(x) || 0, w)); };
  add(question, 1); keywords.forEach(k => add(k, 0.8)); if (extra) add(extra, 0.8); return t;
}
