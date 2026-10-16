"""Load timing on a throttled phone profile (slow 4G-ish: 1.6 Mbps down, 150 ms latency, 4x slower CPU):
first visit, repeat visit (service worker + caches warm) and offline start. Prints seconds until the start screen is
usable and how many bytes came over the network.

    python3 tests/perf_load.py
"""
import asyncio, os, time
from playwright.async_api import async_playwright
BASE = os.environ.get("DTD_URL", "http://localhost:8765/")

async def visit(pg, cdp, label):
    got = {'n': 0}
    def on(r):
        try: got['n'] += int(r.headers.get('content-length') or 0)
        except Exception: pass
    pg.on('response', on)
    t = time.time(); await pg.goto(BASE, wait_until='commit')
    await pg.wait_for_selector('#accName', timeout=120000)
    dt = time.time() - t; await pg.wait_for_timeout(300); pg.remove_listener('response', on)
    print(f'{label}: {dt:.2f}s, {got["n"]/1e6:.2f} MB transferred'); return dt

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        pg = await ctx.new_page(); cdp = await ctx.new_cdp_session(pg)
        await cdp.send('Network.enable'); await cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
        await cdp.send('Network.emulateNetworkConditions', {'offline': False, 'latency': 150, 'downloadThroughput': 1.6e6/8, 'uploadThroughput': 750e3/8})
        await visit(pg, cdp, 'first visit')
        await pg.wait_for_timeout(2500)   # let the service worker install
        await visit(pg, cdp, 'repeat visit')
        await cdp.send('Network.emulateNetworkConditions', {'offline': True, 'latency': 0, 'downloadThroughput': -1, 'uploadThroughput': -1})
        try: await visit(pg, cdp, 'offline start')
        except Exception as e: print('offline start: failed', str(e)[:80])
        await b.close()
asyncio.run(main())
