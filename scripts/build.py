#!/usr/bin/env python3
"""Build Dream Team Dex.

    python3 scripts/build.py              # -> dist/web/  (the website: index.html + packs, ready for GitHub Pages)
    python3 scripts/build.py --artifact   # also -> dist/artifact/dream-team-dex.html (single-page claude.ai version)

No third-party packages needed. The source of truth is src/app.html; data placeholders like /*DATA*/ in it are
filled from data/ and packs/index.json.
"""
import base64, hashlib, json, os, shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC, DATA, PACKS, SITE, DIST = ROOT / "src", ROOT / "data", ROOT / "packs", ROOT / "site", ROOT / "dist"
ART = ROOT / "art" / "2d"   # 2D pixel art (Hall of Fame backgrounds, Home furniture and rooms), embedded in the page

PLACEHOLDERS = [
    ("DATA", DATA / "data.json"), ("IDX", PACKS / "index.json"), ("TRAINERS", DATA / "trainer_names2.json"),
    ("OLDTRAINERS", DATA / "trainer_names.json"), ("TAGS", DATA / "themes_tags.json"), ("HOFD", DATA / "hofdata.json"),
    ("FORMS", DATA / "forms.json"), ("FE", DATA / "fe.json"), ("MOVES", DATA / "moves_data.json"), ("BALLS", DATA / "balls.json"),
    ("RIVALS", DATA / "rivals.json"), ("ITEMICONS", DATA / "item_icons.json"), ("REWARDS", DATA / "rewards.json"), ("FAMILIES", DATA / "families.json"), ("LEADERS", DATA / "leaders.json"),
]
TITLE = "Dream Team Dex"
DESC = ("Build Pokémon dream teams for every region, battle Gym Leaders, decorate your own Pokémon Home and stage "
        "Hall of Fame scenes, in 2D pixel art or 3D. A free fan project.")


def assemble() -> str:
    """src/app.html + data -> one page (the claude.ai artifact form: no <!doctype>, build id left as a placeholder)."""
    page = (SRC / "app.html").read_text(encoding="utf-8")
    for ph, f in PLACEHOLDERS:
        tag = f"/*{ph}*/"
        assert page.count(tag) == 1, f"{tag} appears {page.count(tag)} times in src/app.html"
        page = page.replace(tag, f.read_text(encoding="utf-8").strip())
    assert page.count("/*ENGINE*/") == 1, "/*ENGINE*/ must appear once in src/app.html"
    page = page.replace("/*ENGINE*/", (SRC / "engine.js").read_text(encoding="utf-8").strip())
    art = {p.relative_to(ART).with_suffix("").as_posix(): "data:image/png;base64," + base64.b64encode(p.read_bytes()).decode()
           for p in sorted(ART.rglob("*.png"))}
    assert art, "art/2d is empty"
    assert page.count("/*ART2D*/") == 1, "/*ART2D*/ must appear once in src/app.html"
    page = page.replace("/*ART2D*/", json.dumps(art, separators=(",", ":")))
    return page


def build_web(page: str) -> None:
    W = DIST / "web"
    h = hashlib.sha1()
    for f in ["index.json", "learnsets.json", "gifkit.js", "items.png"]:
        h.update((PACKS / f).read_bytes())
    h.update(page.encode())
    build = h.hexdigest()[:10]
    assert page.count('"/*BUILD*/"') == 1
    page = page.replace('"/*BUILD*/"', f'"{build}"')
    head = f'''<!doctype html>
<html lang="en">
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="icon" href="icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="icons/icon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="manifest" href="manifest.webmanifest">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Dream Team Dex">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta property="og:type" content="website">
<meta property="og:title" content="{TITLE}">
<meta property="og:description" content="{DESC}">
<meta property="og:image" content="og-image.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{TITLE}">
<meta name="twitter:description" content="{DESC}">
<meta name="twitter:image" content="og-image.png">
<script src="config.js"></script>
'''
    tail = '''
<script>if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));</script>
<noscript><p style="padding:24px;font-family:sans-serif">Dream Team Dex needs JavaScript turned on.</p></noscript>
</html>
'''
    page = page.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
    i = page.index('<style>')
    page = head + page[:i] + '</head>\n<body>\n' + page[i:] + '\n</body>' + tail

    if W.exists():
        shutil.rmtree(W)
    W.mkdir(parents=True)
    (W / "index.html").write_text(page, encoding="utf-8")
    for f in ["gifkit.js", "learnsets.json", "items.png"]:
        shutil.copy(PACKS / f, W / f)
    index = json.loads((PACKS / "index.json").read_text())
    for k in index:
        rel = ("t/" + k[1:] if k[0] == "t" else "s/" + k) + ".wasm"
        (W / rel).parent.mkdir(exist_ok=True)
        shutil.copy(PACKS / rel, W / rel)
    shutil.copytree(SITE / "icons", W / "icons")
    shutil.copy(SITE / "og-image.png", W / "og-image.png")
    # online accounts: the Supabase settings (empty = local saves only) and the vendored client, loaded on demand
    shutil.copy(SITE / "config.js", W / "config.js")
    shutil.copytree(SITE / "vendor", W / "vendor")
    (W / "sw.js").write_text((SITE / "sw.js").read_text().replace("__BUILD__", build))
    json.dump({"name": TITLE, "short_name": "Dream Team", "description": DESC, "start_url": "./", "scope": "./",
               "display": "standalone", "orientation": "any", "background_color": "#0e1729", "theme_color": "#0e1729",
               "icons": [{"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
                         {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png"},
                         {"src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]},
              open(W / "manifest.webmanifest", "w"), indent=1)
    # caching rules for Cloudflare Pages / Netlify (GitHub Pages ignores this file)
    (W / "_headers").write_text('''/s/*
  Cache-Control: public, max-age=31536000, immutable
  Content-Type: application/wasm
/t/*
  Cache-Control: public, max-age=31536000, immutable
  Content-Type: application/wasm
/learnsets.json
  Cache-Control: public, max-age=31536000, immutable
/index.html
  Cache-Control: no-cache
/
  Cache-Control: no-cache
/sw.js
  Cache-Control: no-cache
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
''')
    (W / "robots.txt").write_text("User-agent: *\nAllow: /\n")
    (W / "404.html").write_text('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not found · Dream Team Dex</title><body style="background:#0e1729;color:#fff;font-family:sans-serif;display:grid;place-items:center;min-height:100vh;margin:0"><p>This page doesn’t exist. <a id="home" style="color:#ffd43b" href="/">Back to Dream Team Dex</a></p><script>if (location.hostname.endsWith("github.io")) document.getElementById("home").href = "/" + location.pathname.split("/")[1] + "/";</script>')
    (W / ".nojekyll").write_text("")
    files = [p for p in W.rglob("*") if p.is_file()]
    print(f"dist/web  build {build}  {len(files)} files  {sum(p.stat().st_size for p in files)/1e6:.1f} MB")


def build_artifact(page: str) -> None:
    A = DIST / "artifact"
    A.mkdir(parents=True, exist_ok=True)
    (A / "dream-team-dex.html").write_text(page, encoding="utf-8")
    print(f"dist/artifact/dream-team-dex.html  {len(page)//1024} KB  (publish it with packs/s, packs/t, index.json, learnsets.json, items.png, gifkit.js beside it)")


if __name__ == "__main__":
    page = assemble()
    build_web(page)
    if "--artifact" in sys.argv:
        build_artifact(page)
