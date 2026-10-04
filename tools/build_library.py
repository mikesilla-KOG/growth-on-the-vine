#!/usr/bin/env python3
"""Build the combined Messages + Clips library for growonthevine.com.

    python3 tools/build_library.py [--repo PATH]        (default: the repo this file lives in)

Reads   messages/<slug>/content.json   (full messages: summary, section questions, transcript paragraphs, scriptures, FAQs)
        assets/data/clips.json + clips/<slug>/index.html   (clips; only clips whose page exists)
Writes  assets/data/library.json       compact search index used by assets/js/library.js
        messages/index.html            the /messages/ library page (static cards for every item, so it works without JS and is crawlable)

Re-runnable and idempotent. publish_clip_page.py calls build(repo) after it adds a clip, so a new clip appears in the list and the
search index automatically.  Default order: full messages first (MESSAGE_ORDER), then clips newest first.
"""
import sys, re, json, html, argparse, datetime
from pathlib import Path

SITE = 'https://growonthevine.com'
MESSAGE_ORDER = ['saving-a-nation', 'division-part-1', 'division-part-2', 'division-concluded-part-1', 'division-concluded-part-2', 'a-more-excellent-way']
NOTICE = 'Scripture taken from the New King James Version®. Copyright © 1982 by Thomas Nelson. Used by permission. All rights reserved.'
E = lambda s: html.escape(str(s), quote=True)


def fmt_date(iso):
    d = datetime.date.fromisoformat(iso)
    return f'{d.strftime("%B")} {d.day}, {d.year}'


def fmt_dur(sec):
    sec = int(round(sec)); return f'{sec // 60}:{sec % 60:02d}'


def iso_dur(s):
    m = re.fullmatch(r'PT(?:(\d+)M)?(?:(\d+)S)?', s or '')
    return int(m.group(1) or 0) * 60 + int(m.group(2) or 0) if m else 0


def trim(t, n):
    t = re.sub(r'\s+', ' ', t).strip()
    if len(t) <= n: return t
    cut = t[:n].rsplit(' ', 1)[0].rstrip(',;:—-')
    return cut + '…'


def tag_text(h):
    h = re.sub(r'<(script|style)\b.*?</\1>', ' ', h, flags=re.S | re.I)
    h = re.sub(r'<br\s*/?>', ' ', h, flags=re.I)
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', h))).strip()


def load_messages(repo):
    out = []
    for p in sorted((repo / 'messages').glob('*/content.json')):
        slug = p.parent.name
        if not (p.parent / 'index.html').exists(): continue
        c = json.load(open(p, encoding='utf-8')); s = c['sermon']
        if s.get('status') != 'live': continue
        ps = [['Summary', s.get('summary', ''), '', 'o']]
        for ch in c.get('chunks', []):
            body = ' '.join(x['text'] for x in ch.get('paragraphs', [])) or ch.get('text', '')
            sc = ' '.join(f"{x['ref']}: {x.get('text_nkjv', '')}" for x in ch.get('scriptures', []))
            anchor = '#' + ch['page_anchor_url'].split('#', 1)[1] if '#' in ch.get('page_anchor_url', '') else ''
            head = ch.get('section_question', '')
            # kind (4th element): o = the site's own words (gray), s = the preacher's words (amber, "From the sermon"), b = Bible text (blue, NKJV)
            if ch.get('short_answer'): ps.append([head, ch['short_answer'], anchor, 'o'])
            ps.append([head, body.strip(), anchor, 's'])
            if sc: ps.append([head, sc, anchor, 'b'])
        for f in c.get('faqs', []):
            anchor = '#' + f['page_anchor_url'].split('#', 1)[1] if '#' in f.get('page_anchor_url', '') else ''
            ps.append([f.get('question', ''), f.get('answer', ''), anchor, 'o'])
        series = ' · '.join(x for x in [s.get('series'), s.get('series_part')] if x)
        out.append({'k': 'm', 's': slug, 'u': f'messages/{slug}/', 't': s['title'], 'd': trim(s.get('summary', ''), 210), 'dt': s['upload_date'],
                    'du': int(s.get('duration_seconds', 0)), 'ser': series, 'tg': ['full message', 'sermon', 'transcript', s.get('series', ''), s.get('series_part', '')],
                    'img': '', 'p': ps})
    rank = {s: i for i, s in enumerate(MESSAGE_ORDER)}
    out.sort(key=lambda m: (rank.get(m['s'], 99), m['s']))
    return out


