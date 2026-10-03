// Server-side validation: every quote must be an exact stretch of the supplied text; otherwise it is reported/dropped.
const fold = s => s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s/g, ' ');       // length-preserving
const clean = s => fold(s).replace(/\s+/g, ' ').trim();
export const TOKEN = /\[\[([bkvsBKVS]):\s*([VSvs]\d+)\s*(?:\|([\s\S]*?))?\]\]/g;
export function locate(source, words) {
  const parts = clean(words).replace(/^"+|"+$/g, '').split(/\s*(?:\.{3}|…)\s*/).map(x => x.replace(/^[\s.,;:!?"-]+|[\s.,;:!?…"-]+$/g, '').trim()).filter(Boolean);
  if (parts.length !== 1) return null;   // no ellipsis-joined quotes: dropping words can reverse the meaning
  const f = fold(source); let from = 0; const found = [];
  for (const w of parts) { if (parts.length === 1 ? w.length < 8 : w.split(' ').length < 2) return null; const i = f.indexOf(w, from); if (i < 0) return null; found.push(source.slice(i, i + w.length)); from = i + w.length; }
  return found.join(' … ');
}
// strip one wrapping pair of double quotes; inner double quotes become single (display only)
export function disp(w) {
  w = w.trim();
  if ((w.match(/[“”"]/g) || []).length === 2 && /^[“"]/.test(w) && /[”"][,.]?$/.test(w)) w = w.replace(/^[“"]/, '').replace(/[”"]([,.]?)$/, (m, p) => (p === '.' ? '.' : ''));
  w = w.replace(/“/g, '‘').replace(/”/g, '’').replace(/"/g, "'").replace(/\s+/g, ' ').trim();
  return w.replace(/[,;:]$/, '');
}
const W = s => (fold(s).toLowerCase().match(/[a-z0-9']+/g) || []);
function grams(texts, n = 7) { const g = new Set(); for (const t of texts) { const w = W(t); for (let i = 0; i + n <= w.length; i++) g.add(w.slice(i, i + n).join(' ')); } return g; }
// sentences of plain text that copy 7+ consecutive words from supplied text without a verified quote marker
function smuggled(text, GV, GS) { const bad = []; for (const sent of text.split(/(?<=[.!?])\s+/)) { const w = W(sent); let hit = false; for (let i = 0; i + 7 <= w.length && !hit; i++) if (GS.has(w.slice(i, i + 7).join(' '))) hit = true; for (let i = 0; i + 9 <= w.length && !hit; i++) if (GV.has(w.slice(i, i + 9).join(' '))) hit = true; if (hit) bad.push(sent); } return bad; }
const LINT = [[/\bPastor Kincer (?:also |then |further )?(?:speaks|teaches|emphasizes|stresses|explains|points|reminds|warns|encourages|believes|holds|affirms|sees)\b/, 'do not characterize his teaching in your own words; write "Pastor Kincer says" and let the exact quote speak'],
  [/\b(?:much the same|the same thing|says the same|say the same|agrees? with|in agreement|matches|fits with|echoes?|lines up|consistent with|confirms?)\b/i, 'do not say a sermon agrees with / matches / echoes / confirms a verse'],
  [/\b(?:He|She) (?:also |then |further )?(?:says|said)\b(?=[\s\S]*)/, '__HE__'],
  [/\b(?:Jesus|Paul|Matthew|Mark|Luke|John|Peter|James|Jude|Moses|David|Isaiah|Solomon|Jeremiah|Daniel)\s+(?:also |then |further )?(?:says|said|writes|wrote|tells|told|asks|asked|reminds|declares|adds|warns)\b/, 'do not name the speaker of a Bible quote (write "Scripture says")']];
// returns { paragraphs:[{label, segs}], problems:[...], usedV:[], usedS:[] }
export function check(out, V, S, final = false) {
  const GV = grams(Object.values(V).map(v => v.text), 9), GS = grams(Object.values(S).map(x => x.text), 7);
  const problems = [], usedV = [], usedS = [], paras = []; const none = out.coverage === 'none';
  for (const pg of out.paragraphs || []) {
    const segs = []; let last = 0, text = pg.text || ''; const kSeen = new Set(), sSeen = new Set(); let m; TOKEN.lastIndex = 0;
    const pushText = t => { t = t.replace(/[“”"]/g, '').replace(/\[\[[^\]]*\]\]?/g, ''); for (const b of smuggled(t, GV, GS)) { problems.push(`text copied from the sources outside a quote marker: ${b.slice(0, 100)}`); if (final) t = t.replace(b, ''); } if (t) segs.push({ t: 'text', v: t }); };
    while ((m = TOKEN.exec(text))) {
      pushText(text.slice(last, m.index)); last = m.index + m[0].length; const kind = m[1].toLowerCase(), id = m[2].toUpperCase(); let words = m[3];
      if (kind === 'b' || kind === 'v') {
        const v = V[id]; if (!v) { problems.push(`unknown ${id}`); continue; }
        if (kind === 'v') { segs.push({ t: 'v', vid: id }); if (!usedV.includes(id)) usedV.push(id); continue; }
        const nw = (words || '').trim().split(/\s+/).length;         words = clip(words || '', 40); let q = locate(v.text, words); if (!q && final) q = bestSentence(v.text, words, 45); if (!q) { problems.push(`BSB quote not found in ${id} (${v.ref}): ${String(words).slice(0, 90)}`); trimDangling(segs); segs.push({ t: 'v', vid: id }); if (!usedV.includes(id)) usedV.push(id); continue; }
        segs.push({ t: 'b', v: disp(q), vid: id }); if (!usedV.includes(id)) usedV.push(id);
      } else {
        const s = S[id]; if (!s || none) { problems.push(none ? `sermon marker ${id} used with coverage none` : `unknown ${id}`); continue; }
        if (kind === 'k') { const nw = (words || '').trim().split(/\s+/).length; 
          words = clip(words || '', 50); let q = locate(s.text, words); if (!q && final) q = bestSentence(s.text, words, 55); if (!q) { problems.push(`Kincer quote not found in ${id}: ${String(words).slice(0, 90)}`); trimDangling(segs); continue; }
          segs.push({ t: 'k', v: disp(q), sid: id }); kSeen.add(id); if (!usedS.includes(id)) usedS.push(id); }
        else { segs.push({ t: 's', sid: id }); sSeen.add(id); if (!usedS.includes(id)) usedS.push(id); }
      }
    }
    pushText(text.slice(last));
    for (const [rx, msg] of LINT) { const mm = text.match(rx); if (!mm) continue; if (msg === '__HE__') { if (/\[\[b:/i.test(text)) problems.push(`style: "${mm[0]}": after a Bible quote, write "Pastor Kincer says" or "Scripture says" so it is clear who is speaking`); } else problems.push(`style: "${mm[0]}": ${msg}`); }
    // every sermon quote gets a chip in its paragraph
    for (const id of kSeen) if (!sSeen.has(id)) { const idx = segs.map((x, i) => x.t === 'k' && x.sid === id ? i : -1).filter(i => i >= 0).pop(); segs.splice(idx + 1, 0, { t: 's', sid: id }); }
    for (let i = segs.length - 1; i > 0; i--) if (segs[i].t === 'v' && segs[i - 1].t === 'v' && segs[i].vid === segs[i - 1].vid) segs.splice(i, 1);
    for (let i = 0; i < segs.length; i++) { const g = segs[i]; if (g.t !== 'k' && g.t !== 'b') continue; const prev = segs[i - 1];
      const need = !prev || (prev.t === 'text' && /[.!?]\s*$/.test(prev.v)); if (!need) continue;
      const first = !segs.slice(0, i).some(x => x.t === g.t); segs.splice(i, 0, { t: 'text', v: g.t === 'k' ? (first ? 'Pastor Kincer says: ' : 'He also says: ') : (first ? 'Scripture says: ' : 'It also says: ') }); i++; }
    const joined = segs.map(s => s.t === 'text' ? s.v : '·').join('').trim();
    while (segs.length && segs[0].t === 'v') { segs.shift(); if (segs[0] && segs[0].t === 'text') segs[0].v = segs[0].v.replace(/^[\s.,;:]+/, ''); }
    { const seenV = new Set(); for (let i = 0; i < segs.length; i++) if (segs[i].t === 'v') { if (seenV.has(segs[i].vid)) { segs.splice(i, 1); i--; } else seenV.add(segs[i].vid); } }
    const hasQuote = segs.some(x => x.t === 'b' || x.t === 'k'); const plainLen = segs.filter(x => x.t === 'text').map(x => x.v).join('').trim().length;
    if (!hasQuote && plainLen < 25) { problems.push('paragraph with almost no text'); continue; }
    if (joined || segs.length) paras.push({ label: (pg.label || '').replace(/[“”"]/g, '').slice(0, 80), segs });
  }
  return { paragraphs: paras, problems, usedV, usedS };
}

// Repair: the longest run of consecutive source words shared with the (slightly wrong) quote, returned as exact source text (>=6 words and >=60% of the quote)
export function repair(source, words) {
  const norm = x => x.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']/g, '');
  const qw = words.split(/\s+/).map(norm).filter(Boolean); if (qw.length < 6) return null;
  const toksS = [...source.matchAll(/\S+/g)].map(m => ({ n: norm(m[0]), s: m.index, e: m.index + m[0].length })); let best = { len: 0 };
  for (let i = 0; i < toksS.length; i++) for (let j = 0; j < qw.length; j++) { let k = 0; while (i + k < toksS.length && j + k < qw.length && toksS[i + k].n === qw[j + k]) k++; if (k > best.len) best = { len: k, i }; }
  if (best.len < 5 || best.len < 0.35 * qw.length) return null;
  return source.slice(toksS[best.i].s, toksS[best.i + best.len - 1].e);
}
function clip(words, max) { const w = words.trim().split(/\s+/); if (w.length <= max) return words; const cut = w.slice(0, max).join(' '); const m = cut.match(/^[\s\S]*[.;!?,—]/); return m && m[0].split(/\s+/).length >= 6 ? m[0] : cut; }
function trimDangling(segs) { const last = segs[segs.length - 1]; if (!last || last.t !== 'text') return; const m = last.v.match(/^[\s\S]*[.!?]\s/); if (m) last.v = m[0]; else segs.pop(); }

// Fallback for a quote the model got slightly wrong: use the whole source sentence that best matches it (never a fragment, which could change the meaning)
export function bestSentence(source, words, maxW) {
  const norm = x => x.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']/g, '');
  const qw = new Set(words.split(/\s+/).map(norm).filter(Boolean)); if (qw.size < 4) return null;
  let best = null, bs = 0; for (const m of source.matchAll(/[^.!?]+[.!?]+["”’']*|[^.!?]+$/g)) { const sent = m[0].trim(); const sw = sent.split(/\s+/); if (sw.length > maxW || sw.length < 4) continue;
    const hit = sw.map(norm).filter(x => qw.has(x)).length; const sc = hit / qw.size; if (sc > bs) { bs = sc; best = sent; } }
  return bs >= 0.6 ? best : null;
}
