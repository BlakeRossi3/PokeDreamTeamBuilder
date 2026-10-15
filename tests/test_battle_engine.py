import asyncio
from playwright.async_api import async_playwright
import os
BASE = os.environ.get("DTD_URL", "http://localhost:8765/")   # the built website (python3 tests/run_all.py serves dist/web here)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out") + os.sep   # screenshots go here
os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]; pg=await b.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(BASE); await pg.wait_for_timeout(800)
        r = await pg.evaluate('''(async()=>{ await loadLearnsets(); const out={battles:0, turns:0, st:{}, msgs:new Set(), errs:[] , winners:[0,0]};
          const pool=[...NAT_BY.keys()];
          for (let k=0;k<150;k++){ try {
            const mk6=()=>Array.from({length:6},()=>mkMon(pool[Math.floor(Math.random()*pool.length)],{level:50}));
            const sideA={name:"A",party:mk6(),human:false,foePrefix:"A’s "}, sideB={name:"B",party:mk6(),human:false,foePrefix:"B’s "};
            // force status moves on some
            sideA.party[0].moves[3]=MOVE_BY.get("Thunder Wave"); sideA.party[1].moves[3]=MOVE_BY.get("Will-O-Wisp"); sideB.party[0].moves[3]=MOVE_BY.get("Spore"); sideB.party[1].moves[3]=MOVE_BY.get("Toxic"); sideB.party[2].item="Lum Berry"; sideA.party[2].item="Flame Orb"; sideA.party[2].ability="Guts";
            const B=new Battle([sideA,sideB]); let ev=B.start();
            while(!B.over){ for(const i of [0,1]) if(B.need[i]==="switch") ev=ev.concat(B.replace(i,B.aiReplace(i))); if(B.over)break; ev=ev.concat(B.turn([B.ai(0),B.ai(1)])); }
            out.battles++; out.turns+=B.turnNo; out.winners[B.winner]++;
            for(const e of ev){ if(e.k==="st"&&e.st) out.st[e.st]=(out.st[e.st]||0)+1; if(e.k==="msg"&&/burn|poison|paraly|asleep|frozen|woke|thaw|cured/.test(e.t)) out.msgs.add(e.t.replace(/^[AB]’s [^ ]+( [^ ]+)? /,'X ')); }
          } catch(e){ out.errs.push(String(e.stack||e).slice(0,300)); } }
          out.msgs=[...out.msgs].slice(0,40); return out; })()''')
        print(r); print('ERRS', errs[:3]); await b.close()
asyncio.run(main())