def load_clips(repo):
    clips = json.load(open(repo / 'assets/data/clips.json', encoding='utf-8'))
    out = []
    for c in clips:
        slug = c['slug']; page = repo / 'clips' / slug / 'index.html'
        if not page.exists(): continue
        h = page.read_text(encoding='utf-8')
        m = re.search(r'<main\b.*?</main>', h, re.S); main = m.group(0) if m else h
        hook = re.search(r'<p class="hook">(.*?)</p>', main, re.S)
        for pat in (r'<h1\b.*?</h1>', r'<h2\b.*?</h2>', r'<p class="full-message">.*?</p>', r'<section class="crossword-section".*?</section>',
                    r'<section[^>]*aria-labelledby="about-clip-heading".*?</section>', r'<div class="video-stage">.*?</div>', r'<p[^>]*>\s*<a class="btn"[^>]*>.*?</a>\s*</p>', r'<ul class="tags">.*?</ul>'):
            main = re.sub(pat, ' ', main, flags=re.S)
        def sect(pat):
            mm = re.search(pat, main, re.S); return tag_text(mm.group(0)) if mm else ''
        a_short = sect(r'<section class="af-short.*?</section>'); a_quotes = sect(r'<section class="af-quotes.*?</section>'); a_scr = sect(r'<section class="af-scripture.*?</section>')
        a_trans = sect(r'<section aria-labelledby="transcript-heading">.*?</section>')
        text = tag_text(main)
        desc = tag_text(hook.group(1)) if hook else (c.get('answer') or c.get('keyTakeaway', ''))
        thumb = f'assets/img/thumbs/{slug}.jpg'
        out.append({'k': 'c', 's': slug, 'u': f'clips/{slug}/', 't': c['title'], 'd': trim(desc, 210), 'dt': c['published'], 'du': iso_dur(c.get('duration')),
                    'sm': c.get('sermon', ''), 'tg': ['clip', 'short video', c.get('keyScripture', '')] + list(c.get('tags', [])),
                    'img': thumb if (repo / thumb).exists() else '',
                    'p': ([[c.get('answer', ''), (c.get('why', '') or a_short), '', 'o'], [c['title'], (a_quotes + ' ' + a_trans).strip(), '', 's'], [c['title'], a_scr, '', 'b']]
                          if a_short and a_scr else [[c.get('keyTakeaway', ''), (text + ' ' + c.get('scriptureText', '')).strip(), '']])})
    out.sort(key=lambda x: (x['dt'], x['s']), reverse=True)
    return out


# ---------------------------------------------------------------- page
def brandbar(rel):
    return (f'<header class="gv-brandbar"><a class="gv-brand" href="{rel}"><img src="{rel}assets/img/gotv-official.png" alt="" width="112" height="112">'
            f'<span class="gv-brand-text">Grow on the Vine<small>Believe, Know, &amp; Grow</small></span></a></header>')


def nav(rel):
    # same icon menu as the home page (home.css .gv-menu); Messages is the current page here
    def a(cls, href, ico, label, cur=False):
        c = ' aria-current="page"' if cur else ''
        return f'<a class="{cls}" href="{href}"{c}><span class="gv-mi" aria-hidden="true">{ico}</span><span class="gv-ml">{label}</span></a>'
    return ('<nav class="gv-menu" aria-label="Primary">' + a('gv-m-home', rel, '🏠', 'Home') + a('gv-m-clips', './', '🎬', 'Messages', True)
            + a('gv-m-ask', f'{rel}ask/', '💬', 'Ask') + a('gv-m-search', f'{rel}messages/#search', '🔍', 'Search') + '</nav>')


def card(it, rel):
    typ = 'Full Message' if it['k'] == 'm' else 'Clip'
    cls = 'm' if it['k'] == 'm' else 'c'
    ico = '📖' if it['k'] == 'm' else '🎬'
    gv = 'gv-tag-full' if it['k'] == 'm' else 'gv-tag-clip'
    when = fmt_date(it['dt']) + (f' · {fmt_dur(it["du"])}' if it['du'] else '')
    if it['img']:
        media = f'<div class="lib-media"><img src="{rel}{it["img"]}" alt="" width="1280" height="720" loading="lazy" decoding="async"><span class="lib-badge">{fmt_dur(it["du"])}</span></div>'
    else:
        media = (f'<div class="lib-media lib-media-msg" aria-hidden="true"><img class="lib-logo" src="{rel}assets/img/gotv-official.png" alt="" width="64" height="64" loading="lazy">'
                 f'<span class="lib-msg-label">Full message</span><span class="lib-msg-series">{E(it.get("ser", ""))}</span></div>')
    from_ = f'<p class="lib-from">From “{E(it["sm"])}”</p>' if it['k'] == 'c' and it.get('sm') else ''
    return (f'<li class="lib-card lib-{cls}" data-k="{it["k"]}" data-s="{E(it["s"])}">{media}<div class="lib-body">'
            f'<div class="lib-meta"><span class="lib-tag lib-tag-{cls} gv-tag {gv}"><span aria-hidden="true">{ico}</span> {typ}</span><span class="lib-when">{E(when)}</span></div>'
            f'<h2 class="lib-title"><a href="{rel}{it["u"]}">{E(it["t"])}</a></h2>{from_}<p class="lib-desc">{E(it["d"])}</p>'
            f'<p class="lib-snip" hidden></p></div></li>')


