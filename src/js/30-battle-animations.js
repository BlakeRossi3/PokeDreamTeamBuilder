// ================= BATTLE ANIMATIONS =================
// Every move has an animation. A move's recipe is a short list of steps [primitive, start, end, options] on a 0..1
// timeline, drawn on a canvas over the battlefield: signature moves have their own recipes, the rest are built from the
// move's flags (punch, bite, slicing, sound…), category, target and effects, in its type's colours and particle shape.
// 3D draws smooth glows; 2D draws chunky pixels on a low-resolution canvas (no smoothing).
const TYPE_FX = {
  Normal:{c:["#fff4d6", "#ffc94a", "#8a8a8a"], p:"star"}, Fire:{c:["#ff5a1a", "#ffa62e", "#ffe066"], p:"flame"},
  Water:{c:["#2f8fff", "#7cc4ff", "#e0f4ff"], p:"bubble"}, Electric:{c:["#ffd51a", "#fff3a0", "#ffffff"], p:"bolt"},
  Grass:{c:["#2fae3e", "#8fe06a", "#d7ffb0"], p:"leaf"}, Ice:{c:["#7fd8ff", "#d8f6ff", "#ffffff"], p:"shard"},
  Fighting:{c:["#d0501c", "#ffa06a", "#fff1e0"], p:"star"}, Poison:{c:["#9a3fd0", "#cf86ff", "#f0d6ff"], p:"bubble"},
  Ground:{c:["#b9863e", "#e0bb73", "#7a5428"], p:"rock"}, Flying:{c:["#cfe2ff", "#ffffff", "#93acd9"], p:"gust"},
  Psychic:{c:["#ff4f9e", "#ff9fcc", "#ffe0ef"], p:"ring"}, Bug:{c:["#8db51e", "#cfe86a", "#557510"], p:"dot"},
  Rock:{c:["#a8925a", "#7f6b3c", "#d8c893"], p:"rock"}, Ghost:{c:["#6a4aa8", "#a98be0", "#241640"], p:"wisp"},
  Dragon:{c:["#5d4cff", "#a598ff", "#ff6a6a"], p:"flame"}, Dark:{c:["#2f2638", "#5f4f72", "#ff3d64"], p:"slash"},
  Steel:{c:["#aab7cc", "#ffffff", "#6f7c93"], p:"glint"}, Fairy:{c:["#ff86cf", "#ffcfea", "#ffffff"], p:"sparkle"},
};
const ST_COL = {slp:"#9aa6ff", par:"#ffd51a", brn:"#ff7a2e", psn:"#b04fd6", tox:"#8a2fb0", frz:"#9fe8ff", confusion:"#ffd94a"};
// tiny pixel bitmaps for 2D particles (1-3 = the type's colours)
const FX_PX = {
  flame:[".1.", "121", "232", ".2."], bubble:[".11.", "1..1", "1.31", ".11."], bolt:["..1", ".1.", "111", ".1.", "1.."],
  leaf:[".11", "121", "11."], shard:[".1.", "131", "121", ".1."], star:[".1.", "131", ".1."], rock:[".11", "123", "22."],
  gust:["11.", "..1", ".1."], ring:[".1.", "1.1", ".1."], dot:["1"], wisp:[".1.", "121", ".1.", "1.1"], slash:["..1", ".1.", "1.."],
  glint:[".1.", "131", ".1."], sparkle:[".1.", "131", ".1."], heart:["1.1", "111", ".1."],
};
// the shape of each primitive's particles in 3D
function fxShape(c, k, x, y, s, rot){
  c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.beginPath();
  if (k === "flame") { c.moveTo(0, -s*1.3); c.quadraticCurveTo(s, -s*.2, 0, s); c.quadraticCurveTo(-s, -s*.2, 0, -s*1.3); c.fill(); }
  else if (k === "bubble" || k === "ring") { c.arc(0, 0, s, 0, 7); c.lineWidth = Math.max(1, s*.3); c.stroke(); if (k === "bubble") { c.beginPath(); c.arc(-s*.35, -s*.35, s*.25, 0, 7); c.fill(); } }
  else if (k === "bolt") { c.moveTo(-s*.4, -s*1.4); c.lineTo(s*.3, -s*.2); c.lineTo(-s*.2, -s*.1); c.lineTo(s*.4, s*1.4); c.lineWidth = Math.max(1.5, s*.35); c.lineJoin = "round"; c.stroke(); }
  else if (k === "leaf") { c.ellipse(0, 0, s*1.2, s*.55, 0, 0, 7); c.fill(); }
  else if (k === "shard") { c.moveTo(0, -s*1.4); c.lineTo(s*.5, 0); c.lineTo(0, s*1.4); c.lineTo(-s*.5, 0); c.closePath(); c.fill(); }
  else if (k === "rock") { c.moveTo(-s, -s*.3); c.lineTo(-s*.3, -s); c.lineTo(s*.8, -s*.6); c.lineTo(s, s*.4); c.lineTo(0, s); c.lineTo(-s*.8, s*.6); c.closePath(); c.fill(); }
  else if (k === "gust") { c.arc(0, 0, s*1.2, 0, Math.PI*1.3); c.lineWidth = Math.max(1, s*.3); c.stroke(); }
  else if (k === "wisp") { const g = c.createRadialGradient(0, 0, 0, 0, 0, s*1.4); g.addColorStop(0, c.fillStyle); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.arc(0, 0, s*1.4, 0, 7); c.fill(); }
  else if (k === "slash") { c.moveTo(-s*1.5, s*1.5); c.lineTo(s*1.5, -s*1.5); c.lineWidth = Math.max(1.5, s*.4); c.lineCap = "round"; c.stroke(); }
  else if (k === "heart") { c.moveTo(0, s); c.bezierCurveTo(-s*1.6, -s*.1, -s*.8, -s*1.3, 0, -s*.5); c.bezierCurveTo(s*.8, -s*1.3, s*1.6, -s*.1, 0, s); c.fill(); }
  else if (k === "dot") { c.arc(0, 0, s*.7, 0, 7); c.fill(); }
  else { for (let i = 0; i < 8; i++) { const a = i*Math.PI/4, r = i % 2 ? s*.38 : s*1.3; c.lineTo(Math.cos(a)*r, Math.sin(a)*r); } c.closePath(); c.fill(); }   // star, glint, sparkle
  c.restore();
}
// one particle: k = shape, col = colour, s = size (canvas px), a = alpha
function fxDot(g, k, x, y, s, col, a = 1, rot = 0){
  const c = g.c; c.globalAlpha = Math.max(0, Math.min(1, a));
  if (g.pixel) {   // a pixel bitmap at a whole-number scale, coloured from the type's palette
    const bm = FX_PX[k] || FX_PX.dot, z = Math.max(1, Math.round(s/2.2)), pal = g.pal;
    const ox = Math.round(x - bm[0].length*z/2), oy = Math.round(y - bm.length*z/2);
    bm.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === ".") continue; c.fillStyle = ch === "1" ? col : ch === "2" ? pal[1] : pal[2]; c.fillRect(ox + i*z, oy + j*z, z, z); } });
  } else { c.fillStyle = c.strokeStyle = col; fxShape(c, k, x, y, s, rot); }
  c.globalAlpha = 1;
}
function fxGlow(g, x, y, r, col, a){
  const c = g.c; if (r <= 0 || a <= 0) return;
  if (g.pixel) { c.globalAlpha = Math.min(1, a)*.55; c.fillStyle = col; const R = Math.round(r); for (let j = -R; j <= R; j += 2) { const w = Math.round(Math.sqrt(Math.max(0, R*R - j*j))); c.fillRect(Math.round(x - w), Math.round(y + j), w*2, 2); } c.globalAlpha = 1; return; }
  c.save(); c.globalCompositeOperation = "lighter"; const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)"); c.globalAlpha = Math.min(1, a); c.fillStyle = gr; c.fillRect(x - r, y - r, r*2, r*2); c.restore();
}
const fxLerp = (a, b, t) => a + (b - a)*t, fxEase = t => t < .5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2)/2;
const fxHash = n => { const x = Math.sin(n*127.1 + 311.7)*43758.5453; return x - Math.floor(x); };
// ---- primitives: (g, u 0..1, o options). g has c, A/T {x, y, r} (centre and body radius), U (unit size), pal, sh, pixel, W, H ----
const FXP = {
  charge(g, u, o){ const n = o.n || 10, P = g[o.at || "A"]; for (let i = 0; i < n; i++) { const a = i/n*6.28 + u*4, r = (1 - u)*P.r*1.8 + P.r*.2; fxDot(g, o.sh || g.sh, P.x + Math.cos(a)*r, P.y + Math.sin(a)*r*.8, g.U*(.6 + u*.5), g.pal[i % 2], .4 + u*.6, a); } fxGlow(g, P.x, P.y, P.r*u*1.1, g.pal[0], u*.8); },
  projectile(g, u, o){
    const n = o.n || 1, big = o.big || 1, arc = o.arc ?? .25;
    for (let i = 0; i < n; i++) { const d = n > 1 ? i/n*.45 : 0, t = Math.max(0, Math.min(1, (u - d)/(1 - (n > 1 ? .45 : 0)))); if (t <= 0 || t >= 1) continue;
      const sp = (fxHash(i + 3) - .5)*g.T.r*(o.spread || .6), x = fxLerp(g.A.x, g.T.x + sp, fxEase(t)), y = fxLerp(g.A.y, g.T.y + sp*.4, fxEase(t)) - Math.sin(t*Math.PI)*g.H*arc;
      fxGlow(g, x, y, g.U*3.2*big, g.pal[0], .7); fxDot(g, o.sh || g.sh, x, y, g.U*1.6*big, g.pal[1], 1, t*8 + i);
      for (let k = 1; k < 4; k++) { const tt = Math.max(0, t - k*.05); fxDot(g, o.sh || g.sh, fxLerp(g.A.x, g.T.x + sp, fxEase(tt)), fxLerp(g.A.y, g.T.y + sp*.4, fxEase(tt)) - Math.sin(tt*Math.PI)*g.H*arc, g.U*(1.2 - k*.25)*big, g.pal[k % 3], .7 - k*.18); } }
  },
  beam(g, u, o){
    const c = g.c, grow = Math.min(1, u*3), fade = u > .7 ? (1 - u)/.3 : 1, w = g.U*(o.w || 2.6)*fade, x2 = fxLerp(g.A.x, g.T.x, grow), y2 = fxLerp(g.A.y, g.T.y, grow);
    if (g.pixel) { const steps = Math.ceil(Math.hypot(x2 - g.A.x, y2 - g.A.y)/2); for (let i = 0; i <= steps; i++) { const t = i/Math.max(1, steps), x = fxLerp(g.A.x, x2, t), y = fxLerp(g.A.y, y2, t), ww = Math.max(1, Math.round(w*(1 + .25*Math.sin(i + u*40)))); c.fillStyle = g.pal[0]; c.fillRect(Math.round(x - ww), Math.round(y - ww), ww*2, ww*2); c.fillStyle = g.pal[2]; c.fillRect(Math.round(x - ww/2), Math.round(y - ww/2), Math.max(1, ww), Math.max(1, ww)); } }
    else { c.save(); c.globalCompositeOperation = "lighter"; c.lineCap = "round"; for (const [col, k] of [[g.pal[0], 2.2], [g.pal[1], 1.2], [g.pal[2], .5]]) { c.strokeStyle = col; c.lineWidth = w*k; c.globalAlpha = .85; c.beginPath(); c.moveTo(g.A.x, g.A.y); c.lineTo(x2, y2); c.stroke(); } c.restore(); }
    for (let i = 0; i < 8; i++) { const t = (i/8 + u*2) % 1; if (t > grow) continue; fxDot(g, o.sh || g.sh, fxLerp(g.A.x, g.T.x, t), fxLerp(g.A.y, g.T.y, t) + Math.sin(i*2 + u*30)*w*1.2, g.U*.9, g.pal[i % 3], fade, i); }
    if (grow >= 1) fxGlow(g, g.T.x, g.T.y, g.T.r*(.9 + .2*Math.sin(u*40)), g.pal[1], fade*.8);
  },
  impact(g, u, o){ const n = o.n || 10, P = g[o.at || "T"], r = P.r*(o.size || 1)*(.25 + fxEase(u)*1.15), a = 1 - u;
    fxGlow(g, P.x, P.y, P.r*(o.size || 1)*(.5 + u*.7), g.pal[1], a*.9);
    for (let i = 0; i < n; i++) { const ang = i/n*6.28 + fxHash(i)*.6; fxDot(g, o.sh || g.sh, P.x + Math.cos(ang)*r, P.y + Math.sin(ang)*r*.8, g.U*(1.5 - u*.8), g.pal[i % 3], a, ang); } },
  rain(g, u, o){ const n = o.n || 12, P = g[o.at || "T"]; for (let i = 0; i < n; i++) { const d = fxHash(i)*.5, t = (u - d)/.5; if (t <= 0 || t >= 1) continue;
    const x = P.x + (fxHash(i + 9) - .5)*P.r*2.6, y = fxLerp(-g.U*4, P.y + (fxHash(i + 5) - .3)*P.r, t); fxDot(g, o.sh || g.sh, x, y, g.U*(o.big || 1.4), g.pal[i % 3], 1 - Math.max(0, t - .85)/.15, Math.PI/2); if (t > .8) fxGlow(g, x, P.y, P.r*.5, g.pal[1], (1 - t)*4); } },
  quake(g, u, o){ g.shake = Math.max(g.shake, (1 - u)*g.U*(o.amp || 2)); const P = g.T, gy = P.y + P.r*.9, c = g.c;
    c.globalAlpha = Math.sin(u*Math.PI); c.fillStyle = "#3a2a18"; for (let x = P.x - P.r*1.8, k = 0; x < P.x + P.r*1.8; x += g.U*1.5, k++) c.fillRect(Math.round(x), Math.round(gy + Math.sin(k*1.7)*g.U*.8), Math.ceil(g.U*1.5), Math.max(1, Math.round(g.U*.5))); c.globalAlpha = 1;   // a crack in the ground
    for (let i = 0; i < 14; i++) { const x = P.x + (fxHash(i) - .5)*P.r*3.4, t = (u*1.5 + fxHash(i + 2)) % 1; fxDot(g, "rock", x, gy - Math.sin(t*Math.PI)*P.r*.9, g.U*(1.3 + fxHash(i + 4)*1.2), g.pal[i % 3], 1 - u*.6, i); } },
  wave(g, u, o){ const c = g.c, P = g.T, front = fxLerp(-g.W*.1, g.W*1.05, fxEase(u)), h = P.r*1.9, base = P.y + P.r*1.05, a = u > .82 ? (1 - u)/.18 : 1, top = x => base - h*Math.max(0, Math.min(1, (front - x)/(g.W*.35))) - Math.sin(x/(g.U*6) + u*9)*g.U*1.2;
    c.globalAlpha = .55*a;
    if (g.pixel) { for (let x = 0; x < Math.min(g.W, front); x += 2) { const y = Math.round(top(x)); c.fillStyle = g.pal[0]; c.fillRect(x, y, 2, Math.max(0, Math.round(base - y))); c.fillStyle = g.pal[2]; c.fillRect(x, y, 2, 2); } }
    else { c.fillStyle = g.pal[0]; c.beginPath(); c.moveTo(0, base); for (let x = 0; x <= Math.min(g.W, front); x += 4) c.lineTo(x, top(x)); c.lineTo(Math.min(g.W, front), base); c.closePath(); c.fill(); c.globalAlpha = .9*a; c.strokeStyle = g.pal[2]; c.lineWidth = g.U*.8; c.beginPath(); for (let x = 0; x <= Math.min(g.W, front); x += 4) c.lineTo(x, top(x)); c.stroke(); }
    c.globalAlpha = 1; for (let i = 0; i < 10; i++) { const x = front - fxHash(i)*g.W*.3; if (x > 0 && x < g.W) fxDot(g, o.sh || g.sh, x, top(x) - g.U, g.U*1.2, g.pal[i % 3], a, i); } },
  aura(g, u, o){ const P = g[o.at || "A"], col = o.col || g.pal[0]; fxGlow(g, P.x, P.y, P.r*(1 + .15*Math.sin(u*20)), col, Math.sin(u*Math.PI)*.9);
    for (let i = 0; i < 8; i++) { const t = (u*1.6 + i/8) % 1, x = P.x + (fxHash(i) - .5)*P.r*1.8, y = P.y + P.r*.8 - t*P.r*2.2; if (o.arrows) fxArrow(g, x, y, o.down ? 1 : -1, col, Math.sin(t*Math.PI)); else fxDot(g, o.sh || "sparkle", x, y, g.U, i % 2 ? col : g.pal[2], Math.sin(t*Math.PI)); } },
  arrows(g, u, o){ const P = g[o.at || "T"], col = o.down ? "#4f7cff" : "#ff5a3c"; for (let i = 0; i < 6; i++) { const t = (u*1.4 + i/6) % 1, x = P.x + (i/5 - .5)*P.r*1.6, y = o.down ? P.y - P.r + t*P.r*2 : P.y + P.r - t*P.r*2; fxArrow(g, x, y, o.down ? 1 : -1, col, Math.sin(t*Math.PI)); } },
  cloud(g, u, o){ const P = g[o.at || "T"], col = o.col || g.pal[0]; for (let i = 0; i < 12; i++) { const a = fxHash(i)*6.28, r = P.r*(.3 + fxEase(u)*.9)*fxHash(i + 1), x = P.x + Math.cos(a)*r, y = P.y + Math.sin(a)*r*.7 - u*P.r*.3; fxGlow(g, x, y, g.U*3*(.6 + u), col, (1 - u)*.8); fxDot(g, o.sh || "dot", x, y, g.U*.9, col, 1 - u); } },
  shield(g, u, o){ const c = g.c, P = g[o.at || "A"], a = Math.sin(u*Math.PI), r = P.r*1.25, col = o.col || "#7ce8ff";
    if (g.pixel) { c.globalAlpha = a*.8; c.fillStyle = col; for (let t = 0; t < 6.28; t += .12) c.fillRect(Math.round(P.x + Math.cos(t)*r), Math.round(P.y + Math.sin(t)*r), 2, 2); c.globalAlpha = 1; }
    else { c.save(); c.globalAlpha = a*.5; const gr = c.createRadialGradient(P.x, P.y, r*.6, P.x, P.y, r); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(1, col); c.fillStyle = gr; c.beginPath(); c.arc(P.x, P.y, r, 0, 7); c.fill(); c.globalAlpha = a; c.strokeStyle = "#ffffff"; c.lineWidth = g.U*.5; c.beginPath(); c.arc(P.x, P.y, r, -2.4, -1.6); c.stroke(); c.restore(); } },
  screen(g, u, o){ const c = g.c, P = g[o.at || "A"], a = Math.sin(u*Math.PI)*.6, x = P.x + (P === g.A ? 1 : -1)*P.r*(g.A.x < g.T.x ? 1.1 : -1.1);
    c.globalAlpha = a; c.fillStyle = o.col || g.pal[0]; c.fillRect(Math.round(x - g.U), Math.round(P.y - P.r*1.3), Math.max(2, Math.round(g.U*2)), Math.round(P.r*2.4)); c.globalAlpha = 1; FXP.aura(g, u, {at:o.at || "A", col:o.col || g.pal[0]}); },
  weather(g, u, o){ const c = g.c, a = Math.sin(u*Math.PI), w = o.w;
    c.globalAlpha = a*.28; c.fillStyle = w === "sun" ? "#ffb347" : w === "rain" ? "#3a5a9a" : w === "sand" ? "#c9a25a" : w === "snow" ? "#dfefff" : g.pal[0]; c.fillRect(0, 0, g.W, g.H); c.globalAlpha = 1;
    for (let i = 0; i < 40; i++) { const x = fxHash(i)*g.W, t = (u*2 + fxHash(i + 7)) % 1;
      if (w === "sun") fxGlow(g, g.W*.85, g.H*.1, g.W*.25*a, "#fff2a8", a*.6);
      else if (w === "rain") fxDot(g, "slash", x - t*g.U*6, t*g.H, g.U*.9, "#bcd6ff", a);
      else if (w === "sand") fxDot(g, "dot", (x + t*g.W) % g.W, fxHash(i + 3)*g.H, g.U*.9, i % 2 ? "#e0bb73" : "#b9863e", a);
      else fxDot(g, w === "snow" ? "sparkle" : g.sh, x, t*g.H, g.U*.8, w === "snow" ? "#ffffff" : g.pal[i % 3], a); } },
  hazard(g, u, o){ const P = g.T, n = 6; for (let i = 0; i < n; i++) { const t = Math.max(0, Math.min(1, (u - i*.06)/.6)), x = fxLerp(g.A.x, P.x + (i/(n - 1) - .5)*P.r*2.4, t), y = fxLerp(g.A.y, P.y + P.r*.95, t) - Math.sin(t*Math.PI)*g.H*.25; fxDot(g, o.sh || "rock", x, y, g.U*2, g.pal[i % 3], 1, i); } },
  heal(g, u, o){ FXP.aura(g, u, {at:o.at || "A", col:o.col || "#7dff9a", sh:"sparkle"}); },
  drain(g, u, o){ for (let i = 0; i < 10; i++) { const t = (u*1.3 + i/10) % 1, x = fxLerp(g.T.x, g.A.x, fxEase(t)), y = fxLerp(g.T.y, g.A.y, fxEase(t)) - Math.sin(t*Math.PI)*g.H*.15 + Math.sin(i*3)*g.U*2; fxDot(g, "dot", x, y, g.U*1.1, i % 2 ? "#7dff9a" : g.pal[0], Math.sin(t*Math.PI)); } },
  fist(g, u, o){ const P = g.T, s = g.U*(2 + fxEase(Math.min(1, u*2))*3), a = u > .6 ? (1 - u)/.4 : 1; fxDot(g, "rock", P.x - g.U*2 + u*g.U*2, P.y, s, o.col || "#f5d6b3", a, .2); if (u > .4) FXP.impact(g, (u - .4)/.6, {n:8, sh:"star"}); },
  fangs(g, u, o){ const c = g.c, P = g.T, cl = fxEase(Math.min(1, u*1.8)), gap = P.r*(1 - cl)*.9, a = u > .7 ? (1 - u)/.3 : 1; c.globalAlpha = a; c.fillStyle = "#ffffff";
    c.strokeStyle = "#28323f"; c.lineWidth = Math.max(1, g.U*.4); c.lineJoin = "round"; for (const dir of [-1, 1]) for (let i = 0; i < 4; i++) { const x = P.x + (i - 1.5)*P.r*.35, y = P.y + dir*(gap + P.r*.15); c.beginPath(); c.moveTo(x - P.r*.15, y); c.lineTo(x + P.r*.15, y); c.lineTo(x, y - dir*P.r*.38); c.closePath(); c.stroke(); c.fill(); }
    c.globalAlpha = 1; if (u > .55) FXP.impact(g, (u - .55)/.45, {n:6}); },
  slashes(g, u, o){ const c = g.c, P = g.T, n = o.n || 3; for (let i = 0; i < n; i++) { const t = Math.max(0, Math.min(1, (u - i*.12)/.45)); if (t <= 0) continue; const a = t < 1 ? 1 : Math.max(0, 1 - (u - i*.12 - .45)*3), off = (i - (n - 1)/2)*P.r*.45;
    const x1 = P.x - P.r + off, y1 = P.y + P.r, x2 = fxLerp(x1, P.x + P.r + off, t), y2 = fxLerp(y1, P.y - P.r, t);
    if (g.pixel) { c.fillStyle = o.col || "#ffffff"; c.globalAlpha = a; const st = Math.ceil(Math.hypot(x2 - x1, y2 - y1)/1.5); for (let k = 0; k <= st; k++) c.fillRect(Math.round(fxLerp(x1, x2, k/st)), Math.round(fxLerp(y1, y2, k/st)), 2, 2); c.globalAlpha = 1; }
    else { c.save(); c.globalAlpha = a; c.strokeStyle = o.col || "#ffffff"; c.lineCap = "round"; c.lineWidth = g.U*.8; c.shadowColor = g.pal[0]; c.shadowBlur = g.U*3; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.restore(); } } },
  rings(g, u, o){ const from = g[o.from || "A"], to = g[o.to || "T"]; for (let i = 0; i < 4; i++) { const t = Math.max(0, Math.min(1, u*1.4 - i*.12)); if (t <= 0 || t >= 1) continue; const x = fxLerp(from.x, to.x, t), y = fxLerp(from.y, to.y, t), r = g.U*(1.5 + t*4);
    if (g.pixel) { const c = g.c; c.globalAlpha = 1 - t; c.fillStyle = g.pal[i % 2]; for (let a = -1.1; a <= 1.1; a += .25) c.fillRect(Math.round(x + Math.cos(a)*r*(to.x > from.x ? 1 : -1)), Math.round(y + Math.sin(a)*r), 2, 2); c.globalAlpha = 1; }
    else { const c = g.c, a0 = to.x > from.x ? -1.1 : Math.PI - 1.1; c.save(); c.globalAlpha = 1 - t; c.lineCap = "round"; c.strokeStyle = "rgba(20,24,40,.35)"; c.lineWidth = g.U*1.4; c.beginPath(); c.arc(x, y, r, a0, a0 + 2.2); c.stroke(); c.strokeStyle = g.pal[i % 2]; c.lineWidth = g.U*.9; c.beginPath(); c.arc(x, y, r, a0, a0 + 2.2); c.stroke(); c.restore(); } } },
  gust(g, u, o){ for (let i = 0; i < 9; i++) { const t = Math.max(0, Math.min(1, u*1.3 - i*.04)), sw = Math.sin(t*12 + i)*g.T.r*.4; fxDot(g, "gust", fxLerp(g.A.x, g.T.x, t) + sw, fxLerp(g.A.y, g.T.y, t) + Math.cos(t*12 + i)*g.T.r*.3, g.U*(1 + fxHash(i)), g.pal[i % 3], t < 1 ? .9 : 0, t*10 + i); } },
  spin(g, u, o){ const P = g[o.at || "A"]; for (let i = 0; i < 8; i++) { const a = i/8*6.28 + u*10; fxDot(g, o.sh || "sparkle", P.x + Math.cos(a)*P.r*1.1, P.y + Math.sin(a)*P.r*.45, g.U*1.1, g.pal[i % 3], Math.sin(u*Math.PI), a); } },
  flash(g, u, o){ const c = g.c; c.globalAlpha = Math.sin(u*Math.PI)*(o.a || .45); c.fillStyle = o.col || g.pal[2]; c.fillRect(0, 0, g.W, g.H); c.globalAlpha = 1; },
  explode(g, u, o){ const P = g[o.at || "A"]; fxGlow(g, P.x, P.y, P.r*(.4 + u*2.2), "#fff3b0", 1 - u); FXP.impact(g, u, {at:o.at || "A", n:18, size:2, sh:"flame"}); g.shake = Math.max(g.shake, (1 - u)*g.U*3); },
  orb(g, u, o){ const t = Math.max(0, (u - .3)/.7), grow = Math.min(1, u/.3), x = fxLerp(g.A.x, g.T.x, fxEase(t)), y = fxLerp(g.A.y, g.T.y, fxEase(t)), r = g.U*(1.6 + grow*2.2)*(o.big || 1);
    fxGlow(g, x, y, r*2.2, g.pal[0], .9); fxDot(g, "dot", x, y, r, g.pal[1], 1); fxDot(g, "dot", x - r*.3, y - r*.3, r*.35, g.pal[2], .9); if (t > .95) FXP.impact(g, (t - .95)*20, {n:10}); },
  rise(g, u, o){ const P = g.T, col = o.col || g.pal[0]; for (let i = 0; i < 10; i++) { const x = P.x + (fxHash(i) - .5)*P.r*2, t = Math.min(1, u*1.6 - fxHash(i + 1)*.4); if (t <= 0) continue; const y = P.y + P.r - t*P.r*2.4; fxDot(g, o.sh || g.sh, x, y, g.U*1.4, i % 2 ? col : g.pal[2], 1 - t, Math.PI*1.5); } fxGlow(g, P.x, P.y + P.r*.8, P.r*1.2*u, col, (1 - u)*.8); },
  multi(g, u, o){ const n = o.n || 3, k = Math.min(n - 1, Math.floor(u*n)), t = u*n - k, P = g.T, dx = (fxHash(k) - .5)*P.r, dy = (fxHash(k + 4) - .5)*P.r*.8; FXP.impact({...g, T:{x:P.x + dx, y:P.y + dy, r:P.r*.8}}, t, {n:8, size:.9, sh:"star"}); fxGlow(g, P.x + dx, P.y + dy, P.r*.6, "#ffffff", 1 - t); },
};
function fxArrow(g, x, y, dir, col, a){
  const c = g.c, s = g.U*1.1; c.globalAlpha = Math.max(0, a); c.fillStyle = col;
  if (g.pixel) { const z = Math.max(1, Math.round(s/2)); for (let j = 0; j < 3; j++) c.fillRect(Math.round(x - (j + 1)*z), Math.round(y + dir*j*z), (j + 1)*z*2, z); c.fillRect(Math.round(x - z/2), Math.round(y + dir*3*z), z, z*3*dir || z); }
  else { c.beginPath(); c.moveTo(x, y - dir*s*1.4); c.lineTo(x + s, y); c.lineTo(x + s*.35, y); c.lineTo(x + s*.35, y + dir*s*1.3); c.lineTo(x - s*.35, y + dir*s*1.3); c.lineTo(x - s*.35, y); c.lineTo(x - s, y); c.closePath(); c.fill(); }
  c.globalAlpha = 1;
}
// ---- recipes ----
// signature moves (a few dozen of the best known); the rest are built from data in moveRecipe()
const SIG_FX = {
  "Hyper Beam":[["charge", 0, .3, {n:12}], ["beam", .25, 1, {w:3.6}], ["impact", .6, 1, {n:14, size:1.4}], ["shake", .6, 1]],
  "Giga Impact":[["charge", 0, .3], ["impact", .3, 1, {n:16, size:1.6}], ["shake", .35, 1]],
  "Solar Beam":[["charge", 0, .4, {n:14}], ["beam", .35, 1, {w:3.2}], ["impact", .7, 1, {n:10}]],
  "Solar Blade":[["charge", 0, .35], ["slashes", .35, .85, {n:1}], ["impact", .6, 1]],
  "Earthquake":[["quake", 0, 1, {amp:3}], ["shake", 0, 1]], "Magnitude":[["quake", 0, 1, {amp:2}], ["shake", 0, 1]], "Fissure":[["quake", 0, 1, {amp:4}], ["shake", 0, 1]],
  "Surf":[["wave", 0, 1]], "Muddy Water":[["wave", 0, 1]], "Hydro Pump":[["beam", 0, .85, {w:3.4}], ["impact", .55, 1, {n:12}]], "Water Spout":[["rain", 0, 1, {n:16}]],
  "Thunder":[["flash", .2, .5, {col:"#fffbe0", a:.6}], ["rain", 0, .8, {n:5, big:3}], ["impact", .5, 1, {n:12}]], "Thunderbolt":[["beam", 0, .7, {w:1.6}], ["impact", .45, 1, {n:10}]],
  "Thunder Wave":[["rings", 0, .6], ["cloud", .45, 1, {col:"#ffd51a", sh:"bolt"}]],
  "Blizzard":[["flash", 0, .4, {col:"#ffffff", a:.4}], ["rain", 0, 1, {n:20}], ["impact", .6, 1]], "Ice Beam":[["beam", 0, .8, {w:2}], ["impact", .5, 1, {n:10, sh:"shard"}]],
  "Fire Blast":[["projectile", 0, .6, {big:2}], ["impact", .55, 1, {n:16, size:1.5, sh:"flame"}]], "Flamethrower":[["beam", 0, .85, {w:2.2, sh:"flame"}], ["impact", .55, 1, {n:10}]],
  "Overheat":[["charge", 0, .3], ["beam", .25, 1, {w:3.4}], ["impact", .6, 1, {n:16}]], "Eruption":[["rain", 0, 1, {n:16, big:2}], ["shake", .3, 1]],
  "Psychic":[["rings", 0, .5, {from:"T", to:"T"}], ["flash", .2, .8, {col:"#ff9fcc", a:.4}], ["impact", .4, 1, {n:10, sh:"ring"}], ["shake", .4, .8]],
  "Psybeam":[["beam", 0, .8, {w:1.6, sh:"ring"}], ["impact", .5, 1]], "Confusion":[["rings", 0, .6, {from:"T", to:"T"}], ["impact", .4, 1, {sh:"ring"}]],
  "Shadow Ball":[["orb", 0, 1, {big:1.3}]], "Energy Ball":[["orb", 0, 1]], "Focus Blast":[["orb", 0, 1, {big:1.4}]], "Aura Sphere":[["orb", 0, 1]], "Moonblast":[["orb", 0, 1, {big:1.3}]],
  "Sludge Bomb":[["projectile", 0, .7, {n:3, big:1.4}], ["impact", .6, 1, {sh:"bubble"}]], "Sludge Wave":[["wave", 0, 1]],
  "Draco Meteor":[["rain", 0, 1, {n:8, big:2.4}], ["shake", .4, 1]], "Outrage":[["aura", 0, .4, {col:"#ff6a6a"}], ["multi", .3, 1, {n:3}], ["shake", .3, 1]],
  "Dragon Pulse":[["beam", 0, .8, {w:2}], ["rings", .2, .8]], "Dark Pulse":[["rings", 0, .8], ["impact", .5, 1]], "Water Pulse":[["rings", 0, .8], ["impact", .5, 1, {sh:"bubble"}]],
  "Rock Slide":[["rain", 0, 1, {n:10, big:2.2, sh:"rock"}], ["shake", .5, 1]], "Stone Edge":[["rise", 0, .8, {sh:"shard"}], ["impact", .5, 1]],
  "Hurricane":[["gust", 0, 1], ["spin", .3, 1, {at:"T", sh:"gust"}]], "Air Slash":[["slashes", 0, .8, {n:2, col:"#e6f0ff"}]], "Brave Bird":[["charge", 0, .3, {col:"#ffa62e"}], ["impact", .3, 1, {n:14, size:1.4}], ["shake", .35, .9]],
  "Close Combat":[["multi", 0, 1, {n:4}], ["shake", 0, 1]], "Explosion":[["explode", 0, 1, {at:"A"}], ["flash", 0, .6, {col:"#fff6c0", a:.7}], ["impact", .3, 1, {n:18, size:1.8}]], "Self-Destruct":[["explode", 0, 1, {at:"A"}], ["impact", .3, 1, {n:14}]],
  "Protect":[["shield", 0, 1]], "Detect":[["shield", 0, 1, {col:"#ffe066"}]], "King's Shield":[["shield", 0, 1, {col:"#c0c8d8"}]], "Spiky Shield":[["shield", 0, 1, {col:"#7ad04a"}]], "Baneful Bunker":[["shield", 0, 1, {col:"#b04fd6"}]],
  "Recover":[["heal", 0, 1]], "Roost":[["heal", 0, 1, {col:"#e6f0ff"}]], "Synthesis":[["heal", 0, 1]], "Moonlight":[["heal", 0, 1, {col:"#ffd1f0"}]], "Morning Sun":[["heal", 0, 1, {col:"#ffe066"}]], "Slack Off":[["heal", 0, 1]], "Soft-Boiled":[["heal", 0, 1, {col:"#ffd1f0"}]], "Rest":[["heal", 0, 1, {col:"#9aa6ff"}]],
  "Swords Dance":[["spin", 0, 1, {sh:"slash"}], ["aura", .3, 1, {arrows:true, col:"#ff5a3c"}]], "Dragon Dance":[["spin", 0, 1, {sh:"flame"}], ["aura", .3, 1, {arrows:true, col:"#ff5a3c"}]],
  "Calm Mind":[["aura", 0, 1, {col:"#ff9fcc", arrows:true}]], "Nasty Plot":[["aura", 0, 1, {col:"#5f4f72", arrows:true}]], "Quiver Dance":[["spin", 0, 1], ["aura", .3, 1, {arrows:true, col:"#ff5a3c"}]], "Shell Smash":[["impact", 0, .5, {at:"A", n:10}], ["aura", .3, 1, {arrows:true, col:"#ff5a3c"}]],
  "Toxic":[["projectile", 0, .5, {sh:"bubble"}], ["cloud", .4, 1, {col:"#8a2fb0", sh:"bubble"}]], "Will-O-Wisp":[["projectile", 0, .7, {n:3, sh:"wisp", arc:.4}], ["cloud", .6, 1, {col:"#7a5cff"}]],
  "Spore":[["cloud", 0, 1, {col:"#c9a25a"}]], "Sleep Powder":[["cloud", 0, 1, {col:"#9aa6ff"}]], "Stun Spore":[["cloud", 0, 1, {col:"#ffd51a"}]], "Hypnosis":[["rings", 0, .7], ["cloud", .5, 1, {col:"#9aa6ff"}]],
  "Stealth Rock":[["hazard", 0, 1, {sh:"rock"}]], "Spikes":[["hazard", 0, 1, {sh:"shard"}]], "Toxic Spikes":[["hazard", 0, 1, {sh:"bubble"}]], "Sticky Web":[["hazard", 0, 1, {sh:"ring"}]],
  "U-turn":[["impact", .2, .7, {n:8}], ["projectile", .5, 1, {arc:.3}]], "Volt Switch":[["projectile", 0, .6, {sh:"bolt"}], ["impact", .5, 1]],
  "Dazzling Gleam":[["flash", 0, .6, {col:"#ffd1f0", a:.6}], ["impact", .3, 1, {n:14, sh:"sparkle"}]], "Play Rough":[["multi", 0, 1, {n:4}], ["spin", 0, 1, {at:"T", sh:"heart"}]],
  "Earth Power":[["rise", 0, 1, {sh:"rock"}], ["shake", .3, .9]], "Leaf Storm":[["gust", 0, 1], ["impact", .6, 1, {sh:"leaf", n:14}]], "Petal Dance":[["spin", 0, .5, {sh:"leaf"}], ["gust", .3, 1]],
  "Giga Drain":[["impact", 0, .4, {n:8}], ["drain", .2, 1]], "Drain Punch":[["fist", 0, .6], ["drain", .4, 1]], "Leech Life":[["fangs", 0, .6], ["drain", .4, 1]],
  "Splash":[["spin", 0, 1, {sh:"bubble"}]], "Struggle":[["impact", 0, 1, {n:6}]], "Transform":[["flash", 0, 1, {col:"#e0b0ff", a:.5}], ["spin", 0, 1]],
};
// a move's recipe: signature, then flags, then category, target and effects
function moveRecipe(mv){
  if (!mv) return [["impact", 0, 1, {n:8}]];
  const nm = mv[0], cat = mv[2], f = mv[7] || "", fx = mv[8] || {}, pow = mv[3] || 0, has = ch => f.includes(ch);
  if (SIG_FX[nm]) return SIG_FX[nm];
  const big = pow >= 110, shake = big ? [["shake", .55, 1]] : [];
  if (cat === "X") {
    if (fx.w) return [["weather", 0, 1, {w:fx.w}]];
    if (fx.ter) return [["flash", 0, .7, {col:{electric:"#ffd51a", grassy:"#6fd06a", misty:"#ffc6ea", psychic:"#c88cff"}[fx.ter], a:.4}], ["spin", 0, 1, {at:"A"}]];
    if (fx.sc && /spikes|rock|web/.test(fx.sc)) return [["hazard", 0, 1]];
    if (fx.sc) return [["screen", 0, 1, {col:{reflect:"#ffb06a", lightscreen:"#ffe066", auroraveil:"#9fe8ff", safeguard:"#c0b0ff", mist:"#dfefff", tailwind:"#cfe2ff"}[fx.sc]}], ...(fx.sc === "tailwind" ? [["gust", 0, 1]] : [])];
    if (fx.stall || /protect|shield|bunker|obstruct|silktrap|endure/.test(fx.v || "")) return [["shield", 0, 1]];
    if (has("h") || fx.h) return [["heal", 0, 1]];
    if (fx.v === "substitute") return [["flash", 0, .5, {col:"#ffffff", a:.4}], ["spin", 0, 1, {sh:"sparkle"}]];
    if (fx.v === "leechseed") return [["projectile", 0, .6, {n:3, sh:"leaf"}], ["drain", .5, 1]];
    if (fx.v === "confusion" || fx.v === "attract") return [["rings", 0, .6], ["spin", .4, 1, {at:"T", sh:fx.v === "attract" ? "heart" : "star"}]];
    if (fx.st) { const col = ST_COL[fx.st] || "#ffffff"; return has("w") ? [["cloud", 0, 1, {col}]] : [["projectile", 0, .5, {sh:g0(mv)}], ["cloud", .4, 1, {col}]]; }
    if (fx.b) { const self = fx.t === "self" || fx.t === "allySide" || fx.t === "adjacentAllyOrSelf", down = Object.values(fx.b).some(v => v < 0);
      if (self) return [...(has("d") ? [["spin", 0, 1]] : []), ["aura", has("d") ? .3 : 0, 1, {arrows:true, down, col:down ? "#4f7cff" : "#ff5a3c"}]];
      return [["rings", 0, .45], ["arrows", .3, 1, {down}]]; }
    if (has("o")) return [["rings", 0, 1]];
    if (has("w")) return [["cloud", 0, 1]];
    if (fx.t === "self" || fx.t === "allySide") return [["aura", 0, 1]];
    return [["rings", 0, .5], ["spin", .4, 1, {at:"T"}]];
  }
  // damaging moves
  if (fx.sd) return [["explode", 0, 1, {at:"A"}], ["impact", .3, 1, {n:16}], ["shake", 0, 1]];
  if (fx.d) return [["impact", 0, .5, {n:8}], ["drain", .25, 1]];
  if (fx.ohko) return [["flash", 0, .5, {a:.6}], ["impact", .2, 1, {n:16, size:2}], ["shake", .2, 1]];
  if (fl(mv, "2")) return [["charge", 0, .45, {n:12}], ["beam", .4, 1, {w:2.8}], ["impact", .7, 1]];
  if (has("p")) return [["fist", 0, 1], ...shake];
  if (has("b")) return [["fangs", 0, 1, {}], ...shake];
  if (has("s")) return [["slashes", 0, .9, {n:mv[1] === "Normal" ? 3 : 2}], ["impact", .4, 1, {n:6}], ...shake];
  if (has("o")) return [["rings", 0, .9], ["impact", .55, 1, {n:6}], ...shake];
  if (has("w")) return [["cloud", 0, 1]];
  if (has("l")) return [["projectile", 0, .7, {big:1.3, sh:"dot"}], ["impact", .6, 1, {n:10}], ...shake];
  if (has("u")) return [["beam", 0, .7, {w:1.4}], ["rings", 0, .8], ["impact", .5, 1]];
  if (has("i")) return [["gust", 0, 1], ["impact", .6, 1, {n:8}]];
  if (fx.mh) return [["multi", 0, 1, {n:3}]];
  const spread = /all/i.test(fx.t || "");
  if (cat === "P") {
    if (has("c")) return [["impact", .3, 1, {n:big ? 16 : 10, size:big ? 1.4 : 1}], ...shake];
    if (mv[1] === "Ground") return [["quake", 0, 1, {amp:big ? 3 : 2}], ["shake", 0, 1]];
    if (spread || mv[1] === "Rock") return [["rain", 0, 1, {n:10, big:1.8}], ...shake];
    return [["projectile", 0, .65, {n:pow >= 80 ? 1 : 3}], ["impact", .6, 1], ...shake];
  }
  if (spread) return mv[1] === "Ground" ? [["quake", 0, 1, {amp:2}], ["shake", 0, 1]] : mv[1] === "Water" || mv[1] === "Poison" ? [["wave", 0, 1]] : [["flash", 0, .5, {a:.35, col:TYPE_FX[mv[1]] ? TYPE_FX[mv[1]].c[1] : "#fff"}], ["rain", 0, 1, {n:14}]];
  if (pow >= 90) return [["charge", 0, .25], ["beam", .2, 1, {w:big ? 3 : 2.2}], ["impact", .6, 1, {n:12}], ...shake];
  return [["projectile", 0, .65, {n:pow >= 60 ? 1 : 3}], ["impact", .6, 1]];
}
const g0 = mv => (TYPE_FX[mv[1]] || TYPE_FX.Normal).p;
// play a move's animation over the battlefield; resolves when it's done. o.miss: the move missed or failed (no impact)
function playMoveFx(mv, from, to, o = {}){
  const field = $("scBody") && $("scBody").querySelector(".bt-field"), cv = field && field.querySelector(".bt-fx");
  if (!cv || F.fast || !mv) return Promise.resolve();
  const reduced = state.ui.motion === "reduced", pixel = state.mode === "2d";
  const FR = field.getBoundingClientRect(); if (FR.width < 10) return Promise.resolve();
  const k = pixel ? Math.max(2, Math.round(FR.width/320)) : 1/Math.min(2, devicePixelRatio || 1);   // 2D: about 320 canvas pixels across
  cv.width = Math.round(FR.width/k); cv.height = Math.round(FR.height/k);
  const at = side => { const m = sideEl(side).mon, img = m && m.querySelector("img"), r = (img && img.getBoundingClientRect().width > 4 ? img : m).getBoundingClientRect();
    return {x:(r.left + r.width/2 - FR.left)/k, y:(r.top + r.height*.55 - FR.top)/k, r:Math.max(12, Math.min(r.width, r.height)*.42)/k}; };
  const T0 = TYPE_FX[o.type || mv[1]] || TYPE_FX.Normal;
  const g = {c:cv.getContext("2d"), A:at(from), T:at(to), pal:T0.c, sh:T0.p, pixel, W:cv.width, H:cv.height, U:Math.max(2, cv.width/160), shake:0};
  let steps = moveRecipe(mv);
  if (o.miss) steps = steps.filter(s => !["impact", "shake", "multi", "fist", "fangs", "rise", "quake", "flash"].includes(s[0])).map(s => [s[0], s[1], Math.min(s[2], .7), s[3]]);
  if (reduced) steps = [["flash", 0, 1, {a:.25, col:T0.c[1]}]];
  const dur = (reduced ? 300 : 950)*(state.ui.bspeed === "fast" ? .55 : 1)/(F.speed || 1);
  g.c.imageSmoothingEnabled = !pixel;
  return new Promise(res => {
    const t0 = performance.now(), tok = F.tok;
    const frame = now => {
      const u = Math.min(1, (now - t0)/dur);
      g.c.clearRect(0, 0, g.W, g.H); g.shake = 0;
      for (const [p, a, b, op] of steps) { if (u < a || u > b) continue; const lu = (u - a)/Math.max(.001, b - a);
        if (p === "shake") { g.shake = Math.max(g.shake, (1 - lu)*g.U*2.2); continue; }
        try { FXP[p](g, lu, op || {}); } catch(e) { /* a broken step never stops the battle */ } }
      field.style.transform = g.shake > 0 && !reduced ? `translate(${Math.round((fxHash(now) - .5)*g.shake*k)}px, ${Math.round((fxHash(now + 1) - .5)*g.shake*k)}px)` : "";
      if (u < 1 && tok === F.tok && cv.isConnected && !F.fast) requestAnimationFrame(frame);
      else { g.c.clearRect(0, 0, g.W, g.H); field.style.transform = ""; res(); }
    };
    requestAnimationFrame(frame);
  });
}

