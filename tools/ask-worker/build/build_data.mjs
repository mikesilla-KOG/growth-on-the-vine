// Builds worker/public/* (static assets): BSB chapters + BM25 verse index shards + OpenBible topic shards + sermon index + sermon embeddings.
import fs from 'fs'; import path from 'path';
import { toks, shardOf } from '../src/text.js';
const ROOT = path.resolve(new URL('..', import.meta.url).pathname); const PUB = path.join(ROOT, 'public');
const ASK = path.resolve(ROOT, '..'); const REPO = '/workspace/gotv-repo';
const books = JSON.parse(fs.readFileSync(path.join(ROOT, 'build/books.json'))); const bookIdx = Object.fromEntries(books.map((b, i) => [b.name, i])); const osisIdx = Object.fromEntries(books.map((b, i) => [b.osis, i]));
fs.rmSync(PUB, { recursive: true, force: true }); for (const d of ['bible', 'idx', 'topics']) fs.mkdirSync(path.join(PUB, d), { recursive: true });
// ---- BSB
const lines = fs.readFileSync(path.join(ASK, 'bsb/bsb.txt'), 'utf8').split('\n').slice(3).filter(l => l.includes('\t'));
const docs = []; const chapters = []; let cur = null;
for (const l of lines) {
  const [ref, text] = [l.slice(0, l.indexOf('\t')), l.slice(l.indexOf('\t') + 1).trim()]; const m = ref.match(/^(.+?) (\d+):(\d+)$/); const b = bookIdx[m[1]]; if (b === undefined) throw new Error('book ' + m[1]);
  const ch = +m[2], v = +m[3];
  if (!cur || cur.b !== b || cur.ch !== ch) { cur = { b, ch, start: docs.length, n: [], t: [] }; chapters.push(cur); }
  cur.n.push(v); cur.t.push(text); docs.push({ id: docs.length, text });
}
chapters.forEach((c, i) => fs.writeFileSync(path.join(PUB, `bible/${i}.json`), JSON.stringify({ n: c.n, t: c.t })));
fs.writeFileSync(path.join(PUB, 'meta.json'), JSON.stringify({ books: books.map(b => b.name), ch: chapters.map(c => [c.b, c.ch, c.start, c.n.length]), total: docs.length }));
// ---- BM25 verse index (precomputed weights)
function bm25Index(tokDocs) {
  const N = tokDocs.length, df = new Map(), avg = tokDocs.reduce((a, d) => a + d.length, 0) / N, P = new Map(); const k1 = 1.2, b = 0.75;
  tokDocs.forEach(d => new Set(d).forEach(t => df.set(t, (df.get(t) || 0) + 1)));
  tokDocs.forEach((d, i) => { const tf = new Map(); d.forEach(t => tf.set(t, (tf.get(t) || 0) + 1)); tf.forEach((f, t) => { const w = Math.round(100 * f * (k1 + 1) / (f + k1 * (1 - b + b * d.length / avg))); if (!P.has(t)) P.set(t, [[], []]); P.get(t)[0].push(i); P.get(t)[1].push(w); }); });
  const out = {}; for (const [t, [ids, ws]] of P) { const idf = Math.log(1 + (N - df.get(t) + .5) / (df.get(t) + .5)); let prev = 0; out[t] = [Math.round(idf * 100) / 100, ids.map(x => { const d = x - prev; prev = x; return d; }), ws]; }
  return out;
}
const NS = 64; const idx = bm25Index(docs.map(d => toks(d.text)));
const shards = Array.from({ length: NS }, () => ({})); for (const t in idx) shards[shardOf(t, NS)][t] = idx[t];
shards.forEach((s, i) => fs.writeFileSync(path.join(PUB, `idx/${String(i).padStart(2, '0')}.json`), JSON.stringify(s)));
// ---- OpenBible topics (CC-BY; references only)
const T = new Map();
for (const line of fs.readFileSync(path.join(ASK, 'data/topic-scores.txt'), 'utf8').split('\n')) {
  if (!line || line.startsWith('Topic')) continue; const [name, osis, sc] = line.split('\t'); const parts = osis.split('-'); const a = parts[0].split('.'), z = parts[parts.length - 1].split('.');
  if (a.length !== 3 || osisIdx[a[0]] === undefined || z[0] !== a[0]) continue; const ch = +a[1]; let v1 = +a[2], v2 = z[1] === a[1] ? +z[2] : v1 + 3; v2 = Math.min(v2, v1 + 5);
  const n = name.trim(); if (!T.has(n)) T.set(n, []); T.get(n).push([osisIdx[a[0]], ch, v1, v2, +sc]);
}
const NT = 32; const tshards = Array.from({ length: NT }, () => ({})); const names = [];
for (const [n, arr] of T) { arr.sort((x, y) => y[4] - x[4]); tshards[shardOf(n, NT)][n] = arr.slice(0, 14); names.push([n, toks(n).join(' ')]); }
tshards.forEach((s, i) => fs.writeFileSync(path.join(PUB, `topics/${String(i).padStart(2, '0')}.json`), JSON.stringify(s)));
fs.writeFileSync(path.join(PUB, 'topics/names.json'), JSON.stringify(names));
// ---- sermons
const clips = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(REPO, 'assets/data/clips.json'))).map(c => [c.slug, c]));
const sdocs = []; const first = ['saving-a-nation', 'division-part-1', 'division-part-2', 'division-concluded-part-1', 'division-concluded-part-2', 'a-more-excellent-way'];
// all live messages: the original six first (stable ids), then every other messages/*/content.json alphabetically
const order = [...first, ...fs.readdirSync(path.join(REPO, 'messages')).filter(n => !first.includes(n) && fs.existsSync(path.join(REPO, 'messages', n, 'content.json'))).sort()];
for (const slug of order) {
  const d = JSON.parse(fs.readFileSync(path.join(REPO, 'messages', slug, 'content.json'))); const sm = d.sermon;
  for (const c of d.chunks) for (const p of c.paragraphs) sdocs.push({ id: sdocs.length, slug, title: sm.title, sq: c.section_question, sa: c.short_answer, t: p.start_seconds, text: p.text,
    watch: `https://www.youtube.com/watch?v=${sm.video_id}&t=${p.start_seconds}s`, page: c.page_anchor_url, msg: sm.page_url,
    clips: (c.related_clip_pages || []).map(x => ({ title: (clips[x.slug] || x).title, url: x.url })) });
}
const sidx = bm25Index(sdocs.map(d => toks(d.sq + ' ' + d.sq + ' ' + d.sa + ' ' + d.text)));
fs.writeFileSync(path.join(PUB, 'sermons.json'), JSON.stringify({ docs: sdocs, idx: sidx }));
// embeddings (text-embedding-3-small, 512 dims, int8-quantised)
if (process.env.OPENAI_API_KEY && !process.argv.includes('--no-emb')) {
  const DIM = 512, vecs = [];
  for (let i = 0; i < sdocs.length; i += 64) {
    const batch = sdocs.slice(i, i + 64).map(d => (d.sq + '. ' + d.text).slice(0, 2500));
    const r = await fetch('https://api.openai.com/v1/embeddings', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'text-embedding-3-small', input: batch, dimensions: DIM }) });
    if (!r.ok) throw new Error('embeddings ' + r.status); const j = await r.json(); j.data.forEach(x => vecs.push(x.embedding));
  }
  const q = vecs.map(v => { const n = Math.hypot(...v); const i8 = new Int8Array(v.map(x => Math.round(127 * x / n))); return Buffer.from(i8.buffer).toString('base64'); });
  fs.writeFileSync(path.join(PUB, 'sermons_emb.json'), JSON.stringify({ dim: DIM, v: q }));
}
console.log('docs', docs.length, 'chapters', chapters.length, 'topics', T.size, 'sermon paragraphs', sdocs.length);