def page(items):
    rel = '../'
    n_m = sum(1 for i in items if i['k'] == 'm'); n_c = len(items) - n_m
    title = 'Messages & Clips: search every sermon and clip | Grow on the Vine'
    desc = ('Browse and search every full message and short clip from Grow on the Vine. Search titles, topics, Scripture and the actual words '
            'spoken, with links to the exact moment in each video.')
    ld = {'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': 'Messages & Clips', 'url': f'{SITE}/messages/', 'description': desc,
          'mainEntity': {'@type': 'ItemList', 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'url': f'{SITE}/{x["u"]}', 'name': x['t']} for i, x in enumerate(items)]}}
    cards = ''.join(card(x, rel) for x in items)
    return f'''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{E(title)}</title><meta name="description" content="{E(desc)}"><link rel="canonical" href="{SITE}/messages/"><meta name="theme-color" content="#0f2a20"><link rel="icon" type="image/png" sizes="32x32" href="{rel}assets/img/favicon-32.png"><link rel="apple-touch-icon" href="{rel}assets/img/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="Grow on the Vine"><meta property="og:title" content="Messages &amp; Clips | Grow on the Vine"><meta property="og:description" content="{E(desc)}"><meta property="og:url" content="{SITE}/messages/"><meta property="og:image" content="{SITE}/assets/img/gotv-official-og.jpg"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="Messages &amp; Clips | Grow on the Vine"><meta name="twitter:description" content="{E(desc)}"><meta name="twitter:image" content="{SITE}/assets/img/gotv-official-og.jpg"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="{rel}assets/css/styles.css"><link rel="stylesheet" href="{rel}assets/css/library.css"><link rel="stylesheet" href="{rel}assets/css/verse-vs-sermon.css"><link rel="stylesheet" href="{rel}assets/css/home.css"><script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script></head>
<body class="gv-home gv-lib">{brandbar(rel)}{nav(rel)}
<main class="gv-main lib-page">
<section id="search" class="lib-find" aria-labelledby="lib-h1">
<h1 id="lib-h1" class="lib-h1"><span class="lib-h1-ico" aria-hidden="true">🔍</span> Keyword Search - Quick</h1>
<p class="lib-hint">Type a word to find clips and full messages.</p>
<form class="lib-search" role="search" action="./" method="get">
<label class="visually-hidden" for="lib-q">Search messages and clips</label>
<div class="search-box"><input id="lib-q" name="q" type="search" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Try fruit, tongues, baptism, love, Division…" aria-describedby="lib-status"><button type="button" class="btn lib-clear" id="lib-clear" hidden>Clear</button></div>
</form>
<p class="lib-ask">Want an answer to a question? <a href="{rel}ask/">Ask</a></p>
</section>
<div class="lib-chips" role="group" aria-label="Filter by type"><button type="button" class="lib-chip" data-f="all" aria-pressed="true">All <span>{len(items)}</span></button><button type="button" class="lib-chip lib-chip-m" data-f="m" aria-pressed="false"><span aria-hidden="true">📖</span> Full Messages <span>{n_m}</span></button><button type="button" class="lib-chip lib-chip-c" data-f="c" aria-pressed="false"><span aria-hidden="true">🎬</span> Clips <span>{n_c}</span></button></div>
<p id="lib-status" class="lib-status" aria-live="polite">Showing all {len(items)} messages and clips.</p>
<ul id="lib-list" class="lib-grid">{cards}</ul>
<div id="lib-empty" class="lib-empty" hidden><p><strong>No messages or clips match <span id="lib-empty-q"></span>.</strong></p><p>Try a shorter or different word, or <a href="{rel}ask/">have a question? Ask it here</a>.</p></div>
</main>
<footer class="site-footer"><div class="footer-inner"><div><p class="footer-brand">Grow on the Vine</p><p>Messages &amp; clips · Grow on the Vine.</p></div><div><p><a href="{rel}">Home</a> · <a href="./">Messages</a> · <a href="{rel}ask/">Ask</a> · <a href="{rel}messages/#search">Search</a></p></div></div><p class="footer-scripture-notice">{NOTICE}</p></footer>
<script src="{rel}assets/js/library.js" data-index="{rel}assets/data/library.json" data-root="{rel}" defer></script>
</body></html>
'''


def build(repo):
    repo = Path(repo)
    items = load_messages(repo) + load_clips(repo)
    (repo / 'assets/data').mkdir(parents=True, exist_ok=True)
    lib = {'v': 1, 'items': items}
    (repo / 'assets/data/library.json').write_text(json.dumps(lib, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    (repo / 'messages/index.html').write_text(page(items), encoding='utf-8')
    return items


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--repo', default=str(Path(__file__).resolve().parent.parent)); a = ap.parse_args()
    its = build(a.repo)
    print(f'library: {sum(i["k"] == "m" for i in its)} messages + {sum(i["k"] == "c" for i in its)} clips -> assets/data/library.json, messages/index.html')
