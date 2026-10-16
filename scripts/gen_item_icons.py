#!/usr/bin/env python3
"""Build the item icon sheet (packs/items.png) and its map (data/item_icons.json).

    python3 scripts/gen_item_icons.py           # downloads the two sources into .cache/ (git, ~10 MB), needs Pillow

Sources (official in-game bag icons, both MIT-licensed collections; the art itself is © Nintendo / Game Freak):
  1. msikma/pokesprite  items/       Sword/Shield bag icons, 32×32 (preferred: one consistent style)
  2. PokeAPI/sprites    sprites/items  bag icons, 30×30 / 24×24, plus gen8/ and gen9/ folders (fills the gaps)
Every item in data/moves_data.json plus the battle Bag items gets one 32×32 cell. Icons are pasted 1:1 (never scaled),
centred in their cell. The run prints which items have no icon (they show a neutral placeholder in the app).
Run it again whenever items are added to the data.
"""
import json, re, subprocess, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache"
BAG = ["Potion", "Super Potion", "Hyper Potion", "Max Potion", "Full Restore", "Revive", "Max Revive", "Full Heal", "Antidote",
       "Burn Heal", "Ice Heal", "Awakening", "Paralyze Heal", "X Attack", "X Defense", "X Sp. Atk", "X Sp. Def", "X Speed",
       "X Accuracy", "Dire Hit", "Guard Spec."]
CELL, COLS = 32, 24
# Gen 2 names of today's berries (and the Gen 2 Normal boosters) share an icon with their modern versions
ALIAS = {"Berry": "Oran Berry", "Gold Berry": "Sitrus Berry", "PRZ Cure Berry": "Cheri Berry", "PSN Cure Berry": "Pecha Berry",
         "Burnt Berry": "Rawst Berry", "Ice Berry": "Aspear Berry", "Mint Berry": "Chesto Berry", "Bitter Berry": "Persim Berry",
         "Miracle Berry": "Lum Berry", "Mystery Berry": "Leppa Berry", "Pink Bow": "Silk Scarf", "Polkadot Bow": "Silk Scarf"}


def fetch(url, name, path):
    d = CACHE / name
    if not d.exists():
        CACHE.mkdir(exist_ok=True)
        subprocess.run(["git", "clone", "-q", "--depth", "1", "--filter=blob:none", "--sparse", url, str(d)], check=True)
        subprocess.run(["git", "-C", str(d), "sparse-checkout", "set", path], check=True)
    return d / path


def kebab(n):
    return re.sub(r"[^a-z0-9]+", "-", n.lower().replace("'", "").replace("’", "").replace(".", "").replace("é", "e")).strip("-")


def main():
    ps = fetch("https://github.com/msikma/pokesprite.git", "pokesprite", "items")
    pa = fetch("https://github.com/PokeAPI/sprites.git", "pokeapi-sprites", "sprites/items")
    ps_files = {(p.parent.name, p.stem): p for p in ps.glob("*/*.png")}
    ps_by_stem = {}
    for (folder, stem), p in ps_files.items():
        ps_by_stem.setdefault(stem, p)
    data = json.loads((ROOT / "data" / "moves_data.json").read_text())
    names = [i[0] for i in data["ITEMS"]] + BAG

    def candidates(name):
        k = kebab(name)
        words = k.split("-")
        out = []
        if k.endswith("-berry"): out.append(("berry", k[:-6]))
        if k.endswith("-plate"): out.append(("plate", k[:-6]))
        if k.endswith("-gem"): out.append(("gem", k[:-4]))
        if k.endswith("-memory"): out.append(("memory", k[:-7]))
        if k.endswith("-ball"): out.append(("ball", k[:-5] if k != "poke-ball" else "poke"))
        if k.endswith("-incense"): out.append(("incense", k[:-8]))
        if k.endswith("-z"): out.append(("z-crystals", k + "--bag"))
        if k.endswith("-fossil"): out.append(("fossil", k[:-7]))
        if k.startswith("fossilized-"): out.append(("fossil", words[-1]))
        if k.endswith("-sweet"): out.append(("evo-item", k))
        if k.endswith("-mail") or k == "mail": out.append(("mail", k))
        return out

    def find(name):
        name = ALIAS.get(name, name)
        for folder, stem in candidates(name):
            if (folder, stem) in ps_files: return ps_files[(folder, stem)], "pokesprite"
        k = kebab(name)
        if k in ps_by_stem: return ps_by_stem[k], "pokesprite"
        for sub in ["gen9", "gen8", ""]:
            for stem in [k, k + "--bag", {"leek": "stick"}.get(k, k)]:
                p = (pa / sub / f"{stem}.png") if sub else (pa / f"{stem}.png")
                if p.exists(): return p, "pokeapi"
        if k.endswith("-berry") and (pa / "berries" / f"{k}.png").exists(): return pa / "berries" / f"{k}.png", "pokeapi"
        return None, None

    rows = (len(names) + COLS - 1) // COLS
    sheet = Image.new("RGBA", (COLS * CELL, rows * CELL), (0, 0, 0, 0))
    idx, missing, src = {}, [], {"pokesprite": 0, "pokeapi": 0}
    for n, name in enumerate(names):
        p, where = find(name)
        if not p:
            missing.append(name); continue
        im = Image.open(p).convert("RGBA")
        bbox = im.getbbox()
        if bbox: im = im.crop(bbox)
        if im.width > CELL or im.height > CELL: im.thumbnail((CELL, CELL), Image.NEAREST)
        x, y = (n % COLS) * CELL + (CELL - im.width) // 2, (n // COLS) * CELL + (CELL - im.height) // 2
        sheet.paste(im, (x, y), im)
        idx[name] = n; src[where] += 1
    out = ROOT / "packs" / "items.png"
    sheet.save(out, optimize=True)
    (ROOT / "data" / "item_icons.json").write_text(json.dumps({"cell": CELL, "cols": COLS, "rows": rows, "idx": idx}, separators=(",", ":")))
    print(f"{len(idx)} icons ({src['pokesprite']} pokesprite, {src['pokeapi']} PokeAPI) -> packs/items.png ({out.stat().st_size // 1024} KB)")
    print(f"{len(missing)} without an icon: {', '.join(missing)}")


if __name__ == "__main__":
    sys.exit(main())
