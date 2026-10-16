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
    im = im.crop(bb) if bb else im
    # a backdrop box that didn't reach the edge of the picture now does: clear it too (only if it's near-white)
    W, H = im.size
    if Counter(im.getpixel(q)[:3] for q in border(im) if im.getpixel(q)[3]).most_common(1)[:1] and min(Counter(im.getpixel(q)[:3] for q in border(im) if im.getpixel(q)[3]).most_common(1)[0][0]) > 235:
        im = flood_clear(im, border(im), tol)
        bb = im.getbbox()
        im = im.crop(bb) if bb else im
    return im


def keep_main(im):
    """Keep only the largest connected piece (drops detached stray bits), then trim."""
    W, H = im.size
    px, seen, blobs = im.load(), set(), []
    for y in range(H):
        for x in range(W):
            if (x, y) in seen or not px[x, y][3]:
                continue
            blob, q = [], deque([(x, y)])
            while q:
                cx, cy = q.popleft()
                if (cx, cy) in seen or not (0 <= cx < W and 0 <= cy < H) or not px[cx, cy][3]:
                    continue
                seen.add((cx, cy)); blob.append((cx, cy))
                q.extend([(cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1), (cx + 1, cy + 1), (cx - 1, cy - 1), (cx + 1, cy - 1), (cx - 1, cy + 1)])
            blobs.append(blob)
    blobs.sort(key=len)
    for b in blobs[:-1]:
        for q in b:
            px[q] = (0, 0, 0, 0)
    return im.crop(im.getbbox())


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
              5: ("#3a3a44", "#111116"), 6: ("#2f8fd6", "#174a7a"), 7: ("#ff8a3d", "#a23c16"), 8: ("#9c3fd6", "#4a1670"), 9: ("#e2413b", "#6a2bd6"),
              "tower": ("#8a96ad", "#3e4656")}   # the Battle Tower trophy: steel
KEEP_MAIN = {"plant"}   # a stray tuft of grass came along under the pot
HANG = {"cobweb": 56}   # hangs high on the wall: transparent space below it (art pixels)
# The Badge Case came with made-up badges: repaint the velvet with eight empty slots (3 + 3 + 2). The app draws the
# real badges into them; BADGE_SLOTS in src/app.html are these centres after trimming (here minus the 7, 6 margin).
BADGE_SLOTS = [(20, 23), (33, 23), (46, 23), (20, 36), (33, 36), (46, 36), (26.5, 49), (39.5, 49)]


def badge_case(im):
    px = im.load()
    for y in range(16, 56):
        for x in range(14, 52):
            px[x, y] = (142, 4, 28, 255) if (x + y) % 7 or y > 52 else (150, 10, 34, 255)   # a little velvet sheen
    for cx, cy in BADGE_SLOTS:
        for y in range(16, 56):
            for x in range(14, 52):
                d = ((x + .5 - cx - .5) ** 2 + (y + .5 - cy - .5) ** 2) ** .5
                if d <= 5.6:
                    px[x, y] = (96, 0, 18, 255) if d <= 4.6 or y < cy else (184, 40, 64, 255)   # a pressed-in hollow, lit from below
    return im


for p in sorted((RAW / "furn").glob("*.png")):
    im = rgba(p)
    if p.stem == "badgecase":
        im = badge_case(im)
    im = cutout(im)
    if p.stem in KEEP_MAIN:
        im = keep_main(im)
    if p.stem == "cobweb" and im.width > 32:   # one tile wide: trim the outer threads
        x0 = (im.width - 32)//2
        im = im.crop((x0, 0, x0 + 32, im.height))
    if p.stem in HANG:
        c = Image.new("RGBA", (im.width, im.height + HANG[p.stem]), (0, 0, 0, 0))
        c.paste(im, (0, 0))
        im = c
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

# ---------- animated furniture (Retro Diffusion animations, raw/anim/<id>.gif) ----------
# Every frame loses its flat backdrop the same way as the stills; stray specks are dropped; all frames are cropped to
# one shared box. Writes furn/<id>.png (the first frame, used for the Shop and as the still) and anim/<id>.png (the
# frames side by side, each the size of the still).
def drop_specks(im, min_px=4):
    W, H = im.size
    px, seen = im.load(), set()
    for y in range(H):
        for x in range(W):
            if (x, y) in seen or not px[x, y][3]:
                continue
            blob, q = [], deque([(x, y)])
            while q:
                cx, cy = q.popleft()
                if (cx, cy) in seen or not (0 <= cx < W and 0 <= cy < H) or not px[cx, cy][3]:
                    continue
                seen.add((cx, cy)); blob.append((cx, cy))
                q.extend([(cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)])
            pale = all(min(px[b][:3]) > 180 for b in blob)   # leftover bits of the pale backdrop (not honey drops or sparks)
            if len(blob) < min_px or (pale and len(blob) <= 8):
                for b in blob:
                    px[b] = (0, 0, 0, 0)
    return im


