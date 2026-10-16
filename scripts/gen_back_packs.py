#!/usr/bin/env python3
"""Build the 3D back-sprite packs (packs/s/3db-*.wasm, 3dbs-*.wasm) and add them to packs/index.json.

    python3 scripts/gen_back_packs.py        # downloads the PokéAPI sprites repo (sparse, ~600 MB) into .cache/

Source: PokéAPI/sprites  sprites/pokemon/other/showdown/back/  (+ back/shiny/): Pokémon Showdown's animated back
sprites, the same renders as the front `3d`/`3ds` packs. The GIFs are copied byte for byte (never resized or
re-encoded). Packs use the same grouping as the front packs (16 per pack, forms in -f*), so `spKey(num, sh, "3db")`
finds them. A shiny back sprite that differs from its normal one only in the colour table is stored as a palette
patch (kind 3), like the 2D shiny packs. Pokémon without a back sprite are left out; the app then mirrors the front.
"""
import json, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache"
PACKS = ROOT / "packs"
SUB = "sprites/pokemon/other/showdown"


def fetch():
    d = CACHE / "pokeapi-sprites"
    if not d.exists():
        CACHE.mkdir(exist_ok=True)
        subprocess.run(["git", "clone", "-q", "--depth", "1", "--filter=blob:none", "--sparse", "https://github.com/PokeAPI/sprites.git", str(d)], check=True)
        subprocess.run(["git", "-C", str(d), "sparse-checkout", "set", "sprites/items", SUB], check=True)
    elif not (d / SUB).exists():
        subprocess.run(["git", "-C", str(d), "sparse-checkout", "add", SUB], check=True)
    return d / SUB


def gct(b):
    """(start, end) of a GIF's global colour table, or None."""
    if len(b) < 13 or b[:3] != b"GIF" or not b[10] & 0x80: return None
    return 13, 13 + 3 * (2 << (b[10] & 7))


def main():
    src = fetch()
    idx = json.loads((PACKS / "index.json").read_text())
    for k in [k for k in idx if k.startswith(("3db-", "3dbs-"))]: del idx[k]
    fronts = {k: [e[0] for e in v] for k, v in idx.items() if k.startswith("3d-")}
    have = missing = patched = 0
    total = 0
    gaps = []
    for fk, ids in fronts.items():
        suffix = fk[3:]   # "5" or "f3"
        for kind_key, folder in (("3db-", src / "back"), ("3dbs-", src / "back" / "shiny")):
            key = kind_key + suffix
            buf, entries = bytearray(), []
            for i in ids:
                p = folder / f"{i}.gif"
                if not p.exists():
                    if kind_key == "3db-": missing += 1; gaps.append(i)
                    continue
                b = p.read_bytes(); kind = 1
                if kind_key == "3dbs-":
                    n = folder.parent / f"{i}.gif"
                    nb = n.read_bytes() if n.exists() else None
                    g = gct(b)
                    if nb and g and len(nb) == len(b) and gct(nb) == g and nb[:g[0]] == b[:g[0]] and nb[g[1]:] == b[g[1]:]:
                        b = b[g[0]:g[1]]; kind = 3; patched += 1
                else:
                    have += 1
                entries.append([i, len(buf), len(b), kind]); buf += b
            if entries:
                (PACKS / "s" / f"{key}.wasm").write_bytes(bytes(buf)); idx[key] = entries; total += len(buf)
    (PACKS / "index.json").write_text(json.dumps(idx, separators=(",", ":")))
    print(f"{have} back sprites, {patched} shiny backs stored as palette patches, {total / 1e6:.1f} MB in 3db/3dbs packs")
    print(f"{missing} without a back sprite (the app mirrors the front): {gaps}")


if __name__ == "__main__":
    sys.exit(main())
