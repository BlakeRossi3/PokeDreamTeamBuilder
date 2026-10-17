// ================= POKÉMON HOME =================
// A little house you walk around as your trainer. Pick residents from your favorites, pet them to grow friendship,
// decorate with furniture from the Shop and open new rooms. Drawn on a canvas in a 3/4 view: x runs along the room,
// y is depth (0 = back wall). 2D renders at low resolution and scales up for crisp pixels.
const HM = {WALL:2.6, SQ:.58, D:7};
const homeData = () => state.games.home;
const homeRooms = () => ROOMS.filter(r => r.free || owns("exp", r.id));
const homeTrainer = () => Number.isInteger(homeData().tr) ? homeData().tr : trainerOf("all");   // you, walking around your Home
function pickHomeTrainer(){
  const D = homeData();
  openTrainerPicker({cur:homeTrainer(), title:"Who lives here?", note:"Pick the trainer you walk around your Home as. Friends see them when they visit you.",
    extra:Number.isInteger(D.tr) ? `<p class="note"><button class="linkbtn" type="button" id="trUseAll">Use my “All” team’s trainer (${esc(TRAINERS[trainerOf("all")])})</button></p>` : "",
    onPick:i => { D.tr = i; save(); closeModal(); homeSyncMons(); toast(`${TRAINERS[i]} is home!`); }});
  const b = $("trUseAll"); if (b) b.onclick = () => { D.tr = null; save(); closeModal(); homeSyncMons(); toast("Your “All” team’s trainer is home."); };
}
const houseOf = () => { const id = homeData().house; return HOUSES.find(h => h.id === id && owns("house", id)) || HOUSES[0]; };
const homeCap = () => homeRooms().reduce((s, r) => s + r.cap, 0);
const shadeHex = (hex, f) => { const [r, g, b] = hexRGB(hex); const m = v => Math.max(0, Math.min(255, Math.round(f < 1 ? v*f : v + (255 - v)*(f - 1)))); return "#" + [m(r), m(g), m(b)].map(v => v.toString(16).padStart(2, "0")).join(""); };
const FLOOR_ITEMS = new Set(["rugr", "rug", "rugball", "rugt"]);
const isFloorItem = it => FLOOR_ITEMS.has(it.kind);

