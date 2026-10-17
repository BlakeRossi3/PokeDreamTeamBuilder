#!/usr/bin/env python3
"""Build the site, serve dist/web on localhost:8765 and run the tests. Quiet by default: one line per test, and only
the end of a failing test's output. Full logs are in tests/out/logs/.

    pip install playwright && python3 -m playwright install chromium   # once
    npm install                                                         # once (the Node engine tests use @smogon/calc)
    python3 tests/run_all.py                 # everything
    python3 tests/run_all.py home shop       # only these groups (or tests whose file name contains the word)
    python3 tests/run_all.py --quick         # skip the slow whole-site sweeps (audit, layout, a11y, animations)
    python3 tests/run_all.py -j 3            # run 3 tests at a time (default 2)
    python3 tests/run_all.py --no-build      # use the dist/web already built
    python3 tests/run_all.py -v              # print every test's full output

Groups: sweep, home, shop, battle, online, engine. Screenshots land in tests/out/. A test fails if it exits with an
error or reports page errors.
"""
import os, re, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOGS = ROOT / "tests" / "out" / "logs"
SLOW = {"sweep"}
TESTS = [  # (group, file, args)
    ("sweep", "audit.py", []),                                  # every screen, 2D/3D, desktop/phone, sideways scrolling
    ("sweep", "test_layout_lint.py", []),                       # nothing sticking out, clipped, overlapping or wrapping unevenly
    ("sweep", "test_a11y.py", []),                              # axe-core: contrast, labels, ARIA
    ("sweep", "test_battle_anim.py", ["1280", "860"]),          # every move animates in 3D and 2D
    ("shop", "test_shop_home.py", ["1366", "860", "3d"]),       # Shop, Home, Hall of Fame menu, unlocks, gym rewards
    ("shop", "test_shop_home.py", ["390", "844", "2d"]),
    ("shop", "test_save_migration.py", []),                     # old saves: PokéPoints, rewards, locked Poké Balls
    ("shop", "test_rewards.py", ["1366", "860", "3d"]),         # reward table, Shop exclusives, furniture, halls, titles
    ("shop", "test_rewards.py", ["390", "844", "2d"]),
    ("shop", "test_custom_teams.py", []),
    ("shop", "test_sheet.py", ["1280", "860", "3d"]),           # Pokémon sheet: Battle tab, move and item pickers
    ("shop", "test_sheet.py", ["390", "844", "2d"]),
    ("shop", "test_showdown.py", ["390", "844"]),               # Showdown import/export
    ("shop", "test_missions.py", ["3d", "390", "844"]),         # daily missions + login streak
    ("shop", "test_missions.py", ["2d", "1280", "860"]),
    ("battle", "test_battles_and_exports.py", []),              # gyms, Versus, trainer card + GIF export, settings
    ("battle", "test_battle_engine.py", []),
    ("battle", "test_battle_ui.py", ["1280", "860", "3d"]),     # moves + PP, Bag, U-turn, Elite Four run bag
    ("battle", "test_battle_ui.py", ["390", "844", "2d"]),
    ("battle", "test_replays.py", []),                          # replays re-run to the same ending
    ("battle", "test_tower.py", ["390", "844", "2d"]),          # Battle Tower
    ("battle", "test_tower.py", ["1280", "860", "3d"]),
    ("online", "test_online.py", ["1280", "860"]),              # accounts with a stand-in Supabase: sign-in, sync, conflicts
    ("online", "test_online.py", ["390", "844"]),
    ("online", "test_friends.py", ["1280", "860"]),             # profiles, lineup, Home visits, Likes
    ("online", "test_friends.py", ["390", "844"]),
    ("online", "test_friend_battle.py", ["1280", "860"]),       # live friend battles between two players
    ("online", "test_friend_battle.py", ["390", "844"]),
    ("home", "test_home_life.py", ["1280", "860", "3d"]),       # furniture spots, naps, berries, gifts, drag/undo, photos
    ("home", "test_home_life.py", ["390", "844", "2d"]),
    ("home", "test_home_layout.py", ["2d", "1280", "860"]),     # yards, kitchen, old saves keep furniture in its room, house fronts
    ("home", "test_home_layout.py", ["3d", "390", "844"]),
    ("home", "test_home_deco.py", ["2d", "1280", "860"]),       # Decorate mode, the Home trainer, any team after the League
    ("home", "test_home_deco.py", ["3d", "390", "844"]),
    ("home", "test_home_habits.py", ["2d", "1280", "860"]),     # fish + water types in the pond, perches, type spots, bedtime, snacks, sizes
    ("home", "test_home_habits.py", ["3d", "390", "844"]),
    ("home", "test_home_games.py", ["2d", "390", "844"]),       # hammock, Berry Catch, Hide-and-seek
    ("home", "test_home_games.py", ["3d", "1280", "860"]),
    ("home", "test_home_anim.py", []),                          # animated furniture
    ("engine", "test_engine.mjs", []),                          # rules, items, Bag, AI (Node)
    ("engine", "test_damage.mjs", ["1500"]),                    # damage vs @smogon/calc (Node)
]
NOISE = re.compile(r"ERR_TUNNEL|fonts\.g|^\s+(File |~+|\^+|- |waiting for|attempting|retrying|\d+ × )|Call log:|^Traceback")


