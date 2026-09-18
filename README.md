# Growth on the Vine — website

Static pilot site for [Growth on the Vine](https://mikesilla-kog.github.io/growth-on-the-vine/).

Cream / forest-green branding, first clip: **Noise Without Love** (1 Corinthians 13:1).

## Stack

Plain HTML + CSS + a tiny bit of JS. No build step. Repo root = GitHub Pages root.

## Live URL

**https://mikesilla-kog.github.io/growth-on-the-vine/**

Clip page: **https://mikesilla-kog.github.io/growth-on-the-vine/clips/noise-without-love/**

Search: **https://mikesilla-kog.github.io/growth-on-the-vine/search/**

## How it is deployed

1. Source lives in this repository (`mikesilla-KOG/growth-on-the-vine`).
2. GitHub Pages is enabled on branch **`main`**, folder **`/` (root)**.
3. Push to `main` → Pages rebuilds automatically (usually within a minute or two).

```bash
# From this site folder
git add -A
git commit -m "Update site"
git push origin main
```

Enable / check Pages via API (already done once):

```bash
gh api repos/mikesilla-KOG/growth-on-the-vine/pages \
  --method POST \
  -f build_type=legacy \
  -f source[branch]=main \
  -f source[path]=/
# or, if Pages already exists:
gh api repos/mikesilla-KOG/growth-on-the-vine/pages --method PUT \
  -f build_type=legacy \
  -f source[branch]=main \
  -f source[path]=/
```

Status:

```bash
gh api repos/mikesilla-KOG/growth-on-the-vine/pages
```

## Custom domain later (growthonthevine.com)

Do **not** buy or attach the domain until you are ready. When you are:

1. In the repo, add a file named `CNAME` at the **site root** (same level as `index.html`) with one line:

   ```
   growthonthevine.com
   ```

2. In GitHub → Settings → Pages → Custom domain, enter `growthonthevine.com` (and optionally `www.growthonthevine.com`).
3. At your DNS provider, add records GitHub documents (typically):
   - **A** records for apex → GitHub Pages IPs, **or**
   - **CNAME** for `www` → `mikesilla-kog.github.io`
4. Wait for DNS + GitHub HTTPS certificate provisioning.
5. Update absolute URLs in `sitemap.xml`, `robots.txt`, and Open Graph / JSON-LD / canonical tags to `https://growthonthevine.com/...`.

Until then, keep using the `*.github.io` URLs.

## Local preview

Open `index.html` in a browser, or:

```bash
cd /path/to/this/repo
python3 -m http.server 8080
# visit http://localhost:8080/
```


## Clip index + keyword search

Search UI: **https://mikesilla-kog.github.io/growth-on-the-vine/search/**

All search reads one registry: `assets/data/clips.json`.

### Add a clip to the index (when publishing a new Short)

1. Publish the clip page under `clips/<slug>/` as usual.
2. Append **one object** to the array in `assets/data/clips.json` (do not remove existing entries).
3. Fill every field you can; search scores `title`, `keyTakeaway`, `keyScripture`, `scriptureText`, `tags`, `keywords`, and `sermon`.

```json
{
  "id": "your-slug",
  "title": "Your Title",
  "slug": "your-slug",
  "url": "clips/your-slug/",
  "youtube": "https://youtube.com/shorts/VIDEO_ID",
  "sermon": "Source Sermon Title",
  "keyTakeaway": "One or two sentences — the heart of the clip.",
  "keyScripture": "Book Chapter:Verse",
  "scriptureText": "The verse text used on the page.",
  "tags": ["primary tag", "supporting query"],
  "keywords": "space-separated terms people might type",
  "duration": "PT57S",
  "published": "YYYY-MM-DD"
}
```

4. Commit and push `main` — Pages rebuilds; `/search/?q=…` picks up the new entry with no build step.
5. Spot-check: open `/search/?q=` with a tag or verse from the new clip.

Pattern: **every new Short = one new `clips.json` entry.** AI-assisted search comes later; this keyword index is the durable registry.

## Content notes

- Soft branding; Paul-close hooks (no “talent without love”).
- Clip SEO draft source (monorepo): `pilot/a-more-excellent-way/clips/noise-without-love/page.md`
- Official logo: `assets/img/gotv-official.png`