// ---- shape kit for furniture ----
// (0,0) is the back-left floor corner of the item; boxes are drawn as a front face plus a top face.
function fkit(c, ts, pixel){
  const SQ = HM.SQ, R = v => pixel ? Math.round(v) : v;
  const K = {
    box(x, y, w, d, h, col, z = 0){
      const X = R(x*ts), W = R(w*ts), yb = (y + d)*ts*SQ - z*ts, top = R(y*ts*SQ - (z + h)*ts), front = R(yb - h*ts), bot = R(yb);
      c.fillStyle = shadeHex(col, pixel ? .78 : .74); c.fillRect(X, front, W, bot - front);
      if (!pixel) { const g = c.createLinearGradient(0, front, 0, bot); g.addColorStop(0, "rgba(255,255,255,.08)"); g.addColorStop(1, "rgba(0,0,0,.12)"); c.fillStyle = g; c.fillRect(X, front, W, bot - front); }
      c.fillStyle = col; c.fillRect(X, top, W, front - top);
      if (pixel) { c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(X, bot - 1, W, 1); c.fillRect(X, top, 1, bot - top); c.fillRect(X + W - 1, top, 1, bot - top); c.fillStyle = "rgba(255,255,255,.25)"; c.fillRect(X + 1, top, W - 2, 1); }
      else { c.fillStyle = "rgba(255,255,255,.18)"; c.fillRect(X, top, W, Math.max(1, ts*.03)); }
      return {X, W, top, front, bot};
    },
    oval(cx, cy, rx, ry, col, z = 0){ c.fillStyle = col; c.beginPath(); c.ellipse(R(cx*ts), R(cy*ts*SQ - z*ts), Math.max(1, rx*ts), Math.max(1, ry*ts*SQ), 0, 0, 7); c.fill(); },
    disc(cx, cy, r, col, z = 0){ c.fillStyle = col; c.beginPath(); c.arc(R(cx*ts), R(cy*ts*SQ - z*ts), Math.max(1, r*ts), 0, 7); c.fill(); },
    rect(x, y, w, h, col, z = 0){ c.fillStyle = col; c.fillRect(R(x*ts), R(y*ts*SQ - z*ts), Math.max(1, R(w*ts)), Math.max(1, R(h*ts))); },
    flat(x, y, w, d, col){ c.fillStyle = col; c.fillRect(R(x*ts), R(y*ts*SQ), R(w*ts), R(d*ts*SQ)); },
    poly(pts, col){ c.fillStyle = col; c.beginPath(); pts.forEach(([x, y, z = 0], i) => { const px = R(x*ts), py = R(y*ts*SQ - z*ts); i ? c.lineTo(px, py) : c.moveTo(px, py); }); c.closePath(); c.fill(); },
    img(src, cx, cy, size, z = 0){ const f = size*ts/Math.max(src.width, src.height), w = src.width*f, h = src.height*f; c.save(); c.imageSmoothingEnabled = true; c.drawImage(src, R(cx*ts - w/2), R(cy*ts*SQ - z*ts - h/2), R(w), R(h)); c.restore(); },   // a picture standing upright, centred
  };
  return K;
}
// ---- type emblems for reward furniture: drawn upright on the plane at depth y (or flat on the floor) ----
const MOTIF = {
  Fire:[[0,.95],[.3,.45],[.45,0],[.3,-.45],[0,-.58],[-.3,-.45],[-.45,0],[-.18,.3]], Water:[[0,.92],[.33,.25],[.42,-.18],[.26,-.5],[0,-.6],[-.26,-.5],[-.42,-.18],[-.33,.25]],
  Grass:[[0,.92],[.42,.32],[.36,-.3],[0,-.72],[-.36,-.3],[-.42,.32]], Electric:[[.18,.92],[-.36,.04],[-.02,.04],[-.22,-.92],[.4,.12],[.06,.12],[.32,.92]],
  Ground:[[-.7,-.42],[-.36,.18],[-.05,.42],[.32,.16],[.7,-.42]], Flying:[[-.62,-.22],[-.22,.5],[.62,.82],[.42,.32],[.62,.12],[.3,-.08],[.5,-.3],[0,-.42]],
  Rock:[[-.56,-.42],[-.62,0],[-.3,.46],[.2,.52],[.58,.14],[.52,-.42]], Ghost:[[-.45,-.52],[-.45,.18],[-.3,.52],[0,.64],[.3,.52],[.45,.18],[.45,-.52],[.3,-.3],[.15,-.52],[0,-.3],[-.15,-.52],[-.3,-.3]],
  Dragon:[[0,.92],[.36,.2],[.16,-.82],[0,-.6],[-.16,-.82],[-.36,.2]], Fairy:[[0,.92],[.18,.18],[.9,0],[.18,-.18],[0,-.92],[-.18,-.18],[-.9,0],[-.18,.18]],
  Fighting:[[-.5,.38],[.5,.38],[.56,.2],[.56,-.36],[-.5,-.36],[-.56,-.2],[-.56,.2]], Dark:[[.1,.86],[-.32,.62],[-.58,.1],[-.42,-.5],[0,-.8],[.42,-.6],[.12,-.42],[-.08,0],[.06,.5]],
  Poison:[[0,.6],[.36,.06],[.4,-.3],[.22,-.56],[0,-.62],[-.22,-.56],[-.4,-.3],[-.36,.06]],
};
function motif(K, type, cx, y, z, s, col, flat){
  const at = (dx, dz) => flat ? [cx + dx*s, y - dz*s*.9, 0] : [cx + dx*s, y, z + dz*s];
  const P = (pts, c = col) => K.poly(pts.map(([dx, dz]) => at(dx, dz)), c);
  const D = (dx, dz, r, c = col) => { const [x, yy, zz] = at(dx, dz); K.disc(x, yy, r*s, c, zz); };
  const light = shadeHex(col, 1.45), dark = shadeHex(col, .55);
  switch (type) {
    case "Ice": for (const [a, b] of [[0, 1], [.87, .5], [.87, -.5]]) P([[-a*.9 - b*.08, -b*.9 + a*.08], [-a*.9 + b*.08, -b*.9 - a*.08], [a*.9 + b*.08, b*.9 - a*.08], [a*.9 - b*.08, b*.9 + a*.08]]); D(0, 0, .18, light); break;
    case "Psychic": D(0, 0, .62); D(0, 0, .42, light); D(.06, .04, .24); D(.1, .06, .1, light); break;
    case "Bug": D(0, -.06, .5); P([[-.04, .5], [.04, .5], [.04, -.56], [-.04, -.56]], dark); D(0, .5, .2, dark); D(-.2, .1, .1, light); D(.2, -.2, .1, light); break;
    case "Steel": for (let i = 0; i < 8; i++) { const a = i*Math.PI/4, c = Math.cos(a), si = Math.sin(a); P([[c*.5 - si*.12, si*.5 + c*.12], [c*.5 + si*.12, si*.5 - c*.12], [c*.8 + si*.12, si*.8 - c*.12], [c*.8 - si*.12, si*.8 + c*.12]]); } D(0, 0, .58); D(0, 0, .26, light); break;
    case "Normal": D(0, 0, .62); D(0, 0, .38, light); D(0, 0, .2); break;
    case "fossil": D(0, 0, .6, "#c9b28a"); for (let i = 0; i < 3; i++) D(.14*i, .05*i, .44 - i*.13, i % 2 ? "#c9b28a" : "#8a6f4a"); break;
    case "gem": P([[-.3, .5], [.3, .5], [.55, .1], [0, -.7], [-.55, .1]], "#5ff3ff"); P([[-.3, .5], [0, .5], [-.18, .1]], "#c9fbff"); P([[-.55, .1], [.55, .1], [0, -.7]], "#2ab8d6"); break;
    case "icecrystal": P([[0, .95], [.25, .2], [.12, -.8], [-.12, -.8], [-.25, .2]], "#bff3ff"); P([[-.5, .45], [-.32, -.1], [-.4, -.7], [-.62, -.1]], "#8fdcf0"); P([[.5, .4], [.62, -.1], [.4, -.7], [.32, -.1]], "#8fdcf0"); break;
    case "bone": P([[-.5, .1], [.5, .1], [.5, -.1], [-.5, -.1]], "#f2ead8"); for (const sx of [-.55, .55]) { D(sx, .14, .16, "#f2ead8"); D(sx, -.14, .16, "#f2ead8"); } break;
    case "belt": P([[-.8, .22], [.8, .22], [.8, -.22], [-.8, -.22]], "#8a2a1c"); D(0, 0, .38, "#ffd36b"); D(0, 0, .24, "#e2a32a"); break;
    default: if (MOTIF[type]) { P(MOTIF[type]); if (!flat) P(MOTIF[type].map(([a, b]) => [a*.45 - .08, b*.45 + .1]), light); }
  }
}
const typeCol = t => TC[t] || "#a8a77a";
const HOUSE_DRAW = {
  bed(K, it){ const [a, b, w] = it.col; K.box(0, 0, 2, .35, 1.15, w); K.box(.05, .2, 1.9, 2.75, .42, w); K.box(.12, .25, 1.76, 2.6, .2, b, .42); K.box(.3, .32, .55, .5, .14, "#ffffff", .62); K.box(1.15, .32, .55, .5, .14, "#ffffff", .62); K.box(.08, 1.15, 1.84, 1.82, .24, a, .44); },
  rugr(K, it){ K.oval(it.w/2, it.d/2, it.w*.48, it.d*.48, it.col[0]); K.oval(it.w/2, it.d/2, it.w*.34, it.d*.34, it.col[1]); K.oval(it.w/2, it.d/2, it.w*.22, it.d*.22, it.col[0]); },
  rug(K, it){ K.flat(.05, .05, it.w - .1, it.d - .1, it.col[1]); K.flat(.18, .18, it.w - .36, it.d - .36, it.col[0]); for (let i = 1; i < 4; i++) K.flat(.18, .18 + (it.d - .36)*i/4 - .03, it.w - .36, .06, it.col[1]); },
  rugball(K, it){ const cx = it.w/2, cy = it.d/2; K.oval(cx, cy, .96, .96, "#1d1f26"); K.oval(cx, cy, .9, .9, it.col[1]); K.poly([[cx - .9, cy], ...Array.from({length:13}, (_, i) => { const a = Math.PI + i*Math.PI/12; return [cx + Math.cos(a)*.9, cy + Math.sin(a)*.9]; })], it.col[0]); K.flat(cx - .9, cy - .05, 1.8, .1, "#1d1f26"); K.oval(cx, cy, .26, .26, "#1d1f26"); K.oval(cx, cy, .17, .17, "#ffffff"); },
  plant(K, it){ K.box(.28, .35, .44, .4, .45, it.col[1]); [[.5, .45, .32, 1.05], [.3, .5, .22, .85], [.7, .5, .22, .9], [.5, .55, .2, 1.32]].forEach(([x, y, r, z]) => K.disc(x, y, r, shadeHex(it.col[0], .9 + z*.1), z)); },
  tabler(K, it){ K.box(.44, .4, .12, .2, .65, it.col[1]); K.oval(.5, .5, .48, .44, shadeHex(it.col[0], .8), .62); K.oval(.5, .46, .48, .42, it.col[0], .7); },
  sofa(K, it){ const [a, b] = it.col; K.box(0, 0, it.w, .4, 1, b); K.box(0, .3, it.w, .65, .42, b); K.box(.18, .3, it.w - .36, .6, .16, a, .42); K.box(0, .1, .2, .85, .72, a); K.box(it.w - .2, .1, .2, .85, .72, a); },
  chair(K, it){ HOUSE_DRAW.sofa(K, it); },
  shelf(K, it){ K.box(0, .1, it.w, .5, 1.95, it.col[0]); const cols = ["#e2413b", "#2f6fd6", "#ffd43b", "#2f9e62", "#8a55f0", "#f39ac7"]; for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) K.rect(.1 + i*.2, .6, .14, .44, cols[(i*3 + row) % cols.length], .2 + row*.6); },
  tv(K, it){ K.box(.1, .3, it.w - .2, .5, .38, it.col[0]); K.box(.05, .35, it.w - .1, .12, .95, it.col[0], .42); K.rect(.13, .47, it.w - .26, .78, it.col[1], 1.3); },
  lamp(K, it){ K.oval(.5, .6, .22, .18, it.col[1]); K.rect(.47, .6, .06, 1.35, it.col[1], 1.4); K.poly([[.25, .6, 1.4], [.75, .6, 1.4], [.65, .6, 1.85], [.35, .6, 1.85]], it.col[0]); },
  palm(K, it){ K.box(.25, .35, .5, .45, .5, it.col[1]); for (let i = 0; i < 6; i++) K.rect(.44 + Math.sin(i)*.03, .6, .12, .22, "#8a5a3c", .5 + i*.2); [[-.55, 1.85], [.55, 1.85], [-.4, 2.05], [.4, 2.05], [0, 2.15]].forEach(([dx, z]) => K.poly([[.5, .6, 1.85], [.5 + dx, .6, z - .35], [.5 + dx*.9, .6, z - .2]], it.col[0])); K.disc(.5, .6, .18, shadeHex(it.col[0], .8), 1.9); },
  bean(K, it){ K.oval(.5, .62, .46, .36, shadeHex(it.col[0], .8), .05); K.oval(.5, .52, .4, .36, it.col[0], .3); K.oval(.42, .45, .14, .1, "rgba(255,255,255,.35)", .45); },
  desk(K, it){ K.box(.05, .2, .12, .6, .72, it.col[1]); K.box(it.w - .17, .2, .12, .6, .72, it.col[1]); K.box(0, .15, it.w, .7, .1, it.col[0], .72); K.box(.55, .25, .9, .1, .62, "#22252e", .82); K.rect(.6, .35, .8, .48, "#59c2ff", 1.4); },
  tank(K, it){ K.box(0, .2, it.w, .7, .5, it.col[1]); K.box(.05, .25, it.w - .1, .6, .95, it.col[0], .5); K.rect(.05, .85, it.w - .1, .12, "#e7d7a6", .62); [[.5, 1.05, "#ff8a3d"], [1.2, 1.2, "#ffd43b"], [.9, .9, "#ff5a8a"]].forEach(([x, z, cc]) => K.oval(x, .85, .1, .05, cc, z)); },
  stove(K, it){ K.box(.05, .2, it.w - .1, .7, 1.05, it.col[0]); K.rect(.35, .9, 1.3, .55, "#3a3a44", .35); K.rect(.45, .9, 1.1, .35, "#6a6a78", .45);
    for (const [x, y] of [[.55, .4], [1.45, .4], [.55, .72], [1.45, .72]]) K.oval(x, y, .2, .11, it.col[1], 1.05);
    K.box(.38, .3, .34, .2, .26, it.col[2], 1.05); K.rect(.7, .38, .1, .04, it.col[2], 1.22); },   // a kettle on the back burner
  fridge(K, it){ K.box(.08, .25, .84, .6, 2.1, it.col[0]); K.rect(.12, .85, .76, .03, shadeHex(it.col[0], .7), 1.35); K.rect(.78, .85, .05, .45, it.col[1], 1.5); K.rect(.78, .85, .05, .3, it.col[1], .8);
    K.disc(.3, .85, .05, "#e2413b", 1.15); K.disc(.45, .85, .05, "#ffd43b", 1.0); K.rect(.2, .85, .22, .25, "#ffffff", .45); },
  counter(K, it){ K.box(0, .2, it.w, .7, .95, it.col[0]); K.box(-.03, .17, it.w + .06, .76, .1, it.col[1], .95); for (let i = 0; i < it.w*2; i++) K.rect(.08 + i*.5, .9, .38, .6, shadeHex(it.col[0], .93), .2);
    K.oval(.6, .5, .26, .14, "#ffffff", 1.08); K.disc(.52, .48, .07, it.col[2], 1.14); K.disc(.66, .5, .07, it.col[2], 1.14); K.box(1.15, .35, .5, .3, .05, "#c9955a", 1.05); },
  fire(K, it){ K.box(0, .1, it.w, .55, 1.35, it.col[0]); K.rect(.45, .65, 1.1, .7, "#2a1a14", .95); K.box(-.05, .05, it.w + .1, .65, .12, shadeHex(it.col[0], .7), 1.35); },
  piano(K, it){ K.box(0, .1, it.w, .55, 1.25, it.col[0]); K.box(-.02, .5, it.w + .04, .3, .08, it.col[1], .72); for (let i = 0; i < 13; i++) K.rect(.08 + i*.145, .78, .05, .05, "#1d1f26", .82); },
  arcade(K, it){ K.box(.05, .2, .9, .65, 1.7, it.col[0]); K.rect(.18, .85, .64, .5, it.col[1], 1.5); K.box(.1, .7, .8, .2, .1, "#22252e", .85); K.disc(.35, .78, .06, "#ffd43b", .98); K.disc(.6, .78, .06, "#5af0ff", .98); },
  fountain(K, it){ K.oval(1, 1.1, .98, .82, shadeHex(it.col[0], .8)); K.oval(1, 1.02, .98, .8, it.col[0], .3); K.oval(1, 1, .82, .64, it.col[1], .32); K.box(.88, .95, .24, .2, .7, it.col[0], .3); K.oval(1, 1.05, .2, .14, it.col[1], 1); },
  tree(K, it){ K.box(.85, 1.1, .3, .25, 1.2, "#8a5a3c"); [[1, 1.2, .62, 1.7], [.6, 1.2, .48, 1.4], [1.4, 1.2, .48, 1.45], [1, 1.2, .5, 2.15]].forEach(([x, y, r, z]) => K.disc(x, y, r, shadeHex(it.col[0], .85 + z*.07), z)); [[.7, 1.6], [1.3, 1.75], [1, 2.3], [.55, 1.25], [1.45, 1.3]].forEach(([x, z]) => K.disc(x, 1.2, .07, it.col[1], z)); },
  flowers(K, it){ K.box(0, .2, it.w, .7, .22, "#7a4a2c"); for (let i = 0; i < 10; i++) { const x = .15 + (i % 5)*.42, y = .35 + Math.floor(i/5)*.3; K.rect(x + .03, y, .03, .2, "#3a9e4f", .22 + .2); K.disc(x + .05, y, .09, i % 2 ? it.col[0] : it.col[1], .45); } },
  bench(K, it){ K.box(.1, .5, .12, .3, .4, it.col[1]); K.box(it.w - .22, .5, .12, .3, .4, it.col[1]); K.box(0, .4, it.w, .45, .1, it.col[0], .4); for (let i = 0; i < 3; i++) K.box(0, .3, it.w, .08, .1, it.col[0], .6 + i*.18); },
  tramp(K, it){ K.oval(1, 1.05, .95, .8, it.col[1], 0); K.rect(.12, 1.05, .08, .4, it.col[1], .4); K.rect(1.8, 1.05, .08, .4, it.col[1], .4); K.oval(1, 1, .95, .8, it.col[0], .42); K.oval(1, 1, .75, .62, shadeHex(it.col[0], .6), .43); },
  pumpkin(K, it){ const [o, g] = it.col; K.oval(.5, .6, .4, .32, shadeHex(o, .8), .02); K.oval(.5, .58, .38, .3, o, .22); K.oval(.3, .58, .14, .26, shadeHex(o, .9), .24); K.oval(.7, .58, .14, .26, shadeHex(o, .9), .24);
    K.rect(.47, .6, .07, .16, g, .62); K.poly([[.32, .6, .4], [.4, .6, .5], [.42, .6, .4]], "#3a1a08"); K.poly([[.58, .6, .4], [.6, .6, .5], [.68, .6, .4]], "#3a1a08"); K.poly([[.33, .6, .3], [.67, .6, .3], [.6, .6, .22], [.4, .6, .22]], "#ffd36b"); },
  cobweb(K, it){ const c = it.col[0], z = 1.6; for (let i = 0; i < 6; i++) { const a = -Math.PI/2 + (i - 2.5)*.32; K.poly([[.5, .1, z + .85], [.5 + Math.cos(a)*.62 + .01, .1, z + .85 + Math.sin(a)*.62], [.5 + Math.cos(a)*.62 - .01, .1, z + .85 + Math.sin(a)*.62]], c); }
    for (const r of [.2, .38, .56]) for (let i = 0; i < 5; i++) { const a = -Math.PI/2 + (i - 2.5)*.32, b = a + .32; K.poly([[.5 + Math.cos(a)*r, .1, z + .85 + Math.sin(a)*r], [.5 + Math.cos(b)*r, .1, z + .85 + Math.sin(b)*r], [.5 + Math.cos(b)*r, .1, z + .85 + Math.sin(b)*r + .02], [.5 + Math.cos(a)*r, .1, z + .85 + Math.sin(a)*r + .02]], c); }
    K.disc(.5, .1, .06, it.col[1], z + .45); K.rect(.495, .1, .01, .4, c, z + .85); },
  holtree(K, it){ const [g, r] = it.col; K.box(.38, .45, .24, .2, .25, "#8a5a3c"); [[.48, .25], [.38, .9], [.28, 1.5]].forEach(([w, z], i) => K.poly([[.5 - w, .55, z], [.5 + w, .55, z], [.5, .55, z + .85 - i*.08]], shadeHex(g, 1 + i*.08)));
    [[.3, .5], [.66, .62], [.42, 1.1], [.6, 1.25], [.46, 1.7]].forEach(([x, z], i) => K.disc(x, .56, .05, i % 2 ? r : "#ffd43b", z)); K.poly([[.5, .55, 2.25], [.56, .55, 2.12], [.5, .55, 2.0], [.44, .55, 2.12]], "#ffd43b"); },
  cushion(K, it){ K.box(.1, .2, .8, .7, .18, it.col[0]); K.box(.2, .3, .6, .5, .02, it.col[1], .18); },
  globe(K, it){ K.box(.35, .45, .3, .25, .35, "#6b4226"); K.rect(.48, .55, .04, .3, it.col[1], .62); K.disc(.5, .55, .3, it.col[0], .95); K.disc(.42, .55, .1, "#3fae5a", 1.02); },
  display(K, it){ const v = it.var; K.box(.08, .2, .84, .62, .5, "#7b5234"); K.box(.05, .18, .9, .66, .06, "#a8754c", .5); K.box(.12, .25, .76, .52, .82, "#a7d3ea", .56); K.rect(.18, .77, .64, .7, "#cfeaf6", 1.32); motif(K, v === "ice" ? "icecrystal" : v, .5, .62, .96, .28, "#ffffff"); K.box(.08, .22, .84, .58, .06, "#a8754c", 1.38); K.rect(.14, .78, .06, .78, "rgba(255,255,255,.35)", 1.32); },
  statue(K, it){ const col = typeCol(it.var); K.box(.15, .75, 1.7, 1.15, .28, "#7d7889"); K.box(.3, .88, 1.4, .9, .26, "#a9a3b6", .28); K.box(.62, 1.05, .76, .6, 1.25, "#d8d3e2", .54); K.box(.58, 1.02, .84, .66, .1, "#e2b13c", 1.79); K.box(.58, 1.02, .84, .66, .08, "#e2b13c", .54);
    K.disc(1, 1.66, .5, "#c9952a", 1.32); K.disc(1, 1.67, .44, "#ffd36b", 1.32); K.disc(1, 1.68, .37, col, 1.32); motif(K, it.var, 1, 1.69, 1.32, .27, "#ffffff");
    [[.36, 1.82], [1.64, 1.82]].forEach(([x, y]) => motif(K, "Fairy", x, y, .62, .1, "#ffd76a")); },
  lamp2(K, it){ const v = it.var;
    if (v === "tesla") { K.box(.2, .42, .6, .45, .25, "#3a3f52"); for (let i = 0; i < 7; i++) K.box(.32, .55, .36, .22, .14, i % 2 ? "#c9783a" : "#e09a52", .25 + i*.14); K.disc(.5, .66, .26, "#c9c9d2", 1.4); K.disc(.46, .66, .08, "#ffffff", 1.42); motif(K, "Electric", .5, .7, 1.75, .18, "#ffe14a"); }
    else if (v === "lantern") { K.rect(.47, .62, .06, 1.2, "#3a2f40", 1.2); K.box(.36, .5, .28, .24, .06, "#3a2f40", 1.2); K.box(.32, .48, .36, .28, .42, "rgba(150,110,255,.55)", 1.26); K.disc(.5, .62, .12, "#c9a8ff", 1.46); K.box(.3, .46, .4, .32, .06, "#3a2f40", 1.68); motif(K, "Ghost", .5, .7, 1.48, .12, "#ffffff"); }
    else if (v === "beacon") { K.poly([[.22, .6, 0], [.78, .6, 0], [.66, .6, 1.4], [.34, .6, 1.4]], "#f6f1e7"); [.3, .8].forEach(z => K.poly([[.27 - z*.04, .6, z], [.73 + z*.04 - .08, .6, z], [.71 - z*.04, .6, z + .22], [.29 + z*.04, .6, z + .22]], "#e2413b")); K.box(.3, .5, .4, .2, .3, "#ffe68a", 1.4); K.poly([[.28, .55, 1.7], [.72, .55, 1.7], [.5, .55, 1.95]], "#e2413b"); }
    else if (v === "lava") { K.box(.32, .5, .36, .3, .18, "#3a3f52"); K.poly([[.34, .65, .18], [.66, .65, .18], [.6, .65, 1.2], [.4, .65, 1.2]], "#ff8a3d"); [[.48, .45], [.54, .75], [.46, 1]].forEach(([x, z]) => K.disc(x, .66, .07, "#e2413b", z)); K.box(.38, .55, .24, .2, .16, "#3a3f52", 1.2); }
    else if (v === "torch") { for (const x of [.22, .78]) { K.rect(x - .04, .62, .08, 1.2, "#6b4226", 1.2); K.box(x - .1, .55, .2, .14, .12, "#3a2f2a", 1.2); motif(K, "Fire", x, .64, 1.48, .2, "#ff7a1f"); K.disc(x, .64, .06, "#ffe14a", 1.44); } }
    else { K.box(.32, .5, .36, .3, .08, "#2a2d36"); K.rect(.47, .62, .06, 1, "#2a2d36", 1.08); motif(K, "Dark", .5, .64, 1.45, .36, "#ff5ad0"); motif(K, "Dark", .5, .63, 1.45, .26, "#ffb3ec"); }
  },
  arch(K, it){ const v = it.var, leaf = v === "fairy" ? "#f7b6d8" : "#3fae5a", fl = v === "fairy" ? ["#ffffff", "#c9a8ff", "#ffd6ee"] : ["#ff6fa5", "#ffd43b", "#ffffff"];
    for (const x of [.15, 1.75]) K.box(x, .4, .1, .2, 1.65, "#f6f1e7"); for (let i = 0; i <= 12; i++) { const a = Math.PI*i/12, x = 1 - Math.cos(a)*.86, z = 1.65 + Math.sin(a)*.42; K.disc(x, .5, .13, leaf, z); if (i % 2) K.disc(x, .52, .07, fl[i % 3], z + .06); }
    for (let z = .2; z < 1.6; z += .28) for (const x of [.2, 1.8]) { K.disc(x, .52, .1, leaf, z); K.disc(x + .03, .54, .05, fl[Math.round(z*7) % 3], z + .03); }
    if (v === "fairy") motif(K, "Fairy", 1, .52, 2.12, .16, "#ffffff"); },
  orb(K, it){ const v = it.var, c = v === "cosmic" ? ["#1d1f4a", "#6a5ad6"] : v === "beauty" ? ["#f7a6cf", "#ffe2f1"] : ["#b48cff", "#e9ddff"];
    K.box(.3, .45, .4, .35, .4, "#4a3a5a"); K.poly([[.28, .6, .4], [.72, .6, .4], [.62, .6, .55], [.38, .6, .55]], "#e2b13c"); K.disc(.5, .62, .36, c[0], .92); K.disc(.42, .62, .22, c[1], 1.02); K.disc(.38, .62, .08, "#ffffff", 1.1);
    if (v === "cosmic") [[.62, .8], [.56, 1.08], [.36, .86]].forEach(([x, z]) => K.disc(x, .64, .025, "#ffffff", z)); if (v === "beauty") motif(K, "Fairy", .62, .64, 1.08, .08, "#ffffff"); },
  tub(K, it){ K.oval(1, 1.08, .98, .84, "#3a2f2a"); K.oval(1, 1, .98, .84, "#5a4a42", .32); K.oval(1, 1, .8, .66, "#ff7a2a", .33); K.oval(1, 1.02, .62, .5, "#ffb04a", .34);
    [[.35, .55], [1.6, .6], [.4, 1.6], [1.62, 1.55], [1, .25]].forEach(([x, y]) => K.disc(x, y, .14, "#2a211d", .4)); [[.8, 1.1, .7], [1.2, .9, .95], [1, 1, 1.2]].forEach(([x, y, z]) => K.disc(x, y, .16, "rgba(255,255,255,.35)", z)); },
  rugt(K, it){ const col = typeCol(it.var); K.flat(.05, .05, it.w - .1, it.d - .1, shadeHex(col, .55)); K.flat(.15, .15, it.w - .3, it.d - .3, col); K.flat(.28, .28, it.w - .56, it.d - .56, shadeHex(col, 1.25)); motif(K, it.var, it.w/2, it.d/2, 0, .62, shadeHex(col, .5), true); },
  windvane(K, it){ K.box(.3, .45, .4, .34, .16, "#4a4a52"); K.rect(.46, .62, .08, 1.75, "#5a5a64", 1.91); K.rect(.14, .62, .72, .06, "#5a5a64", 1.5); K.disc(.5, .62, .07, "#ffd36b", 1.5);
    K.poly([[.02, .62, 1.86], [.26, .62, 1.98], [.26, .62, 1.74]], "#e2413b"); K.rect(.24, .62, .5, .07, "#e2413b", 1.89); motif(K, "Flying", .8, .62, 1.86, .2, "#2f6fd6"); },
  bag(K, it){ if (it.var === "dummy") { K.box(.42, .5, .16, .16, .9, "#8a5a3c"); K.box(.3, .48, .4, .2, .5, "#e0c27a", .55); K.rect(.12, .58, .76, .1, "#8a5a3c", 1.05); K.disc(.5, .58, .16, "#e0c27a", 1.28); return; }
    K.box(.1, .5, .08, .1, 1.85, "#3a3f52"); K.box(.82, .5, .08, .1, 1.85, "#3a3f52"); K.box(.1, .5, .8, .1, .08, "#3a3f52", 1.85); K.rect(.49, .55, .02, .25, "#9a9aa8", 1.85); K.box(.33, .45, .34, .24, .9, "#c22e28", .7); K.rect(.33, .69, .34, .05, "#e8e2d6", 1.2); },
  hammock(K, it){ const w = it.w, c = it.col, N = 12, top = t => 1.2 - .42*Math.sin(t*Math.PI), bot = t => 1.08 - .66*Math.sin(t*Math.PI);
    [[.08, 0], [w - .2, 0]].forEach(([x]) => { K.box(x, .38, .12, .14, 1.35, c[2]); K.box(x - .02, .36, .16, .18, .06, shadeHex(c[2], 1.2), 1.33); });
    for (let i = 0; i < N; i++) { const a = i/N, b = (i + 1)/N, x0 = .3 + a*(w - .6), x1 = .3 + b*(w - .6);
      K.poly([[x0, .3, top(a) + .04], [x1, .3, top(b) + .04], [x1, .45, top(b)], [x0, .45, top(a)]], shadeHex(i % 2 ? c[1] : c[0], .7));   // the far rim
      K.poly([[x0, .45, top(a)], [x1, .45, top(b)], [x1, .45, bot(b)], [x0, .45, bot(a)]], i % 2 ? c[1] : c[0]); }
    K.poly([[.2, .45, 1.32], [.3, .45, 1.2], [.3, .45, 1.1]], "#d9c08a"); K.poly([[w - .2, .45, 1.32], [w - .3, .45, 1.2], [w - .3, .45, 1.1]], "#d9c08a"); },
  giftpile(K, it){ const c = it.col; K.box(.1, .45, .48, .4, .36, c[0]); K.box(.3, .38, .1, .4, .36, "#ffd43b", .001); K.box(.48, .5, .42, .34, .28, c[1]); K.box(.64, .5, .09, .34, .28, "#f6f1e7", .001);
    K.box(.24, .42, .4, .3, .26, "#5b6fd6", .36); K.box(.4, .42, .08, .3, .26, "#f6f1e7", .362); K.disc(.44, .55, .07, "#ffd43b", .66); },
  snowman(K, it){ K.disc(.5, .6, .36, "#eef6ff", .36); K.disc(.5, .6, .26, "#ffffff", .9); K.disc(.5, .6, .19, "#ffffff", 1.3); K.box(.36, .5, .28, .2, .06, "#c22e28", 1.08); K.box(.38, .52, .24, .2, .22, "#22252e", 1.46); K.box(.32, .48, .36, .26, .04, "#22252e", 1.46); K.disc(.56, .7, .04, "#ff8a3d", 1.3); [-.07, .07].forEach(d => K.disc(.5 + d, .7, .025, "#22252e", 1.36)); },
  banner(K, it){ const col = typeCol(it.var); K.box(.4, .55, .2, .16, .1, "#4a4a52"); K.rect(.47, .65, .05, 1.95, "#c9c9d2", 1.95); K.poly([[.52, .66, 1.9], [.95, .66, 1.9], [.95, .66, 1.05], [.735, .66, 1.18], [.52, .66, 1.05]], col); motif(K, it.var, .735, .67, 1.5, .17, "#ffffff"); K.disc(.495, .66, .05, "#ffd36b", 1.97); },
  totem(K, it){ const col = typeCol(it.var); for (let i = 0; i < 3; i++) K.box(.22, .35, .56, .5, .58, shadeHex(col, [.6, .85, 1.05][i]), i*.58); K.box(.16, .32, .68, .56, .08, shadeHex(col, .45), 1.74); motif(K, it.var, .5, .86, 1.22, .2, "#ffffff"); [[.38, .6], [.62, .6]].forEach(([x, z]) => K.disc(x, .86, .05, "#22252e", z)); K.rect(.4, .86, .2, .04, "#22252e", .4); },
  pot2(K, it){ const v = it.var; K.box(.25, .4, .5, .42, .42, "#b9643a"); K.box(.2, .38, .6, .46, .08, "#c97a4a", .42);
    if (v === "cactus") { K.box(.4, .55, .2, .16, .9, "#3a9e4f", .5); K.box(.24, .58, .12, .1, .3, "#3a9e4f", .82); K.box(.64, .58, .12, .1, .26, "#3a9e4f", .95); K.disc(.5, .62, .06, "#ff6fa5", 1.42); }
    else if (v === "bonsai") { K.poly([[.46, .62, .5], [.54, .62, .5], [.62, .62, .95], [.56, .62, .98], [.5, .62, .7]], "#6b4226"); [[.36, .95, .2], [.64, 1.05, .22], [.5, 1.2, .2]].forEach(([x, z, r]) => K.disc(x, .62, r, "#2f8a4c", z)); }
    else if (v === "herb") { for (let i = 0; i < 7; i++) K.disc(.3 + i*.067, .6 + (i % 2)*.06, .1, i % 3 ? "#5fbf4a" : "#3a9e4f", .6 + (i % 3)*.12); }
    else { for (let i = 0; i < 5; i++) { const x = .32 + i*.09; K.rect(x, .6, .02, .4, "#3a9e4f", .9); K.disc(x + .01, .6, .08, ["#ff6fa5", "#ffd43b", "#ffffff", "#8a55f0", "#ff8a3d"][i], .95 + (i % 2)*.08); } }
  },
  terrarium(K, it){ K.box(0, .3, it.w, .6, .2, "#7b5234"); K.box(.06, .34, it.w - .12, .52, .8, "#b9e3c9", .2); K.rect(.1, .86, it.w - .2, .7, "#d6f2e0", .96); [[.4, .45], [.9, .6], [1.5, .4], [1.2, .75]].forEach(([x, z]) => K.disc(x, .7, .14, "#3fae5a", z)); motif(K, "Bug", 1, .72, .62, .16, typeCol("Bug")); K.box(.02, .32, it.w - .04, .56, .04, "#7b5234", 1); },
  cauldron(K, it){ const liq = it.var === "honey" ? "#ffc23a" : "#a33ea1"; K.oval(.5, .62, .42, .32, "#22252e", .05); K.box(.12, .42, .76, .4, .55, "#2a2d36", .08); K.oval(.5, .62, .4, .3, "#3a3f52", .63); K.oval(.5, .62, .32, .22, liq, .64); [[.42, .78], [.58, .9], [.5, 1.04]].forEach(([x, z]) => K.disc(x, .62, .05, shadeHex(liq, 1.3), z)); },
  pillowpile(K, it){ [["#ff9ac7", 0, .22], ["#7fc8ff", .14, .2], ["#ffe07a", .28, .18], ["#b48cff", .44, .16]].forEach(([c, z, h], i) => { K.box(.1 + i*.04, .3 + i*.04, .8 - i*.08, .55 - i*.06, h, c, z); K.rect(.2 + i*.04, .82, .6 - i*.08, .02, "rgba(255,255,255,.4)", z + h); }); },
  shellfountain(K, it){ K.oval(1, 1.15, .98, .78, "#a9b3c6"); K.oval(1, 1.08, .98, .76, "#c9d2e2", .3); K.oval(1, 1.08, .8, .6, "#5ab4ff", .32);
    for (let i = 0; i < 9; i++) { const a = Math.PI*(.1 + .8*i/8), r = .78; K.poly([[1, .7, .4], [1 + Math.cos(a)*r, .7, .4 + Math.sin(a)*r*1.4], [1 + Math.cos(a + .09)*r, .7, .4 + Math.sin(a + .09)*r*1.4]], i % 2 ? "#ffd6c9" : "#ffb8a6"); }
    K.disc(1, .9, .12, "#ffffff", .62); [[.7, .55], [1.3, .62], [1, .8]].forEach(([x, z]) => K.disc(x, 1, .05, "rgba(255,255,255,.7)", z)); },
  badgecase(K, it){ const L = LEAGUES[it.region - 1], bits = badgeOf(it.region); K.box(0, .3, 2, .55, .5, "#6b4226"); K.box(.02, .32, 1.96, .5, .06, "#8a5a3c", .5); K.box(.1, .36, 1.8, .4, .62, "#2a2030", .56); K.box(.06, .34, 1.88, .44, .06, "#8a5a3c", 1.18);
    L.gyms.forEach(([, ty], k) => { const x = .35 + (k % 4)*.43, z = k < 4 ? 1.02 : .74, on = bits & (1 << k), b = on && badgeArt(it.region, k); K.disc(x, .77, .11, on && !b ? typeCol(ty.split("/")[0]) : "#3a2f45", z); if (b) K.img(b, x, .77, .27, z); else if (on) K.disc(x - .03, .78, .04, "#ffffff", z + .03); });
    K.rect(.1, .77, 1.8, .05, "rgba(255,255,255,.18)", 1.15); },
  clock(K, it){ K.box(.15, .25, .7, .55, 2.15, it.col[0]); K.disc(.5, .8, .22, it.col[1], 1.75); K.rect(.49, .8, .02, .16, "#1d1f26", 1.85); K.rect(.35, .8, .3, .7, shadeHex(it.col[0], .7), 1.25); },
  trophy(K, it){ const rc = REGION_COL[it.region]; K.box(.15, .3, .7, .55, .55, rc[1]); K.box(.22, .35, .56, .45, .06, rc[0], .55); K.poly([[.28, .6, 1.45], [.72, .6, 1.45], [.6, .6, .95], [.4, .6, .95]], "#e2b13c"); K.rect(.44, .6, .12, .32, "#c9952a", .95); K.oval(.5, .6, .24, .1, "#ffe28a", 1.45); K.disc(.25, .6, .1, "#c9952a", 1.3); K.disc(.75, .6, .1, "#c9952a", 1.3); },
};
const FURN_H = {stove:1.5, fridge:2.3, counter:1.3, hammock:1.45, giftpile:.75, pumpkin:.8, cobweb:2.6, holtree:2.4, display:1.5, statue:2.3, lamp2:2, arch:2.2, orb:1.4, tub:1.3, windvane:2.05, bag:1.95, snowman:1.6, banner:2.05, totem:1.85, pot2:1.5, terrarium:1.1, cauldron:1.1, pillowpile:.9, shellfountain:1.6, badgecase:1.25, bed:1.2, plant:1.5, tabler:.75, sofa:1, chair:1, shelf:2, tv:1.35, lamp:1.9, palm:2.4, bean:.75, desk:1.45, tank:1.45, fire:1.5, piano:1.3, arcade:1.75, fountain:1.25, tree:2.7, flowers:.7, bench:1.1, tramp:.5, cushion:.25, globe:1.3, clock:2.2, trophy:1.6};
// one cached canvas per item look; anchor = back-left floor corner at (pad, pad + h*ts)
const furnCache = new Map();
// animated 2D furniture: art/2d/anim/<id>.png holds the frames side by side, each the size of art/2d/furn/<id>.png
const FURN_FRAME_MS = 150;
// shared 2D art: every Elite Four statue of a type uses that type's statue, and all nine Badge Cases one case
const furnArtKey = it => it.kind === "statue" ? "furn/statue_" + it.var : it.kind === "badgecase" ? "furn/badgecase" : "furn/" + it.id;
// the real badges sit in the case's eight velvet slots (centres on art/2d/furn/badgecase.png, see art-src/process.py)
const BADGE_SLOTS = [[13.5,17.5],[26.5,17.5],[39.5,17.5],[13.5,30.5],[26.5,30.5],[39.5,30.5],[20,43.5],[33,43.5]];
const badgeArt = (g, k) => artOf(`badge/${g}-${k}`);
function drawCaseBadges(x, g, X0, Y0, s, flip){
  const bits = badgeOf(g), W = x.canvas.width; x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
  BADGE_SLOTS.forEach(([cx, cy], k) => {
    const b = badgeArt(g, k); if (!b || !(bits & (1 << k))) return;
    const f = 11*s/Math.max(b.width, b.height), w = b.width*f, h = b.height*f, px = flip ? W - (X0 + cx*s) : X0 + cx*s;   // badges are never drawn mirrored
    x.drawImage(b, Math.round(px - w/2), Math.round(Y0 + cy*s - h/2), Math.round(w), Math.round(h));
  });
  x.restore();
}
const furnAnim = id => { const sh = artOf("anim/" + id), st = artOf("furn/" + id); return sh && st && sh.width > st.width ? {sh, n:Math.round(sh.width/st.width), w:st.width} : null; };
const furnFrame = (p, now) => state.ui.motion === "reduced" || !furnAnim(p.it.id) ? 0 : Math.floor((now + p.x*97 + p.y*53)/FURN_FRAME_MS) % furnAnim(p.it.id).n;
function furnSprite(it, ts, pixel, flip, fi = 0){
  const k = [it.id, Math.round(ts*10), pixel, flip, it.kind === "badgecase" ? badgeOf(it.region) : "", it.rot ? "r" : "", fi].join("|"); if (furnCache.has(k)) return furnCache.get(k);
  const A = pixel && !it.rot && fi > 0 && furnAnim(it.id);
  const img = pixel && !it.rot && artOf(furnArtKey(it));   // a turned rug is drawn from shapes
  if (img) {   // 2D pixel art at its own pixel size (32 px per tile): centred on the footprint, standing on its front edge
    const s = ts/32*Math.min(1, it.w*32/img.width), w = img.width*s, h = img.height*s, floorD = it.d*ts*HM.SQ, pad = Math.ceil(ts*.25);
    const off = isFloorItem(it) ? (floorD - h)/2 : floorD - h;   // rugs sit in the middle of their footprint
    const c = mkCanvas(Math.ceil(it.w*ts + pad*2), Math.ceil(h + pad*2)), x = c.getContext("2d"); x.imageSmoothingEnabled = false;
    if (flip) { x.translate(c.width, 0); x.scale(-1, 1); }
    if (A) x.drawImage(A.sh, (fi % A.n)*A.w, 0, A.w, img.height, Math.round(pad + (it.w*ts - w)/2), pad, Math.round(w), Math.round(h));
    else x.drawImage(img, Math.round(pad + (it.w*ts - w)/2), pad, Math.round(w), Math.round(h));
    if (it.kind === "badgecase") drawCaseBadges(x, it.region, Math.round(pad + (it.w*ts - w)/2), pad, s, flip);
    const out = {c, pad, h:-off/ts, art:true}; if (furnCache.size > 400) furnCache.clear(); furnCache.set(k, out); return out;
  }
  const h = isFloorItem(it) ? 0 : (FURN_H[it.kind] || 1.5) + .3, pad = Math.ceil(ts*.25), W = Math.ceil(it.w*ts + pad*2), H = Math.ceil(it.d*ts*HM.SQ + h*ts + pad*2);
  const c = mkCanvas(W, H), x = c.getContext("2d"); x.imageSmoothingEnabled = !pixel;
  x.translate(pad, pad + h*ts); if (flip) { x.translate(it.w*ts, 0); x.scale(-1, 1); }
  try { HOUSE_DRAW[it.kind](fkit(x, ts, pixel), it); } catch(e){}
  const out = {c, pad, h}; if (furnCache.size > 300) furnCache.clear(); furnCache.set(k, out); return out;
}
// the visible part of a picture (transparent margins cut off), so small items like cobwebs fill their Shop tile
const trimC = new WeakMap();
function trimmed(src){
  if (trimC.has(src)) return trimC.get(src);
  const w = src.width, h = src.height, c = mkCanvas(w, h), cx = c.getContext("2d"); cx.drawImage(src, 0, 0);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  try { const d = cx.getImageData(0, 0, w, h).data; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y*w + x)*4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } } catch(e) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
  let out = src;
  if (x1 >= x0 && (x1 - x0 + 1 < w || y1 - y0 + 1 < h)) { out = mkCanvas(x1 - x0 + 1, y1 - y0 + 1); out.getContext("2d").drawImage(src, -x0, -y0); }
  trimC.set(src, out); return out;
}
function homeItemThumb(x, it, pixel){
  x.clearRect(0, 0, 160, 96);
  const art = pixel && artOf(furnArtKey(it));
  let img, k;
  if (art) { img = trimmed(art); k = Math.max(1, Math.floor(Math.min(150/img.width, 86/img.height))); }
  else {
    k = pixel ? 2 : 1; let ts = Math.min(150/(it.w + .6), 84/(it.d*HM.SQ + (FURN_H[it.kind] || .3) + .6)) / k;
    img = trimmed(furnSprite(it, ts, pixel, false).c);
    const f = Math.min(150/(img.width*k), 86/(img.height*k), 4);   // small items: draw them bigger instead of stretching the picture
    if (f > 1.15) { ts *= f*.98; img = trimmed(furnSprite(it, ts, pixel, false).c); }
    k = Math.min(k, 150/img.width, 86/img.height); if (pixel) k = Math.max(1, Math.floor(k));
  }
  x.imageSmoothingEnabled = !pixel && !art;
  x.drawImage(img, Math.round((160 - img.width*k)/2), Math.round((96 - img.height*k)/2), Math.round(img.width*k), Math.round(img.height*k));
}
function homeRoomThumb(x, room, pixel){
  const k = pixel ? 2 : 1, W = 160/k, H = 96/k, c = mkCanvas(W, H), cx = c.getContext("2d"), ts = H/(HM.WALL + HM.D*HM.SQ);
  paintRoom(cx, {...room, x0:0}, ts, pixel, "day", W/ts); x.imageSmoothingEnabled = !pixel; x.drawImage(c, 0, 0, 160, 96);
}
// ---- the room: walls + floor ----
// the pictures for a room in 2D, or null to draw it from shapes
function roomArt(r){
  const wall = artOf(r.wall ? "room/wall_" + r.id : "room/back_" + r.id), floor = artOf("room/floor_" + r.floor);
  return wall && floor ? {wall, floor, win:artOf("room/win_" + r.id), pond:r.pond && artOf("room/pond")} : null;
}
function paintRoomArt(c, r, ts, tod, wTiles, A, head){
  const X0 = Math.round(r.x0*ts), W = Math.round((wTiles ?? r.w)*ts), wallH = Math.round(HM.WALL*ts), floorH = Math.round(HM.D*ts*HM.SQ), k = ts/32, R = Math.round;
  const sky = tod === "night" ? ["#0d1330", "#1f2b5a"] : tod === "sunset" ? ["#ff9a5a", "#ffd39a"] : ["#7cc4ff", "#d8f0ff"];
  const skyFill = (y0, y1) => { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]); c.fillStyle = g; };
  c.save(); c.beginPath(); c.rect(X0, -head, W + 1, head + wallH + floorH + 2); c.clip(); c.imageSmoothingEnabled = false;
  const ww = R(A.wall.width*k), wh = R(A.wall.height*k), wy = wallH - wh;
  if (!r.wall) { skyFill(-head, wy + wh*.6); c.fillRect(X0, -head, W + 1, head + wallH); }   // outdoors: open sky above the hedge
  for (let x = X0; x < X0 + W; x += ww) {
    c.drawImage(A.wall, x, wy, ww, wh);
  }
  if (r.wall && head + wy > 0) {   // indoors the spare height is the cut-away ceiling
    c.fillStyle = "#2a2433"; c.fillRect(X0, -head, W + 1, head + wy);
    c.fillStyle = "#4a4057"; c.fillRect(X0, wy - R(3*k), W + 1, R(3*k));
  }
  if (r.wall && A.win) for (let i = 1; i < W/ts - 1.5; i += 4.5) {   // windows show the sky outside
    const w = R(A.win.width*k), h = R(A.win.height*k), x = R(X0 + (i + 1.4)*ts - w/2), y = R(wallH*.13);
    skyFill(y, y + h); c.fillRect(x + R(3*k), y + R(3*k), w - R(6*k), h - R(6*k)); c.drawImage(A.win, x, y, w, h);
  }
  const fw = R(A.floor.width*k), fh = R(A.floor.height*k);
  for (let y = wallH; y < wallH + floorH; y += fh) for (let x = X0 - ((X0 % fw) + fw) % fw; x < X0 + W; x += fw) c.drawImage(A.floor, x, y, fw, fh);
  c.fillStyle = "rgba(0,0,0,.18)"; c.fillRect(X0, wallH, W + 1, Math.max(1, R(2*k)));   // shadow where wall meets floor
  if (A.pond) { const w = R(A.pond.width*k), h = R(A.pond.height*k); c.drawImage(A.pond, R(X0 + W/2 - w/2), R(wallH + floorH*.55 - h/2), w, h); }
  c.restore();
}
function paintRoom(c, r, ts, pixel, tod, wTiles, head = 0){
  const A = pixel && roomArt(r); if (A) { paintRoomArt(c, r, ts, tod, wTiles, A, head); return; }
  const SQ = HM.SQ, X0 = r.x0*ts, W = (wTiles ?? r.w)*ts, wallH = HM.WALL*ts, floorH = HM.D*ts*SQ, R = v => pixel ? Math.round(v) : v;
  const sky = tod === "night" ? ["#0d1330", "#1f2b5a"] : tod === "sunset" ? ["#ff9a5a", "#ffd39a"] : ["#7cc4ff", "#d8f0ff"];
  if (!r.wall) {   // outdoors: sky, distant hedge and a fence
    const g = c.createLinearGradient(0, 0, 0, wallH); g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]); c.fillStyle = g; c.fillRect(R(X0), 0, R(W) + 1, R(wallH));
    c.fillStyle = tod === "night" ? "#1d3a2a" : "#3a8f4f"; for (let i = 0; i < W/ts + 1; i++) { c.beginPath(); c.arc(R(X0 + i*ts + ts*.5), R(wallH*.78), R(ts*.62), 0, 7); c.fill(); } c.fillRect(R(X0), R(wallH*.78), R(W) + 1, R(wallH*.22));
    c.fillStyle = "#f2eadb"; for (let i = 0; i < W/ts*2; i++) c.fillRect(R(X0 + i*ts*.5 + ts*.08), R(wallH*.7), R(ts*.12), R(wallH*.3)); c.fillRect(R(X0), R(wallH*.78), R(W), R(ts*.08)); c.fillRect(R(X0), R(wallH*.9), R(W), R(ts*.08));
  } else {
    c.fillStyle = r.wall; c.fillRect(R(X0), 0, R(W) + 1, R(wallH));
    c.fillStyle = shadeHex(r.wall, .94); for (let i = 0; i < W/ts*2; i += 2) c.fillRect(R(X0 + i*ts*.5), 0, R(ts*.5), R(wallH));
    c.fillStyle = shadeHex(r.wall, .7); c.fillRect(R(X0), R(wallH - ts*.22), R(W) + 1, R(ts*.22));
    for (let i = 1; i < W/ts - 1.5; i += 4.5) {   // windows
      const wx = X0 + i*ts + ts*.6, wy = wallH*.18, ww = ts*1.6, wh = wallH*.42;
      c.fillStyle = "#ffffff"; c.fillRect(R(wx - ts*.08), R(wy - ts*.08), R(ww + ts*.16), R(wh + ts*.16));
      const g = c.createLinearGradient(0, wy, 0, wy + wh); g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]); c.fillStyle = g; c.fillRect(R(wx), R(wy), R(ww), R(wh));
      c.fillStyle = "#ffffff"; c.fillRect(R(wx + ww/2 - ts*.04), R(wy), R(ts*.08), R(wh)); c.fillRect(R(wx), R(wy + wh/2 - ts*.04), R(ww), R(ts*.08));
    }
  }
  // floor
  const fy = wallH, base = {wood:"#c8945e", carpet:"#7f9fd1", grass:"#7cc45a", marble:"#e9e6f2", tile:"#f1ede2"}[r.floor];
  c.fillStyle = base; c.fillRect(R(X0), R(fy), R(W) + 1, R(floorH) + 1);
  if (r.floor === "wood") { for (let row = 0; row < HM.D*2; row++) { c.fillStyle = row % 2 ? "#bd8752" : "#c8945e"; c.fillRect(R(X0), R(fy + row*ts*SQ/2), R(W) + 1, R(ts*SQ/2) + 1); c.fillStyle = "rgba(0,0,0,.12)"; for (let i = (row % 3)*.7; i < W/ts; i += 2.1) c.fillRect(R(X0 + i*ts), R(fy + row*ts*SQ/2), 1, R(ts*SQ/2)); } }
  if (r.floor === "carpet") { c.fillStyle = "rgba(255,255,255,.08)"; for (let y = 0; y < HM.D; y++) for (let x = 0; x < W/ts; x++) if ((x + y) % 2) c.fillRect(R(X0 + x*ts), R(fy + y*ts*SQ), R(ts), R(ts*SQ)); }
  if (r.floor === "tile") { for (let y = 0; y < HM.D*2; y++) for (let x = 0; x < W/ts*2; x++) if ((x + y) % 2) { c.fillStyle = "#c9d9cf"; c.fillRect(R(X0 + x*ts/2), R(fy + y*ts*SQ/2), R(ts/2) + 1, R(ts*SQ/2) + 1); } }
  if (r.floor === "marble") { for (let y = 0; y < HM.D; y++) for (let x = 0; x < W/ts; x++) { c.fillStyle = (x + y) % 2 ? "#d9d4e8" : "#f2f0f8"; c.fillRect(R(X0 + x*ts), R(fy + y*ts*SQ), R(ts) + 1, R(ts*SQ) + 1); } }
  if (r.floor === "grass") { const Rn = rng(r.x0*7 + 3); c.fillStyle = "#6ab64c"; for (let i = 0; i < W/ts*6; i++) { const x = X0 + Rn()*W, y = fy + Rn()*floorH; c.fillRect(R(x), R(y), Math.max(1, R(ts*.06)), Math.max(1, R(ts*.18))); } }
  if (r.pond) { const cx = X0 + W/2, cy = fy + floorH*.55; c.fillStyle = "#3f8f5a"; c.beginPath(); c.ellipse(R(cx), R(cy), R(W*.32 + ts*.15), R(floorH*.3 + ts*.12), 0, 0, 7); c.fill(); c.fillStyle = "#4aa8e0"; c.beginPath(); c.ellipse(R(cx), R(cy), R(W*.32), R(floorH*.3), 0, 0, 7); c.fill(); c.fillStyle = "rgba(255,255,255,.35)"; for (let i = 0; i < 6; i++) c.fillRect(R(cx - W*.2 + i*W*.07), R(cy - floorH*.1 + (i % 3)*floorH*.08), R(ts*.4), Math.max(1, R(ts*.04))); }
  // back-wall shadow on the floor and the edge of the room
  if (!pixel) { const g = c.createLinearGradient(0, fy, 0, fy + ts*.6); g.addColorStop(0, "rgba(0,0,0,.18)"); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(R(X0), R(fy), R(W), R(ts*.6)); }
}
// ---- walls and doorways between rooms ----
// Each pair of rooms is split by a low cut-away wall with a doorway in the middle; its look depends on what it joins:
// an indoor wall (bedroom ↔ living room), the house's back wall and door (house ↔ garden or pond), a hedge with a
// rose arch (garden ↔ pond) or the marble entrance of the Grand hall.
const DOOR = [2.6, 4.6];
const roomKind = r => r.id === "hall" ? "hall" : r.wall ? "house" : "out";
const divType = (a, b) => { const A = roomKind(a), B = roomKind(b); return A === "hall" || B === "hall" ? "hall" : A === "out" && B === "out" ? "hedge" : A === "house" && B === "house" ? "in" : "ext"; };
const DIV = {in:{h:.45, cap:"#e9dcc4", face:"#9a7a55", col:"#efe2c6"}, ext:{h:.55, cap:"#9b9ba3", face:"#a8442f", col:"#f2eadb"},
  hedge:{h:.8, cap:"#4f9e58", face:"#2f6b3a", col:"#3f8f4f"}, hall:{h:.5, cap:"#f2f0f8", face:"#cfc8e0", col:"#ffffff"}};
