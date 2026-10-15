#!/usr/bin/env python3
"""Turn the raw Retro Diffusion downloads (art-src/raw/) into the 2D art the app ships (art/2d/).

    python3 art-src/process.py

Needs Pillow. Everything here is free local clean-up: background cut-outs, trimming, the per-region trophy
recolours, clear window glass (the app paints the sky behind it), and two floors drawn from code.
"""
import colorsys, random
from collections import Counter, deque
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW, OUT = ROOT / "art-src" / "raw", ROOT / "art" / "2d"


def rgba(p):
    return Image.open(p).convert("RGBA")


def flood_clear(im, seeds, tol, ref=None):
    """Make border-connected pixels close to the reference colour transparent."""
    W, H = im.size
    px = im.load()
    if ref is None:
        ref = Counter(px[x, y][:3] for x, y in seeds if px[x, y][3]).most_common(1)
        if not ref:
            return im
        ref = ref[0][0]
    seen, q = set(), deque(seeds)
    while q:
        x, y = q.popleft()
        if (x, y) in seen or not (0 <= x < W and 0 <= y < H):
            continue
        seen.add((x, y))
        r, g, b, a = px[x, y]
        if a and abs(r - ref[0]) + abs(g - ref[1]) + abs(b - ref[2]) > tol:
            continue
        px[x, y] = (0, 0, 0, 0)
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    return im


def border(im):
    W, H = im.size
    return [(x, 0) for x in range(W)] + [(x, H - 1) for x in range(W)] + [(0, y) for y in range(H)] + [(W - 1, y) for y in range(H)]


def cutout(im, tol=48, passes=2):
    """Clear leftover flat backdrops the generator's own background removal missed, then trim."""
    for _ in range(passes):
        im = flood_clear(im, border(im), tol)
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def save(im, rel):
    p = OUT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    if im.mode == "RGBA" and im.getextrema()[3][0] == 255:
        im = im.convert("RGB")
    im.save(p, optimize=True)


def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


# ---------- Hall of Fame ----------
for p in sorted((RAW / "hof").glob("*.png")):
    im = Image.open(p).convert("RGB")
    if p.stem.startswith("cave"):   # thin cyan lines down both edges
        px = im.load()
        for y in range(im.height):
            px[0, y] = px[1, y] = px[2, y]
            px[im.width - 1, y] = px[im.width - 2, y] = px[im.width - 3, y]
    save(im, f"hof/{p.stem}.png")

# ---------- furniture ----------
REGION_COL = {1: ("#d8423a", "#7a1a14"), 2: ("#c9a227", "#6b5310"), 3: ("#2f9e62", "#164e33"), 4: ("#5b6fd6", "#25307a"),
              5: ("#3a3a44", "#111116"), 6: ("#2f8fd6", "#174a7a"), 7: ("#ff8a3d", "#a23c16"), 8: ("#9c3fd6", "#4a1670"), 9: ("#e2413b", "#6a2bd6")}
for p in sorted((RAW / "furn").glob("*.png")):
    im = cutout(rgba(p))
    if p.stem != "trophy":
        save(im, f"furn/{p.stem}.png")
        continue
    # the trophy's red plinth takes each region's colours; the gold cup stays gold
    for g, (main, dark) in REGION_COL.items():
        t = im.copy()
        px = t.load()
        hm, hd = colorsys.rgb_to_hsv(*[c / 255 for c in hexrgb(main)]), colorsys.rgb_to_hsv(*[c / 255 for c in hexrgb(dark)])
        for y in range(t.height):
            for x in range(t.width):
                r, gg, b, a = px[x, y]
                if not a:
                    continue
                h, s, v = colorsys.rgb_to_hsv(r / 255, gg / 255, b / 255)
                if s > .35 and (h < .045 or h > .95) and v > .2:   # red, not the orange-gold of the cup
                    k = min(1, v / .85)
                    nh, ns, nv = hm[0], hm[1], hd[2] + (hm[2] - hd[2])*k
                    rr, ng, nb = colorsys.hsv_to_rgb(nh, ns, nv)
                    px[x, y] = (int(rr*255), int(ng*255), int(nb*255), a)
        save(t, f"furn/trophy{g}.png")

