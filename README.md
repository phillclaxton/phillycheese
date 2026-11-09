# phillycheese.nz

A single-page Astro site for **www.phillycheese.nz** — bold retro American diner styling.

## Local development

Requires Node 22.23.4 or newer (`.nvmrc` pins 24).

```
nvm use
npm install
npm run dev
```

## Build

```
npm run build
```

Static output lands in `dist/`. Nothing runs server-side.

## Deploying to Cloudflare

The site deploys as a Worker serving static assets. `wrangler.jsonc` points at
`./dist`, so the output directory is set there rather than in the dashboard.

### Option A — connect the GitHub repo (recommended)

1. Cloudflare dashboard → **Workers & Pages** → **Create application**
2. Choose **GitHub**, authenticate, and pick `phillclaxton/phillycheese`
3. Set **Build command** to `npm run build`. Leave **Deploy command** at its
   default `npx wrangler deploy` — it reads `wrangler.jsonc` for the rest.
4. **Save and Deploy**

The Worker's name in the dashboard must be `phillycheese`, matching `name` in
`wrangler.jsonc`, or builds fail. Pushes to `main` redeploy automatically.

Build settings can be changed later under the Worker's **Settings → Build**.

### Option B — direct upload

```
npm run build
npx wrangler deploy
```

### Custom domains

Under the Worker's **Settings → Domains & Routes → Add → Custom Domain**, add
`phillycheese.nz` and `www.phillycheese.nz` as two separate entries. Cloudflare
creates the DNS records and certificates. The zone must already be active in the
account, and the hostname must not already have a CNAME record.

Custom Domains match one hostname exactly with no wildcards, so a Worker on the
apex does not receive `www` traffic. To serve one and redirect the other, add a
Cloudflare **Redirect Rule** and give the redirected-from hostname a proxied `A`
record pointing at the placeholder `192.0.2.0`.

## Notes

- The whole page lives in `src/pages/index.astro`, styles included.
- Music is a Spotify playlist embed in `src/components/Stereo.astro`. The
  playlist id is the only thing to change if the selections move.
- The iframe is left exactly as Spotify's embed generator emits it, including
  the inline `border-radius` and the `allow` list. Spotify's docs warn that
  editing that markup can drop playback to 30-second previews, so all styling
  lives on the wrapper. Full tracks need the visitor to be signed in to
  Spotify; everyone else hears previews, which the caption says plainly.
- `X-Frame-Options: DENY` in `public/_headers` only stops other sites framing
  this one. It does not affect embedding Spotify here.
- `public/_headers` sets security headers and immutable caching for hashed assets.
- Any unknown path serves `index.html` (`not_found_handling`), since there is
  only one page.