from PIL import ImageSequence
for p in sorted((RAW / "anim").glob("*.gif")):
    frames = []
    for f in ImageSequence.Iterator(Image.open(p)):
        im = f.convert("RGBA")
        for _ in range(2):
            im = flood_clear(im, border(im), 40)
        im = flood_clear(im, border(im), 36, ref=(247, 251, 254))   # the animator's pale backdrop, when it survives
        frames.append(drop_specks(im))
    box = None
    for f in frames:
        bb = f.getbbox()
        if bb:
            box = bb if box is None else (min(box[0], bb[0]), min(box[1], bb[1]), max(box[2], bb[2]), max(box[3], bb[3]))
    frames = [f.crop(box) for f in frames]
    w, h = frames[0].size
    sheet = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f, (i * w, 0))
    save(frames[0], f"furn/{p.stem}.png")
    save(sheet, f"anim/{p.stem}.png")

# ---------- badges (for the Badge Cases) ----------
# raw/badge/<g>-<k>.png: the games' badges from PokéAPI's sprite collection (Kanto–Kalos), shrunk to 48 px.
# raw/badge/sheet<g>.png: Retro Diffusion sheets of eight 32 px badges in Gym order for Alola, Galar and Paldea.
for p in sorted((RAW / "badge").glob("*-*.png")):
    im = rgba(p)
    im = im.crop(im.getbbox())
    im.thumbnail((48, 48), Image.LANCZOS)
    save(im, f"badge/{p.stem}.png")
for p in sorted((RAW / "badge").glob("sheet*.png")):
    g, sh = p.stem[5:], rgba(p)
    for k in range(8):
        cell = cutout(sh.crop((k*32, 0, k*32 + 32, 32)))
        save(cell, f"badge/{g}-{k}.png")

# ---------- house fronts (seen from the yards) ----------
# Each raw picture is a repeating piece of roof + front wall. Keep the rows from the ridge to the foundation and make the
# roof taller by repeating one band of tiles, so the house front is exactly as tall as a room (wall + floor, 213 px)
# plus 10 px of roof above. HOUSE_ROWS: ridge row, bottom row, the band of roof rows to repeat, columns to keep.
HOUSE_H = 223
# The cottage was made to repeat; the others are cut where the left and right columns match best (seam()).
HOUSE_ROWS = {"cottage": (47, 210, (110, 130), (0, 256)), "brick": (53, 224, (64, 86), (0, 256)),
              "villa": (33, 224, (54, 86), (0, 256)), "cabin": (50, 208, (62, 82), (62, 226))}


def seam(im, x0, x1, top, bot, min_w=128):
    """The columns a < b (b - a >= min_w) whose pixels match best, so [a, b) repeats with no visible join."""
    px, best = im.load(), None
    for a in range(x0, x1 - min_w):
        for b in range(a + min_w, x1):
            d = sum(abs(px[a, y][i] - px[b, y][i]) for y in range(top, bot, 2) for i in range(3))
            if best is None or d < best[0]:
                best = (d, a, b)
    return best[1], best[2]


for p in sorted((RAW / "house").glob("*.png")):
    top, bot, (b0, b1), (x0, x1) = HOUSE_ROWS[p.stem]
    if p.stem != "cottage":
        x0, x1 = seam(rgba(p), x0, x1, top, bot)
    im = rgba(p).crop((x0, 0, x1, 224))
    parts = [im.crop((0, top, im.width, b1))]
    n = HOUSE_H - (bot - top)
    while n > 0:
        band = im.crop((0, b0, im.width, b0 + min(n, b1 - b0)))
        parts.append(band)
        n -= band.height
    parts.append(im.crop((0, b1, im.width, bot)))
    out = Image.new("RGBA", (im.width, sum(q.height for q in parts)))
    y = 0
    for q in parts:
        out.paste(q, (0, y))
        y += q.height
    save(out, f"house/{p.stem}.png")

# ---------- rooms ----------
R = RAW / "room"
save(rgba(R / "wall_hall.png"), "room/wall_hall.png")
save(rgba(R / "wall_kitchen.png"), "room/wall_kitchen.png")
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

for n in ["win_bedroom", "win_living", "win_hall", "win_kitchen"]:
    im = cutout(rgba(R / f"{n}.png"))
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a and b > 200 and b - r > 60 and g > 140:   # the painted sky in the panes becomes clear glass
                px[x, y] = (0, 0, 0, 0)
    save(im, f"room/{n}.png")

for n in ["back_garden", "back_pond", "back_yard"]:
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
tile = Image.new("RGB", (64, 40))   # the kitchen: cream and sage checks with grout lines
tp = tile.load()
for y in range(40):
    for x in range(64):
        c = (231, 226, 210) if ((x // 16) + (y // 10)) % 2 == 0 else (184, 206, 192)
        if x % 16 == 15 or y % 10 == 9:
            c = (150, 146, 134)                       # grout
        elif x % 16 == 0 or y % 10 == 0:
            c = tuple(min(255, v + 12) for v in c)    # bevel highlight
        tp[x, y] = c
save(tile, "room/floor_tile.png")

# ---------- room dividers ----------
for p in sorted((RAW / "div").glob("*.png")):
    im = rgba(p)
    save(im if p.stem.endswith("_cap") else cutout(im), f"div/{p.stem}.png")

files = sorted(OUT.rglob("*.png"))
print(f"art/2d: {len(files)} images, {sum(f.stat().st_size for f in files)/1024:.0f} KB")
