#!/usr/bin/env python3
"""Build the sleeping-sprite packs (packs/s/zz-*.wasm) from PMD Sprite Collab and write docs/pmd-credits.md.

    python3 scripts/gen_sleep_packs.py [path-to-SpriteCollab]   # default: clones it (sparse, ~17 MB) into .cache/

Source: PMD Sprite Collab (github.com/PMDCollab/SpriteCollab), CC BY-NC 4.0. For every species folder
`sprite/<dex4>/` with a Sleep animation, the down-facing row of `Sleep-Anim.png` is cut into its frames (sizes and
durations from `AnimData.xml`) and stored as a small transparent GIF, pixel for pixel (never resized). Packs use the
same grouping as the other Pokémon packs (16 per pack), so `spKey(num, false, "zz")` finds them. Forms and species
without a Sleep animation are left out; the app then falls back to squashing the normal sprite. Needs Pillow.
"""
import io, json, subprocess, sys, xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache"
PACKS = ROOT / "packs"
CH = 16
TICK_MS = 1000 / 60   # AnimData durations are in game frames (60 per second)


def fetch():
    d = CACHE / "spritecollab"
    if not d.exists():
        CACHE.mkdir(exist_ok=True)
        subprocess.run(["git", "clone", "-q", "--filter=blob:none", "--no-checkout", "https://github.com/PMDCollab/SpriteCollab.git", str(d)], check=True)
        subprocess.run(["git", "-C", str(d), "sparse-checkout", "init", "--no-cone"], check=True)
        subprocess.run(["git", "-C", str(d), "sparse-checkout", "set", "--no-cone", "/sprite/*/Sleep-Anim.png", "/sprite/*/AnimData.xml", "/credit_names.txt", "/tracker.json"], check=True)
        subprocess.run(["git", "-C", str(d), "checkout", "-q", "master"], check=True)   # fetches the needed files in one batch
    return d


def sleep_anim(xml_path):
    """(frame width, frame height, [durations]) of the Sleep animation, following CopyOf; None if there is none."""
    anims = {a.findtext("Name"): a for a in ET.parse(xml_path).getroot().iter("Anim")}
    a, seen = anims.get("Sleep"), set()
    while a is not None and a.findtext("CopyOf") and a.findtext("CopyOf") not in seen:
        seen.add(a.findtext("CopyOf")); a = anims.get(a.findtext("CopyOf"))
    if a is None or a.findtext("Name") != "Sleep" or a.find("FrameWidth") is None: return None
    return int(a.findtext("FrameWidth")), int(a.findtext("FrameHeight")), [int(d.text) for d in a.iter("Duration")]


def to_gif(sheet, fw, fh, durs):
    """The first row's frames as a looping GIF with index 0 transparent, colours copied exactly."""
    frames = [sheet.crop((i*fw, 0, i*fw + fw, fh)) for i in range(len(durs))]
    px = lambda f: (tuple(f.tobytes()[i:i + 4]) for i in range(0, f.width*f.height*4, 4))   # RGBA pixels
    cols = {}
    for f in frames:
        for r, g, b, a in px(f):
            if a >= 128 and (r, g, b) not in cols: cols[(r, g, b)] = len(cols) + 1
    if len(cols) > 255: raise ValueError("too many colours")
    pal = [0, 0, 0] + [v for c in cols for v in c]; pal += [0] * (768 - len(pal))
    out = []
    for f in frames:
        p = Image.new("P", f.size); p.putpalette(pal)
        p.putdata([cols[(r, g, b)] if a >= 128 else 0 for r, g, b, a in px(f)]); out.append(p)
    buf = io.BytesIO()
    out[0].save(buf, format="GIF", save_all=True, append_images=out[1:], duration=[max(20, round(d*TICK_MS/10)*10) for d in durs],
                loop=0, disposal=2, transparency=0, optimize=False)
    return buf.getvalue()


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else fetch()
    names = {}
    cn = src / "credit_names.txt"
    if cn.exists():
        for line in cn.read_text(encoding="utf-8").splitlines()[1:]:
            cols = line.split("\t")
            if len(cols) >= 2: names[cols[1]] = cols[0]; names[cols[0]] = cols[0]
    tracker = json.loads((src / "tracker.json").read_text(encoding="utf-8")) if (src / "tracker.json").exists() else {}
    idx = json.loads((PACKS / "index.json").read_text())
    for k in [k for k in idx if k.startswith("zz-")]: del idx[k]
    packs, credits, gaps = {}, [], []
    for n in range(1, 1026):
        d = src / "sprite" / f"{n:04d}"
        xml, png = d / "AnimData.xml", d / "Sleep-Anim.png"
        a = sleep_anim(xml) if xml.exists() else None
        if not a or not png.exists(): gaps.append(n); continue
        fw, fh, durs = a
        sheet = Image.open(png).convert("RGBA")
        if sheet.width < fw*len(durs) or sheet.height < fh: gaps.append(n); continue
        packs.setdefault((n - 1)//CH, []).append((n, to_gif(sheet, fw, fh, durs)))
        t = tracker.get(f"{n:04d}", {}); sc = t.get("sprite_credit") or {}
        who = [names.get(sc.get("primary"), sc.get("primary"))] + [names.get(x, x) for x in sc.get("secondary") or []]
        credits.append((n, t.get("name") or str(n), ", ".join(w for w in who if w) or "PMD Sprite Collab contributors"))
    total = 0
    for k, items in packs.items():
        buf, entries = bytearray(), []
        for n, b in items: entries.append([n, len(buf), len(b), 1]); buf += b
        (PACKS / "s" / f"zz-{k}.wasm").write_bytes(bytes(buf)); idx[f"zz-{k}"] = entries; total += len(buf)
    (PACKS / "index.json").write_text(json.dumps(idx, separators=(",", ":")))
    lines = ["# Sleeping sprites: credits", "",
             "The sleeping Pokémon in the Pokémon Home use the Sleep animation from **PMD Sprite Collab**",
             "(https://github.com/PMDCollab/SpriteCollab), licensed **CC BY-NC 4.0** (non-commercial, with credit).",
             "Thank you to every artist below. Regenerate this file with `python3 scripts/gen_sleep_packs.py`.", "",
             f"{len(credits)} species have a sleeping sprite. Forms, and the species listed at the end, fall back to the normal sprite.", "",
             "| # | Pokémon | Sprite artists |", "|---|---|---|"]
    lines += [f"| {n} | {name} | {who} |" for n, name, who in credits]
    lines += ["", f"## No Sleep animation yet ({len(gaps)})", "", ", ".join(str(g) for g in gaps) or "None.", ""]
    (ROOT / "docs" / "pmd-credits.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"{len(credits)} sleeping sprites, {total/1e3:.0f} KB in {len(packs)} zz packs; {len(gaps)} without: {gaps}")


if __name__ == "__main__":
    sys.exit(main())
