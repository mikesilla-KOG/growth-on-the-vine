/* Grow on the Vine: Messages & Clips library search (/messages/)
 * Loads assets/data/library.json (built by tools/build_library.py) and filters the static card list as you type.
 * Multi-word AND, case-insensitive, word-start matching, light stemming and typo tolerance; matches titles, descriptions,
 * topics/tags and the full text of every message and clip. Shows a snippet with the match highlighted.
 */
(function () {
  "use strict";
  var script = document.currentScript || document.querySelector("script[data-index]");
  var INDEX_URL = script.getAttribute("data-index");
  var ROOT = script.getAttribute("data-root") || "../";
  var input = document.getElementById("lib-q"), clearBtn = document.getElementById("lib-clear");
  var list = document.getElementById("lib-list"), status = document.getElementById("lib-status");
  var empty = document.getElementById("lib-empty"), emptyQ = document.getElementById("lib-empty-q");
  var chips = Array.prototype.slice.call(document.querySelectorAll(".lib-chip"));
  var form = document.querySelector("#search form") || document.getElementById("search");
  if (!input || !list) return;

  var cards = Array.prototype.slice.call(list.children);       // default order
  var byKey = {};
  cards.forEach(function (li) { byKey[li.getAttribute("data-k") + ":" + li.getAttribute("data-s")] = li; });
  var items = null, filter = "all", vocab = null, fuzzyCache = {};

  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/['\u2019\u2018`]/g, "").replace(/[^a-z0-9]+/g, " ");
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function prep(it) {
    it._t = " " + norm(it.t) + " ";
    it._d = " " + norm(it.d) + " ";
    it._g = " " + norm((it.tg || []).join(" ") + " " + (it.sm || it.ser || "")) + " ";
    it._h = []; it._b = [];
    var all = [it._t, it._d, it._g];
    it.p.forEach(function (p) { var h = " " + norm(p[0]) + " ", b = " " + norm(p[1]) + " "; it._h.push(h); it._b.push(b); all.push(h, b); });
    it._all = all.join("");
  }

  function variants(t) {
    var v = [t], s = t;
    if (s.length > 3 && /ies$/.test(s)) v.push(s.slice(0, -3) + "y");
    if (s.length > 3 && /es$/.test(s)) v.push(s.slice(0, -2));
    if (s.length > 3 && /s$/.test(s)) { s = s.slice(0, -1); v.push(s); }
    if (s.length > 5 && /ing$/.test(s)) v.push(s.slice(0, -3));
    else if (s.length > 4 && /ed$/.test(s)) v.push(s.slice(0, -2));
    if (s.length > 3 && /e$/.test(s)) v.push(s.slice(0, -1));
    return v.filter(function (x, i) { return x && v.indexOf(x) === i; });
  }
  function has(str, vs) { for (var i = 0; i < vs.length; i++) if (str.indexOf(" " + vs[i]) >= 0) return true; return false; }

  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i]; var rowMin = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (rowMin > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }
  function fuzzyVariants(t) {
    if (fuzzyCache[t]) return fuzzyCache[t];
    if (!vocab) {
      var seen = {}; vocab = [];
      items.forEach(function (it) { it._all.split(" ").forEach(function (w) { if (w.length > 3 && !seen[w]) { seen[w] = 1; vocab.push(w); } }); });
    }
    var max = t.length >= 9 ? 2 : 1, out = [];
    vocab.forEach(function (w) { if (lev(t, w, max) <= max || (w.length > t.length && lev(t, w.slice(0, t.length), max) <= max)) out.push(w); });
    return (fuzzyCache[t] = out.slice(0, 12));
  }

  function tokensOf(q) { return norm(q).split(" ").filter(Boolean); }

  function search(q) {
    var toks = tokensOf(q);
    if (!toks.length) return null;
    var tv = toks.map(variants);
    // typo tolerance: a long token that matches nothing anywhere is replaced by close words from the index
    toks.forEach(function (t, i) {
      if (t.length < 5) return;
      var any = items.some(function (it) { return has(it._all, tv[i]); });
      if (!any) tv[i] = fuzzyVariants(t);
    });
    var phrase = toks.length > 1 ? " " + toks.join(" ") : "";
    var res = [];
    items.forEach(function (it, idx) {
      var score = 0, ok = true;
      for (var i = 0; i < toks.length && ok; i++) {
        var vs = tv[i];
        if (!vs.length || !has(it._all, vs)) { ok = false; break; }
        if (has(it._t, vs)) score += 10 + (it._t.indexOf(" " + toks[i] + " ") >= 0 ? 4 : 0);
        if (has(it._g, vs)) score += 6;
        if (has(it._d, vs)) score += 4;
        var hh = 0, bb = 0;
        for (var p = 0; p < it._h.length; p++) { if (has(it._h[p], vs)) hh++; if (has(it._b[p], vs)) bb++; }
        score += Math.min(hh, 3) * 2 + Math.min(bb, 6) * 0.5;
      }
      if (!ok) return;
      if (phrase) {
        if (it._t.indexOf(phrase) >= 0) score += 8;
        if (it._d.indexOf(phrase) >= 0) score += 5;
        for (var p2 = 0; p2 < it._b.length; p2++) if (it._b[p2].indexOf(phrase) >= 0 || it._h[p2].indexOf(phrase) >= 0) { score += 3; break; }
      }
      res.push({ it: it, idx: idx, score: score, tv: tv });
    });
    res.sort(function (a, b) { return b.score - a.score || a.idx - b.idx; });
    return { res: res, tv: tv };
  }

  function wordRx(vs) {
    var parts = vs.map(function (v) { return v.split("").map(reEsc).join("['\u2019\u2018]?"); });
    return new RegExp("(^|[^A-Za-z0-9])(" + parts.join("|") + ")([A-Za-z0-9'\u2019]*)", "gi");
  }
  function highlight(text, rx) {
    if (!rx) return esc(text);
    var out = "", last = 0, m;
    rx.lastIndex = 0;
    while ((m = rx.exec(text))) {
      var start = m.index + m[1].length;
      out += esc(text.slice(last, start)) + "<mark>" + esc(m[2] + m[3]) + "</mark>";
      last = start + m[2].length + m[3].length;
      if (m[0].length === 0) rx.lastIndex++;
    }
    return out + esc(text.slice(last));
  }

  function bestSnippet(r, rxAll) {
    var it = r.it, tv = r.tv, best = null;
    for (var p = 0; p < it.p.length; p++) {
      var hb = it._h[p] + it._b[p], c = 0, hit = 0;
      for (var i = 0; i < tv.length; i++) if (has(hb, tv[i])) c++;
      if (!c) continue;
      for (var j = 0; j < tv.length; j++) if (has(it._b[p], tv[j])) hit++;
      var sc = c * 10 + hit;
      if (!best || sc > best.sc) best = { p: p, sc: sc };
    }
    if (!best) return "";
    var ps = it.p[best.p], head = ps[0] && ps[0] !== "Summary" ? ps[0].split(" — ")[0] : "", body = ps[1] || "";
    var rx = new RegExp(rxAll.source, "gi"), m = null;
    rx.lastIndex = 0; m = rx.exec(body);
    var s, e, pre = "", post = "";
    if (m) {
      var pos = m.index + m[1].length;
      s = Math.max(0, pos - 90); e = Math.min(body.length, pos + 170);
      if (s > 0) { var sp = body.indexOf(" ", s); if (sp > -1 && sp < pos) s = sp + 1; pre = "\u2026"; }
      if (e < body.length) { var sp2 = body.lastIndexOf(" ", e); if (sp2 > pos) e = sp2; post = "\u2026"; }
    } else { s = 0; e = Math.min(body.length, 200); if (e < body.length) { var sp3 = body.lastIndexOf(" ", e); if (sp3 > 0) e = sp3; post = "\u2026"; } }
    var html = "";
    if (head) html += '<span class="lib-snip-h">' + highlight(head, rxAll) + "</span>";
    html += pre + highlight(body.slice(s, e), rxAll) + post;
    if (it.k === "m" && ps[2]) html += ' <a href="' + ROOT + it.u + ps[2] + '">Go to this part \u2192</a>';
    return { h: html, k: ps[3] || "" };
  }

  function setCard(li, it, rxAll, snipHtml) {
    var a = li.querySelector(".lib-title a"), d = li.querySelector(".lib-desc"), sn = li.querySelector(".lib-snip");
    a.innerHTML = rxAll ? highlight(it.t, rxAll) : esc(it.t);
    d.innerHTML = rxAll ? highlight(it.d, rxAll) : esc(it.d);
    if (snipHtml && snipHtml.h) {
      /* kind: s = the preacher's words (amber), b = Bible text (blue), anything else = our own words (gray) */
      var k = snipHtml.k, tag = "";
      if (k === "s") tag = '<span class="vs-tag vs-tag--srm"><span class="vs-ico" aria-hidden="true">\uD83C\uDF99</span>From the sermon</span>';
      else if (k === "b") tag = '<span class="vs-tag vs-tag--scr"><span class="vs-ico" aria-hidden="true">\uD83D\uDCD6</span>Scripture (NKJV)</span>';
      sn.className = "lib-snip" + (k === "s" ? " vs-snip" : k === "b" ? " vs-snip vs-snip--scr" : " vs-own-snip");
      sn.innerHTML = tag + snipHtml.h; sn.hidden = false;
    } else { sn.hidden = true; sn.innerHTML = ""; }
  }

  var FNAME = { all: "messages and clips", m: "full messages", c: "clips" };
  function render() {
    var q = input.value.trim();
    clearBtn.hidden = !input.value;
    var shown = 0, order = cards;
    if (!items) { fallback(q); return; }
    var out = q ? search(q) : null;
    if (!out) {
      cards.forEach(function (li) {
        var it = items[li._i], vis = filter === "all" || it.k === filter;
        li.hidden = !vis; if (vis) shown++;
        setCard(li, it, null, "");
      });
      cards.forEach(function (li) { list.appendChild(li); });
      status.textContent = "Showing " + (filter === "all" ? "all " : "") + shown + " " + FNAME[filter] + ".";
      empty.hidden = true; return;
    }
    var rxAll = wordRx(uniq([].concat.apply([], out.tv)));
    var matched = {};
    out.res.forEach(function (r) {
      var li = byKey[r.it.k + ":" + r.it.s];
      if (!li) return;
      matched[r.it.k + ":" + r.it.s] = 1;
      var vis = filter === "all" || r.it.k === filter;
      li.hidden = !vis;
      if (vis) { shown++; list.appendChild(li); setCard(li, r.it, rxAll, bestSnippet(r, rxAll)); }
    });
    cards.forEach(function (li) { if (!matched[li.getAttribute("data-k") + ":" + li.getAttribute("data-s")]) { li.hidden = true; setCard(li, items[li._i], null, ""); } });
    if (shown) {
      status.textContent = shown + (shown === 1 ? " result" : " results") + " for \u201c" + q + "\u201d" + (filter === "all" ? "." : " in " + FNAME[filter] + ".");
      empty.hidden = true;
    } else {
      status.textContent = "No results for \u201c" + q + "\u201d" + (filter === "all" ? "." : " in " + FNAME[filter] + ".");
      emptyQ.textContent = "\u201c" + q + "\u201d"; empty.hidden = false;
    }
  }
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }

  // no index (fetch failed): plain text filter over the visible cards
  function fallback(q) {
    var toks = tokensOf(q), shown = 0;
    cards.forEach(function (li) {
      var t = " " + norm(li.textContent) + " ", vis = toks.every(function (x) { return t.indexOf(" " + x) >= 0; }) && (filter === "all" || li.getAttribute("data-k") === filter);
      li.hidden = !vis; if (vis) shown++;
    });
    status.textContent = q ? shown + " result(s) for \u201c" + q + "\u201d." : "Showing " + shown + " " + FNAME[filter] + ".";
    empty.hidden = !!shown; emptyQ.textContent = "\u201c" + q + "\u201d";
  }

  function syncUrl() {
    var q = input.value.trim(), u = location.pathname + (q ? "?q=" + encodeURIComponent(q) : "") + location.hash;
    try { history.replaceState(null, "", u); } catch (e) {}
  }
  function focusBox(scroll) {
    input.focus({ preventScroll: !scroll });
    if (scroll) { var box = document.getElementById("search") || form, top = box.getBoundingClientRect().top + window.pageYOffset - 80; window.scrollTo({ top: Math.max(0, top), behavior: "smooth" }); }
    try { var n = input.value.length; input.setSelectionRange(n, n); } catch (e) {}
  }

  input.addEventListener("input", function () { render(); syncUrl(); });
  input.addEventListener("keydown", function (e) { if (e.key === "Escape" && input.value) { input.value = ""; render(); syncUrl(); } });
  form.addEventListener("submit", function (e) { e.preventDefault(); render(); syncUrl(); try { status.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (x) {} });
  clearBtn.addEventListener("click", function () { input.value = ""; render(); syncUrl(); input.focus(); });
  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      filter = c.getAttribute("data-f");
      chips.forEach(function (x) { x.setAttribute("aria-pressed", x === c ? "true" : "false"); });
      render();
    });
  });
  window.addEventListener("hashchange", function () { if (location.hash === "#search") focusBox(true); });
  // nav "Search" link while already on this page
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.target === "_blank") return;
    var u; try { u = new URL(a.href, location.href); } catch (x) { return; }
    if (u.hash === "#search" && u.pathname === location.pathname) { e.preventDefault(); if (location.hash !== "#search") { try { history.replaceState(null, "", location.pathname + location.search + "#search"); } catch (x2) {} } focusBox(true); }
  });

  // start: prefill from ?q=
  var params = new URLSearchParams(location.search), q0 = params.get("q");
  if (q0) input.value = q0.slice(0, 200);
  var wantFocus = !!q0 || location.hash === "#search";
  if (wantFocus) {
    focusBox(true);
    // the browser's own #fragment handling can blur the field after load; focus it again once it has finished
    var again = function () { setTimeout(function () { if (document.activeElement === document.body || document.activeElement === null) focusBox(false); }, 60); };
    if (document.readyState === "complete") again(); else window.addEventListener("load", again);
  }
  render();
  fetch(INDEX_URL).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) {
    items = j.items; items.forEach(prep);
    var pos = {}; items.forEach(function (it, i) { pos[it.k + ":" + it.s] = i; });
    cards.forEach(function (li) { li._i = pos[li.getAttribute("data-k") + ":" + li.getAttribute("data-s")]; });
    // cards without index entry (stale index) stay visible and are not searchable
    cards = cards.filter(function (li) { return li._i !== undefined; });
    render();
  }).catch(function () { /* fallback filter already active */ });
})();