const dividers = () => HS.rooms.slice(1).map((r, i) => ({x:r.x0, t:divType(HS.rooms[i], r), row:r.row === HS.rooms[i].row})).filter(d => d.row);   // only between rooms in the same row
const inWall = (x, y) => HS.rooms.some((r, i) => i && (r.row !== HS.rooms[i - 1].row ? Math.abs(x - r.x0) < .3 : Math.abs(x - r.x0) < .6 && (y < DOOR[0] + .15 || y > DOOR[1] - .15)));
function paintDivider(c, d, ts, pixel, head){
  const T = DIV[d.t], R = v => pixel ? Math.round(v) : v, X0 = d.x*ts - ts/2, wallH = HM.WALL*ts, fy = y => wallH + y*ts*HM.SQ, h = T.h*ts, k = ts/32;
  const col = pixel && artOf(`div/${d.t}_col`), cap = pixel && artOf(`div/${d.t}_cap`), door = pixel && artOf(`div/${d.t}_door`);
  if (col) { const w = col.width*k, hh = col.height*k; c.drawImage(col, R(d.x*ts - w/2), R(wallH - hh), R(w), R(hh)); }   // the wall's end
  else { c.fillStyle = T.col; c.fillRect(R(X0 + ts*.1), R(-head), R(ts*.8), R(wallH + head)); c.fillStyle = "rgba(0,0,0,.15)"; c.fillRect(R(X0 + ts*.78), R(-head), R(ts*.12), R(wallH + head)); }
  for (const [a, b] of [[0, DOOR[0]], [DOOR[1], HM.D]]) {   // the wall either side of the doorway
    const top = fy(a) - h, bot = fy(b) - h;
    if (cap) { c.save(); c.beginPath(); c.rect(R(X0), R(top), R(ts), R(bot - top)); c.clip(); const th = cap.height*k; for (let y = top; y < bot; y += th) c.drawImage(cap, R(X0), R(y), R(ts), R(th)); c.restore(); }
    else { c.fillStyle = T.cap; c.fillRect(R(X0), R(top), R(ts), R(bot - top)); }
    c.fillStyle = T.face; c.fillRect(R(X0), R(bot), R(ts), R(h)); c.fillStyle = "rgba(0,0,0,.25)"; c.fillRect(R(X0), R(bot), R(ts), Math.max(1, R(ts*.05)));
  }
  const y0 = fy(DOOR[0]), y1 = fy(DOOR[1]);   // the doorway: a mat, a step or stepping stones
  if (door) { const w = door.width*k, hh = door.height*k; c.drawImage(door, R(d.x*ts - w/2), R((y0 + y1)/2 - hh/2), R(w), R(hh)); }   // the mat or step at its own size
  else { c.fillStyle = "rgba(0,0,0,.12)"; c.fillRect(R(X0 + ts*.1), R(y0 + ts*.05), R(ts*.8), R(y1 - y0 - ts*.1)); }
}
function drawDivPost(c, d, y, pixel){   // door posts stand up, so they are drawn in depth order with everyone else
  const ts = HS.ts, img = pixel && artOf(`div/${d.t}_post`), X = scrX(d.x), Y = scrY(y), T = DIV[d.t];
  if (img) { const w = img.width*ts/32, h = img.height*ts/32; c.drawImage(img, Math.round(X - w/2), Math.round(Y - h), Math.round(w), Math.round(h)); return; }
  const w = ts*.34, h = ts*1.25; c.fillStyle = T.face; c.fillRect(X - w/2, Y - h, w, h); c.fillStyle = T.cap; c.fillRect(X - w/2, Y - h, w, ts*.12);
}
// ---- rows of rooms, joined by doors ----
// The rooms lie in rows, north to south (ROOMS[].row): the garden and pond behind the house, the house, the front yard.
// Positions are still saved along one strip of rooms in ROOMS order (each row is one stretch of it), so saves don't
// change. On screen each row starts at the left, one above the other, and the doors (DOORX tiles in from each row's left
// end) join them: the front door in the yard's back wall opens onto the house's front edge, and the back door in the
// bedroom's back wall onto the garden's front edge. Going through moves you to the door's other end (a path waypoint
// with `to`), and the view slides up or down to that row.
const DOORX = 4.5;
function homeRows(){
  const rows = [];
  for (const r of HS.rooms) { const R = rows.find(q => q.row === r.row); if (R) { R.rooms.push(r); R.x1 = r.x0 + r.w; } else rows.push({row:r.row, rooms:[r], x0:r.x0, x1:r.x0 + r.w}); }
  rows.sort((a, b) => a.row - b.row).forEach((R, k) => { R.k = k; R.w = R.x1 - R.x0; R.out = R.rooms.every(r => roomKind(r) === "out"); });
  HS.rows = rows; HS.pass = null;
  HS.doors = rows.slice(1).map((S, i) => ({k:i, n:{x:rows[i].x0 + DOORX, y:HM.D - .35}, s:{x:S.x0 + DOORX, y:.45}}));   // between row k (its front edge) and row k + 1 (its back wall)
}
const rowOf = x => HS.rows.find(R => x >= R.x0 && x < R.x1) || HS.rows[HS.rows.length - 1];
const sameRow = (a, b) => rowOf(a) === rowOf(b);
const doorWays = () => HS.doors.flatMap(d => [{at:d.s, to:d.n, up:true, k:d.k}, {at:d.n, to:d.s, up:false, k:d.k + 1}]);   // k: the row it leads to
const nearDoor = (o, r = .8) => doorWays().find(w => Math.abs(o.x - w.at.x) < r && Math.abs(o.y - w.at.y) < r*.9) || null;
const doorLabel = w => { const R = HS.rows[w.k]; return R.out ? `Go out to the ${R.rooms[0].name.toLowerCase()}` : "Go inside"; };
function goThrough(o, w){ o.x = w.to.x; o.y = w.to.y < 1 ? w.to.y + .45 : w.to.y; o.path = null; if (o === HS.me) Sound.play("door"); }   // a step into the room, clear of the door
// in a row's pass the camera is that row's: scrX/scrY place it on screen (HS.pass), one band above the next
function rowCam(R){ HS.pass = R; HS.camY = HS.camY0 - Math.round((R.k - (HS.vy ?? R.k))*HS.bandH); }
const HSKY = {night:["#0d1330", "#1f2b5a"], sunset:["#ff9a5a", "#ffd39a"], day:["#7cc4ff", "#d8f0ff"]};
// past the ends of a row: a dim corridor beside the house rooms; more hedge, sky and lawn beside a yard
function rowBackdrop(c, R, pixel, tod){
  const ts = HS.ts, V = HS.V, top = R.k ? Math.round(scrY(0) - HM.WALL*ts) : 0, wy = Math.round(scrY(0)), bot = R.k === HS.rows.length - 1 ? V.H : Math.round(scrY(HM.D)), X0 = Math.round(scrX(R.x0));
  const draw = out => {
    if (!out) { c.fillStyle = "#3a2f2a"; c.fillRect(0, top, V.W, wy - top); c.fillStyle = "#4a3426"; c.fillRect(0, wy, V.W, bot - wy); c.fillStyle = "rgba(0,0,0,.25)"; for (let i = 0; i < 8; i++) c.fillRect(0, wy + Math.round(i*ts*HM.SQ), V.W, 1); return; }
    const sk = HSKY[tod] || HSKY.day, g = c.createLinearGradient(0, top, 0, wy); g.addColorStop(0, sk[0]); g.addColorStop(1, sk[1]); c.fillStyle = g; c.fillRect(0, top, V.W, wy - top);
    const back = pixel && artOf("room/back_" + R.rooms[0].id), grass = pixel && artOf("room/floor_grass");
    if (back) { const w = back.width, h = back.height; for (let x = X0 - Math.ceil(X0/w)*w; x < V.W; x += w) c.drawImage(back, x, wy - h); }
    else { c.fillStyle = tod === "night" ? "#1d3a2a" : "#3a8f4f"; for (let x = X0 % ts - ts; x < V.W + ts; x += ts) { c.beginPath(); c.arc(x + ts*.5, wy - HM.WALL*ts*.22, ts*.62, 0, 7); c.fill(); } c.fillRect(0, wy - HM.WALL*ts*.22, V.W, HM.WALL*ts*.22); }
    if (grass) { const w = grass.width, h = grass.height; for (let y = wy; y < bot; y += h) for (let x = X0 - Math.ceil(X0/w)*w; x < V.W; x += w) c.drawImage(grass, x, y); }
    else { c.fillStyle = "#7cc45a"; c.fillRect(0, wy, V.W, bot - wy); }
    c.fillStyle = "rgba(16,28,24,.32)"; c.fillRect(0, top, V.W, bot - top);   // dimmer: you can't go there
  };
  draw(R.out); if (!R.out && HS.outA > .01) { c.save(); c.globalAlpha = HS.outA; draw(true); c.restore(); }
}
// ---- the house from outside: its front wall behind the front yard, and its roof over the house rows seen from a yard ----
function roofShapes(c, H, X0, X1, top, wallTop, ts, pixel){
  const R = v => pixel ? Math.round(v) : v, W = X1 - X0;
  let g = c.createLinearGradient(0, top, 0, wallTop); g.addColorStop(0, H.roof2); g.addColorStop(1, H.roof);   // seen from above
  c.fillStyle = g; c.fillRect(R(X0), R(top), R(W), R(wallTop - top));
  const rowH = ts*.42;
  for (let y = top + ts*.5, i = 0; y < wallTop - ts*.1; y += rowH, i++) {   // rows of tiles, staggered joints
    c.fillStyle = "rgba(0,0,0,.2)"; c.fillRect(R(X0), R(y), R(W), Math.max(1, R(ts*.06)));
    c.fillStyle = "rgba(255,255,255,.1)"; c.fillRect(R(X0), R(y + ts*.06), R(W), Math.max(1, R(ts*.03)));
    c.fillStyle = "rgba(0,0,0,.12)"; for (let x = X0 + (i % 2)*ts*.3; x < X1; x += ts*.6) c.fillRect(R(x), R(y - rowH + ts*.06), Math.max(1, R(ts*.04)), R(rowH - ts*.06));
  }
  c.fillStyle = shadeHex(H.roof2, .8); c.fillRect(R(X0), R(top), R(W), R(ts*.5));   // ridge
  c.fillStyle = "rgba(255,255,255,.18)"; c.fillRect(R(X0), R(top + ts*.08), R(W), Math.max(1, R(ts*.06)));
  for (let x = X0 + ts*2.2; x < X1 - ts*1.5; x += ts*13) {   // chimneys
    c.fillStyle = "#8a4a3a"; c.fillRect(R(x), R(top - ts*.4), R(ts*.8), R(ts*1.3)); c.fillStyle = "#5a3026"; c.fillRect(R(x - ts*.08), R(top - ts*.5), R(ts*.96), R(ts*.22));
  }
}
function frontShapes(c, H, X0, X1, wallTop, bot, ts, pixel, night, door){   // door: the x of the front door, kept clear of windows
  const R = v => pixel ? Math.round(v) : v, W = X1 - X0;
  c.fillStyle = H.wall; c.fillRect(R(X0), R(wallTop), R(W), R(bot - wallTop));
  c.fillStyle = "rgba(0,0,0,.06)"; for (let y = wallTop + ts*.3; y < bot; y += ts*.3) c.fillRect(R(X0), R(y), R(W), Math.max(1, R(ts*.03)));
  c.fillStyle = "rgba(0,0,0,.28)"; c.fillRect(R(X0), R(wallTop), R(W), R(ts*.16));   // shadow under the eaves
  const wy = wallTop + ts*.45, wh = ts*1.1, ww = ts*1.2, glass = night > .3 ? "#ffd98a" : "#a9d4f5";
  for (let x = X0 + ts*1.6; x < X1 - ts*1.6; x += ts*3.2) {   // windows with shutters and a flower box
    if (door != null && x - ts*.5 < door + ts*.8 && x + ww + ts*.5 > door - ts*.8) continue;
    c.fillStyle = H.trim; c.fillRect(R(x - ts*.5), R(wy), R(ts*.42), R(wh)); c.fillRect(R(x + ww + ts*.08), R(wy), R(ts*.42), R(wh));
    c.fillStyle = "#ffffff"; c.fillRect(R(x - ts*.06), R(wy - ts*.06), R(ww + ts*.12), R(wh + ts*.12));
    c.fillStyle = glass; c.fillRect(R(x), R(wy), R(ww), R(wh)); c.fillStyle = "#ffffff"; c.fillRect(R(x + ww/2 - ts*.03), R(wy), R(ts*.06), R(wh)); c.fillRect(R(x), R(wy + wh/2 - ts*.03), R(ww), R(ts*.06));
    c.fillStyle = "#7a4a2a"; c.fillRect(R(x - ts*.1), R(wy + wh + ts*.04), R(ww + ts*.2), R(ts*.18));
    c.fillStyle = "#e2413b"; for (let k = 0; k < 4; k++) c.fillRect(R(x + k*ww/4 + ts*.06), R(wy + wh - ts*.04), R(ts*.12), R(ts*.1));
  }
  c.fillStyle = H.base; c.fillRect(R(X0), R(bot - ts*.38), R(W), R(ts*.38));   // foundation
  c.fillStyle = "rgba(0,0,0,.18)"; for (let x = X0 + ts*.2; x < X1; x += ts*.7) c.fillRect(R(x), R(bot - ts*.38), Math.max(1, R(ts*.04)), R(ts*.38));
}
function facadeShapes(c, H, X0, X1, top, bot, ts, pixel, night){   // the whole house front (the Shop's picture in 3D)
  const wallTop = bot - HM.WALL*ts*.95;
  roofShapes(c, H, X0, X1, top, wallTop, ts, pixel); frontShapes(c, H, X0, X1, wallTop, bot, ts, pixel, night);
  c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(X0, top, Math.max(1, ts*.06), bot - top); c.fillRect(X1 - ts*.06, top, Math.max(1, ts*.06), bot - top);
}
// 3D doors: the front door (closed, a fan light over it) and the back door standing open on the garden
function doorShapes(c, open, x, yb, ts, tod){
  const w = ts*1.15, h = ts*1.85, X = x - w/2, Y = yb - h;
  c.fillStyle = "#f4efe4"; c.fillRect(X - ts*.12, Y - ts*.12, w + ts*.24, h + ts*.12); c.fillStyle = "rgba(0,0,0,.18)"; c.fillRect(X + w + ts*.06, Y - ts*.12, ts*.06, h + ts*.12);
  if (open) {
    const sk = HSKY[tod] || HSKY.day, g = c.createLinearGradient(0, Y, 0, yb); g.addColorStop(0, sk[0]); g.addColorStop(.55, sk[1]); g.addColorStop(.56, "#79b85a"); g.addColorStop(1, "#4f9a45"); c.fillStyle = g; c.fillRect(X, Y, w, h);
    c.fillStyle = "#3f8f4f"; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(X + w*(.45 + i*.25), Y + h*.6, ts*.28, 0, 7); c.fill(); }
    c.fillStyle = "#e48ac8"; for (let i = 0; i < 5; i++) c.fillRect(X + w*(.42 + i*.11), Y + h*(.5 + (i % 2)*.12), ts*.08, ts*.08);
    c.fillStyle = "#8a5530"; c.beginPath(); c.moveTo(X, Y); c.lineTo(X + w*.36, Y + h*.06); c.lineTo(X + w*.36, yb - h*.03); c.lineTo(X, yb); c.closePath(); c.fill();   // the door, swung open
    c.fillStyle = "rgba(0,0,0,.15)"; c.fillRect(X + w*.08, Y + h*.12, w*.2, h*.3); c.fillRect(X + w*.08, Y + h*.52, w*.2, h*.36); c.fillStyle = "#ffd43b"; c.fillRect(X + w*.3, Y + h*.52, ts*.08, ts*.08);
    return;
  }
  c.fillStyle = "#a8622f"; c.fillRect(X, Y, w, h);
  c.fillStyle = "#8fc3ea"; c.beginPath(); c.arc(x, Y + h*.2, w*.3, Math.PI, 0); c.closePath(); c.fill(); c.fillStyle = "#f4efe4"; c.fillRect(x - ts*.02, Y + h*.2 - w*.3, ts*.04, w*.3);
  c.fillStyle = "rgba(0,0,0,.2)"; for (const [a, b] of [[.12, .3], [.56, .3]]) for (const [u, v] of [[.28, .26], [.6, .3]]) c.fillRect(X + w*a, Y + h*u, w*b, h*v);
  c.fillStyle = "#ffd43b"; c.beginPath(); c.arc(X + w*.86, Y + h*.58, ts*.06, 0, 7); c.fill();
}
// little marks on the floor at the doors: the step and mat outside the front door, a mat inside, stepping stones in the garden
function doorMark(c, kind, x, y, pixel){
  const ts = HS.ts, img = pixel && artOf({step:"div/ext_door", mat:"div/in_door", stones:"div/hedge_door"}[kind]), X = scrX(x), Y = scrY(y);
  if (img) { c.drawImage(img, Math.round(X - img.width/2), Math.round(Y - img.height/2)); return; }
  if (kind === "stones") { c.fillStyle = "#8f959d"; for (const [dx, dy] of [[-.1, -.5], [.15, .1], [-.05, .7]]) { c.beginPath(); c.ellipse(X + dx*ts, Y + dy*ts*HM.SQ, ts*.36, ts*.16, 0, 0, 7); c.fill(); } return; }
  if (kind === "step") { c.fillStyle = "#9b9ba3"; c.fillRect(X - ts*.6, Y - ts*.32, ts*1.2, ts*.5); c.fillStyle = "rgba(0,0,0,.25)"; c.fillRect(X - ts*.6, Y + ts*.12, ts*1.2, ts*.06); }
  c.fillStyle = "#b8473a"; c.fillRect(X - ts*.42, Y - ts*.22, ts*.84, ts*.32); c.fillStyle = "rgba(255,255,255,.25)"; c.fillRect(X - ts*.34, Y - ts*.16, ts*.68, ts*.04);
}
// a row's doors, drawn after its rooms: behind the front yard the house front (as wide as the house) with the front door,
// the back door in the bedroom's back wall, and the marks on the floor where you come through
function drawRowDoors(c, R, pixel, tod){
  const ts = HS.ts, below = HS.doors[R.k], above = R.k ? HS.doors[R.k - 1] : null, wb = Math.round(scrY(0));
  if (above && !HS.rows[R.k - 1].out && R.out) {   // the house is behind this yard
    const HR = HS.rows[R.k - 1], H = houseOf(), X0 = Math.round(scrX(R.x0)), X1 = Math.round(scrX(R.x0 + HR.w)), wt = wb - Math.round(HM.WALL*ts), dx = Math.round(scrX(above.s.x));
    const img = pixel && artOf(`house/${H.id}_front`), door = pixel && artOf("room/door_front");
    c.save(); c.beginPath(); c.rect(X0, wt - ts, X1 - X0, wb - wt + ts); c.clip();
    if (img) { const w = img.width; for (let x = dx - (H.door || 0) - Math.ceil((dx - (H.door || 0) - X0)/w)*w; x < X1; x += w) c.drawImage(img, x, wb - img.height); }
    else frontShapes(c, H, X0, X1, wt, wb, ts, pixel, HS.light ? HS.light.night : 0, dx);
    c.fillStyle = "rgba(0,0,0,.3)"; c.fillRect(X0, wt, Math.max(1, Math.round(ts*.06)), wb - wt); c.fillRect(X1 - Math.max(1, Math.round(ts*.06)), wt, Math.max(1, Math.round(ts*.06)), wb - wt);   // the corners
    c.restore();
    if (door) c.drawImage(door, dx - Math.round(door.width/2), wb - door.height - 3); else doorShapes(c, false, dx, wb - ts*.1, ts, tod);
    doorMark(c, "step", above.s.x, .25, pixel);
  } else if (above) {   // a back door out to the garden
    const dx = Math.round(scrX(above.s.x)), door = pixel && artOf("room/door_back");
    if (door) c.drawImage(door, dx - Math.round(door.width/2), wb - door.height); else doorShapes(c, true, dx, wb, ts, tod);
    doorMark(c, "mat", above.s.x, .3, pixel);
  }
  if (below) doorMark(c, R.out ? "stones" : "mat", below.n.x, below.n.y - (R.out ? .35 : .05), pixel);
}
// out in a yard, the house's rooms are seen from above: the roof covers them (and whoever is inside)
function drawRoof(c, pixel, R, a){
  const ts = HS.ts, H = houseOf(), X0 = Math.round(scrX(R.x0)), X1 = Math.round(scrX(R.x1)), bot = Math.round(scrY(HM.D)), top = Math.round(scrY(0) - HM.WALL*ts), img = pixel && artOf(`house/${H.id}_roof`);
  if (X1 < 0 || X0 > HS.V.W) return;
  c.save(); c.globalAlpha = a; c.beginPath(); c.rect(X0, top - ts, X1 - X0, bot - top + ts); c.clip();
  if (img) for (let x = X0; x < X1; x += img.width) c.drawImage(img, x, bot - img.height);
  else roofShapes(c, H, X0, X1, top, bot, ts, pixel);
  const e = Math.max(1, Math.round(ts*.06)); c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(X0, top, e, bot - top); c.fillRect(X1 - e, top, e, bot - top); c.fillRect(X0, bot - e, X1 - X0, e);
  c.restore();
}
function houseThumb(x, H, pixel){
  x.clearRect(0, 0, 160, 96);
  const img = pixel && artOf("house/" + H.id);
  if (img) { const k = 96/img.height; x.imageSmoothingEnabled = true; for (let X = 0; X < 160; X += img.width*k) x.drawImage(img, X, 0, img.width*k, 96); return; }   // repeated along, like the house
  x.fillStyle = "#bfe3ff"; x.fillRect(0, 0, 160, 96); facadeShapes(x, H, 8, 152, 16, 92, 13, pixel, 0);
}
const inPond = (r, x, y) => r.pond && (((x - (r.x0 + r.w/2))/(r.w*.32))**2 + ((y - HM.D*.55)/(HM.D*.3))**2) < 1;