def bad_output(code, out):
    return code != 0 or "PAGEERR" in out or any(l.startswith(("errors:", "ERRS")) and l.strip() not in ("errors: []", "ERRS []") and "Failed to load resource" not in l for l in out.splitlines())


def run(test):
    group, f, args = test
    name = f"{f} {' '.join(args)}".strip()
    t0 = time.time()
    cmd = ["node" if f.endswith(".mjs") else sys.executable, str(ROOT / "tests" / f), *args]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=900, cwd=ROOT)
        code, out = r.returncode, r.stdout + r.stderr
    except subprocess.TimeoutExpired as e:
        code, out = -1, f"{(e.stdout or b'').decode(errors='replace') if isinstance(e.stdout, bytes) else (e.stdout or '')}\nTIMED OUT after 900 s"
    (LOGS / (re.sub(r"[^\w.-]+", "_", name) + ".log")).write_text(out)
    return name, bad_output(code, out), time.time() - t0, out


def main():
    a = sys.argv[1:]
    jobs = int(a[a.index("-j") + 1]) if "-j" in a else 2
    words = [w for i, w in enumerate(a) if not w.startswith("-") and not (i and a[i - 1] == "-j")]
    picked = [t for t in TESTS if (not words or any(w == t[0] or w in t[1] for w in words)) and not ("--quick" in a and t[0] in SLOW and not words)]
    LOGS.mkdir(parents=True, exist_ok=True)
    if "--no-build" not in a:
        b = subprocess.run([sys.executable, str(ROOT / "scripts" / "build.py")], capture_output=True, text=True)
        if b.returncode: print(b.stdout[-2000:] + b.stderr[-2000:]); sys.exit(1)
        print(b.stdout.strip().splitlines()[-1])
    srv = subprocess.Popen([sys.executable, "-m", "http.server", "8765"], cwd=ROOT / "dist" / "web", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    failed, t0 = [], time.time()
    try:
        with ThreadPoolExecutor(jobs) as ex:
            for name, bad, secs, out in ex.map(run, picked):
                print(f"{'FAIL' if bad else 'ok  '} {name} ({secs:.0f}s)", flush=True)
                if "-v" in a: print(out)
                elif bad:
                    lines = [l for l in out.splitlines() if not NOISE.search(l)]
                    print("     " + "\n     ".join(lines[-14:]))
                if bad: failed.append(name)
    finally:
        srv.terminate()
    print(f"\n{len(picked) - len(failed)}/{len(picked)} passed in {time.time() - t0:.0f}s" + (f". FAILED: {', '.join(failed)} (logs in tests/out/logs/)" if failed else "."))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
