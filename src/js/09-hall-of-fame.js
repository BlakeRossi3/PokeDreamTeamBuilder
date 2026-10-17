// ================= HALL OF FAME (full-page animated scene) =================
const INTRO_DELAY = 250, INTRO_STEP = 230, INTRO_POP = 820, INTRO_LEN = INTRO_DELAY + 5*INTRO_STEP + INTRO_POP + 400, CAM_P = 6000;
const SCENES = [
  {id:"route", name:"Route meadow", tod:true, fx:{type:{day:"petal", sunset:"petal", night:"firefly"}, y:[.1,.98]}},
  {id:"forest", name:"Deep forest", tod:true, fx:{type:{day:"leaf", sunset:"leaf", night:"firefly"}, y:[.1,.98]}},
  {id:"beach", name:"Seaside", tod:true, fx:{type:"sparkle", y:[.6,.74]}},
  {id:"summit", name:"Snowy summit", tod:true, fx:{type:"snow"}},
  {id:"city", name:"City lights", tod:true, fx:{type:"sparkle", y:[.05,.45]}},
  {id:"league", name:"Champion’s hall", fx:{type:"confetti"}},
  {id:"volcano", name:"Volcano", fx:{type:"ember"}},
  {id:"cave", name:"Crystal cave", fx:{type:"dust"}},
  {id:"crater", name:"Area Zero", fx:{type:"sparkle", y:[.3,.95]}},
  {id:"ultra", name:"Ultra Space", fx:{type:"sparkle", y:[0,.6]}},
  {id:"pokecenter", name:"Pokémon Center", fx:{type:"sparkle", y:[.05,.5]}},
  {id:"safari", name:"Safari Zone", tod:true, fx:{type:{day:"leaf", sunset:"leaf", night:"firefly"}, y:[.1,.98]}},
  {id:"gym", name:"Gym arena", fx:{type:"confetti"}},
  {id:"lavender", name:"Lavender Town", fx:{type:"wisp"}},
  {id:"spear", name:"Spear Pillar", fx:{type:"sparkle", y:[0,.55]}},
  {id:"tower", name:"Battle Tower", fx:{type:"confetti"}},
  {id:"stadium", name:"Stadium lights", fx:{type:"confetti"}},
  {id:"skypillar", name:"Sky Pillar", fx:{type:"dust"}},
  {id:"blossom", name:"Blossom shrine", fx:{type:"petal"}},
  {id:"reef", name:"Coral reef", fx:{type:"bubble"}},
  ...["Kanto", "Johto", "Hoenn", "Sinnoh", "Unova", "Kalos", "Alola", "Galar", "Paldea"].map((r, i) => ({id:"hall" + (i + 1), name:`${r} Champion’s Hall`, hall:i + 1, fx:{type:"confetti"}})),
];
const SCENE_BY = new Map(SCENES.map(s => [s.id, s]));
// "live" follows the clock on this device: day 6:00–17:30, sunset until 19:30, then night
const clockTod = () => { if (window.DTD_TOD) return window.DTD_TOD;   // tests can pin the time of day
  const d = new Date(), h = d.getHours() + d.getMinutes()/60; return h >= 6 && h < 17.5 ? "day" : h >= 17.5 && h < 19.5 ? "sunset" : "night"; };
const todOf = sc => sc.tod === "live" ? clockTod() : sc.tod;
const DEFAULT_BG = {g1:"route", g2:"forest", g3:"beach", g4:"summit", g5:"city", g6:"city", g7:"beach", g8:"league", g9:"crater", all:"league", starters:"route", pseudo:"summit", legend:"league", myth:"ultra", ub:"ultra", paradox:"crater", fossil:"volcano", baby:"route", eevee:"forest"};
const SLOTS = [[.30,.87],[.70,.87],[.15,.78],[.85,.78],[.38,.71],[.62,.71],[.05,.9],[.95,.9],[.24,.64],[.76,.64],[.06,.68],[.94,.68]];
// 2D and 3D scenes are separate: the 2D one lives at "<team>~2d" and starts as a copy of the 3D one
const sceneKey = (id, mode = state.mode) => mode === "2d" ? id + "~2d" : id;
function sceneOf(id, mode = state.mode){
  const key = sceneKey(id, mode); let s = state.scenes[key];
  if ((!s || typeof s !== "object") && mode === "2d" && state.scenes[id] && typeof state.scenes[id] === "object") s = state.scenes[key] = JSON.parse(JSON.stringify(state.scenes[id]));
  if (!s || typeof s !== "object") s = state.scenes[key] = {};
  if (!SCENE_BY.has(s.bg)) s.bg = DEFAULT_BG[id] || DEFAULT_BG[(TEAM_BY.get(id) || {}).base] || "route";
  if (!["day","sunset","night","live"].includes(s.tod)) s.tod = "live";
  if (!s.lv) { s.tod = "live"; s.lv = 1; }
  for (const [k,v] of Object.entries({fx:true, showTitle:true, frame:true, names:false, motion:"gif", title:"", cam:"none", intro:true})) if (s[k] === undefined) s[k] = v;
  if (s.mv !== 2) { s.motion = "gif"; s.mv = 2; }
  if (!["none","zoom","pan"].includes(s.cam)) s.cam = "none";
  if (!s.items || typeof s.items !== "object") s.items = {};
  return s;
}
function itemOf(sc, key, i){
  let it = sc.items[key];
  if (!it || typeof it.x !== "number") {
    const p = key === "t" ? [.5,.93] : SLOTS[i] || [.5,.8];
    it = sc.items[key] = {x:p[0], y:p[1], s:i >= 6 ? .8 : 1, f: key !== "t" && p[0] < .5 ? 1 : 0};
  }
  return it;
}
const hFrac = n => Math.min(.44, Math.max(.12, .2 * Math.pow(htOf(n), .35)));
const SZ_MIN = 20, SZ_MAX = 300;

// ---- colour + random helpers ----
const hexRGB = h => { h = h.replace("#",""); if (h.length === 3) h = h.split("").map(c => c+c).join(""); const n = parseInt(h,16); return [n>>16&255, n>>8&255, n&255]; };
const rgba = (h,a) => { const [r,g,b] = hexRGB(h); return `rgba(${r},${g},${b},${a})`; };
const mix = (a,b,t) => { if (a[0] !== "#" || b[0] !== "#") return t < .5 ? a : b; const A = hexRGB(a), B = hexRGB(b); return "#" + A.map((v,i) => Math.round(v + (B[i]-v)*t).toString(16).padStart(2,"0")).join(""); };
function stopAt(stops, o){ for (let i = 1; i < stops.length; i++) if (o <= stops[i][0]) { const [o0,c0] = stops[i-1], [o1,c1] = stops[i]; return mix(c0, c1, (o-o0)/((o1-o0)||1)); } return stops[stops.length-1][1]; }
function rng(seed){ return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const mkCanvas = (w,h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

// ---- painting kit (HD gradients, or banded pixel-art fills in 2D) ----
function kit(ctx, V, S, pixel){
  const u = S.h / 100, Y = f => S.y + S.h * f;
  const K = {u, Y, S, pixel, W:V.W, H:V.H, ctx,
    vgrad(y0, y1, stops, x0 = 0, x1 = V.W){
      y0 = Math.floor(y0); y1 = Math.ceil(y1); const h = y1 - y0; if (h <= 0) return;
      if (!pixel) { const g = ctx.createLinearGradient(0,y0,0,y1); for (const [o,c] of stops) g.addColorStop(o,c); ctx.fillStyle = g; ctx.fillRect(x0,y0,x1-x0,h); return; }
      const n = Math.max(3, Math.min(10, Math.round(h/7)));
      for (let i = 0; i < n; i++) { ctx.fillStyle = stopAt(stops, (i+.5)/n); const a = y0 + Math.floor(h*i/n), b = y0 + Math.floor(h*(i+1)/n); ctx.fillRect(x0, a, x1-x0, b-a); }
    },
    glow(x, y, r, c, a = 1){
      if (r <= 0) return;
      if (!pixel) { const g = ctx.createRadialGradient(x,y,0,x,y,r); g.addColorStop(0, rgba(c,a)); g.addColorStop(1, rgba(c,0)); ctx.fillStyle = g; ctx.fillRect(x-r, y-r, r*2, r*2); return; }
      for (let i = 3; i >= 1; i--) { ctx.fillStyle = rgba(c, a*.26); ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y), Math.max(1, Math.round(r*i/3.4)), 0, 7); ctx.fill(); }
    },
    disc(x, y, r, c){ ctx.fillStyle = c; ctx.beginPath(); ctx.arc(pixel ? Math.round(x) : x, pixel ? Math.round(y) : y, Math.max(pixel ? 1 : .5, r), 0, 7); ctx.fill(); },
    poly(pts, c){ ctx.fillStyle = c; ctx.beginPath(); pts.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.closePath(); ctx.fill(); },
    ridge(base, amp, seed, freq, c, bottom = V.H){
      const R = rng(seed), p = [R()*7, R()*7, R()*7], step = pixel ? 1 : 4;
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, bottom);
      for (let x = 0; x <= V.W + step; x += step) { const q = x / S.h * freq * 3; const n = Math.sin(q + p[0])*.55 + Math.sin(q*2.1 + p[1])*.3 + Math.sin(q*4.7 + p[2])*.15; ctx.lineTo(x, Math.round(base - amp * (.5 + .5*n))); }
      ctx.lineTo(V.W, bottom); ctx.closePath(); ctx.fill();
    },
    peaks(base, hgt, n, seed, c, snow){
      const R = rng(seed), span = V.W / n;
      ctx.fillStyle = c; ctx.fillRect(0, base, V.W, V.H - base);
      for (let i = -1; i <= n; i++) {
        const px = span*(i + .2 + R()*.6), ph = hgt*(.5 + R()*.5), w = span*(.7 + R()*.5), j = R();
        const pts = [[px - w, base + 1], [px - w*.45, base - ph*.55], [px - w*.25, base - ph*(.62 + j*.1)], [px, base - ph], [px + w*.3, base - ph*.66], [px + w*.5, base - ph*.48], [px + w, base + 1]];
        K.poly(pts, c);
        if (snow) K.poly([[px - w*.25, base - ph*(.62 + j*.1)], [px, base - ph], [px + w*.3, base - ph*.66], [px + w*.14, base - ph*.72], [px + w*.02, base - ph*.64], [px - w*.12, base - ph*.71]], snow);
        K.poly([[px, base - ph], [px + w*.3, base - ph*.66], [px + w*.5, base - ph*.48], [px + w, base + 1], [px + w*.2, base + 1]], "rgba(0,0,0,.12)");
      }
    },
    pines(base, size, spacing, seed, c, trunk){
      const R = rng(seed);
      for (let x = -spacing; x < V.W + spacing; x += spacing * (.6 + R()*.8)) {
        const h = size * (.7 + R()*.6), w = h * .38, bx = x + R()*spacing*.3;
        const tc = trunk || c, tw0 = Math.max(pixel ? 1 : .5, w*.17);
        ctx.fillStyle = tc; ctx.fillRect(bx - tw0/2, base - h*.3, tw0, h*.33);
        if (trunk) { ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.fillRect(bx + tw0*.1, base - h*.3, tw0*.4, h*.33); }
        for (let k = 0; k < 3; k++) { const ty = base - h*.15 - k*h*.27, tw = w*(1 - k*.24); K.poly([[bx - tw, ty], [bx, ty - h*.42], [bx + tw, ty]], c); }
      }
    },
    cloud(x, y, s, c, a){
      ctx.fillStyle = rgba(c, a);
      const parts = [[0,0,1],[.9,.15,.8],[-.9,.18,.75],[.45,-.35,.8],[-.4,-.3,.7],[1.6,.3,.55],[-1.6,.3,.5]];
      ctx.beginPath(); for (const [dx,dy,r] of parts) { ctx.moveTo(x + dx*s + r*s, y + dy*s); ctx.arc(x + dx*s, y + dy*s, r*s, 0, 7); } ctx.fill();
      if (!pixel) { ctx.fillStyle = rgba("#000000", a*.06); ctx.beginPath(); ctx.ellipse(x, y + s*.55, s*2, s*.35, 0, 0, 7); ctx.fill(); }
    },
    star4(x, y, r, c, a){
      if (a <= .02) return;
      ctx.fillStyle = rgba(c, a);
      if (pixel) { const X = Math.round(x), Yy = Math.round(y), R = Math.max(1, Math.round(r)); ctx.fillRect(X - R, Yy, R*2+1, 1); ctx.fillRect(X, Yy - R, 1, R*2+1); return; }
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill();
    },
  };
  return K;
}
const SKY = {
  day:[[0,"#4f9cf5"],[.7,"#a9d8ff"],[1,"#e4f4ff"]],
  sunset:[[0,"#2c2a6e"],[.45,"#c3608a"],[.8,"#ff9d6c"],[1,"#ffd38a"]],
  night:[[0,"#050822"],[.7,"#16204e"],[1,"#2b3a78"]]
};
const TINT = {sunset:"rgba(255,120,70,.20)", night:"rgba(14,22,80,.55)"};
function skyBox(K, tod, hz, seed){
  K.vgrad(0, K.Y(hz) + K.u*4, SKY[tod]);
  const R = rng(seed);
  if (tod === "night") {
    for (let i = 0; i < 160; i++) { const x = R()*K.W, y = R()*K.Y(hz), r = (R()*.18 + .05)*K.u; K.disc(x, y, r, rgba("#ffffff", .4 + R()*.6)); }
    const mx = K.W*.78, my = K.Y(.16); K.glow(mx, my, K.u*16, "#9fb4ff", .35); K.disc(mx, my, K.u*4.4, "#f4f1de"); K.disc(mx + K.u*1.4, my - K.u*.8, K.u*.9, "#e2ddc4"); K.disc(mx - K.u*1.2, my + K.u*1.2, K.u*.6, "#e2ddc4");
  } else if (tod === "sunset") { const sx = K.W*.68, sy = K.Y(hz) - K.u*4; K.glow(sx, sy, K.u*40, "#ffb36b", .55); K.disc(sx, sy, K.u*7, "#ffe2a0"); }
  else { const sx = K.W*.8, sy = K.Y(.12); K.glow(sx, sy, K.u*22, "#fff6c9", .6); K.disc(sx, sy, K.u*4.2, "#fffbe8"); }
}
function clouds(K, tod, t, seed, y0, y1, n = 6, a = .9){
  const R = rng(seed), c = tod === "night" ? "#5a6896" : tod === "sunset" ? "#ffd2c0" : "#ffffff", span = K.W + K.u*80;
  for (let i = 0; i < n; i++) { const s = K.u*(2.4 + R()*3), sp = (.6 + R())*K.u*.0025, x = ((R()*span + t*sp) % span) - K.u*40, y = K.Y(y0 + R()*(y1-y0)); K.cloud(x, y, s, c, a*(.6 + R()*.4)); }
}

