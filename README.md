# Growth on the Vine — website

Static pilot site for [Growth on the Vine](https://mikesilla-KOG.github.io/growth-on-the-vine/).

Cream / forest-green branding, first clip: **Noise Without Love** (1 Corinthians 13:1).

## Stack

Plain HTML + CSS + a tiny bit of JS. No build step. Repo root = GitHub Pages root.

## Live URL

**https://mikesilla-KOG.github.io/growth-on-the-vine/**

Clip page: **https://mikesilla-KOG.github.io/growth-on-the-vine/clips/noise-without-love/**

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
   - **CNAME** for `www` → `mikesilla-KOG.github.io`
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

## Content notes

- Soft branding; Paul-close hooks (no “talent without love”).
- Clip SEO draft source (monorepo): `pilot/a-more-excellent-way/clips/noise-without-love/page.md`
- Official logo: `assets/img/gotv-official.png`
