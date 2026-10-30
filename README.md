# phillycheese.nz

A single-page Astro site for **www.phillycheese.nz** — bold retro American diner styling.

## Local development

Requires Node 20+ (or 18.20.8+).

```
npm install
npm run dev
```

## Build

```
npm run build
```

Static output lands in `dist/`.

## Deploying to Cloudflare

### Option A — Git-connected (recommended)

Push this repo to GitHub, then in the Cloudflare dashboard create a **Workers & Pages**
project connected to the repo with:

- **Build command:** `npm run build`
- **Output directory:** `dist`

Then add `phillycheese.nz` and `www.phillycheese.nz` as custom domains on the project.

### Option B — Direct upload with Wrangler

```
npx wrangler deploy
```

`wrangler.jsonc` serves `./dist` as static assets. Custom domains are attached in the
dashboard under the Worker's **Settings → Domains & Routes**.

## Notes

- `public/_headers` sets security headers and long-lived caching for hashed assets.
- The whole page lives in `src/pages/index.astro`, styles included.