// ---- scenes: sky (untinted) · land (tinted by time of day) · after (lights, untinted) · anim (moving parts) ----
const PAINT = {
  route: {
    sky:(K,tod) => skyBox(K, tod, .62, 11),
    land:(K) => {
      K.ridge(K.Y(.58), K.u*16, 3, 1.4, "#9db8d9"); K.ridge(K.Y(.64), K.u*7, 5, 2.2, "#86c96a"); K.ridge(K.Y(.70), K.u*4, 9, 3, "#6cb556");
      K.vgrad(K.Y(.71), K.H, [[0,"#74c057"],[1,"#3e8834"]]);
      const cx = K.W/2; K.poly([[cx - K.u*3, K.Y(.71)], [cx + K.u*3, K.Y(.71)], [cx + K.u*30, K.H], [cx - K.u*30, K.H]], "#d8c387");
      K.poly([[cx - K.u*2, K.Y(.71)], [cx + K.u*2, K.Y(.71)], [cx + K.u*22, K.H], [cx - K.u*22, K.H]], "#e4d197");
      const R = rng(21), cols = ["#ffffff","#ffd84d","#ff8fb1","#ff6b6b","#c9a3ff"];
      for (let i = 0; i < 220; i++) { const y = K.Y(.72) + Math.pow(R(),1.3)*(K.H - K.Y(.72)), x = R()*K.W; if (Math.abs(x - cx) < K.u*(3 + (y - K.Y(.71))/(K.H - K.Y(.71))*28)) continue; K.disc(x, y, K.u*(.25 + (y - K.Y(.7))/K.S.h*.9), cols[i % 5]); }
      for (let x = -K.u*2; x < K.W; x += K.u*1.6) { const h = K.u*(2.5 + R()*3.5); K.poly([[x, K.H], [x + K.u*.6, K.H - h], [x + K.u*1.2, K.H]], R() > .5 ? "#3c7f2c" : "#2f6b23"); }
    },
    anim:(K,tod,t) => clouds(K, tod, t, 31, .08, .36),
  },
  forest: {
    sky:(K,tod) => skyBox(K, tod, .7, 12),
    land:(K) => {
      K.pines(K.Y(.52), K.u*26, K.u*6, 2, "#6f9c8e", "#8f8173"); K.pines(K.Y(.6), K.u*30, K.u*8, 4, "#4c7e66", "#76583f"); K.pines(K.Y(.68), K.u*34, K.u*10, 6, "#30604a", "#5c3d27");
      K.vgrad(K.Y(.69), K.H, [[0,"#4f7d3a"],[1,"#24421d"]]);
      const R = rng(8);
      for (let i = 0; i < 160; i++) { const y = K.Y(.7) + R()*(K.H - K.Y(.7)), x = R()*K.W; K.disc(x, y, K.u*(.3 + R()*.4), R() > .5 ? "#6a9a45" : "#3a6a2c"); }
      for (const side of [0,1]) {
        const x = side ? K.W - K.u*6 : K.u*1;
        K.poly([[x + K.u*(side ? -2 : 7), K.Y(.3)], [x + K.u*(side ? -16 : 24), K.Y(.18)], [x + K.u*(side ? -16 : 24), K.Y(.2)], [x + K.u*(side ? -2 : 7), K.Y(.34)]], "#4a311f");
        K.poly([[x, 0], [x + K.u*7, 0], [x + K.u*8, K.H], [x - K.u*1, K.H]], "#5a3b25");
        K.poly([[x + K.u*(side ? 0 : 4.6), 0], [x + K.u*(side ? 2.4 : 7), 0], [x + K.u*(side ? 2.8 : 8), K.H], [x + K.u*(side ? -1 : 5.2), K.H]], "#3f2817");
        K.ctx.fillStyle = "rgba(255,226,180,.10)"; for (let y = K.u*4; y < K.H; y += K.u*7) K.ctx.fillRect(x + K.u*1.5, y, K.u*2.2, Math.max(1, K.u*.35));
        const lx = x + K.u*(side ? -16 : 24); K.disc(lx, K.Y(.19), K.u*5, "#2c5a35"); K.disc(lx + K.u*(side ? 4 : -4), K.Y(.16), K.u*4, "#24502f");
      }
      for (let x = 0; x < K.W; x += K.u*3) { const h = K.u*(3 + R()*4); K.poly([[x, K.H], [x + K.u*1.5, K.H - h], [x + K.u*3, K.H]], "#1f3d1a"); }
    },
    anim:(K,tod,t) => {
      if (tod === "night") return;
      const ctx = K.ctx; ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 4; i++) { const a = .06 + .04*Math.sin(t/1800 + i*1.7), x = K.W*(.2 + i*.2); K.poly([[x, 0], [x + K.u*6, 0], [x + K.u*26, K.Y(.9)], [x + K.u*12, K.Y(.9)]], rgba(tod === "sunset" ? "#ffc58a" : "#fff8d0", a)); }
      ctx.restore();
    },
  },
  beach: {
    sky:(K,tod) => skyBox(K, tod, .58, 13),
    land:(K) => {
      K.vgrad(K.Y(.58), K.Y(.75), [[0,"#2a78c2"],[1,"#80d2ec"]]);
      K.poly([[K.W*.06, K.Y(.585)], [K.W*.12, K.Y(.55)], [K.W*.17, K.Y(.56)], [K.W*.24, K.Y(.585)]], "#5c8a7a");
      K.vgrad(K.Y(.745), K.H, [[0,"#f3dda0"],[1,"#e0b973"]]);
      const R = rng(14); for (let i = 0; i < 120; i++) K.disc(R()*K.W, K.Y(.76) + R()*(K.H - K.Y(.76)), K.u*(.2 + R()*.3), R() > .6 ? "#fff3d6" : "#c9a265");
    },
    anim:(K,tod,t) => {
      const ctx = K.ctx, c = tod === "night" ? "#9bb0e0" : "#ffffff";
      for (let i = 0; i < 7; i++) { const y = K.Y(.6 + i*.021), off = (t*K.u*.002*(1 + i*.3)) % (K.u*12); ctx.fillStyle = rgba(c, .25 + i*.05); for (let x = -K.u*12 + off + (i%2)*K.u*5; x < K.W; x += K.u*12) ctx.fillRect(Math.round(x), Math.round(y), Math.round(K.u*(3 + i*.6)), Math.max(1, Math.round(K.u*.25))); }
      ctx.fillStyle = rgba("#ffffff", .85); ctx.beginPath(); ctx.moveTo(0, K.Y(.75));
      for (let x = 0; x <= K.W + 8; x += K.pixel ? 2 : 8) ctx.lineTo(x, K.Y(.742) + Math.sin(x/(K.u*6) + t/700)*K.u*.5 + Math.sin(t/1400)*K.u*.6);
      ctx.lineTo(K.W, K.Y(.765)); ctx.lineTo(0, K.Y(.765)); ctx.closePath(); ctx.fill();
      clouds(K, tod, t, 41, .06, .3, 5);
    },
  },
  summit: {
    sky:(K,tod) => skyBox(K, tod, .62, 15),
    land:(K) => {
      K.peaks(K.Y(.6), K.u*34, 4, 16, "#a9bbdc", "#ffffff"); K.peaks(K.Y(.68), K.u*20, 5, 17, "#7a8fbb", "#eef4ff");
      K.vgrad(K.Y(.69), K.H, [[0,"#f4f8ff"],[1,"#c9d7f0"]]);
      K.ridge(K.Y(.76), K.u*3, 18, 2.6, "#e2ebfb", K.Y(.8)); K.ridge(K.Y(.88), K.u*3, 19, 2, "#dbe5f7", K.Y(.92));
      const R = rng(20); for (let i = 0; i < 26; i++) { const x = R()*K.W, y = K.Y(.72) + R()*(K.H - K.Y(.72)), s = K.u*(.6 + R()*1.4); K.poly([[x - s, y], [x - s*.3, y - s*.8], [x + s*.6, y - s*.5], [x + s, y]], "#6b7690"); }
    },
    anim:(K,tod,t) => clouds(K, tod, t, 51, .42, .6, 5, .55),
  },
  city: {
    sky:(K,tod) => skyBox(K, tod, .66, 17),
    land:(K,tod) => {
      const B = cityBlocks(K);
      for (const b of B.far) K.ctx.fillStyle = "#56628a", K.ctx.fillRect(b.x, b.y, b.w, K.Y(.72) - b.y);
      const tx = K.W*.5, ty = K.Y(.12);
      K.poly([[tx - K.u*4, K.Y(.72)], [tx - K.u*1.2, ty + K.u*14], [tx, ty], [tx + K.u*1.2, ty + K.u*14], [tx + K.u*4, K.Y(.72)]], "#3a4364");
      K.ctx.fillStyle = "#3a4364"; K.ctx.fillRect(tx - K.u*.2, ty - K.u*6, K.u*.4, K.u*6);
      for (const b of B.near) K.ctx.fillStyle = "#2c3350", K.ctx.fillRect(b.x, b.y, b.w, K.Y(.74) - b.y);
      K.vgrad(K.Y(.73), K.H, [[0,"#5c6276"],[1,"#2e3246"]]);
      K.ctx.fillStyle = "rgba(255,255,255,.12)"; for (let i = 1; i < 6; i++) { const y = K.Y(.73) + (K.H - K.Y(.73))*Math.pow(i/6, 1.4); K.ctx.fillRect(0, Math.round(y), K.W, Math.max(1, Math.round(K.u*.2))); }
      for (let x = K.u*8; x < K.W; x += K.u*26) { K.ctx.fillStyle = "#1c2033"; K.ctx.fillRect(x, K.Y(.62), K.u*.5, K.Y(.75) - K.Y(.62)); K.ctx.fillRect(x - K.u*1.5, K.Y(.62), K.u*3.5, K.u*.6); }
    },
    after:(K,tod) => {
      if (tod === "day") return;
      const B = cityBlocks(K), R = rng(77);
      for (const b of [...B.far, ...B.near]) for (let y = b.y + K.u*1.5; y < K.Y(.71); y += K.u*2.2) for (let x = b.x + K.u*.8; x < b.x + b.w - K.u*.8; x += K.u*1.8) if (R() > .45) { K.ctx.fillStyle = rgba(R() > .3 ? "#ffd98a" : "#9fd8ff", .55 + R()*.4); K.ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(K.u*.8)), Math.max(1, Math.round(K.u*1))); }
      for (let x = K.u*8; x < K.W; x += K.u*26) K.glow(x + K.u*.6, K.Y(.625), K.u*8, "#ffd98a", .45);
    },
    anim:(K,tod,t) => {
      if (tod !== "night") { clouds(K, tod, t, 61, .06, .25, 4, .7); return; }
      const ctx = K.ctx; ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 2; i++) { const a = Math.sin(t/2600 + i*2.4)*.5, x = K.W*.5, y = K.Y(.12); const L = K.S.h; ctx.fillStyle = rgba("#bcd4ff", .07); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(a - .05)*L, y - Math.cos(a - .05)*L); ctx.lineTo(x + Math.sin(a + .05)*L, y - Math.cos(a + .05)*L); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      K.glow(K.W*.5, K.Y(.06), K.u*3, "#ff4f6a", .5 + .5*Math.sin(t/400));
    },
  },
  league: {
    sky:(K) => {
      K.vgrad(0, K.Y(.72), [[0,"#140e26"],[.6,"#2d1d4d"],[1,"#4a2f6e"]]);
      K.glow(K.W/2, K.Y(.3), K.u*40, "#8f6bff", .25);
      const cx = K.W/2, cy = K.Y(.26), r = K.u*13; K.ctx.lineWidth = Math.max(1, K.u*.8); K.ctx.strokeStyle = rgba("#ffd77a", .55);
      K.ctx.beginPath(); K.ctx.arc(cx, cy, r, 0, 7); K.ctx.stroke(); K.ctx.beginPath(); K.ctx.moveTo(cx - r, cy); K.ctx.lineTo(cx + r, cy); K.ctx.stroke(); K.ctx.beginPath(); K.ctx.arc(cx, cy, r*.3, 0, 7); K.ctx.stroke();
    },
    land:(K) => {
      const n = Math.ceil(K.W/(K.u*22)) + 1;
      for (let i = 0; i < n; i++) {
        const x = K.W/2 + (i - n/2)*K.u*22 + K.u*11; if (Math.abs(x - K.W/2) < K.u*16) continue;
        K.vgrad(K.Y(.1), K.Y(.72), [[0,"#6d5aa0"],[1,"#2e2148"]], x - K.u*2.6, x + K.u*2.6);
        K.ctx.fillStyle = "#8a76c0"; K.ctx.fillRect(x - K.u*3.4, K.Y(.1), K.u*6.8, K.u*1.6);
        K.poly([[x + K.u*4.5, K.Y(.16)], [x + K.u*12.5, K.Y(.16)], [x + K.u*12.5, K.Y(.44)], [x + K.u*8.5, K.Y(.48)], [x + K.u*4.5, K.Y(.44)]], "#b52a37");
        K.ctx.fillStyle = "#ffd36b"; K.ctx.fillRect(x + K.u*4.5, K.Y(.16), K.u*8, K.u*.8);
        K.disc(x + K.u*8.5, K.Y(.3), K.u*2, "#ffd36b"); K.disc(x + K.u*8.5, K.Y(.3), K.u*1.2, "#b52a37");
      }
      K.vgrad(K.Y(.72), K.H, [[0,"#3d2d62"],[1,"#161029"]]);
      const vx = K.W/2; K.ctx.strokeStyle = "rgba(255,255,255,.08)"; K.ctx.lineWidth = Math.max(1, K.u*.15);
      for (let i = -14; i <= 14; i++) { K.ctx.beginPath(); K.ctx.moveTo(vx + i*K.u*3, K.Y(.72)); K.ctx.lineTo(vx + i*K.u*30, K.H + K.u*20); K.ctx.stroke(); }
      for (let i = 1; i < 8; i++) { const y = K.Y(.72) + (K.H - K.Y(.72))*Math.pow(i/8, 1.6); K.ctx.beginPath(); K.ctx.moveTo(0, y); K.ctx.lineTo(K.W, y); K.ctx.stroke(); }
      K.poly([[vx - K.u*6, K.Y(.72)], [vx + K.u*6, K.Y(.72)], [vx + K.u*40, K.H], [vx - K.u*40, K.H]], "#ffd36b");
      K.poly([[vx - K.u*5.2, K.Y(.72)], [vx + K.u*5.2, K.Y(.72)], [vx + K.u*37, K.H], [vx - K.u*37, K.H]], "#a8232f");
    },
    anim:(K,tod,t) => {
      const ctx = K.ctx; ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 3; i++) { const sx = K.W*(.2 + i*.3), a = Math.sin(t/1700 + i*2)*.45, L = K.S.h*1.1; ctx.fillStyle = rgba(i === 1 ? "#ffe6a8" : "#c9b6ff", .09); ctx.beginPath(); ctx.moveTo(sx, -K.u*2); ctx.lineTo(sx + Math.sin(a - .08)*L, Math.cos(a - .08)*L); ctx.lineTo(sx + Math.sin(a + .08)*L, Math.cos(a + .08)*L); ctx.closePath(); ctx.fill(); K.glow(sx + Math.sin(a)*L*.8, Math.cos(a)*L*.8, K.u*10, i === 1 ? "#ffe6a8" : "#c9b6ff", .12); }
      ctx.restore();
    },
  },
  volcano: {
    sky:(K) => { K.vgrad(0, K.Y(.68), [[0,"#160709"],[.5,"#4f1612"],[.85,"#b43c1a"],[1,"#ff7e36"]]); K.glow(K.W/2, K.Y(.3), K.u*30, "#ff6a1f", .35); },
    land:(K) => {
      const cx = K.W/2;
      K.ridge(K.Y(.62), K.u*10, 71, 1.6, "#3c1d19");
      K.poly([[cx - K.u*55, K.Y(.68)], [cx - K.u*12, K.Y(.3)], [cx - K.u*6, K.Y(.28)], [cx + K.u*5, K.Y(.29)], [cx + K.u*12, K.Y(.3)], [cx + K.u*55, K.Y(.68)]], "#2a1615");
      K.poly([[cx + K.u*5, K.Y(.29)], [cx + K.u*12, K.Y(.3)], [cx + K.u*55, K.Y(.68)], [cx + K.u*10, K.Y(.68)]], "#1f100f");
      K.vgrad(K.Y(.66), K.H, [[0,"#3b2521"],[1,"#140c0b"]]);
      const R = rng(72); for (let i = 0; i < 18; i++) { const x = R()*K.W, y = K.Y(.7) + R()*(K.H - K.Y(.7)), s = K.u*(1 + R()*3); K.poly([[x - s, y], [x - s*.2, y - s*1.8], [x + s*.4, y - s*1.2], [x + s, y]], "#24130f"); }
    },
    after:(K) => {
      const cx = K.W/2; K.glow(cx, K.Y(.28), K.u*14, "#ffb347", .9);
      const river = [[K.W*.62, K.Y(.66)], [K.W*.66, K.Y(.66)], [K.W*.74, K.Y(.78)], [K.W*.98, K.H], [K.W*.82, K.H], [K.W*.68, K.Y(.8)]];
      K.poly(river, "#ff5a1a"); K.poly(river.map(([x,y]) => [x + (x > K.W*.7 ? -K.u*1.2 : K.u*.6), y]), "#ffb347");
      K.poly([[cx - K.u*2.5, K.Y(.3)], [cx + K.u*2, K.Y(.3)], [cx + K.u*1, K.Y(.45)], [cx - K.u*.5, K.Y(.52)], [cx - K.u*1.5, K.Y(.42)]], "#ff6a1f");
    },
    anim:(K,tod,t) => {
      K.glow(K.W*.75, K.Y(.82), K.u*22, "#ff6a1f", .18 + .1*Math.sin(t/600));
      const R = rng(73), cx = K.W/2;
      for (let i = 0; i < 9; i++) { const ph = ((R() + t/9000) % 1), x = cx + Math.sin(ph*3 + i)*K.u*6 + ph*K.u*18, y = K.Y(.27) - ph*K.S.h*.32, r = K.u*(3 + ph*9); K.disc(x, y, r, rgba("#3a3030", .35*(1 - ph))); }
    },
  },
  cave: {
    sky:(K) => K.vgrad(0, K.H, [[0,"#060912"],[.6,"#111a2e"],[1,"#1b263e"]]),
    land:(K) => {
      K.ridge(K.Y(.55), K.u*16, 81, 1.8, "#18223a"); K.ridge(K.Y(.66), K.u*8, 82, 2.6, "#1f2b45");
      K.vgrad(K.Y(.69), K.H, [[0,"#2b3349"],[1,"#11151f"]]);
      const R = rng(83); for (let x = 0; x < K.W; x += K.u*(3 + R()*5)) { const l = K.u*(4 + R()*16); K.poly([[x, 0], [x + K.u*3.5, 0], [x + K.u*1.6, l]], "#0a0f1c"); }
      for (let i = 0; i < 14; i++) { const x = R()*K.W, y = K.Y(.72) + R()*(K.H - K.Y(.72)), s = K.u*(1.5 + R()*3); K.poly([[x - s, y], [x - s*.4, y - s*.9], [x + s*.5, y - s*.7], [x + s, y]], "#1a2133"); }
      for (const [fx, fy, sz, c] of CRYSTALS) crystal(K, K.W*fx, K.Y(fy), K.u*sz, c);
    },
    after:(K) => { for (const [fx, fy, sz, c] of CRYSTALS) K.glow(K.W*fx, K.Y(fy) - K.u*sz*.6, K.u*sz*2.4, c, .35); },
    anim:(K,tod,t) => { for (const [fx, fy, sz, c] of CRYSTALS) K.glow(K.W*fx, K.Y(fy) - K.u*sz*.6, K.u*sz*1.6, c, .12 + .1*Math.sin(t/900 + fx*9)); K.glow(K.W*.5, K.Y(.1), K.u*30, "#9fb8ff", .06); },
  },
  crater: {
    sky:(K) => { K.vgrad(0, K.Y(.62), [[0,"#7ab1c2"],[.7,"#cfe8e0"],[1,"#eef6ec"]]); K.glow(K.W*.5, K.Y(.15), K.u*40, "#ffffff", .3); },
    land:(K) => {
      K.ridge(K.Y(.46), K.u*14, 91, 1.4, "#6f8f93"); K.ridge(K.Y(.55), K.u*11, 92, 2, "#57767d"); K.ridge(K.Y(.64), K.u*8, 93, 2.8, "#41606a");
      K.vgrad(K.Y(.67), K.H, [[0,"#6d8a74"],[1,"#3a574a"]]);
      const R = rng(94); for (let i = 0; i < 90; i++) K.disc(R()*K.W, K.Y(.7) + R()*(K.H - K.Y(.7)), K.u*(.3 + R()*.5), R() > .5 ? "#86a58b" : "#4a6b58");
    },
    after:(K) => { for (const [fx, fy, sz] of TERA) tera(K, K.W*fx, K.Y(fy), K.u*sz); },
    anim:(K,tod,t) => { const R = rng(95); for (let i = 0; i < 6; i++) { const span = K.W + K.u*80, x = ((R()*span + t*K.u*.003*(.5 + R())) % span) - K.u*40, y = K.Y(.5 + R()*.25); K.ctx.fillStyle = rgba("#ffffff", .14); K.ctx.beginPath(); K.ctx.ellipse(x, y, K.u*(20 + R()*20), K.u*(2 + R()*2), 0, 0, 7); K.ctx.fill(); } },
  },
  ultra: {
    sky:(K) => {
      K.vgrad(0, K.H, [[0,"#07031a"],[.5,"#180b3a"],[1,"#0a2140"]]);
      K.glow(K.W*.25, K.Y(.3), K.u*45, "#b44cff", .28); K.glow(K.W*.8, K.Y(.2), K.u*40, "#2fd0ff", .22); K.glow(K.W*.6, K.Y(.55), K.u*35, "#ff4fa3", .15);
      const R = rng(101); for (let i = 0; i < 220; i++) K.disc(R()*K.W, R()*K.Y(.72), K.u*(.06 + R()*.18), rgba("#ffffff", .3 + R()*.7));
    },
    land:(K) => {
      const R = rng(102);
      for (let i = 0; i < 6; i++) { const x = R()*K.W, y = K.Y(.2 + R()*.4), s = K.u*(3 + R()*7); K.poly([[x - s*1.4, y], [x + s*1.4, y], [x + s*.6, y + s*1.6], [x - s*.2, y + s*2.2], [x - s*.9, y + s*1.1]], "#1b1238"); K.poly([[x - s*1.4, y], [x + s*1.4, y], [x + s*1.2, y + s*.25], [x - s*1.2, y + s*.25]], "#4b3a8a"); }
      K.poly([[K.W/2 - K.u*70, K.Y(.7)], [K.W/2 + K.u*70, K.Y(.7)], [K.W + K.u*40, K.H], [-K.u*40, K.H]], "#241c4a");
      K.ctx.strokeStyle = rgba("#2fd0ff", .3); K.ctx.lineWidth = Math.max(1, K.u*.15);
      for (let i = -10; i <= 10; i++) { K.ctx.beginPath(); K.ctx.moveTo(K.W/2 + i*K.u*7, K.Y(.7)); K.ctx.lineTo(K.W/2 + i*K.u*16, K.H); K.ctx.stroke(); }
      for (let i = 1; i < 6; i++) { const y = K.Y(.7) + (K.H - K.Y(.7))*Math.pow(i/6, 1.5); K.ctx.beginPath(); K.ctx.moveTo(0, y); K.ctx.lineTo(K.W, y); K.ctx.stroke(); }
      K.ctx.strokeStyle = rgba("#ff9df5", .7); K.ctx.lineWidth = Math.max(1, K.u*.3); K.ctx.beginPath(); K.ctx.moveTo(K.W/2 - K.u*70, K.Y(.7)); K.ctx.lineTo(K.W/2 + K.u*70, K.Y(.7)); K.ctx.stroke();
    },
    anim:(K,tod,t) => {
      const cx = K.W*.5, cy = K.Y(.24), r = K.u*13, ctx = K.ctx;
      K.glow(cx, cy, r*2.4, "#c98bff", .35);
      K.disc(cx, cy, r*.82, "#05020f");
      const seg = 24; ctx.lineWidth = Math.max(2, K.u*1.6);
      for (let i = 0; i < seg; i++) { const a0 = i/seg*Math.PI*2 + t/2200, hue = (i/seg*360 + t/20) % 360; ctx.strokeStyle = `hsla(${hue},95%,68%,.9)`; ctx.beginPath(); ctx.arc(cx, cy, r, a0, a0 + Math.PI*2/seg + .02); ctx.stroke(); }
      K.glow(cx, cy, r*.7, "#6f3cff", .3 + .15*Math.sin(t/700));
    },
  },
  pokecenter: {
    sky:(K) => {
      K.vgrad(0, K.Y(.7), [[0,"#fff1f4"],[1,"#f6cdd8"]]);
      K.ctx.fillStyle = "rgba(226,84,107,.09)"; for (let x = K.u*3; x < K.W; x += K.u*14) K.ctx.fillRect(Math.round(x), 0, Math.max(1, Math.round(K.u*.5)), K.Y(.47));
      K.ctx.fillStyle = "#e2546b"; K.ctx.fillRect(0, K.Y(.45), K.W, K.u*2.6); K.ctx.fillStyle = "#ffffff"; K.ctx.fillRect(0, K.Y(.45) + K.u*2.6, K.W, Math.max(1, K.u*.6));
      K.ctx.fillStyle = "#f9e3e9"; K.ctx.fillRect(0, 0, K.W, K.u*2.4);
      for (let i = 0; i < 5; i++) { const x = K.W*(.1 + i*.2); K.glow(x, K.u*2.4, K.u*9, "#ffffff", .8); K.ctx.fillStyle = "#ffffff"; K.ctx.fillRect(x - K.u*4, K.u*1.2, K.u*8, K.u*1.2); }
      pokeEmblem(K, K.W/2, K.Y(.22), K.u*9);
    },
    land:(K) => {
      const cx = K.W/2, top = K.Y(.5), bot = K.Y(.68);
      K.ctx.fillStyle = "#fffaf6"; K.ctx.fillRect(cx - K.u*46, top, K.u*92, bot - top);
      K.ctx.fillStyle = "rgba(0,0,0,.07)"; K.ctx.fillRect(cx - K.u*46, bot - K.u*2, K.u*92, K.u*2);
      K.ctx.fillStyle = "#e2546b"; K.ctx.fillRect(cx - K.u*48, top - K.u*2.4, K.u*96, K.u*2.6);
      K.ctx.fillStyle = "#c43f56"; K.ctx.fillRect(cx - K.u*48, top, K.u*96, Math.max(1, K.u*.5));
      const M = pcMachine(K);
      K.ctx.fillStyle = "#cfd8e6"; K.ctx.fillRect(M.x - K.u*9, M.y - K.u*7.5, K.u*18, K.u*7.5);
      K.ctx.fillStyle = "#9aa7bd"; K.ctx.fillRect(M.x - K.u*9, M.y - K.u*1.4, K.u*18, K.u*1.4);
      for (const [bx, by] of M.balls) { K.disc(bx, by, K.u*1.15, "#28323f"); K.ctx.fillStyle = "#e2546b"; K.ctx.beginPath(); K.ctx.arc(bx, by, K.u*.9, Math.PI, 0); K.ctx.fill(); K.ctx.fillStyle = "#ffffff"; K.ctx.beginPath(); K.ctx.arc(bx, by, K.u*.9, 0, Math.PI); K.ctx.fill(); }
      const mx = cx + K.u*30; K.ctx.fillStyle = "#3a4560"; K.ctx.fillRect(mx - K.u*6, top - K.u*9, K.u*12, K.u*7); K.ctx.fillStyle = "#7fd3ff"; K.ctx.fillRect(mx - K.u*5, top - K.u*8.2, K.u*10, K.u*5.4); K.ctx.fillStyle = "#3a4560"; K.ctx.fillRect(mx - K.u*.8, top - K.u*2.4, K.u*1.6, K.u*.6);
      K.vgrad(bot, K.H, [[0,"#f5f0e6"],[1,"#d8cdb9"]]);
      K.ctx.strokeStyle = "rgba(160,140,110,.28)"; K.ctx.lineWidth = Math.max(1, K.u*.15);
      for (let i = -12; i <= 12; i++) { K.ctx.beginPath(); K.ctx.moveTo(cx + i*K.u*8, bot); K.ctx.lineTo(cx + i*K.u*22, K.H); K.ctx.stroke(); }
      for (let i = 1; i < 7; i++) { const y = bot + (K.H - bot)*Math.pow(i/7, 1.5); K.ctx.beginPath(); K.ctx.moveTo(0, y); K.ctx.lineTo(K.W, y); K.ctx.stroke(); }
      K.poly([[cx - K.u*12, bot + K.u*2], [cx + K.u*12, bot + K.u*2], [cx + K.u*36, K.H], [cx - K.u*36, K.H]], "#e2546b");
      K.poly([[cx - K.u*10, bot + K.u*3], [cx + K.u*10, bot + K.u*3], [cx + K.u*32, K.H], [cx - K.u*32, K.H]], "#ef7388");
      for (const side of [0, 1]) { const x = side ? K.W - K.u*9 : K.u*9, y = K.Y(.74); K.poly([[x - K.u*3, y], [x + K.u*3, y], [x + K.u*2.2, y + K.u*5], [x - K.u*2.2, y + K.u*5]], "#c9785a"); for (const [dx, dy, r, c] of [[0,-4,3.4,"#3f8a46"],[-2.6,-1.6,2.6,"#4fa356"],[2.6,-1.8,2.6,"#368040"],[0,-7,2.4,"#5cb563"]]) K.disc(x + K.u*dx, y + K.u*dy, K.u*r, c); }
    },
    anim:(K,tod,t) => {
      const M = pcMachine(K), on = Math.floor(t/260) % 7;
      M.balls.forEach(([bx, by], i) => { if (i === on || on === 6) K.glow(bx, by, K.u*2.6, "#fff4a8", .7); });
      K.glow(K.W/2, K.Y(.22), K.u*16, "#ffffff", .12 + .08*Math.sin(t/900));
    },
  },
  safari: {
    sky:(K,tod) => skyBox(K, tod, .6, 19),
    land:(K) => {
      const R = rng(201);
      K.ridge(K.Y(.57), K.u*7, 202, 1.1, "#c7ad80");
      for (let i = 0; i < 3; i++) { const x = K.W*(.12 + i*.36 + R()*.08), w = K.u*(14 + R()*12), h = K.u*(5 + R()*6), b = K.Y(.61); K.poly([[x - w, b], [x - w*.72, b - h], [x + w*.72, b - h], [x + w, b]], "#b08d5c"); K.poly([[x + w*.2, b - h], [x + w*.72, b - h], [x + w, b], [x + w*.3, b]], "rgba(0,0,0,.12)"); }
      K.ridge(K.Y(.64), K.u*4, 203, 2.4, "#a9a24f");
      K.vgrad(K.Y(.655), K.H, [[0,"#c2b55a"],[1,"#7c7a2d"]]);
      for (const [fx, s] of [[.09, 1.1],[.86, 1.3],[.62, .62]]) acacia(K, K.W*fx, K.Y(.655), K.u*s);
      const fy = K.Y(.69);
      K.ctx.fillStyle = "#6f4520"; for (let x = K.u*2; x < K.W; x += K.u*7) K.ctx.fillRect(Math.round(x), fy - K.u*4.2, Math.max(1, Math.round(K.u*.9)), K.u*4.8);
      K.ctx.fillStyle = "#94622f"; K.ctx.fillRect(0, fy - K.u*3.5, K.W, Math.max(1, K.u*.7)); K.ctx.fillRect(0, fy - K.u*1.7, K.W, Math.max(1, K.u*.7));
      const cx = K.W/2; K.poly([[cx - K.u*4, K.Y(.7)], [cx + K.u*4, K.Y(.7)], [cx + K.u*26, K.H], [cx - K.u*26, K.H]], "#d2b77f");
      for (let i = 0; i < 170; i++) { const y = K.Y(.71) + Math.pow(R(), 1.2)*(K.H - K.Y(.71)), x = R()*K.W; if (Math.abs(x - cx) < K.u*(4 + (y - K.Y(.7))/(K.H - K.Y(.7))*22)) continue; K.disc(x, y, K.u*(.25 + (y - K.Y(.7))/K.S.h*.8), R() > .5 ? "#8f8b35" : "#d0ca70"); }
      for (let i = 0; i < 5; i++) { const x = R()*K.W, y = K.Y(.74) + R()*(K.H - K.Y(.74)), s = K.u*(1 + R()*2); if (Math.abs(x - cx) < K.u*20) continue; K.poly([[x - s*1.4, y], [x - s*.6, y - s], [x + s*.7, y - s*.8], [x + s*1.3, y]], "#8e8574"); }
    },
    anim:(K,tod,t) => {
      clouds(K, tod, t, 211, .06, .3, 4);
      const R = rng(212), c1 = tod === "night" ? "#2c4426" : tod === "sunset" ? "#5d6a2a" : "#4f7a2a", c2 = tod === "night" ? "#203519" : tod === "sunset" ? "#4b5622" : "#3d6420";
      for (let x = -K.u*2; x < K.W + K.u*2; x += K.u*2.1) { const h = K.u*(4 + R()*5), sway = Math.sin(t/700 + x/(K.u*9))*K.u*.9; K.poly([[x, K.H], [x + K.u*.7 + sway, K.H - h], [x + K.u*1.6, K.H]], R() > .5 ? c1 : c2); }
    },
  },
  gym: {
    sky:(K) => {
      K.vgrad(0, K.Y(.62), [[0,"#0d1322"],[1,"#202c46"]]);
      const R = rng(301), cols = ["#ff6a3d","#ffd43b","#5fa8ff","#46d996","#c98bff","#f2f5ff"];
      for (let r = 0; r < 6; r++) {
        const y0 = K.Y(.17 + r*.068); K.ctx.fillStyle = r % 2 ? "#24304c" : "#2b3958"; K.ctx.fillRect(0, y0, K.W, K.u*6.8);
        K.ctx.fillStyle = "rgba(255,255,255,.07)"; K.ctx.fillRect(0, y0, K.W, Math.max(1, K.u*.3));
        for (let x = R()*K.u*2; x < K.W; x += K.u*(1.7 + R()*1.1)) { if (R() < .22) continue; const c = cols[Math.floor(R()*6)]; K.disc(x, y0 + K.u*3, K.u*.75, rgba(c, .7)); K.ctx.fillStyle = rgba(c, .4); K.ctx.fillRect(x - K.u*.8, y0 + K.u*3.8, K.u*1.6, K.u*2.4); }
      }
      K.ctx.fillStyle = "#080c18"; K.ctx.fillRect(0, 0, K.W, K.Y(.16));
      const cx = K.W/2; K.ctx.fillStyle = "#ffd43b"; K.ctx.fillRect(cx - K.u*17, K.Y(.015), K.u*34, K.u*13); K.ctx.fillStyle = "#121a2e"; K.ctx.fillRect(cx - K.u*16.2, K.Y(.015) + K.u*.8, K.u*32.4, K.u*11.4);
      pokeEmblem(K, cx, K.Y(.08), K.u*4.2);
    },
    land:(K) => {
      K.ctx.fillStyle = "#b93636"; K.ctx.fillRect(0, K.Y(.585), K.W, K.u*4); K.ctx.fillStyle = "#ffffff"; K.ctx.fillRect(0, K.Y(.585) + K.u*1.7, K.W, Math.max(1, K.u*.6));
      const top = K.Y(.625); K.vgrad(top, K.H, [[0,"#5fa864"],[1,"#2f6b3a"]]);
      for (let i = 0; i < 9; i += 2) { const a = top + (K.H - top)*Math.pow(i/9, 1.5), b = top + (K.H - top)*Math.pow((i + 1)/9, 1.5); K.ctx.fillStyle = "rgba(255,255,255,.05)"; K.ctx.fillRect(0, a, K.W, b - a); }
      const cx = K.W/2, ft = K.Y(.665), mid = K.Y(.77), ctx = K.ctx;
      ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = Math.max(1, K.u*.45);
      ctx.beginPath(); ctx.moveTo(cx - K.u*40, ft); ctx.lineTo(cx + K.u*40, ft); ctx.lineTo(cx + K.u*78, K.H + K.u*4); ctx.moveTo(cx - K.u*40, ft); ctx.lineTo(cx - K.u*78, K.H + K.u*4); ctx.stroke();
      const hw = K.u*(40 + 38*(mid - ft)/(K.H + K.u*4 - ft)); ctx.beginPath(); ctx.moveTo(cx - hw, mid); ctx.lineTo(cx + hw, mid); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx, mid, K.u*13, K.u*3.4, 0, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx, mid, K.u*3, K.u*.8, 0, 0, 7); ctx.stroke();
    },
    anim:(K,tod,t) => {
      const ctx = K.ctx; ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 4; i++) { const sx = K.W*(.12 + i*.25), a = Math.sin(t/1500 + i*1.7)*.5, L = K.S.h*1.15; ctx.fillStyle = rgba(i % 2 ? "#ffe6a8" : "#bcd4ff", .08); ctx.beginPath(); ctx.moveTo(sx, K.Y(.15)); ctx.lineTo(sx + Math.sin(a - .07)*L, K.Y(.15) + Math.cos(a - .07)*L); ctx.lineTo(sx + Math.sin(a + .07)*L, K.Y(.15) + Math.cos(a + .07)*L); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      const R = rng(303);
      for (let i = 0; i < 14; i++) { const x = R()*K.W, y = K.Y(.18 + R()*.38), p = R()*9, al = Math.pow(Math.max(0, Math.sin(t/260 + p*7)), 30); K.star4(x, y, K.u*1.6, "#ffffff", al); }
    },
  },
  lavender: {
    sky:(K) => {
      K.vgrad(0, K.Y(.66), [[0,"#120a24"],[.6,"#35204f"],[1,"#6a4a80"]]);
      const R = rng(401); for (let i = 0; i < 120; i++) K.disc(R()*K.W, R()*K.Y(.5), K.u*(.06 + R()*.16), rgba("#ffffff", .3 + R()*.6));
      const mx = K.W*.8, my = K.Y(.15); K.glow(mx, my, K.u*18, "#c9a8ff", .35); K.disc(mx, my, K.u*4.6, "#efe6ff"); K.disc(mx - K.u*1.2, my - K.u*.6, K.u*.9, "#d9caf2"); K.disc(mx + K.u*1.5, my + K.u*1.3, K.u*.6, "#d9caf2");
    },
    land:(K) => {
      K.ridge(K.Y(.61), K.u*9, 402, 1.5, "#2a1b3e");
      const L = lavender(K);
      for (const f of L.floors) { K.ctx.fillStyle = "#4a3566"; K.ctx.fillRect(f.x, f.y, f.w, f.h); K.ctx.fillStyle = "rgba(0,0,0,.28)"; K.ctx.fillRect(f.x + f.w*.68, f.y, f.w*.32, f.h); K.poly([[f.x - K.u*2, f.y + K.u*1.2], [f.x + f.w + K.u*2, f.y + K.u*1.2], [f.x + f.w*.88, f.y - K.u*1.4], [f.x + f.w*.12, f.y - K.u*1.4]], "#2b1d40"); }
      K.poly([[L.tx - K.u*3, L.top + K.u*1.2], [L.tx + K.u*3, L.top + K.u*1.2], [L.tx, L.top - K.u*8]], "#2b1d40");
      for (const h of L.houses) { K.ctx.fillStyle = "#3d2d55"; K.ctx.fillRect(h.x - h.w/2, h.y - h.h, h.w, h.h); K.poly([[h.x - h.w*.62, h.y - h.h + K.u*.3], [h.x, h.y - h.h - h.w*.42], [h.x + h.w*.62, h.y - h.h + K.u*.3]], "#5b3f7a"); K.ctx.fillStyle = "#24193a"; K.ctx.fillRect(h.x - h.w*.1, h.y - h.h*.5, h.w*.2, h.h*.5); }
      K.vgrad(K.Y(.66), K.H, [[0,"#3d2f50"],[1,"#1a1325"]]);
      const cx = K.W/2; K.poly([[cx - K.u*4, K.Y(.66)], [cx + K.u*4, K.Y(.66)], [cx + K.u*24, K.H], [cx - K.u*24, K.H]], "#4e4064");
      const R = rng(403);
      for (let i = 0; i < 9; i++) { const side = i % 2, x = side ? K.W - K.u*(4 + R()*26) : K.u*(4 + R()*26), y = K.Y(.76) + R()*(K.H - K.Y(.8)), s = K.u*(1.4 + R()*1.2); K.ctx.fillStyle = "#77708a"; K.ctx.fillRect(x - s*.7, y - s*1.6, s*1.4, s*1.6); K.disc(x, y - s*1.6, s*.7, "#77708a"); K.ctx.fillStyle = "rgba(0,0,0,.25)"; K.ctx.fillRect(x + s*.2, y - s*1.6, s*.5, s*1.6); }
    },
    after:(K) => {
      const L = lavender(K);
      for (const [x, y] of L.tw) { K.glow(x, y, K.u*2.4, "#c9a8ff", .45); K.ctx.fillStyle = "#d9c2ff"; K.ctx.fillRect(Math.round(x - K.u*.6), Math.round(y - K.u*.9), Math.max(1, Math.round(K.u*1.2)), Math.max(1, Math.round(K.u*1.8))); }
      for (const [x, y] of L.hw) { K.glow(x, y, K.u*3, "#ffd98a", .4); K.ctx.fillStyle = "#ffe2a0"; K.ctx.fillRect(Math.round(x - K.u*.9), Math.round(y - K.u*.8), Math.max(1, Math.round(K.u*1.8)), Math.max(1, Math.round(K.u*1.6))); }
    },
    anim:(K,tod,t) => {
      const L = lavender(K); K.glow(L.tx, L.top - K.u*8, K.u*4, "#e0b3ff", .35 + .3*Math.sin(t/400)*Math.sin(t/170));
      const R = rng(404), ctx = K.ctx;
      for (let i = 0; i < 7; i++) { const span = K.W + K.u*90, x = ((R()*span + t*K.u*.002*(.4 + R())) % span) - K.u*45, y = K.Y(.62 + R()*.3); ctx.fillStyle = rgba("#d9c8f0", .07 + R()*.05); ctx.beginPath(); ctx.ellipse(x, y, K.u*(18 + R()*18), K.u*(1.6 + R()*1.6), 0, 0, 7); ctx.fill(); }
    },
  },
  spear: {
    sky:(K) => {
      K.vgrad(0, K.Y(.66), [[0,"#090720"],[.55,"#2b1f5c"],[1,"#7d5ea8"]]);
      const R = rng(501); for (let i = 0; i < 150; i++) K.disc(R()*K.W, R()*K.Y(.55), K.u*(.05 + R()*.15), rgba("#ffffff", .3 + R()*.6));
      K.glow(K.W*.5, K.Y(.22), K.u*44, "#8f6bff", .25);
    },
    land:(K) => {
      K.peaks(K.Y(.63), K.u*16, 6, 502, "#2a2450", "#5c5590");
      const top = K.Y(.645); K.vgrad(top, K.H, [[0,"#85829f"],[1,"#3d3b57"]]);
      const cx = K.W/2; K.ctx.strokeStyle = "rgba(255,255,255,.09)"; K.ctx.lineWidth = Math.max(1, K.u*.15);
      for (let i = -14; i <= 14; i++) { K.ctx.beginPath(); K.ctx.moveTo(cx + i*K.u*6, top); K.ctx.lineTo(cx + i*K.u*20, K.H); K.ctx.stroke(); }
      for (let i = 1; i < 8; i++) { const y = top + (K.H - top)*Math.pow(i/8, 1.5); K.ctx.beginPath(); K.ctx.moveTo(0, y); K.ctx.lineTo(K.W, y); K.ctx.stroke(); }
      const R = rng(503); for (let i = 0; i < 10; i++) { const x = R()*K.W, y = top + K.u*3 + R()*(K.H - top), s = K.u*(.6 + R()*1.2); K.poly([[x - s, y], [x - s*.2, y - s*.7], [x + s*.8, y - s*.3], [x + s, y]], "#5b5878"); }
      for (const [fx, base, h, w, broken] of SPEAR_PILLARS) pillar(K, K.W*fx, K.Y(base), K.u*h, K.u*w, broken);
    },
    anim:(K,tod,t) => {
      const cx = K.W*.5, cy = K.Y(.22), ctx = K.ctx; ctx.save(); ctx.globalCompositeOperation = "lighter";
      const cols = ["#ff7ad9","#b48cff","#6fc3ff","#ffffff"];
      for (let i = 0; i < 4; i++) { const r = K.u*(5 + i*3.6), a0 = t/(1500 + i*500)*(i % 2 ? -1 : 1); ctx.lineWidth = Math.max(1, K.u*(1 - i*.18)); ctx.strokeStyle = rgba(cols[i], .6 - i*.1); ctx.beginPath(); ctx.arc(cx, cy, r, a0, a0 + Math.PI*1.2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, r, a0 + Math.PI*1.45, a0 + Math.PI*1.85); ctx.stroke(); }
      ctx.restore(); K.glow(cx, cy, K.u*7, "#ffffff", .22 + .12*Math.sin(t/500)); K.disc(cx, cy, K.u*1.6, "#140c30");
      const R = rng(505); for (let i = 0; i < 5; i++) { const x = K.W*(.08 + R()*.84), y = K.Y(.3 + R()*.18) + Math.sin(t/1300 + i*2)*K.u*1.4, s = K.u*(.8 + R()*1.4); K.poly([[x - s, y], [x - s*.3, y - s*.8], [x + s*.7, y - s*.5], [x + s, y + s*.3], [x, y + s*.6]], "#3b3460"); }
    },
  },
};
// the nine Champion's Halls: one grand hall, in each region's colours (main, dark, light, metal)
const HALL_COL = {1:["#d8423a","#5c1410","#ffb3a8","#ffd36b"], 2:["#c9a227","#4d3c08","#ffe9a3","#fff2c4"], 3:["#2f9e62","#0f3f26","#a8f0c8","#ffd36b"], 4:["#5b6fd6","#1c2466","#c7d0ff","#e8ecff"], 5:["#4a4a58","#121218","#d9d9e8","#c9a227"], 6:["#2f8fd6","#103a63","#bfe3ff","#ffd36b"], 7:["#ff8a3d","#7a2c0e","#ffd2b0","#fff2c4"], 8:["#9c3fd6","#38105a","#e3c2ff","#ffd36b"], 9:["#e2413b","#3a1670","#ffc0d6","#ffb347"], 10:["#8a96ad","#1b2233","#e4ebf7","#ffd36b"]};
function hallPaint(g){
  const [A, D, Lt, M] = HALL_COL[g];
  return {
    sky:(K) => {
      K.vgrad(0, K.Y(.72), [[0, mix(D, "#000000", .55)], [.55, D], [1, mix(A, D, .5)]]);
      K.glow(K.W/2, K.Y(.28), K.u*46, A, .35);
      const cx = K.W/2, cy = K.Y(.28), r = K.u*12; K.ctx.lineWidth = Math.max(1, K.u*.9); K.ctx.strokeStyle = rgba(M, .7);
      K.ctx.beginPath(); K.ctx.arc(cx, cy, r, 0, 7); K.ctx.stroke(); K.ctx.beginPath(); K.ctx.arc(cx, cy, r*.62, 0, 7); K.ctx.stroke();
      for (let i = 0; i < 8; i++) { const a = i*Math.PI/4; K.disc(cx + Math.cos(a)*r*.81, cy + Math.sin(a)*r*.81, K.u*.7, rgba(M, .8)); }
      K.disc(cx, cy, K.u*2.4, rgba(Lt, .85));
    },
    land:(K) => {
      const n = Math.ceil(K.W/(K.u*20)) + 1;
      for (let i = 0; i < n; i++) {
        const x = K.W/2 + (i - n/2)*K.u*20 + K.u*10; if (Math.abs(x - K.W/2) < K.u*15) continue;
        K.vgrad(K.Y(.06), K.Y(.72), [[0, Lt], [.35, mix(Lt, A, .35)], [1, mix(A, D, .55)]], x - K.u*2.4, x + K.u*2.4);
        K.ctx.fillStyle = M; K.ctx.fillRect(x - K.u*3.2, K.Y(.06), K.u*6.4, K.u*1.4); K.ctx.fillRect(x - K.u*3.2, K.Y(.7), K.u*6.4, K.u*1.4);
        K.poly([[x + K.u*4.6, K.Y(.12)], [x + K.u*11.4, K.Y(.12)], [x + K.u*11.4, K.Y(.46)], [x + K.u*8, K.Y(.51)], [x + K.u*4.6, K.Y(.46)]], A);
        K.ctx.fillStyle = M; K.ctx.fillRect(x + K.u*4.6, K.Y(.12), K.u*6.8, K.u*.8);
        K.disc(x + K.u*8, K.Y(.28), K.u*1.9, M); K.disc(x + K.u*8, K.Y(.28), K.u*1.1, A);
      }
      K.vgrad(K.Y(.72), K.H, [[0, mix(D, Lt, .18)], [1, mix(D, "#000000", .5)]]);
      const vx = K.W/2; K.ctx.strokeStyle = rgba(Lt, .1); K.ctx.lineWidth = Math.max(1, K.u*.15);
      for (let i = -14; i <= 14; i++) { K.ctx.beginPath(); K.ctx.moveTo(vx + i*K.u*3, K.Y(.72)); K.ctx.lineTo(vx + i*K.u*30, K.H + K.u*20); K.ctx.stroke(); }
      for (let i = 1; i < 8; i++) { const y = K.Y(.72) + (K.H - K.Y(.72))*Math.pow(i/8, 1.6); K.ctx.beginPath(); K.ctx.moveTo(0, y); K.ctx.lineTo(K.W, y); K.ctx.stroke(); }
      K.poly([[vx - K.u*6, K.Y(.72)], [vx + K.u*6, K.Y(.72)], [vx + K.u*40, K.H], [vx - K.u*40, K.H]], M);
      K.poly([[vx - K.u*5.1, K.Y(.72)], [vx + K.u*5.1, K.Y(.72)], [vx + K.u*37, K.H], [vx - K.u*37, K.H]], A);
      K.poly([[vx - K.u*1.2, K.Y(.72)], [vx + K.u*1.2, K.Y(.72)], [vx + K.u*9, K.H], [vx - K.u*9, K.H]], rgba(M, .55));
    },
    anim:(K, tod, t) => {
      const ctx = K.ctx; ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 3; i++) { const sx = K.W*(.2 + i*.3), a = Math.sin(t/1700 + i*2)*.45, L = K.S.h*1.1; ctx.fillStyle = rgba(i === 1 ? M : Lt, .08); ctx.beginPath(); ctx.moveTo(sx, -K.u*2); ctx.lineTo(sx + Math.sin(a - .08)*L, Math.cos(a - .08)*L); ctx.lineTo(sx + Math.sin(a + .08)*L, Math.cos(a + .08)*L); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    },
  };
}
for (let g = 1; g <= 9; g++) PAINT["hall" + g] = hallPaint(g);
PAINT.tower = hallPaint(10);   // the Battle Tower's hall: steel and gold
// a night stadium: floodlights, a packed crowd and a striped pitch
PAINT.stadium = {
  sky:(K) => {
    K.vgrad(0, K.Y(.62), [[0,"#05070f"],[1,"#141c33"]]);
    const R = rng(601); for (let i = 0; i < 60; i++) K.disc(R()*K.W, R()*K.Y(.14), K.u*(.05 + R()*.12), rgba("#ffffff", .3 + R()*.5));
    for (let r = 0; r < 5; r++) {   // the stands, each row a band of little fans
      const y0 = K.Y(.2 + r*.08); K.ctx.fillStyle = r % 2 ? "#1d2742" : "#232f50"; K.ctx.fillRect(0, y0, K.W, K.u*8);
      const cols = ["#ff5d6c","#ffd43b","#5fa8ff","#f2f5ff","#46d996","#ff9f43"];
      for (let x = R()*K.u; x < K.W; x += K.u*(1.1 + R()*.6)) { const c = cols[Math.floor(R()*6)]; K.disc(x, y0 + K.u*2.6, K.u*.62, rgba(c, .75)); K.ctx.fillStyle = rgba(c, .45); K.ctx.fillRect(x - K.u*.6, y0 + K.u*3.2, K.u*1.2, K.u*1.6); }
    }
    K.ctx.fillStyle = "#2c3758"; K.ctx.fillRect(0, K.Y(.6), K.W, K.u*2.4); K.ctx.fillStyle = "#ffd43b"; K.ctx.fillRect(0, K.Y(.6), K.W, Math.max(1, K.u*.4));
    for (const fx of [.08, .3, .7, .92]) { const x = K.W*fx, y = K.Y(.06); K.ctx.fillStyle = "#3a4466"; K.ctx.fillRect(x - K.u*.4, y, K.u*.8, K.Y(.2) - y); K.ctx.fillStyle = "#cfd8ee"; K.ctx.fillRect(x - K.u*4, y - K.u*3, K.u*8, K.u*4); for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) K.disc(x - K.u*3 + i*K.u*2, y - K.u*2 + j*K.u*2, K.u*.75, "#ffffff"); }
  },
  land:(K) => {
    const top = K.Y(.625); K.vgrad(top, K.H, [[0,"#4fae4f"],[1,"#22702c"]]);
    for (let i = 0; i < 10; i += 2) { const a = top + (K.H - top)*Math.pow(i/10, 1.4), b = top + (K.H - top)*Math.pow((i + 1)/10, 1.4); K.ctx.fillStyle = "rgba(255,255,255,.06)"; K.ctx.fillRect(0, a, K.W, b - a); }
    const cx = K.W/2, mid = K.Y(.76), ctx = K.ctx; ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = Math.max(1, K.u*.4);
    ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(K.W, mid); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, mid, K.u*14, K.u*3.6, 0, 0, 7); ctx.stroke();
    pokeEmblem(K, cx, mid, K.u*2.2);
  },
  after:(K) => { for (const fx of [.08, .3, .7, .92]) K.glow(K.W*fx, K.Y(.04), K.u*9, "#ffffff", .45); },
  anim:(K,tod,t) => {
    const ctx = K.ctx; ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const [i, fx] of [.08, .3, .7, .92].entries()) { const sx = K.W*fx, a = (fx < .5 ? -.5 : .5) + Math.sin(t/2200 + i*1.3)*.12, L = K.S.h*1.2; ctx.fillStyle = "rgba(220,232,255,.07)"; ctx.beginPath(); ctx.moveTo(sx, K.Y(.04)); ctx.lineTo(sx - Math.sin(a - .09)*L, K.Y(.04) + Math.cos(a - .09)*L); ctx.lineTo(sx - Math.sin(a + .09)*L, K.Y(.04) + Math.cos(a + .09)*L); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    const R = rng(603); for (let i = 0; i < 16; i++) { const x = R()*K.W, y = K.Y(.2 + R()*.38), al = Math.pow(Math.max(0, Math.sin(t/240 + R()*60)), 30); K.star4(x, y, K.u*1.4, "#ffffff", al); }   // camera flashes
  },
};
// the top of Sky Pillar at dusk: a sea of clouds, mossy ruined columns
PAINT.skypillar = {
  sky:(K) => {
    K.vgrad(0, K.Y(.62), [[0,"#2a2350"],[.5,"#7a4c78"],[.85,"#e2876a"],[1,"#f6c07a"]]);
    K.glow(K.W*.5, K.Y(.6), K.u*36, "#ffcf8a", .45);
    const R = rng(611); for (let i = 0; i < 70; i++) K.disc(R()*K.W, R()*K.Y(.3), K.u*(.05 + R()*.12), rgba("#ffffff", .25 + R()*.5));
    for (let i = 0; i < 7; i++) { const x = K.W*(.08 + R()*.84), y = K.Y(.12 + R()*.3); K.glow(x, y, K.u*1.6, "#ffb35a", .6); K.disc(x, y, K.u*.4, "#ffe0a0"); }   // floating lanterns
  },
  land:(K) => {
    K.ridge(K.Y(.6), K.u*3, 612, 3, "#b48aa8"); K.ridge(K.Y(.63), K.u*3, 613, 4, "#9a7398"); K.ridge(K.Y(.66), K.u*2.4, 614, 5, "#7e5f86");
    const top = K.Y(.68); K.vgrad(top, K.H, [[0,"#6f7d5a"],[1,"#38452e"]]);
    const cx = K.W/2; K.ctx.strokeStyle = "rgba(20,30,15,.35)"; K.ctx.lineWidth = Math.max(1, K.u*.2);
    for (let i = -10; i <= 10; i++) { K.ctx.beginPath(); K.ctx.moveTo(cx + i*K.u*7, top); K.ctx.lineTo(cx + i*K.u*22, K.H); K.ctx.stroke(); }
    for (let i = 1; i < 7; i++) { const y = top + (K.H - top)*Math.pow(i/7, 1.5); K.ctx.beginPath(); K.ctx.moveTo(0, y); K.ctx.lineTo(K.W, y); K.ctx.stroke(); }
    const R = rng(615); for (let i = 0; i < 26; i++) K.disc(R()*K.W, top + R()*(K.H - top), K.u*(.6 + R()*1.4), rgba("#7fa04e", .55));
    for (const [fx, base, h, w, broken] of [[.36,.67,12,2,1],[.64,.67,15,2,1],[.12,.78,60,5,0],[.88,.78,60,5,0]]) pillar(K, K.W*fx, K.Y(base), K.u*h, K.u*w, broken);
    K.ctx.fillStyle = "rgba(90,120,60,.5)"; for (const fx of [.12, .88]) K.ctx.fillRect(K.W*fx - K.u*2.5, K.Y(.3), K.u*5, K.u*1.2);
  },
  anim:(K,tod,t) => {
    const R = rng(616), ctx = K.ctx;
    for (let i = 0; i < 8; i++) { const span = K.W + K.u*90, x = ((R()*span + t*K.u*.0015*(.4 + R())) % span) - K.u*45, y = K.Y(.6 + R()*.1); ctx.fillStyle = rgba("#ffe4d6", .1 + R()*.08); ctx.beginPath(); ctx.ellipse(x, y, K.u*(16 + R()*16), K.u*(1.4 + R()*1.2), 0, 0, 7); ctx.fill(); }
  },
};
// a shrine path under cherry trees in full bloom
PAINT.blossom = {
  sky:(K) => { K.vgrad(0, K.Y(.6), [[0,"#7fc4f2"],[.7,"#c4e6fb"],[1,"#fbeef2"]]); },
  land:(K) => {
    K.ridge(K.Y(.55), K.u*8, 621, 1.6, "#b9c9de");
    const R = rng(622), tree = (x, y, s) => { K.ctx.fillStyle = "#5a3a32"; K.ctx.fillRect(x - s*.08, y - s*.7, s*.16, s*.72); K.poly([[x, y - s*.5], [x - s*.4, y - s*.95], [x - s*.32, y - s], [x + s*.02, y - s*.62]], "#5a3a32"); for (let i = 0; i < 9; i++) { const a = R()*Math.PI*2, d = R()*s*.45; K.disc(x + Math.cos(a)*d*1.2, y - s*.95 + Math.sin(a)*d*.6, s*(.22 + R()*.12), i % 3 ? "#ffc4d8" : "#ff9fbf"); } };
    for (let i = 0; i < 7; i++) tree(K.W*(i/6), K.Y(.62), K.u*(18 + R()*5));
    const top = K.Y(.62); K.vgrad(top, K.H, [[0,"#9cc46a"],[1,"#5e8f3e"]]);
    const cx = K.W/2; K.poly([[cx - K.u*5, top], [cx + K.u*5, top], [cx + K.u*34, K.H], [cx - K.u*34, K.H]], "#c9c2b6");
    K.ctx.strokeStyle = "rgba(90,80,70,.35)"; K.ctx.lineWidth = Math.max(1, K.u*.2);
    for (let i = 1; i < 9; i++) { const f = Math.pow(i/9, 1.4), y = top + (K.H - top)*f, hw = K.u*(5 + 29*f); K.ctx.beginPath(); K.ctx.moveTo(cx - hw, y); K.ctx.lineTo(cx + hw, y); K.ctx.stroke(); }
    const g = K.u, tx = cx, ty = K.Y(.62);   // the torii gate
    K.ctx.fillStyle = "#d8402e"; K.ctx.fillRect(tx - g*9, ty - g*22, g*2, g*22); K.ctx.fillRect(tx + g*7, ty - g*22, g*2, g*22); K.ctx.fillRect(tx - g*11, ty - g*18, g*22, g*1.6);
    K.poly([[tx - g*14, ty - g*23.5], [tx + g*14, ty - g*23.5], [tx + g*12, ty - g*21.6], [tx - g*12, ty - g*21.6]], "#2b2024"); K.ctx.fillStyle = "#c4352a"; K.ctx.fillRect(tx - g*12, ty - g*21.6, g*24, g*1.4);
    for (const s of [-1, 1]) { const lx = tx + s*g*16, ly = ty + g*4; K.ctx.fillStyle = "#a8a29a"; K.ctx.fillRect(lx - g*1, ly - g*7, g*2, g*7); K.ctx.fillRect(lx - g*2.2, ly - g*9.5, g*4.4, g*2.5); K.poly([[lx - g*3, ly - g*9.5], [lx + g*3, ly - g*9.5], [lx, ly - g*12]], "#8c867e"); }
  },
  after:(K) => { const tx = K.W/2, g = K.u, ly = K.Y(.62) + g*4; for (const s of [-1, 1]) K.glow(tx + s*g*16, ly - g*8.2, g*2.5, "#ffd98a", .5); },
  anim:(K,tod,t) => { const R = rng(623); for (let i = 0; i < 6; i++) K.star4(K.W*(.05 + R()*.9), K.Y(.2 + R()*.3), K.u*1.1, "#ffffff", Math.pow(Math.max(0, Math.sin(t/700 + R()*40)), 12)); },
};
// a coral reef around a sunken arch, light rippling down from the surface
PAINT.reef = {
  sky:(K) => { K.vgrad(0, K.Y(.7), [[0,"#5ec4e8"],[.25,"#1f7fb8"],[1,"#0d3d6e"]]); K.ridge(K.Y(.6), K.u*10, 631, 1.2, "#164c78"); },
  land:(K) => {
    const top = K.Y(.68); K.ridge(top, K.u*2, 632, 3, "#d9c48f"); K.vgrad(top + K.u*2, K.H, [[0,"#d9c48f"],[1,"#a88f5c"]]);
    const R = rng(633), coral = (x, y, s, c) => { for (let i = 0; i < 5; i++) { const a = -Math.PI/2 + (i - 2)*.38, L = s*(.6 + R()*.5); K.ctx.strokeStyle = c; K.ctx.lineWidth = Math.max(1, s*.13); K.ctx.lineCap = "round"; K.ctx.beginPath(); K.ctx.moveTo(x, y); K.ctx.quadraticCurveTo(x + Math.cos(a)*L*.3, y + Math.sin(a)*L*.6, x + Math.cos(a)*L, y + Math.sin(a)*L); K.ctx.stroke(); } };
    const ax = K.W*.68, ay = K.Y(.74), g = K.u;   // the sunken arch
    K.ctx.fillStyle = "#6d7f86"; K.ctx.fillRect(ax - g*10, ay - g*20, g*4, g*20); K.ctx.fillRect(ax + g*6, ay - g*16, g*4, g*16);
    K.ctx.lineWidth = g*4; K.ctx.strokeStyle = "#6d7f86"; K.ctx.beginPath(); K.ctx.arc(ax, ay - g*18, g*8, Math.PI, Math.PI*1.75); K.ctx.stroke();
    K.ctx.fillStyle = "rgba(90,140,90,.6)"; K.ctx.fillRect(ax - g*10, ay - g*6, g*4, g*6);
    const cols = ["#ff7a59","#ff9fbf","#b07bff","#ffd166","#4fd1c5"];
    for (let i = 0; i < 18; i++) { const side = i % 2, x = side ? K.W - K.u*(2 + R()*30) : K.u*(2 + R()*30), y = K.Y(.72) + R()*(K.H - K.Y(.72)); coral(x, y, K.u*(4 + R()*5), cols[i % 5]); }
    for (let i = 0; i < 10; i++) { const x = R()*K.W, y = K.Y(.74) + R()*(K.H - K.Y(.74)); K.ctx.fillStyle = "#3f8f4e"; for (let k = 0; k < 3; k++) K.ctx.fillRect(x + k*K.u*.8, y - K.u*(4 + R()*5), Math.max(1, K.u*.35), K.u*(4 + R()*5)); }
  },
  anim:(K,tod,t) => {
    const ctx = K.ctx; ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 5; i++) { const sx = K.W*(.1 + i*.2) + Math.sin(t/2600 + i)*K.u*4, w = K.u*(3 + i % 2*2); ctx.fillStyle = "rgba(200,240,255,.06)"; ctx.beginPath(); ctx.moveTo(sx - w, 0); ctx.lineTo(sx + w, 0); ctx.lineTo(sx + w*3 + K.u*6, K.Y(.75)); ctx.lineTo(sx - w + K.u*6, K.Y(.75)); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  },
};
const CRYSTALS = [[.08,.86,9,"#5ff3ff"],[.14,.8,6,"#b07bff"],[.92,.84,9,"#b07bff"],[.86,.78,6,"#5ff3ff"],[.3,.69,4,"#5ff3ff"],[.72,.69,4,"#ff8fe0"]];
const TERA = [[.06,.9,16],[.95,.88,14],[.22,.66,7],[.8,.65,8]];
function crystal(K, x, y, s, c){
  const shards = [[0,1.6,.38],[-.55,1.05,.3],[.5,1.2,.32],[-.95,.6,.24],[.95,.7,.26]];
  for (const [dx, h, w] of shards) { const bx = x + dx*s, top = y - h*s; K.poly([[bx - w*s, y], [bx - w*s, top + w*s], [bx, top], [bx + w*s, top + w*s], [bx + w*s, y]], mix(c, "#0a1022", .45)); K.poly([[bx, top], [bx + w*s, top + w*s], [bx + w*s, y], [bx, y]], mix(c, "#0a1022", .15)); K.poly([[bx - w*s*.5, top + w*s*1.2], [bx - w*s*.2, top + w*s*.6], [bx - w*s*.2, y - h*s*.2], [bx - w*s*.5, y - h*s*.1]], rgba("#ffffff", .35)); }
}
function tera(K, x, y, s){
  const cols = ["#ffd6f5","#9be7ff","#fff1a8","#c6b3ff"];
  const shards = [[0,2,.42],[-.7,1.3,.34],[.75,1.45,.36],[-1.25,.75,.26],[1.3,.8,.28]];
  shards.forEach(([dx, h, w], i) => { const bx = x + dx*s, top = y - h*s; K.poly([[bx - w*s, y], [bx - w*s*.9, top + w*s*1.2], [bx, top], [bx + w*s*.9, top + w*s*1.2], [bx + w*s, y]], rgba(cols[i % 4], .82)); K.poly([[bx, top], [bx + w*s*.9, top + w*s*1.2], [bx + w*s, y], [bx + w*s*.2, y]], rgba("#ffffff", .25)); });
}
function pokeEmblem(K, x, y, r){
  const c = K.ctx; K.disc(x, y, r, "#28323f");
  c.fillStyle = "#e2546b"; c.beginPath(); c.arc(x, y, r*.86, Math.PI, 0); c.fill();
  c.fillStyle = "#ffffff"; c.beginPath(); c.arc(x, y, r*.86, 0, Math.PI); c.fill();
  c.fillStyle = "#28323f"; c.fillRect(x - r, y - r*.08, r*2, r*.16);
  K.disc(x, y, r*.32, "#28323f"); K.disc(x, y, r*.2, "#ffffff");
}
function pcMachine(K){ const x = K.W/2 - K.u*30, y = K.Y(.5) - K.u*2.4, balls = []; for (let i = 0; i < 6; i++) balls.push([x - K.u*5.5 + (i % 3)*K.u*5.5, y - K.u*5.4 + Math.floor(i/3)*K.u*2.6]); return {x, y, balls}; }
function acacia(K, x, base, s){
  K.poly([[x - s*.8, base], [x + s*.8, base], [x + s*.5, base - s*9], [x + s*2.5, base - s*13], [x + s*1.8, base - s*13.5], [x - s*.2, base - s*10], [x - s*2.4, base - s*13.2], [x - s*2.9, base - s*12.6], [x - s*.6, base - s*9]], "#5c4127");
  const c = K.ctx; c.fillStyle = "#4b6a2a"; c.beginPath(); c.ellipse(x, base - s*14, s*10, s*2.6, 0, 0, 7); c.fill();
  c.fillStyle = "#64853a"; c.beginPath(); c.ellipse(x - s*1, base - s*14.8, s*8, s*1.6, 0, 0, 7); c.fill();
}
const lavCache = new Map();
function lavender(K){
  const key = [K.W, K.H, K.S.h, K.S.y].join("|"); if (lavCache.has(key)) return lavCache.get(key);
  const tx = K.W*.3, floors = [], tw = [], houses = [], hw = []; let y = K.Y(.66);
  for (const [hwid, h] of [[12,10],[10.5,9],[9,8],[7.5,7.5],[6,7]]) { const H = K.u*h, W = K.u*hwid; floors.push({x:tx - W, y:y - H, w:W*2, h:H}); for (const k of [-1, 0, 1]) tw.push([tx + k*W*.5, y - H*.5]); y -= H + K.u*1.2; }
  for (const [fx, s] of [[.58, 1], [.73, 1.25], [.9, .95], [.07, .9]]) { const x = K.W*fx, w = K.u*9*s, h = K.u*6*s, by = K.Y(.665); houses.push({x, y:by, w, h}); hw.push([x - w*.28, by - h*.62], [x + w*.28, by - h*.62]); }
  const r = {tx, top:y + K.u*1.2, floors, tw, houses, hw}; lavCache.set(key, r); return r;
}
const SPEAR_PILLARS = [[.33,.655,13,2.2,1],[.67,.655,16,2.2,0],[.2,.7,24,3.2,1],[.8,.7,30,3.2,0],[.06,.78,40,4.4,0],[.95,.8,30,4.4,1]];
function pillar(K, x, base, h, w, broken){
  const c = K.ctx, top = base - h;
  c.fillStyle = "rgba(0,0,0,.22)"; c.beginPath(); c.ellipse(x + w*.6, base, w*1.6, w*.35, 0, 0, 7); c.fill();
  c.fillStyle = "#8d8aac"; c.fillRect(x - w*1.3, base - w*.7, w*2.6, w*.7);
  c.fillStyle = "#b3b0cc"; c.fillRect(x - w, top, w*2, h - w*.7);
  c.fillStyle = "#8582a6"; c.fillRect(x + w*.35, top, w*.65, h - w*.7);
  c.fillStyle = "rgba(60,56,90,.35)"; for (const f of [-.55, -.1]) c.fillRect(x + f*w, top + w*.4, Math.max(1, w*.14), h - w*1.4);
  if (broken) K.poly([[x - w - 1, top + 1], [x - w*.6, top - w*1.1], [x - w*.1, top - w*.3], [x + w*.4, top - w*1.6], [x + w + 1, top - w*.5], [x + w + 1, top + 1]], "#b3b0cc");
  else { c.fillStyle = "#c9c6de"; c.fillRect(x - w*1.35, top - w*.8, w*2.7, w*.8); c.fillStyle = "#9d9abd"; c.fillRect(x - w*1.35, top - w*.15, w*2.7, w*.15); }
}
const cityCache = new Map();
function cityBlocks(K){
  const key = [K.W, K.H, K.S.h].join("|"); if (cityCache.has(key)) return cityCache.get(key);
  const R = rng(66), far = [], near = [];
  for (let x = -K.u*4; x < K.W; ) { const w = K.u*(6 + R()*8); far.push({x, w, y:K.Y(.72) - K.u*(12 + R()*20)}); x += w + K.u*R()*2; }
  for (let x = -K.u*4; x < K.W; ) { const w = K.u*(8 + R()*12); const tall = Math.abs(x + w/2 - K.W/2) < K.u*14 ? .4 : 1; near.push({x, w, y:K.Y(.74) - K.u*(10 + R()*24)*tall}); x += w + K.u*(1 + R()*3); }
  const r = {far, near}; cityCache.set(key, r); return r;
}
function paintBg(id, tod, V, S, pixel){
  const c = mkCanvas(V.W, V.H), ctx = c.getContext("2d"); ctx.imageSmoothingEnabled = !pixel;
  const P = PAINT[id], def = SCENE_BY.get(id), useTod = def.tod ? tod : "day";
  const img = pixel && hofArt(id, useTod);
  if (img) {   // 2D: the pixel-art picture fills the stage; a soft, darkened copy fills anything outside it
    const fit = (box, cover) => { const s = cover ? Math.max(box.w/img.width, box.h/img.height) : 1, w = img.width*s, h = img.height*s; return [box.x + (box.w - w)/2, box.y + box.h - h, w, h]; };
    const tiny = mkCanvas(32, 18), tx = tiny.getContext("2d"); tx.imageSmoothingEnabled = true; tx.drawImage(img, 0, 0, 32, 18);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(tiny, ...fit({x:0, y:0, w:V.W, h:V.H}, true));
    ctx.fillStyle = "rgba(10,12,24,.35)"; ctx.fillRect(0, 0, V.W, V.H);
    const [x, y, w, h] = fit(S, true);
    ctx.imageSmoothingEnabled = w < img.width; ctx.drawImage(img, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    c.art = true; return c;
  }
  P.sky(kit(ctx, V, S, pixel), useTod);
  const T = mkCanvas(V.W, V.H), tctx = T.getContext("2d");
  P.land(kit(tctx, V, S, pixel), useTod);
  if (def.tod && TINT[useTod]) { tctx.globalCompositeOperation = "source-atop"; tctx.fillStyle = TINT[useTod]; tctx.fillRect(0, 0, V.W, V.H); }
  ctx.drawImage(T, 0, 0);
  if (P.after) P.after(kit(ctx, V, S, pixel), useTod);
  return c;
}
function drawFx(K, sc, t){
  const def = SCENE_BY.get(sc.bg), tod = def.tod ? todOf(sc) : "day";
  const type = typeof def.fx.type === "string" ? def.fx.type : def.fx.type[tod];
  const [ya, yb] = def.fx.y || [0, 1];
  const R = rng(777), W = K.W, H = K.H, u = K.u, ctx = K.ctx, s = t/1000;
  const n = {snow:110, confetti:70, ember:60, dust:50, petal:40, leaf:30, firefly:34, sparkle:42, wisp:16, bubble:36}[type] || 40;
  const conf = ["#ff5d6c","#ffd43b","#46d996","#5fa8ff","#c98bff","#ffffff"];
  for (let i = 0; i < n; i++) {
    const a = R(), b = R(), c = R(), d = R();
    if (type === "snow") { const ph = (a + s*(.05 + .05*c)) % 1, x = (b*W + Math.sin(s*1.3 + d*6)*2*u + W) % W; K.disc(x, ph*H, (.22 + .38*c)*u, rgba("#ffffff", .85)); }
    else if (type === "petal" || type === "leaf") {
      const ph = (a + s*(.04 + .03*c)) % 1, x = ((b*W + ph*W*.35 + Math.sin(s*1.6 + d*7)*3*u) % W + W) % W, y = ph*H, r = (type === "leaf" ? .9 : .6)*u;
      ctx.save(); ctx.translate(x, y); ctx.rotate(s*2 + d*6); ctx.fillStyle = type === "leaf" ? (d > .5 ? "#e8962f" : "#8fbf3c") : (d > .5 ? "#ffc0d6" : "#ffffff"); ctx.beginPath(); ctx.ellipse(0, 0, r, r*.45, 0, 0, 7); ctx.fill(); ctx.restore();
    }
    else if (type === "firefly") { const x = b*W + Math.sin(s*.8 + d*7)*4*u, y = K.Y(.35 + .6*a) + Math.cos(s*.6 + c*7)*3*u, al = .5 + .5*Math.sin(s*2.5 + d*9); K.glow(x, y, u*2.2, "#e8ff7a", .55*al); K.disc(x, y, u*.3, rgba("#f6ffb8", al)); }
    else if (type === "ember") { const ph = (a + s*(.07 + .07*c)) % 1, x = b*W + Math.sin(s*2 + d*6)*2*u, y = H - ph*H*.95; K.disc(x, y, (.2 + .3*c)*u, rgba(c > .5 ? "#ffb347" : "#ff6a1f", 1 - ph)); }
    else if (type === "wisp") { const ph = (a + s*(.025 + .025*c)) % 1, x = b*W + Math.sin(s*.9 + d*7)*5*u, y = K.Y(.98) - ph*K.S.h*.85, al = Math.sin(ph*Math.PI)*.75; K.glow(x, y, u*3.2, "#b38cff", .5*al); K.disc(x, y, u*.7, rgba("#efe4ff", al)); }
    else if (type === "bubble") { const ph = (a + s*(.05 + .05*c)) % 1, x = b*W + Math.sin(s*2 + d*8)*1.5*u, y = H - ph*H*1.05, r = (.3 + .5*c)*u; ctx.strokeStyle = rgba("#e6fbff", .7*(1 - ph*.6)); ctx.lineWidth = Math.max(1, u*.18); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); K.disc(x - r*.35, y - r*.35, r*.25, rgba("#ffffff", .7)); }
    else if (type === "dust") { const x = (b*W + s*u*(.6 + c)) % W, y = K.Y(.1 + .8*a) + Math.sin(s*.5 + d*6)*u; K.disc(x, y, (.12 + .2*c)*u, rgba("#cfe0ff", .35 + .25*Math.sin(s + d*9))); }
    else if (type === "confetti") { const ph = (a + s*(.06 + .05*c)) % 1, x = (b*W + Math.sin(s*1.4 + d*6)*3*u + W) % W, y = ph*H; ctx.save(); ctx.translate(x, y); ctx.rotate(s*3 + d*7); ctx.scale(1, Math.cos(s*4 + d*5)); ctx.fillStyle = conf[i % conf.length]; ctx.fillRect(-u*.45, -u*.75, u*.9, u*1.5); ctx.restore(); }
    else { const x = b*W, y = K.Y(ya + (yb - ya)*a), al = Math.pow(Math.max(0, Math.sin(s*(1.2 + c*1.5) + d*12)), 4); K.star4(x, y, u*(.8 + c*1.2), "#ffffff", al); }
  }
}