// ---- state of the running Home ----
const HS = {camY:0, ro:null, cv:null, ctx:null, low:null, lctx:null, raf:0, ts:0, V:null, k:1, cam:0, camT:0, world:null, rooms:[], W:0, me:null, mons:[], keys:new Set(), edit:false, place:null, sel:null, ghost:null, msg:"", msgT:0, last:0, layerKey:"", pointer:null, followers:[], undo:[], hold:null, joy:null, photo:false, pcam:0, pdrag:null, weather:"sun", introPending:true, intro:null, evKey:"", evT:0, drag:null, stepT:0, crackT:0, rows:[], doors:[], pass:null, vy:null, camY0:0, bandH:0};
// Furniture, gifts and berry trees are saved at positions along the house, together with the room order they refer
// to (home.lay). When the rooms change (one bought, or the order changed), everything moves along with its room.
const LEGACY_ROOMS = ["bedroom", "living", "garden", "pond", "hall"];   // the order before the front yard and kitchen
function homeRelayout(){
  const D = homeData(), now = homeRooms().map(r => r.id), cur = now.join(",");
  if (D.lay === cur) return;
  const old = D.lay ? D.lay.split(",") : LEGACY_ROOMS.filter(id => now.includes(id));
  const starts = ids => { const o = {}; let x = 0; for (const id of ids) { o[id] = x; x += ROOMS.find(r => r.id === id).w; } return o; };
  const o0 = starts(old), o1 = starts(now);
  const move = x => { const id = old.filter(i => x >= o0[i]).pop(); return id && id in o1 ? x - o0[id] + o1[id] : x; };
  for (const p of D.items) p.x = move(p.x);
  for (const g of D.gifts) g.x = move(g.x);
  D.trees = Object.fromEntries(Object.entries(D.trees).map(([k, v]) => { const [x, y] = k.split(",").map(Number); return [`${move(x)},${y}`, v]; }));
  D.lay = cur; save();
}
function homeLayout(){
  homeRelayout();
  let x = 0; HS.rooms = homeRooms().map(r => { const o = {...r, x0:x}; x += r.w; return o; }); HS.W = x;
  homeRows();
}
const roomAt = x => HS.rooms.find(r => x >= r.x0 && x < r.x0 + r.w) || HS.rooms[HS.rooms.length - 1];
function placedItems(){ return homeData().items.map(p => { const it = unlockOf("furn", p.id); return {...p, it:it && p.r && canRotate(it) ? rotItem(it, 1) : it}; }).filter(p => p.it && p.x + p.it.w <= HS.W); }
function blocked(x, y, swim){
  if (x < .3 || x > HS.W - .3 || y < .35 || y > HM.D - .15 || inWall(x, y)) return true;
  const r = roomAt(x); if (inPond(r, x, y) && !swim) return true;
  if (HS.doors.some(d => [d.n, d.s].some(e => Math.abs(x - e.x) < .7 && Math.abs(y - e.y) < .6))) return false;   // the doorways stay open
  for (const p of placedItems()) { if (isFloorItem(p.it) || p.s) continue; if (x > p.x - .1 && x < p.x + p.it.w + .1 && y > p.y + .05 && y < p.y + p.it.d + .25) return true; }
  return false;
}
function randomSpot(swim, near){
  for (let i = 0; i < 40; i++) {
    const x = near ? near.x + (Math.random() - .5)*5 : .5 + Math.random()*(HS.W - 1), y = .6 + Math.random()*(HM.D - 1.1);
    if (near && !sameRow(x, near.x)) continue;   // near: in the same row
    if (swim === "only") { if (inPond(roomAt(x), x, y)) return {x, y}; continue; }
    if (!blocked(x, y, swim)) return {x, y};
  }
  return null;
}
// a path to anywhere: within a row, or to the doors and through them (a waypoint with `to` is a doorway)
function findPath(from, to){
  let a = rowOf(from.x).k; const b = rowOf(to.x).k; if (a === b) return gridPath(from, to);
  const out = []; let cur = from;
  for (; a !== b; a += Math.sign(b - a)) {
    const d = b < a ? HS.doors[a - 1] : HS.doors[a], at = b < a ? d.s : d.n, nx = b < a ? d.n : d.s, seg = gridPath(cur, at); if (!seg) return null;
    seg[seg.length - 1] = {x:at.x, y:at.y, to:{x:nx.x, y:nx.y}}; out.push(...seg); cur = nx;
  }
  const seg = gridPath(cur, to); return seg ? out.concat(seg) : null;
}
// simple A* on a half-tile grid so the trainer walks around furniture
function gridPath(from, to){
  const S = .5, GW = Math.ceil(HS.W/S), GH = Math.ceil(HM.D/S), id = (i, j) => j*GW + i, cx = i => (i + .5)*S, cy = j => (j + .5)*S;
  const free = (i, j) => i >= 0 && j >= 0 && i < GW && j < GH && !blocked(cx(i), cy(j), false);
  const si = Math.floor(from.x/S), sj = Math.floor(from.y/S); let ti = Math.floor(to.x/S), tj = Math.floor(to.y/S);
  if (!free(ti, tj)) { let best = null, bd = 1e9; for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) if (free(ti + di, tj + dj)) { const d = di*di + dj*dj; if (d < bd) { bd = d; best = [ti + di, tj + dj]; } } if (!best) return null; [ti, tj] = best; }
  const open = [[si, sj]], g = new Map([[id(si, sj), 0]]), came = new Map(), h = (i, j) => Math.hypot(i - ti, j - tj);
  for (let it = 0; open.length && it < 4000; it++) {
    open.sort((a, b) => (g.get(id(...a)) + h(...a)) - (g.get(id(...b)) + h(...b)));
    const [i, j] = open.shift(); if (i === ti && j === tj) { const out = []; let k = id(i, j); while (came.has(k)) { out.unshift({x:cx(k % GW), y:cy(Math.floor(k/GW))}); k = came.get(k); } out.push({x:to.x, y:to.y}); if (!blocked(to.x, to.y)) return out; out.pop(); return out; }
    for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) { const ni = i + di, nj = j + dj; if (!free(ni, nj)) continue; if (di && dj && (!free(i + di, j) || !free(i, j + dj))) continue;
      const k = id(ni, nj), ng = g.get(id(i, j)) + Math.hypot(di, dj); if (ng < (g.get(k) ?? 1e9)) { g.set(k, ng); came.set(k, id(i, j)); if (!open.some(o => o[0] === ni && o[1] === nj)) open.push([ni, nj]); } }
  }
  return null;
}
const friendOf = n => homeData().fr[n] | 0;
const homeMons = () => homeData().mons.filter(n => NAT_BY.has(n)).slice(0, homeCap());

