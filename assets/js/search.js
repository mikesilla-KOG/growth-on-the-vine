/**
 * Grow on the Vine — client-side clip keyword search
 * Loads assets/data/clips.json, scores title / takeaway / scripture / tags / keywords.
 * Mount: #search-form, #search-input, #search-results, #search-status
 * Optional: script[data-clips] and script[data-root] for path overrides.
 */
(function () {
  "use strict";

  var WEIGHTS = {
    title: 12,
    keyScripture: 10,
    tags: 9,
    keywords: 7,
    keyTakeaway: 6,
    scriptureText: 5,
    sermon: 4,
    phraseBonus: 8
  };

  function scriptEl() {
    return document.currentScript || document.querySelector("script[src*='search.js']");
  }

  function config() {
    var s = scriptEl();
    var root = (s && s.getAttribute("data-root")) || "../";
    if (root && root.slice(-1) !== "/") root += "/";
    var clips = (s && s.getAttribute("data-clips")) || root + "assets/data/clips.json";
    return { root: root, clipsUrl: clips };
  }

  function tokenize(q) {
    return String(q || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s:'-]/gi, " ")
      .split(/\s+/)
      .filter(function (t) {
        return t.length > 0;
      });
  }

  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s:'-]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function fieldHaystack(clip) {
    var tags = Array.isArray(clip.tags) ? clip.tags.join(" ") : "";
    return {
      title: normalize(clip.title),
      keyScripture: normalize(clip.keyScripture),
      tags: normalize(tags),
      keywords: normalize(clip.keywords),
      keyTakeaway: normalize(clip.keyTakeaway),
      scriptureText: normalize(clip.scriptureText),
      sermon: normalize(clip.sermon),
      all: normalize(
        [
          clip.title,
          clip.keyScripture,
          tags,
          clip.keywords,
          clip.keyTakeaway,
          clip.scriptureText,
          clip.sermon
        ].join(" ")
      )
    };
  }

  function tokenIn(hay, token) {
    if (!hay || !token) return false;
    // Word-boundary-ish match; also allow substring for short refs like "13:1"
    if (token.length <= 2) {
      return new RegExp("(^|\\s)" + escapeReg(token) + "(\\s|$)", "i").test(hay);
    }
    return hay.indexOf(token) !== -1;
  }

  function escapeReg(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function scoreClip(clip, tokens, phrase) {
    var fields = fieldHaystack(clip);
    var score = 0;
    var matched = 0;
    var i, t, f, w;

    for (i = 0; i < tokens.length; i++) {
      t = tokens[i];
      var hit = false;
      for (f in WEIGHTS) {
        if (f === "phraseBonus") continue;
        if (tokenIn(fields[f], t)) {
          score += WEIGHTS[f];
          hit = true;
        }
      }
      if (hit) matched++;
    }

    if (matched === 0) return null;

    // Prefer clips that match more of the query
    score += matched * 3;
    if (matched === tokens.length && tokens.length > 1) score += 5;

    if (phrase && phrase.length >= 4 && fields.all.indexOf(phrase) !== -1) {
      score += WEIGHTS.phraseBonus;
    }

    return { clip: clip, score: score, matched: matched };
  }

  function resolveUrl(root, path) {
    if (!path) return root;
    if (/^https?:\/\//i.test(path)) return path;
    if (path.charAt(0) === "/") return path;
    return root + path;
  }

  function snippet(text, maxLen) {
    text = String(text || "").trim();
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - 1).replace(/\s+\S*$/, "") + "…";
  }

  function el(tag, cls, html) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function renderEmpty(status, results, kind) {
    results.innerHTML = "";
    if (kind === "idle") {
      status.textContent = "Try a topic, verse, or keyword — e.g. “clanging cymbal” or “1 Corinthians 13”.";
      status.className = "search-status idle";
      results.appendChild(
        el(
          "div",
          "search-empty",
          "<p class=\"search-empty-title\">Search the vines</p>" +
            "<p>Type what you’re looking for. Results rank by title, Scripture, tags, and keywords.</p>" +
            "<ul class=\"search-suggestions\">" +
            "<li><button type=\"button\" data-q=\"clanging cymbal\">clanging cymbal</button></li>" +
            "<li><button type=\"button\" data-q=\"1 Corinthians 13\">1 Corinthians 13</button></li>" +
            "<li><button type=\"button\" data-q=\"love\">love</button></li>" +
            "<li><button type=\"button\" data-q=\"noise\">noise</button></li>" +
            "</ul>"
        )
      );
      return;
    }
    if (kind === "none") {
      status.textContent = "No clips matched. Try fewer words or a different verse/topic.";
      status.className = "search-status none";
      results.appendChild(
        el(
          "div",
          "search-empty",
          "<p class=\"search-empty-title\">No results</p>" +
            "<p>Nothing in the index matched that search yet. New Shorts are added to the clip index when published.</p>"
        )
      );
      return;
    }
  }

  function renderResults(status, results, ranked, query, root) {
    results.innerHTML = "";
    var n = ranked.length;
    status.textContent =
      n === 1 ? "1 clip for “" + query + "”" : n + " clips for “" + query + "”";
    status.className = "search-status ok";

    var list = el("ul", "search-result-list");
    ranked.forEach(function (item) {
      var c = item.clip;
      var li = el("li", "search-result");
      var card = el("article", "search-result-card");

      var meta = el("div", "search-result-meta");
      if (c.keyScripture) {
        var sc = el("span", "search-chip scripture");
        sc.textContent = c.keyScripture;
        meta.appendChild(sc);
      }
      if (c.sermon) {
        var sm = el("span", "search-chip sermon");
        sm.textContent = c.sermon;
        meta.appendChild(sm);
      }
      card.appendChild(meta);

      var h = el("h2");
      var a = document.createElement("a");
      a.href = resolveUrl(root, c.url);
      a.textContent = c.title || c.slug || "Clip";
      h.appendChild(a);
      card.appendChild(h);

      if (c.keyTakeaway) {
        var p = el("p", "search-result-takeaway");
        p.textContent = snippet(c.keyTakeaway, 160);
        card.appendChild(p);
      }

      if (c.scriptureText || c.keyScripture) {
        var verse = el("p", "search-result-scripture");
        verse.textContent = c.keyScripture
          ? c.keyScripture + (c.scriptureText ? " — " + snippet(c.scriptureText, 120) : "")
          : snippet(c.scriptureText, 140);
        card.appendChild(verse);
      }

      var actions = el("div", "search-result-actions");
      var clipLink = document.createElement("a");
      clipLink.className = "btn";
      clipLink.href = resolveUrl(root, c.url);
      clipLink.textContent = "Open clip →";
      actions.appendChild(clipLink);

      if (c.youtube) {
        var yt = document.createElement("a");
        yt.className = "btn btn-ghost search-yt-chip";
        yt.href = c.youtube;
        yt.rel = "noopener noreferrer";
        yt.target = "_blank";
        yt.textContent = "YouTube ↗";
        actions.appendChild(yt);
      }
      card.appendChild(actions);

      li.appendChild(card);
      list.appendChild(li);
    });
    results.appendChild(list);
  }

  function setQueryInUrl(q) {
    try {
      var url = new URL(window.location.href);
      if (q) url.searchParams.set("q", q);
      else url.searchParams.delete("q");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    } catch (e) {
      /* ignore */
    }
  }

  function runSearch(clips, query, status, results, root) {
    var q = String(query || "").trim();
    if (!q) {
      renderEmpty(status, results, "idle");
      setQueryInUrl("");
      return;
    }
    var tokens = tokenize(q);
    var phrase = normalize(q);
    var ranked = [];
    for (var i = 0; i < clips.length; i++) {
      var scored = scoreClip(clips[i], tokens, phrase);
      if (scored) ranked.push(scored);
    }
    ranked.sort(function (a, b) {
      return b.score - a.score || String(a.clip.title).localeCompare(String(b.clip.title));
    });
    setQueryInUrl(q);
    if (ranked.length === 0) renderEmpty(status, results, "none");
    else renderResults(status, results, ranked, q, root);
  }

  function init() {
    var form = document.getElementById("search-form");
    var input = document.getElementById("search-input");
    var results = document.getElementById("search-results");
    var status = document.getElementById("search-status");
    if (!form || !input || !results || !status) return;

    var cfg = config();
    var clips = [];
    var ready = false;

    status.textContent = "Loading clips…";
    status.className = "search-status idle";

    fetch(cfg.clipsUrl, { credentials: "same-origin" })
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load clips (" + res.status + ")");
        return res.json();
      })
      .then(function (data) {
        clips = Array.isArray(data) ? data : [];
        ready = true;
        var params = new URLSearchParams(window.location.search);
        var initial = params.get("q") || "";
        if (initial) {
          input.value = initial;
          runSearch(clips, initial, status, results, cfg.root);
        } else {
          renderEmpty(status, results, "idle");
        }
      })
      .catch(function (err) {
        status.textContent = "Could not load the clip index. Try refreshing.";
        status.className = "search-status none";
        console.error(err);
      });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!ready) return;
      runSearch(clips, input.value, status, results, cfg.root);
    });

    var debounce;
    input.addEventListener("input", function () {
      if (!ready) return;
      clearTimeout(debounce);
      debounce = setTimeout(function () {
        runSearch(clips, input.value, status, results, cfg.root);
      }, 180);
    });

    results.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-q]");
      if (!btn) return;
      input.value = btn.getAttribute("data-q") || "";
      input.focus();
      if (ready) runSearch(clips, input.value, status, results, cfg.root);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
