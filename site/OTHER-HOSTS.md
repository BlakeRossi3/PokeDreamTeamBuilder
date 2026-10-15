# Hosting somewhere other than GitHub Pages

`dist/web/` (made by `python3 scripts/build.py`) is the whole website. It's static files only, so any static host works.

## Put it online (free, about 5 minutes) — Cloudflare Pages
1. Make a free account at https://dash.cloudflare.com/sign-up
2. Go to **Workers & Pages → Create → Pages → Upload assets**.
3. Name the project (for example `dreamteamdex`). That becomes `dreamteamdex.pages.dev`.
4. Drag this whole folder (the one containing `index.html`) onto the upload box and click **Deploy**.

To update later: open the project → **Create deployment** → drag in the new folder.

Netlify works the same way (https://app.netlify.com/drop: drag the folder in).
GitHub Pages also works: push the folder to a repository and turn on Pages; `.nojekyll` is already included.

## Custom domain (optional)
Buy a domain (about $10–15 a year) and add it under the project's **Custom domains** tab.

## What's in here
- `index.html` — the app
- `s/`, `t/` — sprite packs (about 250 MB in total)
- `learnsets.json`, `gifkit.js` — data and the GIF library
- `manifest.webmanifest`, `icons/`, `sw.js` — lets people install it to their home screen and play offline after a first visit
- `og-image.png` — the preview picture shown when the link is shared
- `_headers` — caching rules for Cloudflare Pages and Netlify (ignored elsewhere)

## Saving
Progress is saved in each player's browser. Players move a save between devices with
Account menu → **Download a backup** / **Restore a backup**.

Dream Team Dex is a free, non-profit fan project. Pokémon is © Nintendo, Game Freak, Creatures and The Pokémon Company.
Keep it free and keep the credits (Settings → Credits) in place.