function renderHome(){
  homeLayout(); HS.style = state.mode; HS.vy = null;
  const cap = homeCap(), mons = homeMons();
  $("scBody").innerHTML = `<div class="home">
    <div class="home-bar">
      <button class="btn sm primary hm-tb" type="button" id="hmPick" title="Choose who lives here" aria-label="Pokémon, ${mons.length} of ${cap}">${ic("paw")}<span>Pokémon</span><span class="hm-cnt">${mons.length}/${cap}</span></button>
      <button class="btn sm hm-tb" type="button" id="hmDeco" aria-pressed="${HS.edit}" title="Place and move furniture" aria-label="${HS.edit ? "Done decorating" : "Decorate"}">${ic(HS.edit ? "check" : "sofa")}<span>${HS.edit ? "Done decorating" : "Decorate"}</span></button>
      <button class="btn sm hm-tb" type="button" id="hmShop" title="Furniture and rooms" aria-label="Shop">${ic("shop")}<span>Shop</span></button>
      <button class="btn sm hm-tb" type="button" id="hmCam" title="Photo mode" aria-label="Photo mode">${ic("camera")}<span>Photo</span></button>
      ${VISIT ? "" : `<button class="btn sm hm-tb" type="button" id="hmTr" title="Choose your trainer" aria-label="Trainer: ${esc(TRAINERS[homeTrainer()])}">${ic("person")}<span>Trainer</span></button>`}
      ${VISIT || HS.edit ? "" : `<button class="btn sm hm-tb" type="button" id="hmGames" title="Berry Catch and Hide-and-seek" aria-label="${HS.hide && !HS.hide.found ? "Stop Hide-and-seek" : "Games"}">${ic("quiz")}<span>${HS.hide && !HS.hide.found ? "Stop" : "Games"}</span></button>`}
      <span class="home-pp" title="Your PokéPoints">${fmtPP(state.games.pp)}</span>
    </div>
    ${HS.edit ? "" : `<div class="hm-bag" id="hmBag"></div>`}
    <div class="home-stage" id="hmStage"><canvas id="hmCv" tabindex="0" aria-label="Your Pokémon Home. Use the arrow keys or WASD to walk, E to play with a Pokémon, or tap where to go."></canvas>
      <div class="home-msg" id="hmMsg" hidden></div>
      <div class="hm-photo" id="hmPhoto" ${HS.photo ? "" : "hidden"}><span>Drag or use the arrow keys to look around</span><button class="btn sm primary" type="button" data-ph="png">Save PNG</button><button class="btn sm" type="button" data-ph="gif">Save GIF</button><button class="btn sm" type="button" data-ph="exit">Done</button></div>
      <div class="home-pad" aria-hidden="true"></div>
      ${HS.edit ? `<div class="hm-float" id="hmFloat" hidden></div><div class="hm-dhint" id="hmDHint"></div>` : ""}</div>
    ${HS.edit ? `<div class="home-deco" id="hmDecoBar"></div>` : `<div class="home-res" id="hmRes"></div>`}
    ${eventOn() && !HS.edit ? `<p class="hm-event" data-ev="${eventOn().id}"><span class="hm-ev-pill">${eventOn().id === "halloween" ? "🎃" : "❄"} ${esc(eventOn().name)}</span><span>Limited-time furniture in the Shop${eventOn().visitors ? ", and visitors after dark" : ""}.</span></p>` : ""}
    <p class="note home-help">${HS.edit ? (matchMedia("(pointer:coarse)").matches ? "Drag the floor to look around. Tap a piece of furniture to move, flip, turn or put it away, or drag it to slide it. Pick something below to add it." : "Drag the floor or use the arrow keys to look around (up and down go between the garden, the house and the front yard). Click a piece of furniture to move, flip, turn or put it away; drag it to slide it, or nudge it with the arrow keys (F flip, R turn, Delete put away, Esc cancel).") : (matchMedia("(pointer:coarse)").matches ? "Tap the floor to walk, tap a door to go through it and tap a Pokémon to play with it." : "Walk with the arrow keys or WASD, or click the floor; the front and back doors lead outside. Get close to a Pokémon and press E, or click it, to play.") + " Each Pokémon gives PokéPoints the first time you play with it each day."}</p>
  </div>`;
  HS.cv = $("hmCv"); HS.ctx = HS.cv.getContext("2d");
  if (!HS.me || HS.me.x > HS.W) HS.me = {x:Math.min(3, HS.W/2), y:4.6, dir:1, path:null, walk:0, target:null};
  HS.weather = weatherToday();
  homeSyncMons();
  if (HS.edit) renderDecoBar(); else { renderResidents(); renderHomeBag(); }
  $("scBody").querySelector(".home").classList.toggle("photo", HS.photo); $("scBody").querySelector(".home").classList.toggle("deco", HS.edit);
  homeResize(); homePad();
  if (HS.introPending && !HS.edit) { HS.intro = {t0:performance.now()}; HS.introPending = false; }
  HS.layerKey = ""; cancelAnimationFrame(HS.raf); HS.last = performance.now(); HS.raf = requestAnimationFrame(homeFrame);
  if (HS.ro) HS.ro.disconnect(); const ro = HS.ro = new ResizeObserver(() => homeResize()); ro.observe($("hmStage"));
  if (HS.vis) HS.vis.disconnect(); HS.offscreen = false; const vis = HS.vis = new IntersectionObserver(es => { HS.offscreen = !es[es.length - 1].isIntersecting; }); vis.observe($("hmStage"));
  HS.cv.addEventListener("pointerdown", homePointerDown); HS.cv.addEventListener("pointermove", homePointerMove);
  HS.cv.addEventListener("pointerup", homePointerUp); HS.cv.addEventListener("pointercancel", homePointerUp); HS.cv.addEventListener("pointerleave", () => { HS.hover = null; HS.ptrE = null; });
  HS.cv.style.touchAction = HS.edit || HS.photo ? "none" : "";
  nav.cleanup = () => { if (HS.edit) decoCancel(); seekStop(true); cancelAnimationFrame(HS.raf); clearInterval(HS.tw); HS.hover = null; HS.acts = 0; ro.disconnect(); HS.ro = null; vis.disconnect(); HS.vis = null; HS.offscreen = false; HS.keys.clear(); HS.place = null; HS.sel = null; HS.drag = null; HS.photo = false; HS.hold = null; HS.joy = null; HS.introPending = true; HS.undo = []; save(); };
  nav.onClick = e => {
    if (e.target.closest("#hmPick")) { pickHomeMons(); return; }
    if (e.target.closest("#hmDeco")) { decoCancel(); HS.edit = !HS.edit; HS.sel = null; HS.dcam = HS.cam; HS.drow = rowOf(HS.me.x).k; Sound.play("select"); renderHome(); return; }
    const rm = e.target.closest("[data-hroom]"); if (rm) { const r = HS.rooms[+rm.dataset.hroom]; if (r) { const R = rowOf(r.x0); HS.drow = R.k; HS.dcam = r.x0 - R.x0 + r.w/2 - HS.V.W/HS.ts/2; Sound.play("select"); } return; }
    if (e.target.closest("#hmShop")) { shopCat = "furn"; openScreen("shop"); return; }
    if (e.target.closest("#hmGames")) { if (HS.hide && !HS.hide.found) seekStop(); else homeGames(); return; }
    if (e.target.closest("#hmTr")) { pickHomeTrainer(); return; }
    if (e.target.closest("#hmCam")) { HS.photo = true; HS.pcam = HS.cam; HS.edit = false; Sound.play("select"); renderHome(); return; }
    const ph = e.target.closest("[data-ph]"); if (ph) { if (ph.dataset.ph === "exit") { HS.photo = false; renderHome(); } else homePhoto(ph.dataset.ph); return; }
    const hb = e.target.closest("[data-hold]"); if (hb) { HS.hold = HS.hold === hb.dataset.hold ? null : hb.dataset.hold; Sound.play("select"); renderHomeBag(); return; }
    const r = e.target.closest("[data-hres]"); if (r) { const m = HS.mons.find(x => x.n === +r.dataset.hres); if (m) homeGoTo(m); return; }
    const p = e.target.closest("[data-hplace]"); if (p) { const same = HS.place && HS.place.id === p.dataset.hplace; decoCancel(); HS.place = same ? null : {id:p.dataset.hplace, f:0}; HS.sel = null; decoGhostInView(); Sound.play("select"); renderDecoBar(); return; }
    const a = e.target.closest("[data-hact]"); if (a) { homeEditAct(a.dataset.hact); return; }
  };
  setMusic("home");
}
function homeSyncMons(){
  const res = homeMons(), vis = eventVisitors().filter(n => !res.includes(n)), want = [...res, ...vis], have = new Map(HS.mons.map(m => [m.n, m]));
  HS.evKey = vis.join(",");
  HS.followers = res.filter(n => friendOf(n) >= 50 && !(isFish(n) && HS.rooms.some(r => r.pond))).sort((a, b) => friendOf(b) - friendOf(a)).slice(0, 2);
  HS.mons = want.map((n, i) => have.get(n) || (() => { const s = (isFish(n) && randomSpot("only")) || randomSpot(false) || {x:1 + i, y:4}; const m = NAT_BY.get(n); return {n, x:s.x, y:s.y, dir:Math.random() < .5 ? -1 : 1, st:"idle", t:Math.random()*2000, spd:1.2 + Math.random()*.8, fl:floatsOf(n), water:m.types.includes("Water"), sp:null, hop:0, emote:null, swim:false, z:0, visitor:vis.includes(n)}; })());
  for (const m of HS.mons) if (m.spMode !== state.mode) { m.sp = null; m.bk = null; m.bkLoad = false; m.loading = false; m.spMode = state.mode; }   // the style changed: everyone gets that style's sprite
  for (const m of HS.mons) if (!m.sp && !m.loading) { const md = state.mode; m.loading = true; getSprite(spKey(m.n, false, md), m.n).then(sp => { if (md === m.spMode) m.sp = sp; m.loading = false; }).catch(() => { m.loading = false; }); }
  // visiting a friend, you walk around as yourself
  const tr = VISIT ? VISIT.myTr : homeTrainer(); HS.trSp = null; getSprite(state.mode === "2d" ? "t2d" : "t3f", tr).then(sp => { HS.trSp = sp; }).catch(() => {});
}
function homeResize(){
  const st = $("hmStage"); if (!st || !HS.cv) return;
  const cssW = st.clientWidth, dpr = Math.min(2, devicePixelRatio || 1), pixel = state.mode === "2d", fullPx = (HM.WALL + HM.D*HM.SQ)*32;
  let cssH = Math.max(Math.min(320, Math.round(innerHeight*.5)), Math.min(Math.round(innerHeight*.62), Math.round(cssW*.62)));
  if (pixel) {   // 2D: a whole number of screen pixels per art pixel; sized from the window so a scrollbar can't make it flip-flop
    const want = Math.max(Math.min(320, Math.round(innerHeight*.5)), Math.min(Math.round(innerHeight*.62), Math.round(Math.min(innerWidth, 1200)*.62)));
    cssH = Math.floor(Math.max(1, Math.round(want*dpr/fullPx))*fullPx/dpr);
  }
  HS.cv.style.height = cssH + "px"; HS.cv.width = Math.round(cssW*dpr); HS.cv.height = Math.round(cssH*dpr);
  HS.k = pixel ? Math.max(1, Math.round(HS.cv.height/250)) : 1;
  HS.V = {W:Math.ceil(HS.cv.width/HS.k), H:Math.ceil(HS.cv.height/HS.k)};
  if (pixel) { HS.low = mkCanvas(HS.V.W, HS.V.H); HS.lctx = HS.low.getContext("2d"); }
  // fill the width when the house is narrower than the view by zooming in and cropping up to one tile of wall
  const full = HM.WALL + HM.D*HM.SQ;
  if (pixel) {   // 2D: exactly 32 px per tile so the pixel art is drawn at its own size; spare height shows more wall or sky
    HS.k = Math.max(1, Math.round(HS.cv.height/(full*32)));
    HS.V = {W:Math.ceil(HS.cv.width/HS.k), H:Math.ceil(HS.cv.height/HS.k)}; HS.low = mkCanvas(HS.V.W, HS.V.H); HS.lctx = HS.low.getContext("2d");
    HS.ts = 32; HS.camY = HS.camY0 = Math.round(full*32 - HS.V.H); HS.head = Math.max(0, -HS.camY); HS.bandH = Math.round(HM.WALL*32) + Math.round(HM.D*32*HM.SQ); HS.layerKey = ""; return;
  }
  let ts = HS.V.H/full; const fit = HS.V.W/Math.max(1, ...HS.rows.map(R => R.w)); if (fit > ts) ts = Math.min(fit, HS.V.H/(full - 1));   // the widest row fills the width
  HS.ts = ts; HS.camY = HS.camY0 = Math.max(0, Math.round(full*ts - HS.V.H)); HS.head = 0; HS.bandH = full*ts; HS.layerKey = "";
}
function homeLayer(tod){
  const pixel = state.mode === "2d", head = HS.head || 0, key = [HS.ts, head, pixel, tod, HS.W, JSON.stringify(homeData().items.filter(p => { const it = unlockOf("furn", p.id); return it && isFloorItem(it); }))].join("|");
  if (HS.layerKey === key) return HS.layer;
  const c = mkCanvas(Math.ceil(HS.W*HS.ts) + 2, Math.ceil((HM.WALL + HM.D*HM.SQ)*HS.ts) + 2 + head), x = c.getContext("2d"); x.imageSmoothingEnabled = !pixel;
  x.translate(0, head);
  for (const r of HS.rooms) paintRoom(x, r, HS.ts, pixel, tod, undefined, head);
  for (const d of dividers()) paintDivider(x, d, HS.ts, pixel, head);
  // rugs live on the floor layer
  for (const p of placedItems()) if (isFloorItem(p.it)) { const s = furnSprite(p.it, HS.ts, pixel, !!p.f); x.drawImage(s.c, Math.round(p.x*HS.ts - s.pad), Math.round(HM.WALL*HS.ts + p.y*HS.ts*HM.SQ - s.pad - s.h*HS.ts)); }
  x.setTransform(1, 0, 0, 1, 0, 0);
  HS.layer = c; HS.layerKey = key; return c;
}
const scrX = x => (x - (HS.pass ? HS.pass.x0 : 0))*HS.ts - (HS.camPx ?? Math.round(HS.cam*HS.ts)), scrY = y => HM.WALL*HS.ts + y*HS.ts*HM.SQ - HS.camY;
function homeFrame(now){
  if (!HS.cv || !HS.cv.isConnected) return;
  if (HS.offscreen) { HS.last = now; HS.raf = requestAnimationFrame(homeFrame); return; }   // scrolled out of view: nothing to draw
  if (HS.style !== state.mode) { renderHome(); return; }   // the 2D/3D switch was flipped while the Home is open
  const dt = HS.dt = Math.min(.05, (now - HS.last)/1000); HS.last = now;
  const pixel = state.mode === "2d", c = pixel ? HS.lctx : HS.ctx, V = HS.V, ts = HS.ts, tod = clockTod();
  homeUpdate(dt, now);
  // the row in view: yours, or the one you're decorating; the camera follows you along it (x from the row's left end)
  const VR = HS.rows[HS.edit ? Math.max(0, Math.min(HS.rows.length - 1, HS.drow ?? rowOf(HS.me.x).k)) : rowOf(HS.me.x).k], RW = VR.w; if (HS.edit) HS.drow = VR.k;
  const view = V.W/ts, fit = RW <= view, follow = fit ? (RW - view)/2 : Math.max(0, Math.min(RW - view, HS.me.x - VR.x0 - view/2));
  let want = follow;
  if (HS.photo) want = HS.pcam = fit ? follow : Math.max(0, Math.min(RW - view, HS.pcam));   // photo mode: you steer the camera
  else if (HS.edit) {   // decorating: the camera is yours too (drag the floor, arrow keys, the room buttons); carrying something to an edge scrolls
    if (HS.place && HS.ptrE && !fit) { const px = homeWorldPoint(HS.ptrE).px, edge = V.W*.08; if (px < edge) HS.dcam -= dt*7; else if (px > V.W - edge) HS.dcam += dt*7; if (px < edge || px > V.W - edge) homePointerMove(HS.ptrE); }
    want = HS.dcam = fit ? follow : Math.max(0, Math.min(RW - view, HS.dcam ?? HS.cam));
  }
  else if (HS.intro) {   // walking in: a slow look along the row, then back to you
    const t = (now - HS.intro.t0)/3200, ease = v => v*v*(3 - 2*v);
    if (fit || t >= 1) HS.intro = null; else want = t < .55 ? ease(t/.55)*(RW - view) : (RW - view) + (follow - (RW - view))*ease((t - .55)/.45);
  }
  if (!HS.intro && !HS.photo && !fit && HS.me.walk) want = Math.max(0, Math.min(RW - view, want + HS.me.dir*view*.12));   // look a little ahead of where you're walking
  if (HS.intro || HS.photo || HS.edit) { HS.cam += (want - HS.cam)*Math.min(1, dt*12); HS.camV = 0; }
  else { const a = (want - HS.cam)*28 - (HS.camV || 0)*10.6; HS.camV = (HS.camV || 0) + a*dt; HS.cam += HS.camV*dt; }   // a critically damped spring: eases in and out, never overshoots
  if (Math.abs(want - HS.cam) < .001 && Math.abs(HS.camV || 0) < .01) { HS.cam = want; HS.camV = 0; }
  HS.camPx = Math.round(HS.cam*ts);   // one rounded camera offset for the room, the furniture and the Pokémon, so nothing shimmers against the floor
  HS.vy = HS.vy == null ? VR.k : HS.vy + (VR.k - HS.vy)*Math.min(1, dt*7); if (Math.abs(VR.k - HS.vy) < .002) HS.vy = VR.k;   // and slides up or down to its row
  const L = HS.light = homeLight();
  const outT = !HS.edit && !HS.intro && VR.out ? 1 : 0;   // out in a yard: the house shows its roof
  HS.outA = HS.outA == null ? outT : HS.outA + (outT - HS.outA)*Math.min(1, dt*7);
  c.imageSmoothingEnabled = !pixel;
  // each row in view is drawn with its own camera, north to south, so the nearer row overlaps the one behind it
  const rows = HS.rows.filter(R => { rowCam(R); return scrY(HM.D) > 0 && scrY(0) - HM.WALL*ts - (R.k ? 0 : HS.head || 0) < V.H; });
  const layer = homeLayer(tod), head = HS.head || 0, hh = Math.ceil((HM.WALL + HM.D*HM.SQ)*ts), roofed = R => !R.out && HS.outA > .5;
  for (const m of HS.mons) m.box = null;
  for (const R of rows) {
    rowCam(R);
    const inR = x => x >= R.x0 && x < R.x1, hd = R.k ? 0 : head, sx = Math.round(R.x0*ts), sw = Math.min(layer.width - sx, Math.round(R.x1*ts) - sx);
    if (HS.cam < 0 || HS.cam + view > R.w) rowBackdrop(c, R, pixel, tod);
    c.drawImage(layer, sx, head - hd, sw, hh + hd, Math.round(scrX(R.x0)), -HS.camY - hd, sw, hh + hd);
    drawWeather(c, now, pixel, "win");
    drawWindowLight(c, pixel, L);
    drawWeather(c, now, pixel, "far");
    const bt = R.k ? scrY(0) - HM.WALL*ts : 0, bh = scrY(HM.D) - bt;
    if (HS.cam < 0) { const g = c.createLinearGradient(scrX(R.x0) - ts*.5, 0, scrX(R.x0), 0); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.35)"); c.fillStyle = g; c.fillRect(scrX(R.x0) - ts*.5, bt, ts*.5, bh); }
    if (HS.cam + view > R.w) { const g = c.createLinearGradient(scrX(R.x1), 0, scrX(R.x1) + ts*.5, 0); g.addColorStop(0, "rgba(0,0,0,.35)"); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(scrX(R.x1), bt, ts*.5, bh); }
    drawRowDoors(c, R, pixel, tod);
    // drawables sorted by depth
    const list = [];
    for (const p of placedItems()) if (!isFloorItem(p.it) && inR(p.x)) { const sf = surfOf(p), z = sf ? surfZ(sf) : 0;
      list.push({y:sf ? sf.y + sf.it.d + .02 : p.y + p.it.d, draw:() => { const s = furnSprite(p.it, ts, pixel, !!p.f, pixel ? furnFrame(p, now) : 0), X = scrX(p.x) - s.pad, Y = scrY(p.y) - s.pad - s.h*ts;
      if (z) { c.save(); c.translate(0, -Math.round(z*ts)); }   // standing on a table
      if (!NO_SHADOW.has(p.it.kind) && !z) furnShadow(c, p, pixel);
      c.drawImage(s.c, Math.round(X), Math.round(Y)); if (!s.art) homeItemFx(c, p, now, pixel); if (p.it.kind === "tree") drawTreeBerries(c, p, pixel);
      if (HS.edit && HS.sel === p) { c.strokeStyle = "#ffd43b"; c.lineWidth = pixel ? 1 : 3; c.setLineDash([6, 4]); c.strokeRect(scrX(p.x), scrY(p.y) - (FURN_H[p.it.kind] || 1)*ts, p.it.w*ts, p.it.d*ts*HM.SQ + (FURN_H[p.it.kind] || 1)*ts); c.setLineDash([]); }
      if (z) c.restore(); }}); }
    for (const d of dividers()) if (inR(d.x)) for (const y of DOOR) list.push({y, draw:() => drawDivPost(c, d, y, pixel)});
    for (const m of HS.mons) if (inR(m.x)) list.push({y:m.depth || m.y, draw:() => drawHomeMon(c, m, now, pixel)});
    for (const g of homeData().gifts) if (inR(g.x)) list.push({y:g.y, draw:() => drawGift(c, g, now, pixel)});
    if (inR(HS.me.x)) list.push({y:HS.me.y + .01, draw:() => drawHomeTrainer(c, now, pixel)});
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw();
    drawHomeFx(c, now, pixel);
    if (!R.out && HS.outA > .01) drawRoof(c, pixel, R, HS.outA);
    drawWeather(c, now, pixel, "out");
    if (HS.edit && R === VR) drawDecoOverlay(c, pixel);
  }
  // the light: a warm sunset tint and a night tint that fade in and out with the clock, then lamps and fires glowing
  if (L.dusk > .01) { c.fillStyle = `rgba(255,140,80,${(.1*L.dusk*(1 - L.night)).toFixed(3)})`; c.fillRect(0, 0, V.W, V.H); }
  if (L.night > .01) { const ev = eventOn(), n = ev && ev.night || [20, 30, 80, .32]; c.fillStyle = `rgba(${n[0]},${n[1]},${n[2]},${(n[3]*L.night).toFixed(3)})`; c.fillRect(0, 0, V.W, V.H); for (const R of rows) if (!roofed(R)) { rowCam(R); drawGlows(c, now, pixel, L.night); } }
  for (const R of rows) if (!roofed(R)) { rowCam(R); for (const m of HS.mons) if (m.x >= R.x0 && m.x < R.x1) drawEmote(c, m, now, pixel); }   // emotes stay bright at night
  rowCam(VR);   // the overlay, the pointer and the decorating toolbar use the row in view
  if (pixel) { HS.ctx.imageSmoothingEnabled = false; HS.ctx.drawImage(HS.low, 0, 0, HS.low.width*HS.k, HS.low.height*HS.k); }
  homeOverlay(now, pixel);
  if (HS.edit) decoFloat(pixel);
  HS.raf = requestAnimationFrame(homeFrame);
}
function homeItemFx(c, p, now, pixel){
  const ts = HS.ts, k = p.it.kind;
  if (k === "fire") { const x = scrX(p.x + (p.f ? p.it.w - 1 : 1)), y = scrY(p.y + .65) - .3*ts; for (let i = 0; i < 4; i++) { const h = ts*(.35 + .15*Math.sin(now/120 + i*1.7)); c.fillStyle = i % 2 ? "#ffb84a" : "#ff6a3d"; c.beginPath(); c.ellipse(x + (i - 1.5)*ts*.16, y - h/2, ts*.09, h/2, 0, 0, 7); c.fill(); } }
  if (k === "fountain") { c.fillStyle = "rgba(170,220,255,.8)"; for (let i = 0; i < 5; i++) { const t = (now/700 + i/5) % 1, x = scrX(p.x + 1) + Math.sin(i*2.1)*t*ts*.5, y = scrY(p.y + 1.05) - ts*1.2 + t*t*ts*.9; c.fillRect(Math.round(x), Math.round(y), Math.max(1, ts*.06), Math.max(1, ts*.06)); } }
  if (k === "tv" || k === "arcade") { if (Math.sin(now/300) > .7) { c.fillStyle = "rgba(255,255,255,.12)"; c.fillRect(scrX(p.x + .13), scrY(p.y + .47) - 1.3*ts, (p.it.w - .26)*ts, .5*ts); } }
}
// ---- shadows: soft in 3D, dithered pixels in 2D, sized to what casts them ----
const NO_SHADOW = new Set(["cobweb"]);
const SHC = new Map();
function ditherShadow(rx, ry, a){
  const key = rx + "|" + ry + "|" + a; let c = SHC.get(key); if (c) return c;
  c = mkCanvas(rx*2 + 1, ry*2 + 1); const x = c.getContext("2d"); x.fillStyle = `rgba(0,0,0,${a})`;
  for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) { const d = i*i/(rx*rx) + j*j/(ry*ry); if (d <= 1 && (d < .4 || ((i + j) & 1) === 0)) x.fillRect(i + rx, j + ry, 1, 1); }   // solid core, checkered rim
  if (SHC.size > 200) SHC.clear(); SHC.set(key, c); return c;
}
function softShadow(c, x, y, rx, ry, a, pixel){
  if (rx < 1 || a <= 0) return;
  if (pixel) { const R = Math.max(1, Math.round(rx)), r = Math.max(1, Math.round(ry)), sh = ditherShadow(R, r, Math.round(a*20)/20); c.drawImage(sh, Math.round(x - R), Math.round(y - r)); return; }
  c.save(); c.translate(x, y); c.scale(1, ry/rx);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(.5, `rgba(0,0,0,${(a*.72).toFixed(3)})`); g.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, 7); c.fill(); c.restore();
}
// where a sprite touches the ground: the opaque pixels in its bottom rows (centre offset and width, as parts of the box)
function footOf(sp){
  if (sp.foot) return sp.foot;
  const bb = sp.bb, h = Math.max(1, Math.round(bb.h*.16)); let f = {cx:0, w:.55};
  try { const c = mkCanvas(bb.w, h), x = c.getContext("2d"); x.drawImage(sp.frames[0].img, bb.x, bb.y + bb.h - h, bb.w, h, 0, 0, bb.w, h);
    const d = x.getImageData(0, 0, bb.w, h).data; let a = bb.w, b = -1;
    for (let j = 0; j < h; j++) for (let i = 0; i < bb.w; i++) if (d[(j*bb.w + i)*4 + 3] > 40) { if (i < a) a = i; if (i > b) b = i; }
    if (b >= a) f = {cx:((a + b + 1)/2 - bb.w/2)/bb.w, w:Math.max(.25, (b - a + 1)/bb.w)};
  } catch(e) { /* keep the default */ }
  return sp.foot = f;
}
// furniture: a contact shadow over its footprint, plus a little shade on the wall behind things standing against it (3D)
function furnShadow(c, p, pixel){
  const ts = HS.ts, it = p.it, cx = scrX(p.x + it.w/2) + ts*.05, cy = scrY(p.y + it.d*.55);
  softShadow(c, cx, cy, it.w*ts*.56, it.d*ts*HM.SQ*.6 + ts*.08, pixel ? .3 : .26, pixel);
  if (!pixel && p.y < .35 && roomAt(p.x + it.w/2) && roomAt(p.x + it.w/2).wall) { const wy = scrY(0), g = c.createLinearGradient(0, wy - ts*.7, 0, wy); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.13)"); c.fillStyle = g; c.fillRect(scrX(p.x) - ts*.08, wy - ts*.7, it.w*ts + ts*.16, ts*.7); }
}
// 3D Pokémon walk the Home at their native size (a whole-number multiple on big screens); only giants are shrunk to fit a room
function monScale(m, sp = m.sp){ if (!sp) return 1; const pixel = state.mode === "2d", bb = sp.bb; if (pixel) return 1; const k = natK(HS.ts, 40); return Math.min(k, 3.4*HS.ts/bb.h); }
// real sleeping sprites (PMD Sprite Collab, packs zz-*) and 3D back sprites for facing the TV or the fire
const hasSleep = n => { const k = spKey(n, false, "zz"); return !!(IDX[k] && IDX[k].some(e => e[0] === n)); };
function monAltSprites(m){
  if (m.act === "nap" && !m.zz && !m.zzLoad && hasSleep(m.n)) { m.zzLoad = true; getSprite(spKey(m.n, false, "zz"), m.n).then(s => { m.zz = s; }).catch(() => {}); }
  if ((m.act === "watch" || m.act === "warm") && state.mode !== "2d" && !m.bk && !m.bkLoad && hasBack(m.n, false)) { m.bkLoad = true; getSprite(spKey(m.n, false, "3db"), m.n).then(s => { m.bk = s; }).catch(() => {}); }
}
function drawHomeMon(c, m, now, pixel){
  if (!m.sp) return;
  if (HS.hide && HS.hide.n === m.n && !HS.hide.found) { m.box = null; return; }   // hiding (Hide-and-seek)
  const zz = m.act === "nap" && m.zz, bk = !pixel && (m.act === "watch" || m.act === "warm") && m.bk, sp = zz || bk || m.sp;
  // a sleeping sprite is pixel art drawn at a whole-number scale close to the awake size; the rest as usual
  const s = zz ? Math.max(1, Math.min(4, Math.round(Math.max(m.sp.bb.w*.62, m.sp.bb.h*.5)*monScale(m)/Math.max(zz.bb.w, zz.bb.h)))) : monScale(m, sp);
  const ts = HS.ts, bb = sp.bb, w = bb.w*s, h = bb.h*s, X = scrX(m.x), Y = scrY(m.y);
  // fliers: floaters always hover; birds take off when they go somewhere and land when they stop (flapping as they fly)
  const airT = m.swim || m.z ? 0 : m.fl ? 1 : isFlier(m) && m.st === "walk" ? 1 : 0; m.air = (m.air ?? airT) + (airT - (m.air ?? airT))*Math.min(1, (HS.dt || .016)*4);
  const zl = (m.z || 0)*ts, lift = zl + (m.air > .01 ? m.air*ts*(m.fl ? .75 : 1) + Math.sin(now/(m.fl ? 600 : 120) + m.n)*ts*(m.fl ? .08 : .07)*m.air : 0) + (m.hop > 0 ? Math.sin(m.hop*Math.PI)*ts*(m.act === "bounce" ? .8 : .5) : 0) + (m.st === "walk" && !(m.air > .5) ? Math.abs(Math.sin(now/110 + m.n))*ts*.06 : 0);
  const swim = m.swim, ft = footOf(sp), up = Math.max(0, lift - zl), lf = 1/(1 + up/(ts*.9)), sw = Math.max(ts*.2, ft.w*w*.62)*lf;   // the shadow shrinks and fades as it hops or floats
  if (swim) { c.strokeStyle = "rgba(255,255,255,.45)"; c.lineWidth = pixel ? 1 : Math.max(1, ts*.04); c.beginPath(); c.ellipse(Math.round(X), Math.round(Y - zl), Math.max(2, w*.36), Math.max(1, w*.09), 0, 0, 7); c.stroke(); }
  else softShadow(c, X + ft.cx*w*(bk ? m.dir : -m.dir) + ts*.04, Y - zl + ts*.02, sw, sw*.3, (.34 - .14*(m.air || 0))*lf, pixel);
  const fi = frameIdx(sp, now + m.n*137), img = sp.frames[fi].img;
  c.save(); c.translate(Math.round(X), Math.round(Y - lift)); if (bk ? m.dir < 0 : m.dir > 0) c.scale(-1, 1);   // front sprites face left (back sprites right): mirrored to face the other way
  if (m.act === "nap" && !zz) { c.rotate(.07); c.scale(1.08, .8 + .025*Math.sin(now/900 + m.n)); c.globalAlpha = .96; }   // no sleeping sprite: curled up a little, slow breathing
  if (zz && !pixel) { c.shadowColor = "rgba(20,24,40,.45)"; c.shadowBlur = Math.max(2, ts*.08); }   // 3D: pixel-art sleepers get a soft outline so they sit in the scene
  if (m.eatT > now) c.scale(1 + .03*Math.abs(Math.sin(now/85)), 1 - .07*Math.abs(Math.sin(now/85)));   // munching
  if (m.visitor) c.globalAlpha = .82 + .12*Math.sin(now/500 + m.n);
  if (swim) { c.beginPath(); c.rect(-w, -h, w*2, h*.72); c.clip(); }
  if (Number.isInteger(s)) c.imageSmoothingEnabled = false;
  c.drawImage(img, bb.x, bb.y, bb.w, bb.h, Math.round(-w/2), -Math.round(h), Math.round(w), Math.round(h));
  c.restore();
  m.box = {x:X - w/2, y:Y - lift - h, w, h};
  if (m.eatT > now && now > (m.crumbT || 0)) { m.crumbT = now + 140; fx("crumb", m.x + m.dir*.15, m.y, (lift + h*.3)/ts, {col:m.eatCol}); }
}
// ---- little effects: heart bursts, sparkles, crumbs, berries flying to the pouch, gift confetti ----
// positions are in tiles (x, floor y, height above the floor) so they stay put when the camera moves
function fx(k, x, y, z, o = {}){
  if (state.ui.motion === "reduced" && k !== "berry") return;   // Reduced motion: no bursts or confetti
  if (!HS.fx) HS.fx = []; if (HS.fx.length > 160) HS.fx.shift();
  const a = Math.random()*Math.PI*2, sp = o.sp ?? .8;
  HS.fx.push({k, x, y, z, vx:o.vx ?? Math.cos(a)*sp*.6, vz:o.vz ?? (1 + Math.random())*sp, t0:performance.now(), dur:o.dur || 900, col:o.col, to:o.to, rot:Math.random()*6, g:o.g ?? 2.2});
}
function burst(k, m, n = 6, o = {}){ for (let i = 0; i < n; i++) fx(k, m.x + (Math.random() - .5)*.3, m.y, (m.box ? (scrY(m.y) - m.box.y)/HS.ts : 1)*.85, o); }
function drawHomeFx(c, now, pixel){
  if (!HS.fx || !HS.fx.length) return;
  const ts = HS.ts, R = v => pixel ? Math.round(v) : v;
  HS.fx = HS.fx.filter(p => now - p.t0 < p.dur);
  for (const p of HS.fx) {
    const t = (now - p.t0)/1000, u = (now - p.t0)/p.dur, a = u > .7 ? (1 - u)/.3 : 1;
    let x, z;
    if (p.to) { const e = Math.min(1, u); x = p.x + (p.to.x - p.x)*e; z = p.z + (p.to.z - p.z)*e + Math.sin(e*Math.PI)*1.2; }   // an arc to a point
    else { x = p.x + p.vx*t; z = Math.max(0, p.z + p.vz*t - p.g*t*t*(p.k === "heart" || p.k === "spark" ? .15 : 1)); }
    const X = R(scrX(x)), Y = R(scrY(p.y) - z*ts);
    c.globalAlpha = Math.max(0, a);
    if (p.k === "heart") { if (pixel) { c.fillStyle = "#e2413b"; EMO_PX.heart.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === "X") c.fillRect(X - 3 + i, Y - 3 + j, 1, 1); }); } else { c.fillStyle = "#e2413b"; emoteShape(c, "heart", X, Y, ts*(.13 + .05*Math.sin(u*Math.PI))); } }
    else if (p.k === "spark") { c.fillStyle = p.col || "#ffd43b"; if (pixel) { c.fillRect(X, Y - 2, 1, 5); c.fillRect(X - 2, Y, 5, 1); } else emoteShape(c, "sig", X, Y, ts*.12*(1 - u*.5)); }
    else if (p.k === "crumb") { c.fillStyle = p.col || "#c98a4a"; const sz = pixel ? 1 : Math.max(1, ts*.04); c.fillRect(X, Y, sz, sz); }
    else if (p.k === "berry") { c.fillStyle = p.col || "#e2413b"; const r = pixel ? 2 : ts*.09; if (pixel) c.fillRect(X - 2, Y - 2, 4, 4); else { c.beginPath(); c.arc(X, Y, r, 0, 7); c.fill(); c.fillStyle = "#3fae5a"; c.fillRect(X - r*.2, Y - r*1.5, r*.4, r*.6); } }
    else if (p.k === "confetti") { c.fillStyle = p.col; c.save(); c.translate(X, Y); c.rotate(p.rot + t*8); const sz = pixel ? 2 : ts*.07; c.fillRect(-sz, -sz/2, sz*2, sz); c.restore(); }
    else if (p.k === "lid") { c.save(); c.translate(X, Y); c.rotate((p.vx > 0 ? 1 : -1)*t*7); const sz = ts*.36; c.fillStyle = "#e2413b"; c.fillRect(R(-sz/2), R(-sz*.12), R(sz), R(sz*.24)); c.fillStyle = "#ffd43b"; c.fillRect(R(-sz*.09), R(-sz*.12), R(sz*.18), R(sz*.24)); c.restore(); }
    else if (p.k === "splash") { c.strokeStyle = "rgba(210,228,255,.8)"; c.lineWidth = pixel ? 1 : Math.max(1, ts*.025); c.beginPath(); c.ellipse(X, Y, ts*.12*(.4 + u), ts*.04*(.4 + u), 0, 0, 7); c.stroke(); }
  }
  c.globalAlpha = 1;
}
function drawHomeTrainer(c, now, pixel){
  const sp = HS.trSp, me = HS.me, ts = HS.ts; const X = scrX(me.x), Y = scrY(me.y);
  softShadow(c, X + ts*.04, Y + ts*.02, ts*.32, ts*.1, .34, pixel);
  if (!sp) return;
  const bb = sp.bb, h = pixel ? bb.h : ts*2.05, w = bb.w*h/bb.h, bob = me.walk ? Math.abs(Math.sin(now/120))*ts*.07 : 0, img = frameAt(sp, now);
  c.save(); c.translate(Math.round(X), Math.round(Y - bob)); if (me.dir > 0) c.scale(-1, 1);   // trainer sprites face left too
  if (me.walk && !pixel) c.rotate(Math.sin(now/120)*.025);
  c.drawImage(img, bb.x, bb.y, bb.w, bb.h, pixel ? Math.round(-w/2) : -w/2, -h, w, h); c.restore();
}
// emotes: little drawn icons in a bubble (pixel bitmaps in 2D, shapes in 3D)
const EMO_PX = {
  heart:[".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."],
  note:["...XXX", "...X.X", "...X.X", "...X..", ".XXX..", "XXXX..", ".XX..."],
  zz:["XXXX...", "..X....", ".X.XXX.", "XXXX.X.", "....X..", "...XXX."],
  bang:["XX", "XX", "XX", "XX", "..", "XX"],
  star:["...X...", "..XXX..", "XXXXXXX", ".XXXXX.", "..XXX..", ".XX.XX.", "X.....X"],
  sig:["...X...", "...X...", "..XXX..", "XXXXXXX", "..XXX..", "...X...", "...X..."],
  drop:["..X..", "..X..", ".XXX.", "XXXXX", "XXXXX", ".XXX."],
  dots:["XX.XX.XX", "XX.XX.XX"],
};
EMO_PX.fav = EMO_PX.star;
function emoteShape(c, k, x, y, r){
  c.beginPath();
  if (k === "heart") { c.moveTo(x, y + r*.62); c.bezierCurveTo(x - r*1.05, y - r*.05, x - r*.55, y - r*.85, x, y - r*.32); c.bezierCurveTo(x + r*.55, y - r*.85, x + r*1.05, y - r*.05, x, y + r*.62); c.fill(); }
  else if (k === "star" || k === "fav" || k === "sig") { const n = k === "sig" ? 4 : 5, ri = k === "sig" ? .3 : .45; for (let i = 0; i < n*2; i++) { const a = -Math.PI/2 + i*Math.PI/n, rr = (i % 2 ? ri : 1)*r*.85; c.lineTo(x + Math.cos(a)*rr, y + Math.sin(a)*rr); } c.closePath(); c.fill(); }
  else if (k === "drop") { c.moveTo(x, y - r*.8); c.bezierCurveTo(x + r*.15, y - r*.4, x + r*.6, y, x + r*.6, y + r*.25); c.arc(x, y + r*.25, r*.6, 0, Math.PI); c.bezierCurveTo(x - r*.6, y, x - r*.15, y - r*.4, x, y - r*.8); c.fill(); }
  else if (k === "note") { c.ellipse(x - r*.22, y + r*.45, r*.3, r*.22, -.4, 0, 7); c.fill(); c.fillRect(x + r*.02, y - r*.7, r*.14, r*1.15); c.beginPath(); c.moveTo(x + r*.16, y - r*.7); c.quadraticCurveTo(x + r*.7, y - r*.45, x + r*.45, y - r*.05); c.quadraticCurveTo(x + r*.5, y - r*.4, x + r*.16, y - r*.38); c.fill(); }
  else if (k === "zz") { c.lineWidth = r*.2; c.lineJoin = c.lineCap = "round"; const z = (zx, zy, s) => { c.moveTo(zx - s, zy - s); c.lineTo(zx + s, zy - s); c.lineTo(zx - s, zy + s); c.lineTo(zx + s, zy + s); }; z(x - r*.2, y + r*.15, r*.38); z(x + r*.45, y - r*.45, r*.22); c.stroke(); }
  else if (k === "bang") { c.roundRect(x - r*.13, y - r*.75, r*.26, r*.95, r*.13); c.fill(); c.beginPath(); c.arc(x, y + r*.55, r*.15, 0, 7); c.fill(); }
  else { for (const dx of [-.5, 0, .5]) { c.moveTo(x + dx*r + r*.13, y); c.arc(x + dx*r, y, r*.13, 0, 7); } c.fill(); }
}
function drawEmote(c, m, now, pixel){
  if (!m.emote || !m.box) return; const e = m.emote, age = now - e.t0; if (age > e.dur) { m.emote = null; return; }
  const ts = HS.ts, pop = Math.min(1, age/180), fade = age > e.dur - 300 ? (e.dur - age)/300 : 1;
  const col = e.k === "heart" ? "#e2413b" : e.k === "zz" ? "#5b6fd6" : e.k === "fav" ? "#e2a32a" : e.k === "drop" ? "#3a8fd6" : e.k === "note" ? "#7a4fd6" : e.k === "star" ? "#e2a32a" : e.k === "sig" ? TC[NAT_BY.get(m.n).types[0]] : "#1d2631";
  c.save(); c.globalAlpha = fade;
  if (pixel) {   // a square pixel bubble with an ink outline and a stepped tail
    const bm = EMO_PX[e.k] || EMO_PX.dots, s = Math.max(1, Math.round(ts/32)), bw = bm[0].length, bh = bm.length, W = (Math.max(bw, bh) + 4)*s, H = W;
    const x = Math.round(m.box.x + m.box.w/2 + ts*.15), y = Math.round(m.box.y - H - ts*.1 - Math.round((1 - pop)*-4)*s);
    c.fillStyle = "#28323f"; c.fillRect(x + s, y, W - 2*s, H); c.fillRect(x, y + s, W, H - 2*s); c.fillRect(x + 2*s, y + H, 2*s, s); c.fillRect(x + s, y + H + s, s, s);
    c.fillStyle = "#ffffff"; c.fillRect(x + s, y + s, W - 2*s, H - 2*s); c.fillRect(x + 2*s, y + H - s, s, s);
    c.fillStyle = col; const ox = x + Math.floor((W - bw*s)/2), oy = y + Math.floor((H - bh*s)/2);
    bm.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === "X") c.fillRect(ox + i*s, oy + j*s, s, s); });
  } else {   // a round bubble with a soft shadow and a little tail
    const r = ts*.34*(.6 + .4*pop), x = m.box.x + m.box.w/2 + ts*.38, y = m.box.y - ts*.18 - pop*ts*.22;
    c.shadowColor = "rgba(0,0,0,.25)"; c.shadowBlur = ts*.18; c.shadowOffsetY = ts*.04;
    c.fillStyle = "#ffffff"; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.beginPath(); c.moveTo(x - r*.55, y + r*.62); c.lineTo(x - r*.95, y + r*1.15); c.lineTo(x - r*.08, y + r*.92); c.fill();
    c.shadowColor = "transparent"; c.fillStyle = c.strokeStyle = col; emoteShape(c, e.k, x, y, r*.62);
  }
  c.restore();
}
// ---- the overlay drawn at full resolution on top (crisp text in both styles): name tags and "E · Play" key-cap prompts ----
function homeOverlay(now, pixel){
  if (HS.photo) return;
  const c = HS.ctx, k = pixel ? HS.k : 1; c.save(); c.scale(k, k);
  const t = !HS.edit ? nearestThing() : null; let tagged = null;
  if (t) { promptFor(c, t, pixel); if (t.k === "mon") tagged = t.m; }
  const want = HS.hover || HS.me.target, h = want && want !== tagged && HS.mons.includes(want) ? want : null;   // the one under the mouse, or the one you tapped and are walking to
  if (h && h.box && !HS.edit) monTag(c, h, pixel);
  c.restore();
}
function homeFont(px, pixel, bold = true){ return `${bold ? 700 : 500} ${px}px ${pixel ? '"Pixelify Sans", monospace' : '"Rubik", system-ui, sans-serif'}`; }
// a rounded label above a point: [key] text, with a tail pointing down at it
function keyChip(c, cx, by, key, text, pixel){
  const k = pixel ? HS.k : 1, fs = Math.round(Math.max(13, Math.min(17, HS.ts*k*.3)))/k, pad = fs*.55, kh = fs*1.45, kw = key ? Math.max(kh, fs*.7 + pad) : 0;
  c.font = homeFont(fs, pixel); const tw = c.measureText(text).width, W = (key ? kw + pad*.7 : pad*.4) + tw + pad*1.2, H = kh + pad*.7;
  let x = cx - W/2; const y = by - H - fs*.55; x = Math.max(4/k, Math.min(HS.V.W - W - 4/k, x));
  const R = v => Math.round(v*k)/k;
  c.save();
  if (pixel) { c.fillStyle = "#28323f"; c.fillRect(R(x - 2/k), R(y - 2/k), R(W + 4/k), R(H + 4/k)); c.fillStyle = "#f8f8ec"; c.fillRect(R(x), R(y), R(W), R(H)); }
  else { c.shadowColor = "rgba(0,0,0,.35)"; c.shadowBlur = 10/k; c.shadowOffsetY = 2/k; c.fillStyle = "rgba(14,20,38,.92)"; c.beginPath(); c.roundRect(x, y, W, H, H/2); c.fill(); c.shadowColor = "transparent"; }
  // tail
  const tx = Math.max(x + H*.5, Math.min(x + W - H*.5, cx)); c.beginPath(); c.moveTo(tx - fs*.42, y + H - .5/k); c.lineTo(tx, y + H + fs*.48); c.lineTo(tx + fs*.42, y + H - .5/k); c.closePath();
  if (pixel) { c.fillStyle = "#28323f"; c.fill(); c.fillStyle = "#f8f8ec"; c.beginPath(); c.moveTo(tx - fs*.28, y + H - 1/k); c.lineTo(tx, y + H + fs*.22); c.lineTo(tx + fs*.28, y + H - 1/k); c.fill(); } else { c.fillStyle = "rgba(14,20,38,.92)"; c.fill(); }
  let tx0 = x + pad*.4;
  if (key) {   // the key cap
    const ky = y + (H - kh)/2;
    if (pixel) { c.fillStyle = "#28323f"; c.fillRect(R(tx0), R(ky), R(kw), R(kh)); c.fillStyle = "#ffffff"; }
    else { c.fillStyle = "#ffd43b"; c.beginPath(); c.roundRect(tx0, ky, kw, kh, kh*.3); c.fill(); c.fillStyle = "rgba(0,0,0,.22)"; c.fillRect(tx0 + kh*.15, ky + kh - 2.5/k, kw - kh*.3, 1.5/k); c.fillStyle = "#1b1400"; }
    c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(key, tx0 + kw/2, ky + kh/2 + .5/k); tx0 += kw + pad*.7;
  }
  c.textAlign = "left"; c.textBaseline = "middle"; c.fillStyle = pixel ? "#1d2631" : "#ffffff"; c.fillText(text, tx0, y + H/2 + .5/k);
  c.restore();
}
function monTag(c, m, pixel){
  const f = !VISIT && !m.visitor ? friendOf(m.n) : -1;
  keyChip(c, m.box.x + m.box.w/2, m.box.y, "", nickFor(m.n) + (f >= 0 ? `  ♥ ${f}` : ""), pixel);
}
function promptFor(c, t, pixel){
  const ts = HS.ts, key = matchMedia("(pointer:coarse)").matches ? "" : "E";
  if (t.k === "mon") { if (t.m.sp && t.m.box) keyChip(c, t.m.box.x + t.m.box.w/2, t.m.box.y, key, `${HS.hold && !t.m.visitor && !VISIT ? "Feed" : "Play with"} ${nickFor(t.m.n)}`, pixel); return; }
  if (t.k === "gift") { keyChip(c, scrX(t.x), scrY(t.y) - ts*.45, key, "Open gift", pixel); return; }
  if (t.k === "tree") { const p = t.p; keyChip(c, scrX(p.x + p.it.w/2), scrY(p.y + p.it.d*.5) - 2.5*ts, key, treeLeft(p) > 0 ? "Pick a berry" : "No berries today", pixel); }
  if (t.k === "door") { keyChip(c, scrX(t.w.at.x), t.w.up ? scrY(0) - 2.1*ts : scrY(HS.me.y) - 2.3*ts, key, doorLabel(t.w), pixel); return; }
  if (t.k === "case") { const p = t.p; keyChip(c, scrX(p.x + p.it.w/2), scrY(p.y + p.it.d*.5) - (pixel ? 2.6 : 1.9)*ts, key, `Look at the ${LEAGUES[p.it.region - 1].badge === "stamp" ? "stamps" : "badges"}`, pixel); }
}
function nearestMon(r){ let best = null, bd = r; for (const m of HS.mons) { if (!sameRow(m.x, HS.me.x)) continue; const d = Math.hypot(m.x - HS.me.x, (m.y - HS.me.y)*1.4); if (d < bd) { bd = d; best = m; } } return best; }
function homeUpdate(dt, now){
  const me = HS.me; let vx = 0, vy = 0;
  if (!HS.edit && $("modalWrap").hidden) {
    if (HS.keys.has("left")) vx -= 1; if (HS.keys.has("right")) vx += 1; if (HS.keys.has("up")) vy -= 1; if (HS.keys.has("down")) vy += 1;
    if (HS.joy) { vx += HS.joy.x; vy += HS.joy.y; }
  }
  if (HS.photo) { HS.pcam += vx*dt*6; vx = vy = 0; }   // photo mode: the arrows move the camera, not you
  if (HS.edit && $("modalWrap").hidden && !HS.sel) HS.dcam = (HS.dcam ?? HS.cam) + ((HS.keys.has("right") ? 1 : 0) - (HS.keys.has("left") ? 1 : 0))*dt*9;   // decorating: the arrows look around
  if (me.walk && now - HS.stepT > 320) { HS.stepT = now; Sound.play("step"); }
  if (now > HS.crackT) { HS.crackT = now + 350 + Math.random()*900; if (placedItems().some(p => p.it.kind === "fire" && Math.hypot(p.x + 1 - me.x, p.y + 1 - me.y) < 3.2)) Sound.play("crackle"); }
  if (now > HS.evT) { HS.evT = now + 5000; if (eventVisitors().filter(n => !homeMons().includes(n)).join(",") !== HS.evKey) homeSyncMons(); }   // visitors come at night and leave by day
  if (vx || vy) { me.path = null; me.target = null; HS.pickAt = null; const l = Math.hypot(vx, vy), sp = 3.4*dt; tryMove(me, vx/l*sp, vy/l*sp*.8); if (vx) me.dir = vx; me.walk = 1;
    const w = vy && nearDoor(me, .7); if (w && (vy < 0) === w.up && (w.up ? me.y < w.at.y + .35 : me.y > w.at.y - .35)) goThrough(me, w);   // walking into a door goes through it
  }
  else if (me.path && me.path.length) {
    const p = me.path[0], dx = p.x - me.x, dy = p.y - me.y, d = Math.hypot(dx, dy), sp = 3.4*dt;
    if (d <= sp) { me.x = p.x; me.y = p.y; me.path.shift(); if (p.to) { const rest = me.path; goThrough(me, {to:p.to}); me.path = rest; } } else { me.x += dx/d*sp; me.y += dy/d*sp; if (Math.abs(dx) > .05) me.dir = Math.sign(dx); }
    me.walk = 1;
    if (!me.path.length) { me.path = null; me.walk = 0; if (me.target) { const m = me.target; me.target = null; if (Math.hypot(m.x - me.x, (m.y - me.y)*1.4) < 2.2) homeUseThing({k:"mon", m}); }
      if (HS.pickAt) { const t = HS.pickAt; HS.pickAt = null; if (Math.hypot(t.x + t.it.w/2 - me.x, (t.y + t.it.d + .45 - me.y)*1.4) < 1.8) pickBerry(t); } }
  } else me.walk = 0;
  if (now > (HS.furnT || 0)) { HS.furnT = now + 500; const sig = JSON.stringify(homeData().items); if (HS.furnSig !== undefined && sig !== HS.furnSig) homeFurnChanged(); HS.furnSig = sig; }
  const night = clockTod() === "night";
  for (const m of HS.mons) {
    if (HS.hide && HS.hide.n === m.n && !HS.hide.found) continue;
    if (m.hop > 0) m.hop = Math.max(0, m.hop - dt*1.8);
    // followers trail a little behind you, and stop when you stop
    const fi = HS.followers.indexOf(m.n);
    if (fi >= 0 && !VISIT && !HS.edit && !(night && !isNocturnal(m.n)) && !m.plan && (m.st === "idle" || m.follow)) {
      const FR = rowOf(me.x), tx = Math.max(FR.x0 + .4, Math.min(FR.x1 - .4, me.x - me.dir*(1.05 + fi*.85))), ty = Math.max(.5, Math.min(HM.D - .3, me.y + (fi ? .3 : -.2))), d = Math.hypot(tx - m.x, (ty - m.y)*1.4);
      if (d > (me.walk ? .45 : 1.25) && !blocked(tx, ty, m.fl)) {
        if (!m.follow || now > (m.pathT || 0)) { m.pathT = now + 600; m.path = !sameRow(m.x, tx) || dividers().some(dv => (dv.x - m.x)*(dv.x - tx) < 0) ? findPath(m, {x:tx, y:ty}) : null; }
        m.follow = true; m.st = "walk"; m.tx = tx; m.ty = ty;
      }
    }
    m.t -= dt*1000; if (me.target === m && m.st === "idle") m.t = Math.max(m.t, 500);
    if (m.st === "act") homeActTick(m, now);
    else if (m.st === "idle" && m.t <= 0 && homeDecide(m, now)) { /* off to use furniture, play, follow you or leave a gift */ }
    else if (m.st === "idle" && m.t <= 0) {
      const pond = HS.rooms.some(r => r.pond), fish = isFish(m.n) && pond, near = !fish && Math.random() < .3 && friendOf(m.n) >= 40 ? me : null;
      const swimTrip = fish || (m.water && pond && Math.random() < (HS.weather === "rain" ? .9 : .75));   // water Pokémon live in the pond
      const t = swimTrip ? randomSpot("only", fish || inPond(roomAt(m.x), m.x, m.y) ? {x:m.x, y:m.y} : null) : wanderSpot(m, near);
      if (t) { m.tx = t.x; m.ty = t.y; m.st = "walk"; m.swimTrip = !!swimTrip; m.path = needPath(m, t) ? findPath(m, t) : null; } else m.t = 1500;
      if (m.swim) m.t = 3000 + Math.random()*5000;   // drifting takes its time
      if (Math.random() < .12) m.emote = {k:clockTod() === "night" && Math.random() < .6 ? "zz" : "note", t0:now, dur:1600};
    } else if (m.st === "walk") {
      const wp = m.path && m.path.length ? m.path[0] : {x:m.tx, y:m.ty}, dx = wp.x - m.x, dy = wp.y - m.y, d = Math.hypot(dx, dy), last = !(m.path && m.path.length > 1);   // through the doorway when it needs another room
      m.v = Math.min(m.spd*(m.follow && me.walk ? 1.25 : 1), (m.v || 0) + m.spd*dt*3.5, last ? Math.max(.3, d*2.4) : 99);   // speeds up, and slows down as it arrives
      const sp = m.v*dt*(m.swim ? .55 : 1);   // drifting in the pond is slow
      if (d <= sp && Math.abs(dx) > .01) m.dir = Math.sign(dx);   // the last little step still turns it the right way
      if (d <= sp && m.path && m.path.length) { m.x = wp.x; m.y = wp.y; m.path.shift(); if (wp.to) { const p = m.path; goThrough(m, wp); m.path = p; } }   // through a door
      else if (d <= sp) { m.x = wp.x; m.y = wp.y; m.v = 0; if (m.plan) homeAct(m, m.plan, now); else if (m.follow) { m.follow = false; m.st = "idle"; m.t = 900; if (Math.abs(me.x - m.x) > .1) m.dir = Math.sign(me.x - m.x); } else { m.st = "idle"; m.t = 1500 + Math.random()*4000; } }
      else {
        const canSwim = isFlier(m) || (m.water && m.swimTrip) || m.swim, av = d > .5 ? steerAway(m) : {x:0, y:0};
        let ux = dx/d + av.x, uy = dy/d + av.y; const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;
        let nx = m.x + ux*sp, ny = m.y + uy*sp*.8;
        if (blocked(nx, ny, canSwim)) { nx = m.x + dx/d*sp; ny = m.y + dy/d*sp*.8; }   // steering would bump into something: go straight
        if (blocked(nx, ny, canSwim)) { m.st = "idle"; m.t = 600; m.plan = null; m.spot = null; m.follow = false; m.v = 0; }
        else { const mx = nx - m.x; m.x = nx; m.y = ny; if (Math.abs(mx) > sp*.05) m.dir = Math.sign(mx); }   // always faces the way it's really moving (only straight up/down keeps its facing)
      }
    }
    m.swim = !isFlier(m) && !m.z && inPond(roomAt(m.x), m.x, m.y);
  }
  if (HS.msgT && now > HS.msgT) { HS.msgT = 0; const el = $("hmMsg"); if (el) el.hidden = true; }
}
// gentle steering: a push away from other Pokémon and the trainer that are close ahead
function steerAway(m){
  let x = 0, y = 0; const R = .8;
  for (const o of [...HS.mons, HS.me]) {
    if (o === m || o === m.with || (o.z || 0) > 0 || o.st === "act" && o.spot && o.spot.on) continue;
    const ddx = m.x - o.x, ddy = (m.y - o.y)*1.4, d = Math.hypot(ddx, ddy);
    if (d < R && d > .01) { const k = (R - d)/R*1.3; x += ddx/d*k; y += ddy/d*k/1.4; }
  }
  return {x, y};
}
// furniture moved or put away: anyone using (or heading to) it gets down, and nobody is left inside furniture
function homeFurnChanged(){
  const keys = new Set(homeSpots().map(x => x.key));
  for (const m of HS.mons) {
    if (m.spot && !keys.has(m.spot.key)) { if (m.st === "act") { m.x = m.spot.ax; m.y = m.spot.ay; } m.z = 0; m.depth = null; m.act = null; m.spot = null; m.plan = null; m.with = null; m.st = "idle"; m.t = 800; m.hop = 1; }
    if (!m.z && blocked(m.x, m.y, m.fl || m.swim)) { const sp = randomSpot(m.fl, {x:m.x, y:m.y}) || randomSpot(m.fl); if (sp) { m.x = sp.x; m.y = sp.y; } }
  }
}
function tryMove(o, dx, dy){ if (!blocked(o.x + dx, o.y + dy)) { o.x += dx; o.y += dy; } else if (!blocked(o.x + dx, o.y)) o.x += dx; else if (!blocked(o.x, o.y + dy)) o.y += dy; }
function homeGoTo(m){
  const me = HS.me, side = me.x < m.x ? -1 : 1, spot = {x:m.x + side*1.15, y:Math.max(.5, m.y - .12)};
  if (Math.hypot(m.x - me.x, (m.y - me.y)*1.4) < 1.7) { homeInteract(m); return; }
  me.path = findPath(me, spot) || [spot]; me.target = m; m.st = "idle"; m.t = 1000;   // it waits for you
}
function homeInteract(m){
  const D = homeData(), day = todayKey(), now = performance.now(), name = monName(m.n);
  m.hop = 1; if (m.st !== "act") { m.st = "idle"; m.t = 2500; } m.dir = HS.me.x < m.x ? -1 : 1; HS.me.dir = m.x > HS.me.x ? 1 : -1;
  m.emote = {k:!VISIT && !m.visitor && friendOf(m.n) >= 25 ? "sig" : "heart", t0:now, dur:1800}; Sound.play("heal");   // from 25 friendship, its own sparkle
  burst("heart", m, 7, {sp:.9, dur:1100});
  if (m.visitor) { homeMsg(`${eventOn() && eventOn().id === "halloween" ? "Boo!" : "Hello there!"} It’s just visiting, and will leave by morning.`, {n:m.n, tag:"Visitor"}); return; }
  if (VISIT) { homeMsg(["Is happy to meet you!", "Says hello!", "Wants to play!"][Math.floor(Math.random()*3)], {n:m.n}); return; }   // a friend's Pokémon: just a hello
  const g = D.gain[m.n] && D.gain[m.n].d === day ? D.gain[m.n] : (D.gain[m.n] = {d:day, n:0});
  let up = 0; if (g.n < 25) { up = Math.min(5, 25 - g.n); g.n += up; D.fr[m.n] = Math.min(100, friendOf(m.n) + up); }
  const f = friendOf(m.n), lines = f >= 100 ? ["Is your best friend!", "Won’t leave your side!"] : f >= 60 ? ["Loves playing with you!", "Is so happy to see you!"] : f >= 25 ? ["Is getting used to you.", "Seems happy."] : ["Is a little shy.", "Watches you curiously."];
  homeMsg(`${lines[Math.floor(Math.random()*lines.length)]}${up ? "" : ` <span class="meta">It’s had enough petting for today.</span>`}`, {n:m.n, f, f0:f - up});
  if (D.pet[m.n] !== day) { D.pet[m.n] = day; earn(10, `Played with ${name}`); missionBump("pet"); }
  save(); renderResidents(); checkAch();
}
const nickFor = n => { if (VISIT && VISIT.nicks[n]) return VISIT.nicks[n]; for (const id of Object.keys(state.members)) { const M = (state.members[id] || {})[n]; if (M && M.nick) return M.nick; } return monName(n); };
// the message box: a speech bubble with the Pokémon's icon and name (o.n), its friendship hearts (o.f) or a tag, and the words typed out
function homeMsg(html, o = {}){
  const el = $("hmMsg"); if (!el) return; const n = o.n;
  el.className = "home-msg" + (n ? " talk" : "");
  el.innerHTML = `<span class="hmm-av${n ? "" : " sys"}" aria-hidden="true">${n ? spr(n, {mode:"2d"}) : "✦"}</span><div class="hmm-b">${n ? `<div class="hmm-h"><b>${esc(nickFor(n))}</b>${o.f !== undefined ? heartsHTML(o.f, o.f0) : o.tag ? `<span class="hmm-tag">${esc(o.tag)}</span>` : ""}</div>` : ""}<p class="hmm-t">${html}</p></div>`;
  if (n) paintAll(el);
  el.style.minHeight = ""; el.hidden = false; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in");
  el.style.minHeight = el.offsetHeight + "px";   // the box keeps its final size while the words type in
  typewriter(el.querySelector(".hmm-t"));
  HS.msgT = performance.now() + 3400 + el.textContent.length*24;
}
function typewriter(el){
  clearInterval(HS.tw); if (!el) return;
  const parts = []; (function walk(n){ for (const ch of n.childNodes) { if (ch.nodeType === 3) { parts.push([ch, ch.textContent]); ch.textContent = ""; } else walk(ch); } })(el);
  if (state.ui.motion === "reduced") { for (const [n, t] of parts) n.textContent = t; return; }   // Reduced motion: the words appear at once
  let i = 0, j = 0; HS.tw = setInterval(() => {
    if (!el.isConnected || i >= parts.length) { clearInterval(HS.tw); for (const [n, t] of parts) n.textContent = t; return; }
    const [n, t] = parts[i]; j = Math.min(t.length, j + 2); n.textContent = t.slice(0, j); if (j >= t.length) { i++; j = 0; }
  }, 22);
}
const HEART_SVG = '<svg viewBox="0 0 10 9" aria-hidden="true"><path d="M5 8.6L1.1 4.8A2.35 2.35 0 0 1 5 1.75 2.35 2.35 0 0 1 8.9 4.8z"/></svg>';
// friendship as five hearts (one per 20), plus the ribbon at 100
const heartLvl = (f, k) => f >= (k + 1)*20 ? 2 : f >= k*20 + 10 ? 1 : 0;
// f0: the friendship before; hearts that just filled pop in (the meter animates in the dialog)
const heartsHTML = (f, f0 = f) => `<span class="hearts" title="Friendship ${f}/100" aria-label="Friendship ${f} of 100">${[0, 1, 2, 3, 4].map(k => `<i class="${["", "half", "on"][heartLvl(f, k)]}${heartLvl(f, k) > heartLvl(f0, k) ? " new" : ""}">${HEART_SVG}</i>`).join("")}${f >= 100 ? `<span class="hm-rib">${RIBBON_SVG}</span>` : ""}</span>`;
function renderResidents(){
  const box = $("hmRes"); if (!box) return; const mons = homeMons();
  box.innerHTML = mons.length ? mons.map(n => { const f = friendOf(n); return `<button class="hm-r" type="button" data-hres="${n}" title="Walk to ${esc(monName(n))} · friendship ${f}/100">${spr(n, {mode:"2d"})}<span class="hm-rt"><b>${esc(nickFor(n))}</b>${heartsHTML(f)}</span></button>`; }).join("")
    : `<p class="note">No one lives here yet. Tap <b>Pokémon</b> to invite some of your favorites.</p>`;
  paintAll(box);
}
function pickHomeMons(){
  const D = homeData(), cap = homeCap(), sel = new Set(homeMons()), favs = state.favs.filter(n => NAT_BY.has(n));
  const md = openModal(`<h3 class="mt" id="modalTitle">Who lives in your Home?</h3>
    <p class="note">Choose up to <b>${cap}</b> of your favorites. ${cap < 20 ? "Open more rooms in the Shop to fit more." : ""}</p>
    ${favs.length ? `<div class="hm-pick" id="hmPickGrid">${favs.map(n => `<button type="button" class="hm-pk" data-hpk="${n}" aria-pressed="${sel.has(n)}">${spr(n)}<span>${esc(monName(n))}</span></button>`).join("")}</div>` : `<p>You haven’t favorited any Pokémon yet. Tap the ♡ on any Pokémon in the Team Builder, then come back.</p>`}
    <div class="actions"><button class="btn primary" type="button" id="hmPickOk">${favs.length ? "Done" : "Open the Team Builder"}</button><span class="meta" id="hmPickN">${sel.size} / ${cap}</span></div>`, {wide:true});
  md.onclick = e => {
    const b = e.target.closest("[data-hpk]"); if (b) { const n = +b.dataset.hpk; if (sel.has(n)) sel.delete(n); else { if (sel.size >= cap) { toast(`Your Home fits ${cap} Pokémon. Open more rooms in the Shop.`); return; } sel.add(n); } b.setAttribute("aria-pressed", sel.has(n)); md.querySelector("#hmPickN").textContent = `${sel.size} / ${cap}`; Sound.play("select"); return; }
    if (e.target.closest("#hmPickOk")) { if (!favs.length) { closeModal(); enterApp(state.mode); return; } D.mons = favs.filter(n => sel.has(n)); save(); closeModal(); homeSyncMons(); renderResidents(); const pb = $("hmPick"); if (pb) pb.textContent = `Pokémon · ${homeMons().length}/${cap}`; checkAch(); }
  };
}
// ---- decorating ----
function renderDecoBar(){
  const box = $("hmDecoBar"); if (!box) return;
  const used = {}; homeData().items.forEach(p => used[p.id] = (used[p.id] | 0) + 1);
  const owned = ITEMS_ALL.filter(it => it.cat === "furn" && furnCount(it.id) > 0);
  box.innerHTML = `<div class="hm-items">${owned.map(it => { const left = furnCount(it.id) - (used[it.id] | 0); return `<button type="button" class="hm-it" data-hplace="${it.id}" aria-pressed="${HS.place && HS.place.id === it.id}" ${left <= 0 ? "disabled" : ""}>${itemThumb(it)}<span>${esc(it.name)}</span><small>${left} left</small></button>`; }).join("")}</div>
    <div class="actions"><button class="btn sm" type="button" data-hact="undo" ${HS.undo.length ? "" : "disabled"}>↶ Undo</button><button class="btn sm" type="button" data-hact="shop">Get more furniture</button></div>
    <div class="hm-rooms" role="group" aria-label="Go to a room"><span class="meta">Go to</span>${HS.rooms.map((r, i) => `<button class="btn sm" type="button" data-hroom="${i}">${esc(r.name)}</button>`).join("")}</div>`;
  paintThumbs(box);
  const fl = $("hmFloat");
  if (fl) { fl.hidden = !HS.sel; if (HS.sel) fl.innerHTML = `<b>${esc(HS.sel.it.name)}</b><button class="btn sm primary" type="button" data-hact="move">Move</button><button class="btn sm" type="button" data-hact="flip">Flip</button>${canRotate(unlockOf("furn", HS.sel.id)) ? `<button class="btn sm" type="button" data-hact="rotate">Turn</button>` : ""}<button class="btn sm" type="button" data-hact="store">Put away</button>`; }
}
// decorating helpers: the toolbar that floats over the selected piece, nudging it, and a new piece showing up in view
function decoFloat(pixel){
  const fl = $("hmFloat"), hint = $("hmDHint"); if (!fl) return;
  if (hint) { const t = HS.place && !HS.place.drag ? (matchMedia("(pointer:coarse)").matches ? `Tap where the ${unlockOf("furn", HS.place.id).name.toLowerCase()} goes` : `Click where the ${unlockOf("furn", HS.place.id).name.toLowerCase()} goes · Esc to cancel`) : ""; if (hint.textContent !== t) hint.textContent = t; hint.hidden = !t; }
  const s = HS.sel; if (!s || fl.hidden) return;
  const it = s.it || unlockOf("furn", s.id), r = HS.cv.getBoundingClientRect(), k = (pixel ? HS.k : 1)*r.width/HS.cv.width, st = $("hmStage").getBoundingClientRect();
  const top = (scrY(s.y) - (isFloorItem(it) ? 0 : (FURN_H[it.kind] || 1.5) + (s.s ? liftOf(s) : 0))*HS.ts)*k + (r.top - st.top), bot = scrY(s.y + it.d)*k + (r.top - st.top), cx = scrX(s.x + it.w/2)*k + (r.left - st.left);
  const w = fl.offsetWidth, h = fl.offsetHeight, x = Math.max(4, Math.min(st.width - w - 4, cx - w/2)), y = top - h - 8 > 4 ? top - h - 8 : Math.min(st.height - h - 4, bot + 8);
  fl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}