// ---- items: trainer + Pokémon ----
function drawItems(ctx, K, S, items, t, o){
  const boxes = [], pixel = K.pixel, u = S.h/100;
  for (const x of items) {
    const it = x.it, gx = S.x + S.w*it.x, gy = S.y + S.h*it.y, ph = (x.n || 3)*1.7;
    if (!x.spr) continue;
    const fi = frameIdx(x.spr, t), img0 = x.spr.frames[fi] && x.spr.frames[fi].img; if (!img0) continue;
    if (x.trainer && x.style === "portrait" && !pixel) {
      const D = .27*S.h*it.s, bob = Math.sin(t/900)*.006*S.h, cx = gx, cy = gy - D/2 - .05*S.h + bob;
      ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(gx, gy, D*.36, D*.08, 0, 0, 7); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, D/2, 0, 7);
      const g = ctx.createRadialGradient(cx, cy - D*.2, 2, cx, cy, D/2); g.addColorStop(0, "#3a2f74"); g.addColorStop(1, "#161c3a"); ctx.fillStyle = g; ctx.fill(); ctx.clip();
      const sc2 = D / img0.width; if (it.f) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); }
      ctx.drawImage(img0, cx - D/2, cy + D/2 - img0.height*sc2, img0.width*sc2, img0.height*sc2); ctx.restore();
      ctx.lineWidth = D*.035; ctx.strokeStyle = "#ffffff"; ctx.beginPath(); ctx.arc(cx, cy, D/2 + ctx.lineWidth/2, 0, 7); ctx.stroke();
      ctx.lineWidth = D*.03; ctx.strokeStyle = "#8f6bff"; ctx.beginPath(); ctx.arc(cx, cy, D/2 + D*.07, 0, 7); ctx.stroke();
      boxes.push({key:x.key, x:cx - D/2, y:cy - D/2, w:D, h:D, name:x.name, gx, gy, sw:D*.36});
      if (o.names ?? o.sc.names) o.tags.push([x.name, cx, gy + u*1.5]);
      continue;
    }
    let w, h, lift = 0, bob = 0, br = 1;
    const animated = x.spr.frames.length > 1 && x.spr.total;
    const bb = x.spr.bb || {x:0, y:0, w:img0.width, h:img0.height};
    if (pixel) { const k = it.s; w = Math.max(1, Math.round(bb.w*k)); h = Math.max(1, Math.round(bb.h*k)); }
    else if (x.trainer) { h = (bb.h/480)*.40*S.h*it.s; w = bb.w*h/bb.h; }
    else if (x.hd) { h = Math.min(bb.h, hFrac(x.n)*S.h*it.s*1.12); w = bb.w*h/bb.h; }   // HD stills (large): sized by the Pokémon's height, never enlarged
    else { const k = natK(S.h, 540, it.s/1.15); h = bb.h*k; w = bb.w*k; }   // animated 3D: native size at a 540-tall stage
    const floats = !x.trainer && (it.fl !== undefined ? it.fl : floatsOf(x.n));
    if (floats) { lift = .09*S.h; bob = Math.sin(t/900 + ph)*.015*S.h; }
    else if (!animated) { bob = Math.max(0, Math.sin(t/650 + ph))*.004*S.h; br = 1 + .016*Math.sin(t/800 + ph); }
    let pop = 1;
    if (o.intro != null && !x.trainer) {
      const lt = o.intro - INTRO_DELAY - (x.idx || 0)*INTRO_STEP;
      if (lt < INTRO_POP) { ballDrop(ctx, S, gx, gy, lt, x.ball, pixel); continue; }
      pop = Math.min(1, (lt - INTRO_POP)/300);
    }
    const sw0 = x.trainer ? w*.42 : w*.36, air = lift + bob;
    let sw = sw0;
    if (floats) { const f = Math.max(.4, 1 - air/(.26*S.h)); sw = sw0*f; dropShadow(ctx, gx, gy, sw, sw*.2, (pixel ? .24 : .3)*f, pixel); }
    else dropShadow(ctx, gx, gy, sw*(pixel ? 1 : 1.12), sw*.21, pixel ? .32 : .4, pixel);
    ctx.save();
    let bx = gx, by = gy - lift - bob;
    if (pixel) { bx = Math.round(bx); by = Math.round(by); }
    ctx.translate(bx, by); if (it.f) ctx.scale(-1, 1); if (br !== 1) ctx.scale(2 - br, br);
    if (pop < 1) { const e = 1 + 2.2*Math.pow(pop - 1, 3) + 1.2*Math.pow(pop - 1, 2); ctx.scale(e, e); ctx.globalAlpha = Math.min(1, pop*2); }
    if (!pixel && !x.trainer && Number.isInteger(w/bb.w)) ctx.imageSmoothingEnabled = false;   // whole-number scale: crisp, unfiltered
    ctx.drawImage(img0, bb.x, bb.y, bb.w, bb.h, pixel || !x.trainer ? Math.round(-w/2) : -w/2, -h, w, h);
    ctx.restore();
    if (pop < 1) { const K2 = kit(ctx, {W:0, H:0}, S, pixel); K2.glow(gx, gy - lift - h*.45, h*(.35 + .6*pop), "#ffffff", .95*(1 - pop)); }
    boxes.push({key:x.key, x:gx - w/2, y:gy - lift - bob - h, w, h:h + lift, name:x.name, gx, gy, sw, img:img0, src:bb, ih:h, flip:!!it.f});
    if (o.names ?? o.sc.names) o.tags.push([x.name, gx, gy + u*1.5]);
  }
  return boxes;
}
function dropShadow(ctx, x, y, rx, ry, a, pixel){
  if (rx < .5 || a <= 0) return;
  if (pixel) { ctx.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`; ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y), Math.max(2, Math.round(rx)), Math.max(1, Math.round(ry)), 0, 0, 7); ctx.fill(); return; }
  ctx.save(); ctx.translate(x, y); ctx.scale(1, Math.max(.05, ry/rx));
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, `rgba(0,0,0,${a.toFixed(3)})`); g.addColorStop(.55, `rgba(0,0,0,${(a*.7).toFixed(3)})`); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, 7); ctx.fill(); ctx.restore();
}
function ballDrop(ctx, S, gx, gy, lt, ball, pixel){
  if (lt < 0) return;
  const img = ballEl(ball || "poke"), size = pixel ? 18 : Math.max(18, S.h*.06), FALL = 480;
  let y, rot = 0;
  if (lt < FALL) { const p = lt/FALL; y = gy - S.h*.8*(1 - p*p); rot = pixel ? 0 : p*7; }
  else { const q = (lt - FALL)/(INTRO_POP - FALL); y = gy - Math.abs(Math.sin(q*Math.PI*2))*S.h*.035*(1 - q); rot = Math.sin(q*Math.PI*5)*(pixel ? 0 : .4)*(1 - q); }
  dropShadow(ctx, gx, gy, size*.5*(lt < FALL ? .3 + .7*lt/FALL : 1), size*.12, pixel ? .3 : .35, pixel);
  ctx.save(); ctx.translate(pixel ? Math.round(gx) : gx, pixel ? Math.round(y - size/2) : y - size/2); ctx.rotate(rot);
  const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false; ctx.drawImage(img, -size/2, -size/2, size, size); ctx.imageSmoothingEnabled = sm; ctx.restore();
}
function camXf(sc, t, S){
  if (!sc.cam || sc.cam === "none" || state.ui.motion === "reduced") return null;
  const w = .5 - .5*Math.cos((t % CAM_P)/CAM_P*2*Math.PI);
  if (sc.cam === "zoom") return {z:1 + .1*w, cx:S.x + S.w*.5, cy:S.y + S.h*.74, dx:0};
  return {z:1.1, cx:S.x + S.w*.5, cy:S.y + S.h*.62, dx:(w - .5)*S.w*.08};
}
function nameTag(ctx, K, text, x, y, pixel){
  const u = K.u, fs = Math.max(pixel ? 8 : 10, u*2.6);
  ctx.save(); ctx.font = pixel ? `${Math.round(fs)}px "VT323", monospace` : `italic 700 ${fs}px "Chakra Petch", sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const w = ctx.measureText(text).width + u*3, h = fs*1.35;
  if (pixel) { ctx.fillStyle = "#28323f"; ctx.fillRect(Math.round(x - w/2) - 1, Math.round(y) - 1, Math.round(w) + 2, Math.round(h) + 2); ctx.fillStyle = "#f8f8ec"; ctx.fillRect(Math.round(x - w/2), Math.round(y), Math.round(w), Math.round(h)); ctx.fillStyle = "#1d2631"; }
  else { ctx.fillStyle = "rgba(11,18,34,.82)"; ctx.beginPath(); ctx.moveTo(x - w/2 + u, y); ctx.lineTo(x + w/2 + u, y); ctx.lineTo(x + w/2 - u, y + h); ctx.lineTo(x - w/2 - u, y + h); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#ffffff"; }
  ctx.fillText(text, x, y + h/2 + (pixel ? 1 : 0)); ctx.restore();
}
function pixelTags(ctx, tags, k, u){
  if (!tags || !tags.length) return;
  ctx.save(); const fs = Math.max(14, Math.round(u*2.8)); ctx.font = `${fs}px "VT323", monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const [txt, x0, y0] of tags) {
    const x = x0*k, y = y0*k, w = Math.round(ctx.measureText(txt).width + fs*.9), h = Math.round(fs*1.15), b = Math.max(2, Math.round(k/2));
    ctx.fillStyle = "#28323f"; ctx.fillRect(Math.round(x - w/2) - b, Math.round(y) - b, w + b*2, h + b*2);
    ctx.fillStyle = "#f8f8ec"; ctx.fillRect(Math.round(x - w/2), Math.round(y), w, h);
    ctx.fillStyle = "#1d2631"; ctx.fillText(txt, x, y + h/2 + 1);
  }
  ctx.restore();
}
function drawTitleFrame(ctx, K, S, sc, pixel, title, sub){
  const u = S.h/100;
  if (sc.frame) {
    if (pixel) { ctx.fillStyle = "#28323f"; const b = Math.max(2, Math.round(u*1.2)); ctx.fillRect(S.x, S.y, S.w, b); ctx.fillRect(S.x, S.y + S.h - b, S.w, b); ctx.fillRect(S.x, S.y, b, S.h); ctx.fillRect(S.x + S.w - b, S.y, b, S.h); ctx.fillStyle = "#f8f8ec"; ctx.fillRect(S.x + b, S.y + b, S.w - 2*b, 1); ctx.fillRect(S.x + b, S.y + S.h - b - 1, S.w - 2*b, 1); ctx.fillRect(S.x + b, S.y + b, 1, S.h - 2*b); ctx.fillRect(S.x + S.w - b - 1, S.y + b, 1, S.h - 2*b); }
    else {
      const m = u*1.6; const g = ctx.createLinearGradient(S.x, S.y, S.x + S.w, S.y + S.h); g.addColorStop(0, "#ffe6a3"); g.addColorStop(.5, "#c9973e"); g.addColorStop(1, "#ffe6a3");
      ctx.strokeStyle = g; ctx.lineWidth = u*.45; ctx.strokeRect(S.x + m, S.y + m, S.w - 2*m, S.h - 2*m); ctx.lineWidth = u*.15; ctx.strokeRect(S.x + m*1.6, S.y + m*1.6, S.w - 3.2*m, S.h - 3.2*m);
      ctx.fillStyle = g; for (const [cx, cy] of [[S.x + m, S.y + m], [S.x + S.w - m, S.y + m], [S.x + m, S.y + S.h - m], [S.x + S.w - m, S.y + S.h - m]]) { ctx.beginPath(); ctx.moveTo(cx, cy - u*1.4); ctx.lineTo(cx + u*1.4, cy); ctx.lineTo(cx, cy + u*1.4); ctx.lineTo(cx - u*1.4, cy); ctx.closePath(); ctx.fill(); }
    }
  }
  if (!sc.showTitle) return;
  ctx.save(); ctx.textBaseline = "middle";
  if (pixel) {
    const fs = Math.max(8, Math.round(u*5)), fs2 = Math.max(7, Math.round(u*3.6));
    ctx.font = `700 ${fs}px "Pixelify Sans", monospace`; const tw = ctx.measureText(title.toUpperCase()).width; ctx.font = `${fs2}px "VT323", monospace`; const sw = ctx.measureText(sub.toUpperCase()).width;
    const w = Math.round(Math.max(tw, sw) + u*6), h = Math.round(fs + fs2 + u*4), x = Math.round(S.x + u*4), y = Math.round(S.y + u*4);
    ctx.fillStyle = "#28323f"; ctx.fillRect(x - 2, y - 2, w + 4, h + 4); ctx.fillStyle = "#a9cbe2"; ctx.fillRect(x - 1, y - 1, w + 2, h + 2); ctx.fillStyle = "#f8f8ec"; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#d63a3a"; ctx.font = `700 ${fs}px "Pixelify Sans", monospace`; ctx.fillText(title.toUpperCase(), x + u*3, y + u*2 + fs/2);
    ctx.fillStyle = "#4f5d6b"; ctx.font = `${fs2}px "VT323", monospace`; ctx.fillText(sub.toUpperCase(), x + u*3, y + u*2.4 + fs + fs2/2);
  } else {
    const fs = u*5.4, x = S.x + u*4, y = S.y + u*5;
    ctx.font = `italic 700 ${fs}px "Chakra Petch", sans-serif`; const tw = ctx.measureText(title).width;
    const g = ctx.createLinearGradient(x, 0, x + tw + u*10, 0); g.addColorStop(0, "#ff6a3d"); g.addColorStop(1, "#ff9b4a");
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - u*1.5, y); ctx.lineTo(x + tw + u*7, y); ctx.lineTo(x + tw + u*5, y + fs*1.45); ctx.lineTo(x - u*3.5, y + fs*1.45); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.fillText(title, x + u*1.5, y + fs*.75);
    ctx.font = `italic 700 ${u*2.3}px "Chakra Petch", sans-serif`; const sw = ctx.measureText(sub.toUpperCase()).width;
    ctx.fillStyle = "#ffd43b"; ctx.beginPath(); ctx.moveTo(x + u*1, y + fs*1.45); ctx.lineTo(x + sw + u*6, y + fs*1.45); ctx.lineTo(x + sw + u*5, y + fs*1.45 + u*3.6); ctx.lineTo(x - u*.2, y + fs*1.45 + u*3.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#1b1400"; ctx.fillText(sub.toUpperCase(), x + u*2.6, y + fs*1.45 + u*1.85);
  }
  ctx.restore();
}
function sceneItems(sc, A, layout){
  if (layout === "lineup") {
    const n = A.mons.length, items = [{key:"t", trainer:true, it:{x:.13, y:.93, s:.95, f:0}, spr:A.trainer, style:A.trStyle, name:TRAINERS[A.tr]}];
    A.mons.forEach((m, i) => items.push({key:String(m.n), n:m.n, idx:m.idx, ball:m.ball, it:{x: n === 1 ? .6 : .32 + i*(.62/(n-1)), y: i % 2 ? .74 : .9, s:1.15, f:0}, spr:m.spr, hd:m.hd, name:m.name || NAT_BY.get(m.n).name}));
    return items.sort((a, b) => a.it.y - b.it.y);
  }
  const items = [{key:"t", trainer:true, it:itemOf(sc, "t", -1), spr:A.trainer, style:A.trStyle, name:TRAINERS[A.tr]}];
  A.mons.forEach((m, i) => items.push({key:String(m.n), n:m.n, idx:m.idx, ball:m.ball, it:itemOf(sc, String(m.n), i), spr:m.spr, hd:m.hd, name:m.name || NAT_BY.get(m.n).name}));
  return items.sort((a, b) => a.it.y - b.it.y);
}
function hofTitle(id, sc){ const T = TEAM_BY.get(id), who = state.name.trim(); return {title: sc.title.trim() || `${who ? who + "’s" : "My"} ${T.card} team`, sub:`Hall of Fame · ${T.sub}`}; }
function renderScene(ctx, V, S, t, o){
  const sc = o.sc, def = SCENE_BY.get(sc.bg), pixel = o.pixel;
  ctx.save(); ctx.imageSmoothingEnabled = !pixel; if (!pixel) ctx.imageSmoothingQuality = "high";
  const cam = o.layout === "lineup" ? null : camXf(sc, o.camT ?? t, S); o.cam = cam;
  if (cam) { ctx.save(); ctx.translate(cam.cx + cam.dx, cam.cy); ctx.scale(cam.z, cam.z); ctx.translate(-cam.cx, -cam.cy); }
  const art = o.art || !!(o.bg && o.bg.art);   // a pixel-art picture already has its sky, light and time of day
  if (o.bg) ctx.drawImage(o.bg, 0, 0); else ctx.clearRect(0, 0, V.W, V.H);
  const K = kit(ctx, V, S, pixel);
  const tod0 = todOf(sc);
  if (PAINT[sc.bg].anim && !art) PAINT[sc.bg].anim(K, def.tod ? tod0 : "day", t);
  o.tags = [];
  let boxes = o.A ? drawItems(ctx, K, S, sceneItems(sc, o.A, o.layout), t, o) : [];
  if (!pixel) for (const [txt, x, y] of o.tags) nameTag(ctx, K, txt, x, y, false);
  if (sc.fx) drawFx(K, sc, t);
  if (cam) {
    ctx.restore();
    const X = x => cam.cx + cam.dx + (x - cam.cx)*cam.z, Y = y => cam.cy + (y - cam.cy)*cam.z;
    boxes = boxes.map(b => ({...b, x:X(b.x), y:Y(b.y), w:b.w*cam.z, h:b.h*cam.z, ih:(b.ih || b.h)*cam.z, gx:X(b.gx), gy:Y(b.gy), sw:b.sw*cam.z}));
    o.tags = o.tags.map(([s2, x, y]) => [s2, X(x), Y(y)]);
  }
  if (def.tod && tod0 === "night" && !art) { ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = "rgba(120,140,220,1)"; ctx.globalAlpha = .28; ctx.fillRect(0, 0, V.W, V.H); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; }
  if (def.tod && tod0 === "sunset" && !art) { ctx.fillStyle = "rgba(255,150,90,.08)"; ctx.fillRect(0, 0, V.W, V.H); }
  const T = hofTitle(o.teamId, sc); drawTitleFrame(ctx, K, S, {...sc, showTitle: o.title !== false && sc.showTitle, frame: o.frame !== false && sc.frame}, pixel, T.title, T.sub);
  if (!pixel) { const g = ctx.createRadialGradient(V.W/2, V.H/2, Math.min(V.W, V.H)*.45, V.W/2, V.H/2, Math.max(V.W, V.H)*.75); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.35)"); ctx.fillStyle = g; ctx.fillRect(0, 0, V.W, V.H); }
  ctx.restore();
  return boxes;
}


// ---- stages: one renderer, three places (start screen, Hall of Fame, View team) ----
function stageRect(V){ const ar = V.W/V.H, a = ar >= 16/9 ? 16/9 : ar >= 4/3 ? ar : 4/3; let w, h; if (ar >= a) { h = V.H; w = h*a; } else { w = V.W; h = w/a; } return {x:(V.W - w)/2, y:(V.H - h)/2, w, h}; }
class Stage {
  constructor(canvas, o){ this.cvs = canvas; this.ctx = canvas.getContext("2d"); this.o = o; this.A = null; this.aKey = ""; this.bgKey = ""; this.boxes = []; this.sel = null; this.raf = 0; this.running = false; this.t0 = performance.now(); this.intro = null; this.camT = 0; this.lastNow = 0; this.camXf = null; }
  playIntro(){ this.intro = {pending:true}; }
  toScene(p){ const c = this.camXf; if (!c) return p; const k = state.mode === "2d" ? this.k : 1, x = p.x/k, y = p.y/k; return {x:(c.cx + (x - c.cx - c.dx)/c.z)*k, y:(c.cy + (y - c.cy)/c.z)*k}; }
  get team(){ return this.o.team(); }
  resize(){
    const r = this.cvs.getBoundingClientRect(), W = Math.max(1, r.width), H = Math.max(1, r.height), dpr = Math.min(window.devicePixelRatio || 1, 2);
    let sc = dpr; if (W*H*sc*sc > 3.6e6) sc = Math.sqrt(3.6e6/(W*H));
    this.cvs.width = Math.round(W*sc); this.cvs.height = Math.round(H*sc);
    this.V = {W:this.cvs.width, H:this.cvs.height}; this.S = stageRect(this.V);
    this.k = Math.max(1, Math.round(this.S.h/(this.o.lowH || 270)));
    this.low = mkCanvas(Math.ceil(this.V.W/this.k), Math.ceil(this.V.H/this.k)); this.lctx = this.low.getContext("2d");
    this.LV = {W:this.low.width, H:this.low.height}; this.LS = {x:Math.round(this.S.x/this.k), y:Math.round(this.S.y/this.k), w:Math.round(this.S.w/this.k), h:Math.round(this.S.h/this.k)};
    this.bgKey = "";
  }
  async load(){
    const id = this.team, sc = sceneOf(id), mode = state.mode, t = teamOf(id), tr = trainerOf(id);
    const trStyle = mode === "2d" ? "pixel" : "hd";
    const still = n => !!(sc.items[String(n)] && sc.items[String(n)].st);
    const key = [id, mode, trStyle, state.shiny, t.map(n => n + (still(n) ? "s" : "a") + ballOf(id, n) + "/" + nickOf(id, n)).join(","), (state.teamShiny[id] || []).join(","), tr].join("|");
    if (this.A && this.aKey === key) return;
    this.aKey = key; this.o.status && this.o.status("Setting the stage…");
    const keyOf = n => { const sh = isShinyMember(id, n) || state.shiny; return mode === "2d" ? spKey(n, sh, "2d") : !still(n) ? spKey(n, sh, "3d") : hdKey(n, sh); };
    try {
      const mons = await Promise.all(t.map(async (n, idx) => ({n, idx, ball:ballOf(id, n), name:nickOf(id, n), hd: mode !== "2d" && still(n), spr: await getSprite(keyOf(n), n)})));
      const trainer = await getSprite(trStyle === "pixel" ? "t2d" : "t3f", tr);
      try { await Promise.all([document.fonts.load('italic 700 30px "Chakra Petch"'), document.fonts.load('700 20px "Pixelify Sans"'), document.fonts.load('20px "VT323"')]); } catch(e){}
      if (this.aKey !== key) return;
      this.A = {mons: mons.filter(m => m.spr), trainer, trStyle, tr};
      this.o.status && this.o.status(null);
    } catch(e){ this.aKey = ""; this.o.status && this.o.status("Some sprites didn’t load. Close and reopen to try again."); }
  }
  start(){ this.running = true; this.t0 = performance.now(); this.lastNow = 0; this.resize(); cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(n => this.frame(n)); return this.load(); }
  stop(){ this.running = false; cancelAnimationFrame(this.raf); }
  frame(now){
    if (!this.running) return;
    const t = now - this.t0, id = this.team, sc = sceneOf(id), pixel = state.mode === "2d";
    const dt = this.lastNow ? Math.min(100, now - this.lastNow) : 0; this.lastNow = now;
    if (!this.sel && !(hofDrag && this === hofStage)) this.camT += dt;
    if (this.intro && this.intro.pending && this.A) this.intro = {t0:t};
    let iv = this.intro && !this.intro.pending ? t - this.intro.t0 : null; if (iv !== null && iv > INTRO_LEN) { this.intro = null; iv = null; }
    const V = pixel ? this.LV : this.V, S = pixel ? this.LS : this.S, ctx = pixel ? this.lctx : this.ctx;
    // in 2D a pixel-art background is drawn at full resolution so its pixels stay even; the sprites go on top
    const hiArt = pixel && !!hofArt(sc.bg, SCENE_BY.get(sc.bg).tod ? todOf(sc) : "day");
    const key = [sc.bg, todOf(sc), V.W, V.H, pixel, hiArt].join("|");
    if (this.bgKey !== key) { this.bg = hiArt ? paintBg(sc.bg, todOf(sc), this.V, this.S, true) : paintBg(sc.bg, todOf(sc), V, S, pixel); this.bgKey = key; }
    const ro = {pixel, sc, A:this.A, bg:hiArt ? null : this.bg, art:hiArt, teamId:id, layout:this.o.layout, title:this.o.title, frame:this.o.frame, names:this.o.names, intro:iv, camT:this.camT};
    let boxes = renderScene(ctx, V, S, t, ro); this.lastTags = ro.tags || []; this.camXf = ro.cam || null;
    if (hiArt) {
      const c = this.ctx, cam = ro.cam, k = this.k; c.save(); c.imageSmoothingEnabled = false;
      if (cam) { c.translate((cam.cx + cam.dx)*k, cam.cy*k); c.scale(cam.z, cam.z); c.translate(-cam.cx*k, -cam.cy*k); }
      c.drawImage(this.bg, 0, 0); c.restore();
    }
    if (pixel) { this.ctx.imageSmoothingEnabled = false; this.ctx.drawImage(this.low, 0, 0, this.low.width*this.k, this.low.height*this.k); const k = this.k; pixelTags(this.ctx, this.lastTags, k, this.S.h/100); boxes = boxes.map(b => ({...b, x:b.x*k, y:b.y*k, w:b.w*k, h:b.h*k, ih:(b.ih || b.h)*k, gx:b.gx*k, gy:b.gy*k, sw:b.sw*k})); }
    this.boxes = boxes;
    const sel = this.sel && boxes.find(b => b.key === this.sel), c = this.ctx, px = this.V.W/Math.max(1, this.cvs.getBoundingClientRect().width);
    if (sel && this.o.sel === "ring") { c.save(); c.lineWidth = 3*px; c.strokeStyle = state.mode === "2d" ? "#d63a3a" : "#ffd43b"; c.globalAlpha = .65 + .35*Math.sin(t/300); c.beginPath(); c.ellipse(sel.gx, sel.gy, sel.sw*1.25 + 6*px, (sel.sw*1.25 + 6*px)*.24, 0, 0, 7); c.stroke(); c.restore(); }
    else if (sel) { const p = 6*px; c.save(); c.setLineDash([8*px, 6*px]); c.lineDashOffset = -t/40; c.lineWidth = 2*px; c.strokeStyle = "#ffd43b"; c.strokeRect(sel.x - p, sel.y - p, sel.w + p*2, sel.h + p*2); c.restore(); }
    this.raf = requestAnimationFrame(n => this.frame(n));
  }
  point(e){ const r = this.cvs.getBoundingClientRect(); return {x:(e.clientX - r.left)*this.cvs.width/r.width, y:(e.clientY - r.top)*this.cvs.height/r.height}; }
  hit(p){
    let loose = null;
    for (let i = this.boxes.length - 1; i >= 0; i--) {
      const b = this.boxes[i], pad = 8*(this.V.W/Math.max(1, this.cvs.getBoundingClientRect().width));
      if (p.x < b.x - pad || p.x > b.x + b.w + pad || p.y < b.y - pad || p.y > b.y + b.h + pad) continue;
      if (!loose) loose = b;
      if (alphaAt(b, p) > 30) return b;
    }
    return loose;
  }
}
const alphaCache = new WeakMap();
function alphaAt(b, p){
  const img = b.img; if (!img) return 255;
  let m = alphaCache.get(img);
  if (!m) { try { const W = img.width, H = img.height, c = mkCanvas(W, H), x = c.getContext("2d", {willReadFrequently:true}); x.drawImage(img, 0, 0); m = {W, H, d:x.getImageData(0, 0, W, H).data}; } catch(e){ m = {W:0}; } alphaCache.set(img, m); }
  if (!m.W) return 255;
  const ih = b.ih || b.h, sr = b.src || {x:0, y:0, w:m.W, h:m.H}; let u = (p.x - b.x)/b.w, v = (p.y - b.y)/ih;
  if (b.flip) u = 1 - u;
  u = (sr.x + u*sr.w)/m.W; v = (sr.y + v*sr.h)/m.H;
  let best = 0;
  for (const [du, dv] of [[0,0],[.03,0],[-.03,0],[0,.03],[0,-.03]]) { const uu = u + du, vv = v + dv; if (uu < 0 || uu > 1 || vv < 0 || vv > 1) continue; const a = m.d[((Math.min(m.H-1, Math.floor(vv*m.H)))*m.W + Math.min(m.W-1, Math.floor(uu*m.W)))*4 + 3]; if (a > best) best = a; }
  return best;
}
const statusFor = id => msg => { const s = $(id); if (!msg) { s.hidden = true; return; } s.innerHTML = msg; s.hidden = false; };
const showHofStatus = statusFor("hofStatus"), hideHofStatus = () => showHofStatus(null);
const hofStage = new Stage($("hofCanvas"), {team:() => state.team, lowH:270, layout:"custom", status:showHofStatus});
const startStage = new Stage($("startCanvas"), {team:() => "all", lowH:360, layout:"custom", title:false, frame:false});
addEventListener("resize", () => { for (const st of [hofStage, startStage]) if (st.running) st.resize(); });

// ---- Hall of Fame overlay (editable art scene) ----
let hofDrag = null, hofBusy = false;
function openHof(){
  if (!team().length) { toast("Add at least one Pokémon to stage a Hall of Fame scene."); return; }
  closeModal(); hideTip();
  $("hof").hidden = false; document.documentElement.classList.add("noscroll");
  hofStage.sel = null;
  hofReturn = null; $("hofName").textContent = `${G().title.replace(" dream team", "")} · ${state.mode === "2d" ? "2D" : "3D"} Hall of Fame`;
  $("hofPanel").hidden = true; $("hofEdit").setAttribute("aria-pressed", "false"); renderSelBar();
  const hint = $("hofHint"); hint.style.opacity = "1"; clearTimeout(openHof.t); openHof.t = setTimeout(() => hint.style.opacity = "0", 5000);
  if (sceneOf(state.team).intro) hofStage.playIntro();
  hofStage.start(); $("hofClose").focus();
}
function closeHof(){ hofStage.stop(); $("hof").hidden = true; document.documentElement.classList.remove("noscroll"); const b = $("hofBtn"); if (b) b.focus(); }
// closing by hand goes back to the Hall of Fame menu when that's where the scene was opened from
function hofDone(){ closeHof(); if (hofReturn) { galMode = hofReturn; hofReturn = null; openScreen("hofgal"); } }
$("hofCanvas").addEventListener("pointerdown", e => {
  e.preventDefault();
  const p = hofStage.point(e), hit = hofStage.hit(p), sc = sceneOf(state.team);
  if (!hit) { hofStage.sel = null; renderSelBar(); return; }
  hofStage.sel = hit.key; renderSelBar();
  const it = sc.items[hit.key]; if (!it) return;
  const S = hofStage.S, ps = hofStage.toScene(p);
  hofDrag = {key:hit.key, ox:ps.x - (S.x + S.w*it.x), oy:ps.y - (S.y + S.h*it.y), moved:false};
  try { $("hofCanvas").setPointerCapture(e.pointerId); } catch(err){}
  $("hofCanvas").classList.add("dragging"); $("hofHint").style.opacity = "0";
});
window.addEventListener("pointermove", e => {
  if (!hofDrag) return;
  const p = hofStage.toScene(hofStage.point(e)), it = sceneOf(state.team).items[hofDrag.key], S = hofStage.S;
  it.x = Math.min(.97, Math.max(.03, (p.x - hofDrag.ox - S.x)/S.w)); it.y = Math.min(.99, Math.max(.5, (p.y - hofDrag.oy - S.y)/S.h)); hofDrag.moved = true;
});
const hofUp = () => { if (!hofDrag) return; if (hofDrag.moved) save(); hofDrag = null; $("hofCanvas").classList.remove("dragging"); };
window.addEventListener("pointerup", hofUp); window.addEventListener("pointercancel", hofUp);
let sizeSaveT = 0;
$("hofSel").addEventListener("input", e => {
  if (e.target.id !== "hofSize") return;
  const it = sceneOf(state.team).items[hofStage.sel]; if (!it) return;
  it.s = (+e.target.value)/100; $("hofSizeOut").textContent = e.target.value + "%";
  clearTimeout(sizeSaveT); sizeSaveT = setTimeout(save, 300);
});
document.addEventListener("keydown", e => {
  if ($("hof").hidden || !hofStage.sel || e.target.closest("input:not([type=range]), textarea, select")) return;
  const it = sceneOf(state.team).items[hofStage.sel]; if (!it) return;
  if (e.key === "+" || e.key === "=") it.s = Math.min(SZ_MAX/100, Math.round(it.s*10 + 1)/10);
  else if (e.key === "-" || e.key === "_") it.s = Math.max(SZ_MIN/100, Math.round(it.s*10 - 1)/10);
  else return;
  e.preventDefault(); save(); renderSelBar();
});
function renderSelBar(){
  const bar = $("hofSel"), sc = sceneOf(state.team), key = hofStage.sel;
  if (!key || !sc.items[key]) { bar.hidden = true; return; }
  const it = sc.items[key], isT = key === "t", n = +key;
  const name = isT ? TRAINERS[trainerOf(state.team)] : nickOf(state.team, n);
  const fl = !isT && (it.fl !== undefined ? it.fl : floatsOf(n));
  const pct = Math.round(it.s*100);
  bar.innerHTML = `<b>${esc(name)}</b>
    <span class="szctl"><button class="btn sm" type="button" data-hs="smaller" aria-label="Smaller" ${pct <= SZ_MIN ? "disabled" : ""}>−</button><input type="range" id="hofSize" min="${SZ_MIN}" max="${SZ_MAX}" step="10" value="${pct}" aria-label="Size of ${esc(name)}"><output id="hofSizeOut" for="hofSize">${pct}%</output><button class="btn sm" type="button" data-hs="bigger" aria-label="Bigger" ${pct >= SZ_MAX ? "disabled" : ""}>+</button></span>
    <button class="btn sm" type="button" data-hs="flip">⇋ Flip</button>
    ${isT ? "" : `<button class="btn sm" type="button" data-hs="float" aria-pressed="${fl}">${fl ? "⇣ Land" : "⇡ Float"}</button>`}
    ${isT || state.mode === "2d" ? "" : `<button class="btn sm" type="button" data-hs="still" aria-pressed="${!!it.st}" title="Animated sprites move like the games. Stills are sharper but only breathe and bob.">${it.st ? "▶ Animate" : "◼ Still (sharper)"}</button>`}
    <button class="btn sm" type="button" data-hs="reset">Reset</button>
    <button class="btn sm primary" type="button" data-hs="done">Done</button>`;
  bar.hidden = false;
}
$("hofSel").addEventListener("click", e => {
  const b = e.target.closest("[data-hs]"); if (!b) return;
  const sc = sceneOf(state.team), it = sc.items[hofStage.sel]; if (!it) return;
  const a = b.dataset.hs;
  if (a === "smaller") it.s = Math.max(SZ_MIN/100, Math.round(it.s*10 - 1)/10);
  if (a === "bigger") it.s = Math.min(SZ_MAX/100, Math.round(it.s*10 + 1)/10);
  if (a === "flip") it.f = it.f ? 0 : 1;
  if (a === "float") { const n = +hofStage.sel, cur = it.fl !== undefined ? it.fl : floatsOf(n); it.fl = !cur; }
  if (a === "still") { it.st = !it.st; save(); renderSelBar(); hofStage.load(); return; }
  if (a === "reset") { delete sc.items[hofStage.sel]; save(); renderSelBar(); hofStage.load(); return; }
  if (a === "done") { hofStage.sel = null; renderSelBar(); return; }
  save(); renderSelBar();
});
function hofPanel(){
  const sc = sceneOf(state.team), def = SCENE_BY.get(sc.bg), two = state.mode === "2d";
  const seg = (k, opts, dis = false) => `<div class="segrow" data-k="${k}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${sc[k] === v}" ${dis ? "disabled" : ""}>${l}</button>`).join("")}</div>`;
  const sw = (k, label) => `<div class="hrow"><span>${label}</span><button class="switch" type="button" role="switch" data-sw="${k}" aria-checked="${!!sc[k]}" aria-label="${label}"></button></div>`;
  const P = $("hofPanel");
  P.innerHTML = `
    <div class="hp-h">Background</div>
    <div class="bg-grid">${SCENES.filter(s => bgUsable(s.id, state.team) || !isExclusive(unlockOf("bg", s.id))).map(s => { const ok = bgUsable(s.id, state.team), it = unlockOf("bg", s.id);
      return `<button class="bg-opt${ok ? "" : " locked"}" type="button" data-bg="${s.id}" aria-pressed="${s.id === sc.bg}"><canvas width="192" height="108" data-thumb="${s.id}"></canvas><span>${s.name}${ok && !owns("bg", s.id) ? ` <small class="meta">· team default</small>` : ""}</span>${ok ? "" : `<i class="lock">${fmtPP(it.price)}</i>`}</button>`; }).join("")}
      ${SCENES.some(s => !bgUsable(s.id, state.team) && isExclusive(unlockOf("bg", s.id))) ? `<button class="bg-opt mystery" type="button" data-bgmore><span class="q">?</span><span>Gym Leader rewards</span></button>` : ""}</div>
    <div class="hp-h">Time of day${def.tod ? "" : ` <span class="meta">· not for this scene</span>`}</div>
    ${seg("tod", [["live","My clock"],["day","Day"],["sunset","Sunset"],["night","Night"]], !def.tod)}
    ${def.tod && sc.tod === "live" ? `<p class="note">Follows the time on this device. It’s ${clockTod()} right now.</p>` : ""}
    ${two ? "" : `<p class="note">Tip: tap a Pokémon in the scene to switch just that one between animated and a sharper still.</p>`}
    <div class="hp-h">Camera</div>
    ${seg("cam", [["none","Still"],["zoom","Slow zoom"],["pan","Pan"]])}
    <p class="note">Camera moves are included when you save a GIF.</p>
    <div class="hp-h">Extras</div>
    <div class="hrow"><span>Poké Ball entrance</span><span class="hrow-r"><button class="btn sm" type="button" id="hofReplay">▶ Replay</button><button class="switch" type="button" role="switch" data-sw="intro" aria-checked="${!!sc.intro}" aria-label="Poké Ball entrance when the scene opens"></button></span></div>
    ${sw("fx", "Weather and effects")}${sw("names", "Name tags")}${sw("frame", "Gold frame")}${sw("showTitle", "Title banner")}
    <label class="field">Title<input id="hofTitleIn" maxlength="40" placeholder="${esc(hofTitle(state.team, {...sc, title:""}).title)}" value="${esc(sc.title)}"></label>
    <div class="actions"><button class="btn" type="button" id="hofReset">Reset positions</button></div>`;
  P.querySelectorAll("canvas[data-thumb]").forEach(c => {
    const id = c.dataset.thumb, tod = SCENE_BY.get(id).tod ? (id === "city" && sc.bg !== "city" ? "night" : todOf(sc)) : "day";
    if (two) { const img = paintBg(id, tod, {W:96, H:54}, {x:0, y:0, w:96, h:54}, true), x = c.getContext("2d"); x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, 192, 108); }
    else c.getContext("2d").drawImage(paintBg(id, tod, {W:192, H:108}, {x:0, y:0, w:192, h:108}, false), 0, 0);
  });
}
$("hofPanel").addEventListener("click", e => {
  const sc = sceneOf(state.team);
  const bg = e.target.closest("[data-bg]");
  if (bg) { const id = bg.dataset.bg, use = () => { const s2 = sceneOf(state.team); s2.bg = id; if (id === "city" && s2.tod === "day") s2.tod = "live"; save(); hofPanel(); };
    if (bgUsable(id, state.team)) use(); else offerUnlock(unlockOf("bg", id), use); return; }
  if (e.target.closest("[data-bgmore]")) { toast("Some backgrounds are only given out by Gym Leaders. Keep earning badges!"); return; }
  const sb = e.target.closest(".segrow button"); if (sb && !sb.disabled) { const k = sb.parentElement.dataset.k; sc[k] = sb.dataset.v; save(); hofPanel(); if (k === "motion" || k === "trStyle") hofStage.load(); return; }
  const sw = e.target.closest("[data-sw]"); if (sw) { sc[sw.dataset.sw] = !sc[sw.dataset.sw]; sw.setAttribute("aria-checked", sc[sw.dataset.sw]); save(); return; }
  if (e.target.closest("#hofReplay")) { hofStage.playIntro(); return; }
  if (e.target.closest("#hofReset")) { sc.items = {}; hofStage.sel = null; renderSelBar(); save(); hofStage.load(); toast("Positions reset."); }
});
$("hofPanel").addEventListener("input", e => { if (e.target.id === "hofTitleIn") { sceneOf(state.team).title = e.target.value.slice(0,40); save(); } });
async function hofExport(kind){
  if (hofBusy || !hofStage.A) return;
  hofBusy = true;
  const id = state.team, sc = sceneOf(id), pixel = state.mode === "2d";
  const outW = kind === "gif" ? 960 : 1920, outH = outW*9/16;
  const V = pixel ? {W:480, H:270} : {W:outW, H:outH}, S = {x:0, y:0, w:V.W, h:V.H};
  const src = mkCanvas(V.W, V.H), sctx = src.getContext("2d", {willReadFrequently:true});
  const out = mkCanvas(outW, outH), octx = out.getContext("2d", {willReadFrequently:true}); octx.imageSmoothingEnabled = !pixel;
  const bg = paintBg(sc.bg, todOf(sc), V, S, pixel);
  const frame = (t, ct) => { const ro = {pixel, sc, A:hofStage.A, bg, teamId:id, layout:"custom", camT:ct}; renderScene(sctx, V, S, t, ro); if (pixel || V.W !== outW) octx.drawImage(src, 0, 0, outW, outH); else octx.drawImage(src, 0, 0); if (pixel) pixelTags(octx, ro.tags, outW/V.W, outH/100); };
  const fname = `hall-of-fame-${TEAM_BY.get(id).card.toLowerCase().replace(/[^a-z]+/g, "-")}-${state.mode}.${kind}`;
  try {
    let blob;
    if (kind === "png") { frame(performance.now() - hofStage.t0, hofStage.camT); blob = await new Promise(r => out.toBlob(r, "image/png")); }
    else {
      if (!window.GifKit) { showHofStatus("The GIF maker didn’t load. Save as PNG instead."); return; }
      const camOn = sc.cam && sc.cam !== "none", step = camOn ? 75 : 60, n = camOn ? Math.round(CAM_P/step) : 66, base = performance.now() - hofStage.t0;
      const sample = new Uint8Array(outW*outH*4*3);
      for (let k = 0; k < 3; k++) { frame(base + k*step*n/3, k*step*n/3); sample.set(octx.getImageData(0, 0, outW, outH).data, k*outW*outH*4); }
      const palette = GifKit.quantize(sample, 256, {format:"rgb565"});
      const enc = GifKit.GIFEncoder();
      for (let i = 0; i < n; i++) {
        frame(base + i*step, i*step);
        enc.writeFrame(GifKit.applyPalette(octx.getImageData(0, 0, outW, outH).data, palette, "rgb565"), outW, outH, i === 0 ? {palette, delay:step} : {delay:step});
        if (i % 2 === 0) { showHofStatus(`Making your GIF… ${Math.round(i/n*100)}%`); await new Promise(r => setTimeout(r, 0)); }
      }
      enc.finish(); blob = new Blob([enc.bytes()], {type:"image/gif"});
    }
    hideHofStatus();
    if (kind === "gif") { state.games.gifs++; save(); }
    if (!(await saveFile(fname, blob))) showHofStatus(`<p>Saving files isn’t available here, so your ${kind.toUpperCase()} is below. Press and hold it (or right-click) to save it.</p><img src="${URL.createObjectURL(blob)}" alt="Your Hall of Fame scene"><button class="btn sm" type="button" id="hofOutClose">Close</button>`);
  } finally { hofBusy = false; }
}
$("hofStatus").addEventListener("click", e => { if (e.target.closest("#hofOutClose")) hideHofStatus(); });
$("hofClose").addEventListener("click", hofDone);
$("hofEdit").addEventListener("click", () => { const P = $("hofPanel"), open = P.hidden; P.hidden = !open; $("hofEdit").setAttribute("aria-pressed", open); if (open) hofPanel(); });
$("hofGif").addEventListener("click", () => hofExport("gif"));
$("hofPng").addEventListener("click", () => hofExport("png"));

// ---- View team (full screen party view; stats, favorite, shiny and personalize) ----
let viewSel = null, viewTab = "stats";
function openView(){
  if (!team().length) { toast("Add at least one Pokémon to view your team."); return; }
  closeModal(); hideTip();
  $("view").hidden = false; document.documentElement.classList.add("noscroll");
  viewSel = null; viewTab = "stats"; renderView(); $("viewClose").focus();
}
function closeView(){ $("view").hidden = true; document.documentElement.classList.remove("noscroll"); const b = $("viewBtn"); if (b) b.focus(); }
$("viewClose").addEventListener("click", closeView);
function renderView(){
  const T = G(), t = team(), tr = trainerOf(state.team);
  const NS = notesOf(state.team).stars;
  $("vtSub").innerHTML = `${esc(T.sub)} · ${t.length}/${sizeOf(state.team)}${NS ? " · " + starsHTML(NS) : ""}`;
  $("vtTitle").textContent = T.title;
  $("vtTrainer").innerHTML = `<div class="stage vt-tr"><img class="tr" data-tr="${tr}" data-full="1" data-zoom="3" alt=""></div><span class="vt-tname">${esc(TRAINERS[tr])}</span>`;
  let html = ""; const Z = sizeOf(state.team), vs = $("vtSlots");
  vs.classList.toggle("many", Z > 6); vs.style.setProperty("--vrows", Math.ceil(Z/4));
  for (let i = 0; i < Z; i++) {
    const m = T.byNum.get(t[i]);
    if (!m) { html += `<div class="vt-slot empty"><span class="ghost" aria-hidden="true"></span></div>`; continue; }
    const sh = isShinyMember(state.team, m.num);
    html += `<button class="vt-slot${viewSel === m.num ? " on" : ""}" type="button" data-vsel="${m.num}" aria-pressed="${viewSel === m.num}">
      <span class="vt-fav" aria-hidden="true">${isFav(m.num) ? "♥" : ""}</span>
      <div class="stage"><img class="spr" data-num="${m.num}"${sh ? ' data-sh="1"' : ""} data-zoom="2" alt="" draggable="false"></div>
      <span class="vt-no">${fmtNo(m.num)}${memberOf(state.team, m.num).nick ? ` · <span class="sp">${esc(m.name)}</span>` : ""}</span><span class="vt-name">${ballImg(ballOf(state.team, m.num))}${esc(nickOf(state.team, m.num))}${sh || state.shiny ? ' <span class="shiny-mark">✦</span>' : ""}</span>${typeBadges(m.types)}</button>`;
  }
  $("vtSlots").innerHTML = html;
  paintAll($("view"));
  renderViewPanel();
}
function teamStatsHTML(){
  const T = G(), ms = team().map(n => T.byNum.get(n)), gen1 = state.team === "g1";
  const labels = gen1 ? ["HP","Atk","Def","Spc","Spe"] : ["HP","Atk","Def","SpA","SpD","Spe"];
  const pick = m => gen1 ? [m.stats[0],m.stats[1],m.stats[2],m.stats[3],m.stats[5]] : m.stats;
  const sums = labels.map((_, i) => ms.reduce((a, m) => a + pick(m)[i], 0)), avg = sums.map(s => Math.round(s/ms.length));
  const tot = ms.map(m => pick(m).reduce((a, b) => a + b, 0)).reduce((a, b) => a + b, 0);
  const best = (f, label) => { const m = ms.reduce((a, b) => f(b) > f(a) ? b : a); return `<div class="hl"><span>${label}</span><b title="${esc(m.name)}">${esc(m.name)}</b><span class="meta">${f(m)}</span></div>`; };
  const types = {}; ms.forEach(m => m.types.forEach(t => types[t] = (types[t] || 0) + 1));
  const {def, off, usesMoves} = coverage(), worst = def.filter(c => sev(c) === 2), warn = def.filter(c => sev(c) === 1), hit = off.filter(o => o.hit).length;
  const N = notesOf(state.team);
  return `<h3 class="vp-title">Team stats</h3>
    ${N.stars || N.text.trim() ? `<div class="vp-note">${N.stars ? starsHTML(N.stars) : ""}${N.text.trim() ? `<p>${esc(N.text)}</p>` : ""}</div>` : ""}
    <div class="cov-h">Average base stats</div>
    <div class="stats">${labels.map((l, i) => `<span class="l">${l}</span><span class="v">${avg[i]}</span><span class="b"><i style="width:${Math.min(100, avg[i]/200*100)}%;--sc:${statColor(avg[i])}"></i></span>`).join("")}
    <div class="tot"><span>Combined base stats</span><span>${tot.toLocaleString()}</span></div><div class="tot"><span>Average per Pokémon</span><span>${Math.round(tot/ms.length)}</span></div></div>
    <div class="cov-h">Standouts</div>
    <div class="hls">${best(m => m.stats[5], "Fastest")}${best(m => Math.max(m.stats[1], m.stats[3]), "Hardest hitter")}${best(m => m.stats[0] + m.stats[2] + m.stats[4], "Bulkiest")}</div>
    <div class="cov-h">Types on the team</div>
    <div class="uncov">${Object.entries(types).sort((a, b) => b[1] - a[1]).map(([t, c]) => `<span class="tb" style="${tStyle(t)}">${t}${c > 1 ? " ×" + c : ""}</span>`).join("")}</div>
    <div class="cov-h">Coverage · ${T.rules} rules</div>
    <p style="margin:0">${worst.length ? `<span class="pill bad">Weak spot</span> ${worst.map(c => c.atk).join(", ")}` : warn.length ? `<span class="pill warn">Watch</span> ${warn.map(c => c.atk).join(", ")}` : `<span class="pill good">Balanced</span> No attacking type outnumbers your resistances.`}</p>
    <p class="meta" style="margin:8px 0 0">${usesMoves ? "Your moves" : "STAB moves"} hit <b>${hit}</b> of ${T.types.length} types super-effectively.</p>
    <p class="note">Tap a Pokémon to see its stats or personalize it.</p>`;
}
const vpMeta = m => `${fmtNo(m.num)} · Gen ${ROMAN[genOf(baseOf(m.num))]} ${REGION(genOf(baseOf(m.num)))}${memberOf(state.team, m.num).nick ? " · " + esc(m.name) : ""}`;
const vpName = m => `${ballImg(ballOf(state.team, m.num), "ball-ic lg")}${esc(nickOf(state.team, m.num))}${isShinyMember(state.team, m.num) || state.shiny ? ' <span class="shiny-mark">✦</span>' : ""}`;
function updateViewMon(n){
  const m = G().byNum.get(n); if (!m) return;
  const a = $("vpName"), b = $("vpMeta"); if (a) a.innerHTML = vpName(m); if (b) b.innerHTML = vpMeta(m);
  const slot = $("vtSlots").querySelector(`[data-vsel="${n}"]`); if (!slot) return;
  slot.querySelector(".vt-name").innerHTML = `${ballImg(ballOf(state.team, n))}${esc(nickOf(state.team, n))}${isShinyMember(state.team, n) || state.shiny ? ' <span class="shiny-mark">✦</span>' : ""}`;
  slot.querySelector(".vt-no").innerHTML = `${fmtNo(n)}${memberOf(state.team, n).nick ? ` · <span class="sp">${esc(m.name)}</span>` : ""}`;
}
function renderViewPanel(){
  const T = G(), n = viewSel, m = n && T.byNum.get(n);
  if (!m) { $("viewPanel").innerHTML = teamStatsHTML(); return; }
  const weak = T.types.map(a => ({a, e: eff(a, m.types, T.chart)})).filter(x => x.e >= 2), immune = T.types.filter(a => eff(a, m.types, T.chart) === 0), sh = isShinyMember(state.team, n);
  const head = `<button class="btn sm" type="button" data-vsel="">← Team stats</button>
    <div class="vp-mon"><div class="meta" id="vpMeta">${vpMeta(m)}</div><h3 id="vpName">${vpName(m)}</h3>${typeBadges(m.types)}</div>
    <div class="segrow sheet-tabs" role="group" aria-label="Sections">${[["stats", "Info"], ["battle", "Battle"], ["build", "Personalize"]].map(([k, l]) => `<button type="button" data-vtab="${k}" aria-pressed="${viewTab === k}">${l}</button>`).join("")}</div>`;
  if (viewTab === "battle") {
    $("viewPanel").innerHTML = head + battleHTML(n);
    wireBattle($("viewPanel").querySelector("#bsRoot"), n, state.team, () => updateViewMon(n));
    return;
  }
  if (viewTab === "build") {
    $("viewPanel").innerHTML = head + personalHTML(n);
    wirePersonal($("viewPanel"), n, state.team, () => updateViewMon(n));
    return;
  }
  $("viewPanel").innerHTML = head + `
    ${(() => { const M = memberOf(state.team, n), mv = movesOf(state.team, n); if (!M.ability && !M.item && !mv.length) return ""; return `<div class="vp-build">${M.ability ? `<div class="kv"><span>Ability</span><b>${esc(M.ability)}</b></div>` : ""}${M.item ? `<div class="kv"><span>Item</span><b>${esc(M.item)}</b></div>` : ""}${mv.length ? `<div class="kv"><span>Moves</span><div class="vp-moves">${mv.map(x => `<span class="tb" style="${tStyle(x[1])}">${esc(x[0])}</span>`).join("")}</div></div>` : ""}</div>`; })()}
    <div class="actions"><button class="btn" type="button" data-vfav="${n}" aria-pressed="${isFav(n)}">${isFav(n) ? "♥ Favorited" : "♡ Favorite"}</button>
    <button class="btn" type="button" data-vshy="${n}" aria-pressed="${sh}" ${state.shiny ? 'disabled title="Shiny is on for every sprite"' : ""}>${sh ? "✦ Shiny on" : "✦ Make shiny"}</button></div>
    <div class="cov-h">Base stats</div>${statsHTML(m)}
    <div class="cov-h">Weak to</div><div class="uncov">${weak.map(x => `<span class="tb" style="${tStyle(x.a)}">${x.a}${x.e >= 4 ? " ×4" : ""}</span>`).join("") || '<span class="meta">Nothing</span>'}</div>
    ${immune.length ? `<div class="cov-h">Immune to</div><div class="uncov">${immune.map(a => `<span class="tb" style="${tStyle(a)}">${a}</span>`).join("")}</div>` : ""}`;
}
$("view").addEventListener("click", e => {
  const vt = e.target.closest("[data-vtab]"); if (vt) { viewTab = vt.dataset.vtab; renderViewPanel(); return; }
  const s = e.target.closest("[data-vsel]"); if (s) { const v = s.dataset.vsel ? +s.dataset.vsel : null; viewSel = viewSel === v ? null : v; renderView(); if (innerWidth <= 760 && viewSel) $("viewPanel").scrollIntoView({behavior:"smooth", block:"start"}); return; }
  const f = e.target.closest("[data-vfav]"); if (f) { toggleFav(+f.dataset.vfav); renderView(); return; }
  const h = e.target.closest("[data-vshy]"); if (h) { toggleMemberShiny(+h.dataset.vshy); renderView(); }
});

// ---- start screen: your all-gen Hall of Fame scene ----
function renderStartUI(){
  document.querySelectorAll("[data-sm]").forEach(b => b.setAttribute("aria-pressed", b.dataset.sm === state.mode));
  $("startSample").hidden = !state.sample;
  $("startTeam").textContent = `${TRAINERS[trainerOf("all")]} and your all-gen team`;
}
document.querySelectorAll("[data-sm]").forEach(b => b.addEventListener("click", () => {
  if (state.mode === b.dataset.sm) return;
  state.mode = b.dataset.sm; document.documentElement.dataset.mode = state.mode; save(); renderStartUI(); startStage.load();
}));

$("viewHof").addEventListener("click", () => { closeView(); openHof(); });

