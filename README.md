# FridaySnack site (fridaysnack.vercel.app)

Static site for **FridaySnack**, a one-person studio shipping snack-sized apps.
Plain HTML + one CSS file + a few small vanilla JS files. No build step, no npm, no frameworks.

## Structure

```
/
├── index.html                  Brand home: intro, apps grid, contact
├── 404.html                    Not-found page (Vercel serves it automatically)
├── favicon.svg                 Brand mark (bitten cookie)
├── robots.txt
├── sitemap.xml
├── vercel.json                 cleanUrls + trailingSlash + security headers
├── assets/
│   ├── site.css                The only stylesheet (light/dark tokens on :root, sticker look)
│   ├── site.js                 KO/EN toggle + App Store URL constants (every page, in <head>)
│   ├── home.js                 Home toys: bite-able cookie, snack parallax, card wave, oven timer (defer)
│   ├── apple-touch-icon.png    Brand mark, 180x180
│   └── og-fridaysnack.png      Open Graph image for the home page (1200x630)
└── mocoder/
    ├── index.html              App page            -> /mocoder/
    ├── demo.js                 "Try it" mini theremin (Web Audio + canvas, defer)
    ├── privacy/index.html      Privacy policy      -> /mocoder/privacy/  (URL given to Apple)
    ├── support/index.html      Support + FAQ       -> /mocoder/support/  (URL given to Apple)
    ├── icon-512.png            App icon (hero, og:image)
    ├── icon-256.png            App icon (cards, favicon)
    └── apple-touch-icon.png    App icon, 180x180
```

Every page lives at `<folder>/index.html`, and every internal link uses the
trailing-slash form (`/mocoder/privacy/`). `vercel.json` sets
`"trailingSlash": true` to match, so `/mocoder/privacy` redirects to
`/mocoder/privacy/`.

## Languages (KO / EN)

Each piece of text exists twice, side by side:

```html
<span class="l-en" lang="en">Support</span><span class="l-ko" lang="ko">지원</span>
<p class="l-en" lang="en">…</p>
<p class="l-ko" lang="ko">…</p>
```

- With JS, `assets/site.js` sets `<html data-lang="en|ko">` before first paint
  (saved choice in `localStorage` key `fs-lang`, else `navigator.language`),
  and CSS hides the other language. The header button toggles it.
- Without JS, both languages are shown (English first) and the toggle is hidden.
- Korean page titles come from `data-title-ko` on `<html>`.

Always add both `l-en` and `l-ko` versions, and put the matching `lang` attribute on each.

## App Store link placeholder

The App Store URL lives in **one place**: `APP_STORE_URLS` at the top of
`assets/site.js`.

```js
var APP_STORE_URLS = {
  mocoder: '', // e.g. 'https://apps.apple.com/app/id0000000000'
};
```

While the value is `''`, every element with `data-appstore="mocoder"` shows the
"Coming soon to the App Store" state. Once it is set, the script swaps those
elements for real "Download on the App Store" links.

When the app is live, also:
- change the `Coming soon` pill on the Mocoder card in `/index.html` to e.g.
  `Available` / `출시`;
- optionally hard-code the link in `mocoder/index.html` so it also works
  without JS (replace the `<span class="store-btn store-btn--soon" …>` with an `<a class="store-btn" href="…">`).

## Adding a new app

1. Create `/<app>/index.html` by copying `mocoder/index.html`. Update the
   `<title>`, `data-title-ko`, description, canonical and `og:*` URLs, icon
   paths, and copy. Keep the header/footer markup.
2. Add icons to `/<app>/` (`icon-512.png`, `icon-256.png`,
   `apple-touch-icon.png`). On macOS: `sips -Z 512 icon.png --out <app>/icon-512.png`.
3. If the app needs them, copy `mocoder/privacy/` and `mocoder/support/` to
   `/<app>/privacy/` and `/<app>/support/`.
4. In `/index.html`, copy the `<li class="app-card">` block in the apps grid
   (the comment marks it) and point it at the new page. Keep the "Next snack"
   card last, or remove it.
5. If it will ship to a store, add a key to `APP_STORE_URLS` in
   `assets/site.js` and use `data-appstore="<key>"` on its button.
6. Add the new URLs to `sitemap.xml`.

App-specific colors (like the Mocoder hero) go in `assets/site.css` as a new
block; reuse the shared tokens for everything else.

## Motion and toys

- Each page runs at most one `requestAnimationFrame` loop (`home.js`, `mocoder/demo.js`).
  It stops when its elements are off screen (IntersectionObserver) or the tab is hidden.
  Blocks with `data-anim` get `.is-paused` while off screen, which pauses their CSS animations.
- `prefers-reduced-motion: reduce` turns off drifting, marquee and idle animation;
  clicks, taps and the demo still work.
- `site.js` adds `.js` to `<html>`. Elements with `.js-only` (bite counter, oven timer)
  are hidden without JS; the page still reads fully without it.
- The demo creates its `AudioContext` only on a press or key press, keeps one sine
  oscillator running and gates it with a gain ramp (30 ms in, 80 ms out).

## Preview locally

```sh
python3 -m http.server 8000
# open http://localhost:8000/
```

The local server has no clean-URL rewrites, but folder URLs (`/mocoder/`)
resolve to `index.html` just like on Vercel. `404.html` is only used by Vercel.

## Deploy (Vercel)

Option A — Git import:
1. Push this repo to GitHub/GitLab/Bitbucket.
2. In Vercel: **Add New → Project → Import** the repo.
3. Framework preset: **Other**. Build command: none. Output directory: `.` (root). Deploy.

Option B — CLI, from this folder:
```sh
npx vercel          # first run links/creates the project, deploys a preview
npx vercel --prod   # production deploy
```

### Custom domain (later): fridaysnack.com

1. Vercel project → **Settings → Domains** → add `fridaysnack.com` and
   `www.fridaysnack.com` (set one to redirect to the other; apex is the canonical URL used in the site).
2. At your DNS provider, create the records Vercel shows. Typically:
   - apex `fridaysnack.com`: `A` record → `76.76.21.21`
   - `www`: `CNAME` → `cname.vercel-dns.com`

   (Vercel may show project-specific values; use exactly what the Domains page lists.)
   Alternatively, point the domain's nameservers to Vercel (`ns1.vercel-dns.com`,
   `ns2.vercel-dns.com`) and let Vercel manage DNS.
3. Wait for Vercel to show the domain as valid; HTTPS certificates are issued automatically.
4. If a domain mailbox is set up later, keep its `MX`/`TXT`
   records when changing DNS.

After deploy, check that these URLs return 200 before submitting to App Review:
- https://fridaysnack.vercel.app/mocoder/privacy/
- https://fridaysnack.vercel.app/mocoder/support/

## Rules

- No trackers, analytics, cookies, or third-party scripts. The only external
  request is Google Fonts (Jua + IBM Plex Sans KR).
- The only contact address on the site is fsnack.support@gmail.com.