function decoCancel(){   // stop placing; a piece picked up with Move goes back where it was
  const P = HS.place; HS.place = null; HS.ghost = null;
  if (P && P.from && !P.drag) { const q = decoPut(P.id, P.from.x, P.from.y, P.f, P.r); decoRiders(P, q); HS.undo.pop(); HS.layerKey = ""; save(); }
}
// a table picked up takes what stands on it along (P.riders), and they go back on top wherever it lands
function decoLift(q){ const D = homeData(), rs = ridersOf(q); D.items = D.items.filter(o => !rs.includes(o)); return rs.map(o => ({...o, dx:o.x - q.x})); }
function decoRiders(P, q){ for (const o of (P && P.riders) || []) homeData().items.push({id:o.id, x:q.x + o.dx, y:q.y, f:o.f || 0, ...(o.r ? {r:1} : {}), s:1}); if (P) P.riders = null; }
function decoNudge(dx, dy){
  const D = homeData(), s = HS.sel, i = D.items.findIndex(p => p.x === s.x && p.y === s.y && p.id === s.id); if (i < 0) return;
  const q = D.items.splice(i, 1)[0], it = rotItem(unlockOf("furn", q.id), q.r ? 1 : 0), rs = ridersOf({...q, it}).filter(o => o !== q), nx = q.x + dx, ny = q.y + dy, ok = fits(it, nx, ny, q);
  if (ok) { decoSnap(); const sf = surfaceUnder(it, nx, ny); q.x = nx; q.y = sf ? sf.y : ny; if (sf) q.s = 1; else delete q.s; for (const o of rs) { o.x += dx; o.y += q.y - (ny - dy); } } D.items.splice(i, 0, q);
  const lx = nx - rowOf(q.x).x0; HS.sel = {...q, it}; HS.layerKey = ""; if (ok) { save(); Sound.play("select"); if (lx < HS.dcam + .5 || lx + it.w > HS.dcam + HS.V.W/HS.ts - .5) HS.dcam = lx + it.w/2 - HS.V.W/HS.ts/2; } else Sound.play("wrong");
}
function decoGhostInView(){   // a piece picked from the tray shows up in the middle of the view right away (no hover on a phone)
  if (!HS.place) { HS.ghost = null; return; }
  const it = rotItem(unlockOf("furn", HS.place.id), HS.place.r), view = HS.V.W/HS.ts, R = HS.rows[HS.drow ?? rowOf(HS.me.x).k] || HS.rows[0], c = R.x0 + (HS.dcam ?? HS.cam) + view/2;
  HS.ghost = snapGhost(it, {x:Math.max(R.x0, Math.min(R.x1 - it.w, Math.round(c - it.w/2))), y:Math.max(0, Math.min(HM.D - it.d, Math.round(HM.D/2 - it.d/2)))});
}
function homeEditAct(a){
  const D = homeData(), s = HS.sel;
  if (a === "shop") { shopCat = "furn"; openScreen("shop"); return; }
  if (a === "undo") { decoUndo(); return; }
  if (!s) return; const i = D.items.findIndex(p => p.x === s.x && p.y === s.y && p.id === s.id);
  if (i >= 0 && ["flip", "store", "move", "rotate"].includes(a)) decoSnap();
  if (a === "flip" && i >= 0) { D.items[i].f = D.items[i].f ? 0 : 1; HS.sel = {...s, f:D.items[i].f}; }
  if (a === "rotate" && i >= 0) {   // turn a long rug a quarter: only if it still fits
    const q = D.items.splice(i, 1)[0], r = q.r ? 0 : 1, it = rotItem(unlockOf("furn", q.id), r);
    if (fits(it, q.x, q.y)) { if (r) q.r = 1; else delete q.r; } else { HS.undo.pop(); toast("There isn’t room to turn it here. Move it first."); }
    D.items.splice(i, 0, q); HS.sel = {...q, it};
  }
  if (a === "store" && i >= 0) { const q = D.items.splice(i, 1)[0], rs = decoLift(q); if (rs.length) toast(`What stood on it went back in storage too.`); HS.sel = null; }
  if (a === "move" && i >= 0) { const q = D.items.splice(i, 1)[0]; HS.place = {id:s.id, f:s.f || 0, r:s.r || 0, from:{x:s.x, y:s.y}, riders:decoLift(q)}; HS.ghost = {x:s.x, y:s.y}; HS.sel = null; }   // it waits where it was until you tap a new spot
  HS.layerKey = ""; save(); Sound.play("select"); renderDecoBar();
}
// ---- stacking: small pieces stand on tables, desks and counters (saved with s:1, at the surface's y) ----
const TOPPER = new Set(["plant", "globe", "orb", "trophy", "pot2", "pumpkin", "lamp2", "giftpile"]);
const SURF = {tabler:.8, desk:.56, counter:.8};   // where the top is, as a share of the piece's height
const canTop = it => !!it && TOPPER.has(it.kind) && it.w === 1 && it.d === 1;
const sameItem = (a, b) => a && b && a.x === b.x && a.y === b.y && a.id === b.id;
function surfaceUnder(it, x, y, ignore){   // the surface a small piece would stand on at x, y
  if (!canTop(it)) return null;
  return placedItems().find(p => !p.s && SURF[p.it.kind] != null && !sameItem(p, ignore) && x >= p.x && x + it.w <= p.x + p.it.w && y >= p.y && y < p.y + p.it.d) || null;
}
const surfOf = q => q.s ? placedItems().find(p => !p.s && SURF[p.it.kind] != null && q.x >= p.x && q.x < p.x + p.it.w && q.y === p.y) : null;   // what a stacked piece stands on
function surfZ(p){ const img = state.mode === "2d" && artOf(furnArtKey(p.it)); return (img ? img.height*Math.min(1, p.it.w*32/img.width)/32 : (FURN_H[p.it.kind] || 1))*SURF[p.it.kind]; }
const liftOf = q => { const sf = surfOf(q); return sf ? surfZ(sf) : 0; };
const ridersOf = p => SURF[p.it ? p.it.kind : (unlockOf("furn", p.id) || {}).kind] == null ? [] : homeData().items.filter(q => q.s && q.y === p.y && q.x >= p.x && q.x < p.x + (p.it || unlockOf("furn", p.id)).w);
function decoPut(id, x, y, f, r){   // add a piece; a small one over a table goes on top of it
  const it = rotItem(unlockOf("furn", id), r ? 1 : 0), sf = surfaceUnder(it, x, y), q = {id, x, y:sf ? sf.y : y, f:f ? 1 : 0, ...(r ? {r:1} : {}), ...(sf ? {s:1} : {})};
  homeData().items.push(q); return q;
}
function snapGhost(it, g){ const sf = g && surfaceUnder(it, g.x, g.y); if (sf) { g.y = sf.y; g.top = surfZ(sf); } else if (g) g.top = 0; return g; }
function fits(it, x, y, ignore){
  if (x < 0 || y < 0 || x + it.w > HS.W || y + it.d > HM.D) return false;
  const sf = surfaceUnder(it, x, y, ignore); if (sf) return !homeData().items.some(q => q.s && q.x === x && q.y === sf.y && !sameItem(q, ignore));   // on a table: one piece per spot
  for (const d of dividers()) if (x < d.x + .5 && x + it.w > d.x - .5) return false;   // keep walls and doorways clear
  for (const R of HS.rows) if (x < R.x0 && x + it.w > R.x0) return false;   // a piece stays in one row
  if (!isFloorItem(it)) for (const d of HS.doors) for (const e of [d.n, d.s]) if (x < e.x + .8 && x + it.w > e.x - .8 && y < e.y + .9 && y + it.d > e.y - .9) return false;   // and out of the doors' way
  for (const r of HS.rooms) if (r.pond) for (let dx = 0; dx <= it.w; dx += .5) for (let dy = 0; dy <= it.d; dy += .5) if (inPond(r, x + dx, y + dy)) return false;
  const floor = isFloorItem(it);
  for (const p of placedItems()) { if (p === ignore || p.s || isFloorItem(p.it) !== floor) continue; if (x < p.x + p.it.w && x + it.w > p.x && y < p.y + p.it.d && y + it.d > p.y) return false; }
  return true;
}
function drawDecoOverlay(c, pixel){
  const ts = HS.ts, R = HS.pass; c.strokeStyle = "rgba(255,255,255,.18)"; c.lineWidth = 1;
  for (let x = R.x0 + Math.max(0, Math.floor(HS.cam)); x <= R.x1; x++) { c.beginPath(); c.moveTo(Math.round(scrX(x)) + .5, scrY(0)); c.lineTo(Math.round(scrX(x)) + .5, scrY(HM.D)); c.stroke(); }
  for (let y = 0; y <= HM.D; y++) { c.beginPath(); c.moveTo(scrX(R.x0), Math.round(scrY(y)) + .5); c.lineTo(scrX(R.x1), Math.round(scrY(y)) + .5); c.stroke(); }
  const g = HS.ghost; if (HS.place && g) {
    const it = rotItem(unlockOf("furn", HS.place.id), HS.place.r), ok = fits(it, g.x, g.y), s = furnSprite(it, ts, pixel, !!HS.place.f);
    const up = Math.round((g.top || 0)*ts);
    c.globalAlpha = .7; c.drawImage(s.c, Math.round(scrX(g.x) - s.pad), Math.round(scrY(g.y) - s.pad - s.h*ts) - up); c.globalAlpha = 1;
    c.fillStyle = ok ? "rgba(80,220,120,.25)" : "rgba(240,70,70,.35)"; c.fillRect(scrX(g.x), scrY(g.y) - up, it.w*ts, it.d*ts*HM.SQ);
  }
}
function homeWorldPoint(e){
  const r = HS.cv.getBoundingClientRect(), px = (e.clientX - r.left)*HS.cv.width/r.width/HS.k, py = (e.clientY - r.top)*HS.cv.height/r.height/HS.k;
  return {px, py, x:px/HS.ts + HS.cam + (HS.pass ? HS.pass.x0 : 0), y:(py + HS.camY - HM.WALL*HS.ts)/(HS.ts*HM.SQ)};
}
function homePointerMove(e){
  if (!HS.edit && !HS.photo && e.pointerType === "mouse") { const p = homeWorldPoint(e); HS.hover = HS.mons.find(m => m.box && p.px >= m.box.x && p.px <= m.box.x + m.box.w && p.py >= m.box.y && p.py <= m.box.y + m.box.h) || null; HS.cv.style.cursor = HS.hover ? "pointer" : ""; }
  HS.ptrE = {clientX:e.clientX, clientY:e.clientY};
  if (HS.pdrag) { const c = HS.pdrag.cam - (e.clientX - HS.pdrag.x)*HS.cv.width/HS.cv.getBoundingClientRect().width/HS.k/HS.ts; if (Math.abs(e.clientX - HS.pdrag.x) > 5) HS.pdrag.moved = true; if (HS.photo) HS.pcam = c; else HS.dcam = c; return; }
  if (HS.edit && HS.drag && !HS.place) { const p = homeWorldPoint(e); if (Math.abs(p.x - HS.drag.px) > .6 || Math.abs(p.y - HS.drag.py) > .9) decoDragStart(); }
  if (!HS.edit || !HS.place) return; const p = homeWorldPoint(e), it = rotItem(unlockOf("furn", HS.place.id), HS.place.r);
  const ox = HS.place.ox ?? it.w/2, oy = HS.place.oy ?? it.d/2;
  const R = HS.pass || rowOf(p.x); HS.ghost = snapGhost(it, {x:Math.max(R.x0, Math.min(R.x1 - it.w, Math.round(p.x - ox))), y:Math.max(0, Math.min(HM.D - it.d, Math.round(p.y - oy)))});
}
// drag a placed item: it lifts off the floor once the pointer has moved, and lands where you let go (or back where it was)
function decoDragStart(){
  const d = HS.drag, D = homeData(), i = D.items.findIndex(q => q.x === d.item.x && q.y === d.item.y && q.id === d.item.id); if (i < 0) { HS.drag = null; return; }
  decoSnap(); const q = D.items.splice(i, 1)[0]; HS.layerKey = "";
  HS.place = {id:d.item.id, f:d.item.f || 0, r:d.item.r || 0, ox:d.px - d.item.x, oy:d.py - d.item.y, drag:true, from:d.item, riders:decoLift(q)}; HS.sel = null; Sound.play("select");
}
function homePointerUp(e){
  if (HS.pdrag) { const d = HS.pdrag; HS.pdrag = null; if (HS.edit && !d.moved && HS.sel) { HS.sel = null; renderDecoBar(); } return; }   // a tap on empty floor puts the selection down
  const d = HS.drag; HS.drag = null;
  if (!HS.edit || !HS.place || !HS.place.drag) return;
  homePointerMove(e);
  const P = HS.place, it = rotItem(unlockOf("furn", P.id), P.r), g = HS.ghost, ok = g && fits(it, g.x, g.y), at = ok ? {x:g.x, y:g.y} : {x:P.from.x, y:P.from.y};
  const q = decoPut(P.id, at.x, at.y, P.f, P.r); decoRiders(P, q);
  if (!ok) HS.undo.pop();
  HS.place = null; HS.ghost = null; HS.layerKey = ""; save(); Sound.play(ok ? "add" : "back");
  HS.sel = ok ? {...homeData().items[homeData().items.length - 1], it} : null; renderDecoBar();
  if (d) for (const m of HS.mons) if (blocked(m.x, m.y, m.fl)) { const sp = randomSpot(m.fl); if (sp) { m.x = sp.x; m.y = sp.y; } }
}
function homePointerDown(e){
  HS.cv.focus({preventScroll:true});
  const p = homeWorldPoint(e); if (HS.pass) p.x = Math.max(HS.pass.x0, Math.min(HS.pass.x1 - .01, p.x));   // past the end of the row in view: its end
  if (HS.photo) { HS.pdrag = {x:e.clientX, cam:HS.pcam}; HS.cv.setPointerCapture(e.pointerId); return; }
  if (HS.edit) {
    if (HS.place && HS.place.drag) return;
    if (HS.place) { homePointerMove(e); const it = rotItem(unlockOf("furn", HS.place.id), HS.place.r), g = HS.ghost; if (g && fits(it, g.x, g.y)) { decoSnap(); const q = decoPut(it.id, g.x, g.y, HS.place.f, HS.place.r); decoRiders(HS.place, q); HS.layerKey = ""; save(); Sound.play("add"); for (const m of HS.mons) if (blocked(m.x, m.y, m.fl)) { const s = randomSpot(m.fl); if (s) { m.x = s.x; m.y = s.y; } } if (blocked(HS.me.x, HS.me.y)) { const s = randomSpot(false); if (s) { HS.me.x = s.x; HS.me.y = s.y; } } const left = furnCount(it.id) - homeData().items.filter(q => q.id === it.id).length; if (left <= 0) HS.place = null; renderDecoBar(); checkAch(); } else Sound.play("wrong"); return; }
    const hit = placedItems().reverse().find(q => { const up = q.s ? liftOf(q)/HM.SQ : 0; return p.x >= q.x && p.x <= q.x + q.it.w && p.y >= q.y - (isFloorItem(q.it) ? 0 : 1.6) - up && p.y <= q.y + q.it.d - up; });
    HS.sel = hit ? homeData().items.find(q => q.x === hit.x && q.y === hit.y && q.id === hit.id) && {...hit} : null; if (HS.sel) Sound.play("select"); renderDecoBar();
    if (hit) { HS.drag = {item:homeData().items.find(q => q.x === hit.x && q.y === hit.y && q.id === hit.id), px:p.x, py:p.y}; HS.cv.setPointerCapture(e.pointerId); }
    else { HS.pdrag = {x:e.clientX, cam:HS.dcam ?? HS.cam, moved:false}; HS.cv.setPointerCapture(e.pointerId); }   // empty floor: drag to look around
    return;
  }
  if (HS.hide && !HS.hide.found) { const hit = placedItems().reverse().find(q => !isFloorItem(q.it) && p.x >= q.x && p.x <= q.x + q.it.w && p.y >= q.y - 1.6 && p.y <= q.y + q.it.d); if (hit) { seekAt(hit); return; } }
  const D = homeData(), gi = VISIT ? -1 : D.gifts.findIndex(g => Math.abs(g.x - p.x) < .45 && p.y > g.y - 1.2 && p.y < g.y + .3);
  if (gi >= 0) { const g = D.gifts[gi]; if (Math.hypot(g.x - HS.me.x, (g.y - HS.me.y)*1.4) < 1.3) openGift(gi); else { HS.me.path = findPath(HS.me, {x:g.x, y:Math.min(HM.D - .2, g.y + .5)}); HS.me.target = null; } return; }
  const hitMon = HS.mons.find(m => m.box && p.px >= m.box.x && p.px <= m.box.x + m.box.w && p.py >= m.box.y && p.py <= m.box.y + m.box.h);
  if (hitMon) { homeGoTo(hitMon); return; }
  const tree = placedItems().find(q => q.it.kind === "tree" && p.x >= q.x && p.x <= q.x + q.it.w && p.y >= q.y - 3 && p.y <= q.y + q.it.d);
  if (tree) { const at = {x:tree.x + tree.it.w/2, y:Math.min(HM.D - .2, tree.y + tree.it.d + .45)}; if (Math.hypot(at.x - HS.me.x, (at.y - HS.me.y)*1.4) < 1.6) pickBerry(tree); else { HS.me.path = findPath(HS.me, at); HS.me.target = null; HS.pickAt = tree; } return; }
  const w = doorWays().find(w => sameRow(w.at.x, p.x) && Math.abs(p.x - w.at.x) < .75 && (w.up ? p.y < .4 && p.y > -2.1/HM.SQ : p.y > HM.D - .9));   // a door: walk through it
  if (w) { HS.me.path = findPath(HS.me, w.to); HS.me.target = null; return; }
  if (p.y < 0) return;
  const to = {x:Math.max(HS.pass ? HS.pass.x0 + .4 : .4, Math.min((HS.pass ? HS.pass.x1 : HS.W) - .4, p.x)), y:Math.max(.5, Math.min(HM.D - .2, p.y))};
  HS.me.path = findPath(HS.me, to); HS.me.target = null;
}
const HM_KEYS = {ArrowLeft:"left", a:"left", A:"left", ArrowRight:"right", d:"right", D:"right", ArrowUp:"up", w:"up", W:"up", ArrowDown:"down", s:"down", S:"down"};
document.addEventListener("keydown", e => {
  const inHome = nav.screen === "home" || (nav.screen === "friends" && nav.sub && nav.sub.startsWith("h:"));
  if (!inHome || $("screen").hidden || !$("modalWrap").hidden || e.target.closest("input, select, textarea")) return;
  if (HS.edit && HS.sel && HM_KEYS[e.key]) { e.preventDefault(); const k = HM_KEYS[e.key]; decoNudge(k === "left" ? -1 : k === "right" ? 1 : 0, k === "up" ? -1 : k === "down" ? 1 : 0); return; }   // the arrows nudge the selected piece
  if (HS.edit && (HM_KEYS[e.key] === "up" || HM_KEYS[e.key] === "down")) { e.preventDefault(); const k = Math.max(0, Math.min(HS.rows.length - 1, (HS.drow ?? 0) + (HM_KEYS[e.key] === "up" ? -1 : 1))); if (k !== HS.drow) { HS.drow = k; Sound.play("select"); } return; }   // decorating: up and down go to the row behind or in front
  if (HM_KEYS[e.key]) { HS.keys.add(HM_KEYS[e.key]); e.preventDefault(); return; }
  if (HS.edit && (e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) { e.preventDefault(); decoUndo(); return; }
  if (HS.edit && e.key === "Escape" && (HS.place || HS.sel)) { e.preventDefault(); if (HS.place && HS.place.drag) return; decoCancel(); HS.sel = null; renderDecoBar(); return; }
  if (HS.edit && HS.sel && !e.ctrlKey && !e.metaKey) { const a = {f:"flip", F:"flip", r:"rotate", R:"rotate", Delete:"store", Backspace:"store", m:"move", M:"move"}[e.key]; if (a) { e.preventDefault(); homeEditAct(a); return; } }
  if ((e.key === "e" || e.key === "E" || e.key === " " || e.key === "Enter") && !e.target.closest("button") && !HS.edit && !HS.photo) { const t = nearestThing(); if (t) { e.preventDefault(); homeUseThing(t); } }
});
document.addEventListener("keyup", e => { if (HM_KEYS[e.key]) HS.keys.delete(HM_KEYS[e.key]); });
addEventListener("blur", () => HS.keys.clear());