# ---------- rooms ----------
R = RAW / "room"
save(rgba(R / "wall_hall.png"), "room/wall_hall.png")
save(rgba(R / "wall_bedroom.png"), "room/wall_bedroom.png")
# the living-room wall came with a strip of floor at the bottom: keep the wall, rebuild the baseboard
lv = rgba(R / "wall_living.png")
wall = Image.new("RGBA", (128, 84))
wall.paste(lv.crop((0, 0, 128, 8)), (0, 0))                       # crown molding
paper = lv.crop((0, 8, 128, 44))
for y in range(8, 59, 36):
    wall.paste(paper, (0, y))                                     # wallpaper, a little taller
wall.paste(lv.crop((0, 44, 128, 61)), (0, 59))                    # wainscot + chair rail
wpx = wall.load()
for x in range(128):
    wpx[x, 76] = (178, 193, 206, 255)
    for y in range(77, 84):
        wpx[x, y] = (246, 248, 250, 255) if y < 82 else (150, 160, 172, 255)
save(wall, "room/wall_living.png")

for n in ["win_bedroom", "win_living", "win_hall"]:
    im = cutout(rgba(R / f"{n}.png"))
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a and b > 200 and b - r > 60 and g > 140:   # the painted sky in the panes becomes clear glass
                px[x, y] = (0, 0, 0, 0)
    save(im, f"room/{n}.png")

for n in ["back_garden", "back_pond"]:
    im = rgba(R / f"{n}.png")
    W = im.width
    im = flood_clear(im, [(x, 0) for x in range(W)], 40)   # the sky above the hedge/reeds is see-through
    save(im, f"room/{n}.png")

save(cutout(rgba(R / "pond.png")), "room/pond.png")
save(rgba(R / "floor_grass.png"), "room/floor_grass.png")
save(rgba(R / "floor_marble.png"), "room/floor_marble.png")

# wood and carpet: drawn here so they repeat perfectly
rnd = random.Random(7)
wood = Image.new("RGB", (64, 40))
wp = wood.load()
tones = [(200, 148, 94), (189, 135, 82), (206, 156, 101), (194, 141, 88)]
for row in range(4):                 # four boards per tile, 10px each, joints staggered
    base = tones[row]
    joint = (row*23 + 9) % 64
    for y in range(row*10, row*10 + 10):
        for x in range(64):
            c = base
            if y == row*10:
                c = (122, 78, 44)                     # seam between boards
            elif y == row*10 + 1:
                c = tuple(min(255, v + 14) for v in base)   # top highlight
            elif x == joint:
                c = (130, 84, 48)                     # end joint
            elif (x*7 + y*3 + row*11) % 23 == 0:
                c = tuple(v - 18 for v in base)       # grain fleck
            wp[x, y] = c
save(wood, "room/floor_wood.png")
carpet = Image.new("RGB", (64, 40))
cp = carpet.load()
for y in range(40):
    for x in range(64):
        c = (111, 146, 205)
        if (x + y) % 2 == 0 and (x // 2 + y) % 3 == 0:
            c = (104, 138, 196)                       # pile texture
        if (x % 16, y % 10) in [(8, 5), (7, 5), (9, 5), (8, 4), (8, 6)]:
            c = (156, 186, 232)                       # small light diamond
        cp[x, y] = c
save(carpet, "room/floor_carpet.png")

# ---------- room dividers ----------
for p in sorted((RAW / "div").glob("*.png")):
    im = rgba(p)
    save(im if p.stem.endswith("_cap") else cutout(im), f"div/{p.stem}.png")

files = sorted(OUT.rglob("*.png"))
print(f"art/2d: {len(files)} images, {sum(f.stat().st_size for f in files)/1024:.0f} KB")
