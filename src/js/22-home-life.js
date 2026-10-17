// ================= HOME LIFE =================
const RIBBON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 13l-3 9 4-2 2 3 2-8z" fill="#e2413b"/><path d="M16 13l3 9-4-2-2 3-2-8z" fill="#c22f2a"/><circle cx="12" cy="9" r="6.5" fill="#ffd43b" stroke="#b8860b" stroke-width="1.5"/><path d="M12 5.8l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z" fill="#fff"/></svg>';
function drawRibbon(c, x, y, s){   // a friendship ribbon on a canvas (trainer card)
  c.save(); c.translate(x, y); c.scale(s/24, s/24);
  c.fillStyle = "#e2413b"; c.beginPath(); c.moveTo(8, 13); c.lineTo(5, 22); c.lineTo(9, 20); c.lineTo(11, 23); c.lineTo(13, 15); c.fill();
  c.fillStyle = "#c22f2a"; c.beginPath(); c.moveTo(16, 13); c.lineTo(19, 22); c.lineTo(15, 20); c.lineTo(13, 23); c.lineTo(11, 15); c.fill();
  c.fillStyle = "#ffd43b"; c.strokeStyle = "#b8860b"; c.lineWidth = 1.5; c.beginPath(); c.arc(12, 9, 6.5, 0, 7); c.fill(); c.stroke(); c.restore();
}
// Pokémon use furniture (spots), follow type preferences and the clock (nap at night, nocturnal Pokémon wake up),
// meet up to play, follow you once they like you, eat berries and leave gifts. Plus daily weather, seasonal events,
// photo mode, phone controls and decorating helpers (drag, undo, rotate). State that must survive lives in
// state.games.home (bag, trees, feed, gifts, giftDay, fedN, photos); everything else is per visit in HS.
const FAMILY = /*FAMILIES*/;
const famOf = n => FAMILY[baseOf(n)] || baseOf(n);
const NOCTURNAL = new Set([41, 42, 169, 92, 93, 94, 163, 164, 197, 198, 430, 200, 429, 302, 353, 354, 355, 356, 477, 491, 714, 715, 527, 528]);
// sizes (PokéAPI height/weight): big ones (2 m+ or 250 kg+) don't squeeze onto chairs; tiny ones (40 cm and 15 kg or less) nap on cushions and shelves
const BIG = new Set([3,23,24,76,95,103,115,130,131,143,146,148,149,150,160,199,208,226,244,245,248,249,250,289,297,306,320,321,330,336,350,357,362,376,381,382,383,384,389,450,460,464,465,472,473,476,477,483,484,485,486,487,493,497,526,545,593,604,614,623,638,639,640,643,644,646,675,697,699,706,713,716,717,718,750,760,766,768,770,773,776,780,781,790,791,792,794,796,797,799,800,804,805,809,812,823,839,843,844,851,858,870,874,879,881,882,883,887,888,889,890,895,896,897,901,902,904,911,934,968,972,975,976,977,981,982,983,984,988,989,992,995,998,1003,1005,1007,1008,1009,1018,1020,1021]);
const TINY = new Set([10,13,16,19,21,25,29,46,50,52,81,90,98,102,104,116,132,133,138,151,172,173,174,175,177,182,183,187,191,194,220,238,255,258,265,276,280,285,298,311,312,315,316,333,339,351,385,387,393,396,401,406,412,415,417,420,422,425,427,433,456,479,480,481,482,489,490,492,494,506,509,519,527,529,540,543,546,557,572,574,577,582,587,590,595,602,607,616,650,653,656,659,661,664,665,669,670,677,682,684,686,702,703,704,707,708,710,722,725,728,731,734,736,742,743,746,747,751,753,755,761,764,771,777,778,789,798,808,810,813,816,819,821,824,829,833,835,837,840,841,842,848,854,855,856,859,868,869,871,872,877,906,909,917,919,921,922,924,925,926,928,938,940,944,951,953,954,955,957,978,999,1004,1011,1012,1013,1024,1025]);
// Pokémon that live in water and can't walk on land: with a pond they never leave it
const FISH = new Set([72,73,90,91,116,117,118,119,120,121,129,130,131,170,171,211,222,223,224,226,230,318,319,320,321,339,340,349,350,366,367,368,369,370,382,456,457,458,489,490,550,592,593,594,746,779,781,846,847,963,964,976,977,978]);
const monSize = n => BIG.has(baseOf(n)) ? "big" : TINY.has(baseOf(n)) ? "tiny" : "mid";
const isFish = n => FISH.has(baseOf(n));
const isFlier = m => m.fl || NAT_BY.get(m.n).types.includes("Flying");
const isNocturnal = n => NOCTURNAL.has(baseOf(n)) || NAT_BY.get(n).types.some(t => t === "Ghost" || t === "Dark");
// where Pokémon can use furniture: on it (nap/sit/bounce, with a lift z in tiles) or in front of it
const SPOT_OF = {
  bed:{act:"nap", pts:[[.65, 1.5], [1.35, 1.7]], z:.55}, bean:{act:"nap", pts:[[.5, .55]], z:.32}, cushion:{act:"nap", pts:[[.5, .55]], z:.2}, pillowpile:{act:"nap", pts:[[.5, .55]], z:.35},
  hammock:{act:"nap", pts:[[1.5, .5]], z:.42},
  sofa:{act:"sit", pts:"row", z:.42}, chair:{act:"sit", pts:[[.5, .62]], z:.42}, bench:{act:"sit", pts:"row", z:.48},
  tv:{act:"watch", front:true}, arcade:{act:"watch", front:true}, desk:{act:"watch", front:true}, piano:{act:"watch", front:true},
  fire:{act:"warm", front:true}, stove:{act:"warm", front:true}, fridge:{act:"sniff", front:true}, counter:{act:"sniff", front:true}, tramp:{act:"bounce", pts:[[1, 1]], z:.45},
  fountain:{act:"splash", front:true}, tank:{act:"splash", front:true}, shellfountain:{act:"splash", front:true},
  plant:{act:"sniff", front:true}, flowers:{act:"sniff", front:true}, tree:{act:"sniff", front:true}, palm:{act:"sniff", front:true}, flowerarch:{act:"sniff", front:true},
  arch:{act:"sniff", front:true}, pot2:{act:"sniff", front:true}, terrarium:{act:"sniff", front:true}, cauldron:{act:"sniff", front:true},
  bag:{act:"train", front:true}, snowman:{act:"chill", front:true}, tub:{act:"warm", front:true},
  orb:{act:"watch", front:true}, globe:{act:"watch", front:true}, lamp2:{act:"watch", front:true}, windvane:{act:"watch", front:true}, clock:{act:"watch", front:true},
  display:{act:"admire", front:true}, totem:{act:"admire", front:true}, statue:{act:"admire", front:true}, badgecase:{act:"admire", front:true}, trophy:{act:"admire", front:true},
};
// tall furniture a flier can perch on (and a tiny Pokémon can nap on top of a shelf)
const PERCH = new Set(["shelf", "statue", "clock", "fridge", "totem", "piano", "arcade", "tree", "palm", "windvane", "display", "badgecase", "lamp2"]);
function perchZ(p){   // the height of the top of a piece of furniture, in tiles
  const img = state.mode === "2d" && artOf(furnArtKey(p.it));
  const h = img ? img.height*Math.min(1, p.it.w*32/img.width)/32 : (FURN_H[p.it.kind] || 1.5);
  return h*(p.it.kind === "tree" || p.it.kind === "palm" ? .78 : .93);
}
const ACT_EMO = {nap:"zz", sit:"note", watch:"star", warm:"heart", bounce:"note", splash:"drop", sniff:"heart", lurk:"dots", play:"note", perch:"note", sun:"heart", eat:"heart", train:"bang", chill:"heart", admire:"star"};
function homeSpots(){
  const out = [];
  for (const p of placedItems()) {
    const S = SPOT_OF[p.it.kind]; if (!S) continue;
    const pts = S.front ? [[p.it.w/2, p.it.d + .55]] : S.pts === "row" ? Array.from({length:p.it.w}, (_, i) => [i + .5, .6]) : S.pts;
    pts.forEach(([dx, dy], i) => {
      const s = {key:`${p.id}@${p.x},${p.y}#${i}`, act:S.act, kind:p.it.kind, x:p.x + (p.f && !S.front ? p.it.w - dx : dx), y:p.y + dy, z:S.front ? 0 : S.z, on:!S.front, depth:p.y + p.it.d + .02, ax:p.x + (p.f && !S.front ? p.it.w - dx : dx), ay:p.y + p.it.d + .45};
      if (S.front && blocked(s.x, s.y)) return;
      if (s.on && blocked(s.ax, s.ay)) { s.ay = Math.min(HM.D - .3, s.ay + .5); if (blocked(s.ax, s.ay)) return; }
      out.push(s);
    });
  }
  for (const p of placedItems()) if (PERCH.has(p.it.kind)) {   // on top of tall furniture
    const x = p.x + p.it.w/2, ay = Math.min(HM.D - .3, p.y + p.it.d + .5), z = perchZ(p);
    if (HM.WALL + (p.y + p.it.d)*HM.SQ - z < 1.3) continue;   // too tall against the back wall: a bird up there would be out of view
    if (!blocked(x, ay)) out.push({key:`${p.id}@${p.x},${p.y}#perch`, act:"perch", kind:p.it.kind, x, y:p.y + p.it.d, z, on:true, depth:p.y + p.it.d + .03, ax:x, ay});
  }
  const tod = clockTod();
  if (tod === "night") for (const r of HS.rooms) if (r.wall) for (const x of [r.x0 + .9, r.x0 + r.w - .9]) if (!blocked(x, .75)) out.push({key:`corner${x}`, act:"lurk", kind:"corner", x, y:.75, z:0, on:false});
  if (tod !== "night" && HS.weather !== "rain" && HS.weather !== "snow")   // sunny patches in the yards
    for (const r of HS.rooms) if (roomKind(r) === "out") for (const f of [.25, .5, .75]) { const x = r.x0 + r.w*f, y = HM.D*(f === .5 ? .82 : .6); if (!blocked(x, y)) out.push({key:`sun${r.id}${f}`, act:"sun", kind:"sun", x, y, z:0, on:false}); }
  return out;
}
// where a Pokémon would rather be: "out" in the yards, "in" the house, or "" (anywhere)
function placePref(m){
  const T = NAT_BY.get(m.n).types, has = t => T.includes(t), w = HS.weather, night = clockTod() === "night";
  if (night) return isNocturnal(m.n) ? "" : "in";
  if (w === "rain") return has("Water") || has("Grass") ? "out" : "in";
  if (w === "snow") return has("Ice") ? "out" : has("Fire") ? "in" : "";
  if (["Grass", "Bug", "Flying", "Ground", "Rock", "Water"].some(has)) return "out";
  if (["Fire", "Electric", "Psychic", "Ghost", "Steel", "Fairy"].some(has)) return "in";
  return "";
}
const isOutside = x => roomKind(roomAt(x)) === "out";
// each type's favourite things (furniture kinds, or acts like "sun" and "perch")
const TYPE_FAV = {Fire:["fire", "stove", "tub"], Water:["fountain", "tank", "shellfountain"], Grass:["sun", "plant", "flowers", "tree", "palm", "pot2", "arch"],
  Bug:["terrarium", "flowers", "plant", "tree", "pot2"], Electric:["tv", "arcade", "desk", "lamp2"], Ice:["snowman", "chill"], Fighting:["bag", "totem"],
  Psychic:["orb", "globe", "piano"], Ghost:["corner", "lamp2", "cobweb"], Dark:["corner"], Rock:["display", "totem"], Ground:["display", "totem", "sun"],
  Steel:["clock", "badgecase", "trophy"], Fairy:["cushion", "pillowpile", "bean", "arch"], Normal:["sofa", "bean", "chair", "fridge", "counter"],
  Flying:["perch", "windvane"], Dragon:["statue", "totem"], Poison:["cauldron"]};
function spotWeight(m, s, night){
  const T = NAT_BY.get(m.n).types, has = t => T.includes(t), noct = isNocturnal(m.n);
  const size = monSize(m.n), flier = isFlier(m);
  let w = 1;
  if (s.act === "nap") w = night ? (noct ? .3 : 8) : (noct ? 3 : .5);
  if (s.act === "lurk") w = noct && (has("Ghost") || has("Dark")) ? 7 : 0;
  if (s.act === "perch") w = flier ? (night ? 6 : 3) : 0;   // only fliers get up there
  if (s.act === "sun") w = has("Bug") || has("Fire") ? 1.5 : .4;   // (Grass and Ground types love it: see TYPE_FAV)
  if (T.some(t => (TYPE_FAV[t] || []).some(k => k === s.kind || k === s.act))) w *= 7;   // each type's favourite spots
  if (has("Ice") && s.act === "warm") w *= .1;   // ice types keep away from the heat
  if (has("Fire") && s.kind === "fountain") w *= .2;
  if (size === "big" && s.on && s.kind !== "bed") w = 0;   // too big for chairs, cushions and hammocks
  if (size === "tiny" && ["cushion", "bean", "pillowpile"].includes(s.kind)) w *= 3;
  if (s.act === "warm" && night) w *= 1.6;
  if (night && !noct && s.act !== "nap") w *= .35;
  const pref = placePref(m); if (pref && HS.rooms.some(r => roomKind(r) === "out") && HS.rooms.some(r => roomKind(r) !== "out")) w *= (isOutside(s.x) === (pref === "out")) ? 2.2 : .35;
  return w;
}
const pickWeighted = list => { const tot = list.reduce((a, x) => a + x.w, 0); if (tot <= 0) return null; let r = Math.random()*tot; for (const x of list) { r -= x.w; if (r <= 0) return x; } return list[list.length - 1]; };
// an idle Pokémon decides what to do next; returns true if it found something (otherwise it wanders as before)
function homeDecide(m, now){
  if (m.visitor) return false;
  if (isFish(m.n) && HS.rooms.some(r => r.pond)) return false;   // fish just swim about (see homeUpdate)
  if (m.water && HS.rooms.some(r => r.pond) && clockTod() !== "night" && Math.random() < .7) return false;   // water types mostly swim
  const tod = clockTod(), night = tod === "night", me = HS.me, f = friendOf(m.n);
  // friends who follow you (the two who like you most, from 50 friendship) mostly stay with you (see homeUpdate)
  if (f >= 50 && !VISIT && HS.followers.includes(m.n) && !(night && !isNocturnal(m.n)) && Math.hypot(me.x - m.x, me.y - m.y) < 2.5 && Math.random() < .6) { m.t = 1200 + Math.random()*1500; return true; }
  // gifts: at 60+ friendship, once a day, sometimes leave a little present
  const D = homeData(), day = todayKey();
  if (!VISIT && !night && f >= 60 && D.giftDay[m.n] !== day && D.gifts.length < 6 && Math.random() < .12) { homeGift(m, day); return true; }
  // meet up and play (same evolution family or type first)
  if (Math.random() < (night ? (isNocturnal(m.n) ? .1 : 0) : .16)) {   // at night only the night owls play
    const T = NAT_BY.get(m.n).types, others = HS.mons.filter(o => o !== m && !o.visitor && o.st === "idle" && !o.act && !(isFish(o.n) && HS.rooms.some(r => r.pond)));
    const pick = pickWeighted(others.map(o => ({o, w:(famOf(o.n) === famOf(m.n) ? 6 : 1)*(NAT_BY.get(o.n).types.some(t => T.includes(t)) ? 2.5 : 1)})));
    if (pick) {
      const o = pick.o, mid = {x:(m.x + o.x)/2, y:(m.y + o.y)/2}, a = randomSpot(m.fl, mid) || mid;
      if (!blocked(a.x + .9, a.y) && !blocked(a.x, a.y)) { homeWalk(m, a, {act:"play", with:o}); homeWalk(o, {x:a.x + .9, y:a.y}, {act:"play", with:m}); return true; }
    }
  }
  const taken = new Set(HS.mons.filter(o => o.spot).map(o => o.spot.key));
  // bedtime: most Pokémon find a bed or cushion (or curl up on the floor); nocturnal ones stay up
  if (night && !isNocturnal(m.n)) {   // bedtime: a bed, a sofa, a perch for fliers, the pond for water types; the closest free one, preferring the bedroom
    if (m.water && HS.rooms.some(r => r.pond) && Math.random() < .5) { const t = randomSpot("only"); if (t) { homeWalk(m, t, {act:"nap"}); m.swimTrip = true; return true; } }
    const size = monSize(m.n), flier = isFlier(m);
    const ok = s => !taken.has(s.key) && (s.act === "nap" || (s.act === "sit" && (s.kind === "sofa" || s.kind === "bench")) || (s.act === "perch" && (flier || (size === "tiny" && s.kind === "shelf")))) && !(size === "big" && s.on && s.kind !== "bed");
    const score = s => Math.hypot(s.ax - m.x, s.ay - m.y)*(roomAt(s.x).id === "bedroom" ? .4 : roomAt(s.x).wall ? 1 : 3);
    const beds = homeSpots().filter(ok).sort((a, b) => score(a) - score(b)), s = beds.length ? beds[Math.random() < .7 || beds.length < 2 ? 0 : 1] : null;
    if (s) { homeWalk(m, {x:s.ax, y:s.ay}, {act:"nap", spot:s}); return true; }
    const br = HS.rooms.find(r => r.id === "bedroom");   // no bed free: curl up on the bedroom floor
    if (br && roomAt(m.x) !== br) { const t = randomSpot(m.fl, {x:br.x0 + br.w/2, y:4}); if (t && roomAt(t.x) === br) { homeWalk(m, t, {act:"nap"}); return true; } }
    homeAct(m, {act:"nap"}, now); return true;
  }
  // use furniture
  if (Math.random() < (night ? .85 : .45)) {
    const c = pickWeighted(homeSpots().filter(s => !taken.has(s.key)).map(s => ({s, w:spotWeight(m, s, night)})));
    if (c) { const s = c.s; homeWalk(m, s.on ? {x:s.ax, y:s.ay} : {x:s.x, y:s.y}, {act:s.act, spot:s}); return true; }
    if (night && !isNocturnal(m.n) && Math.random() < .5) { homeAct(m, {act:"nap"}, now); return true; }   // no bed free: curl up on the floor
  }
  return false;
}
function homeWalk(m, t, plan){
  m.tx = t.x; m.ty = t.y; m.st = "walk"; m.plan = plan || null; m.spot = plan && plan.spot || null; m.swimTrip = false; m.follow = false;
  m.path = needPath(m, t) ? findPath(m, t) : null;
}
// a walk needs a planned path through a doorway, or around the pond for Pokémon that can't swim or fly
function needPath(m, t){
  if (dividers().some(d => (d.x - m.x)*(d.x - t.x) < 0)) return true;
  if (isFlier(m) || (m.water && m.swimTrip)) return false;
  for (let i = 1; i < 12; i++) { const x = m.x + (t.x - m.x)*i/12, y = m.y + (t.y - m.y)*i/12; if (inPond(roomAt(x), x, y)) return true; }
  return false;
}
// somewhere to wander: in the yards or the house, as the Pokémon (and the weather) likes
function wanderSpot(m, near){
  const pref = placePref(m), both = HS.rooms.some(r => roomKind(r) === "out") && HS.rooms.some(r => roomKind(r) !== "out");
  if (pref && both && !near && Math.random() < .75) for (let i = 0; i < 6; i++) { const t = randomSpot(isFlier(m) || m.swim); if (t && isOutside(t.x) === (pref === "out")) return t; }
  return randomSpot(isFlier(m) || m.swim, near);
}
// arrived: start the planned activity
function homeAct(m, plan, now){
  const s = plan.spot, night = clockTod() === "night";
  m.act = plan.act; m.st = "act"; m.with = plan.with || null; HS.acts = (HS.acts || 0) + 1;
  if (plan.act === "eat") { m.eatT = now + 2600; m.eatCol = plan.col; }
  m.t = plan.act === "nap" ? (night ? 25000 + Math.random()*25000 : 9000 + Math.random()*8000) : plan.act === "play" ? 4500 : plan.act === "eat" ? 2800 : 7000 + Math.random()*9000;
  if (s && s.on) { m.x = s.x; m.y = s.y; m.z = s.z; m.depth = s.depth; m.hop = 1; }
  else if (s) { m.x = s.x; m.y = s.y; }   // right on its spot
  if (s && !s.on) { const it = placedItems().find(p => s.key.startsWith(`${p.id}@${p.x},${p.y}#`)); if (it) { const cx = it.x + it.it.w/2; m.dir = Math.abs(cx - m.x) < .2 ? (m.dir || 1) : Math.sign(cx - m.x); } }   // faces what it's using
  if (s && s.on) m.dir = m.x < (HS.W/2) ? 1 : -1;   // sitting or napping: faces into the room
  if (m.with) { m.dir = m.with.x > m.x ? 1 : -1; const o = m.with; m.pc = o.pc && o.act === "play" ? o.pc : {x:(m.x + o.x)/2, y:(m.y + o.y)/2}; m.ang = Math.atan2((m.y - m.pc.y)*1.4, m.x - m.pc.x); }
  monAltSprites(m);
  m.emote = {k:ACT_EMO[m.act] || "note", t0:now, dur:1800}; m.emoT = now;
  if (m.act === "splash") Sound.play("splash");
}
function homeActEnd(m){
  const s = m.spot;
  if (s && s.on) { m.x = s.ax; m.y = s.ay; m.hop = 1; }
  m.z = 0; m.depth = null; m.act = null; m.spot = null; m.with = null; m.plan = null; m.pc = null; m.st = "idle"; m.t = 1500 + Math.random()*3000;
}
// per-frame activity upkeep (emotes, bouncing, play hops)
function homeActTick(m, now){
  if (m.st !== "act") return;
  if (m.act === "bounce" && m.hop <= 0) m.hop = 1;
  if (m.act === "play" && m.with && m.with.act === "play" && m.with.with === m && m.pc) {   // both there: chase each other round in a little circle
    m.ang += (HS.dt || .016)*2.4; const nx = m.pc.x + Math.cos(m.ang)*.6, ny = m.pc.y + Math.sin(m.ang)*.42;
    if (!blocked(nx, ny, m.fl)) { if (Math.abs(nx - m.x) > .002) m.dir = Math.sign(nx - m.x); m.x = nx; m.y = ny; }
    if (m.hop <= 0 && Math.random() < .02) m.hop = 1;
  } else if (m.act === "play" && m.hop <= 0 && Math.random() < .03) { m.hop = 1; if (m.with) m.dir = m.with.x > m.x ? 1 : -1; }
  if (now - m.emoT > (m.act === "nap" ? 2600 : 4200)) { m.emoT = now; if (m.act === "nap" || Math.random() < .5) m.emote = {k:ACT_EMO[m.act] || "note", t0:now, dur:1600}; }
  if (m.t <= 0) homeActEnd(m);
}
// ---- berries ----
const BERRIES = [{id:"cheri", name:"Cheri Berry", fl:"spicy", col:"#e2413b"}, {id:"chesto", name:"Chesto Berry", fl:"dry", col:"#6b5bd6"}, {id:"pecha", name:"Pecha Berry", fl:"sweet", col:"#f39ac7"}, {id:"rawst", name:"Rawst Berry", fl:"bitter", col:"#3fae5a"}, {id:"aspear", name:"Aspear Berry", fl:"sour", col:"#ffd43b"}];
const BERRY_BY = new Map(BERRIES.map(b => [b.id, b]));
const treeBerry = p => BERRIES[Math.abs(p.x*7 + p.y*13) % BERRIES.length];
const favBerry = n => BERRIES[(n*7 + 3) % BERRIES.length];   // each Pokémon's hidden favourite flavour
const treeKey = p => `${p.x},${p.y}`;
function treeLeft(p){ const t = homeData().trees[treeKey(p)]; return 3 - (t && t.d === todayKey() ? t.n : 0); }
const bagTotal = () => Object.values(homeData().bag).reduce((a, n) => a + n, 0);
function pickBerry(p){
  if (VISIT) { homeMsg("These berries belong to your friend."); return; }
  const D = homeData(), k = treeKey(p), day = todayKey(), left = treeLeft(p), b = treeBerry(p);
  if (left <= 0) { homeMsg("No berries left on this tree today. More will grow tomorrow!"); return; }
  if (bagTotal() >= 99) { homeMsg("Your berry pouch is full."); return; }
  D.trees[k] = {d:day, n:3 - left + 1}; D.bag[b.id] = (D.bag[b.id] | 0) + 1;
  Sound.play("pick"); homeMsg(`You picked a <b>${b.name}</b>! ${itemIcon(b.name)} <span class="meta">(${left - 1} left on this tree today)</span>`);
  fx("berry", p.x + p.it.w/2, p.y + p.it.d, 2.1, {to:{x:HS.me.x, z:1.1}, dur:650, col:b.col});   // pops off the tree into your pouch
  save(); setTimeout(() => { renderHomeBag(); const el = $("hmBag") && $("hmBag").querySelector(`[data-hold="${b.id}"]`); if (el) el.classList.add("bump"); }, 600);
}
function feedMon(m, bid){
  const D = homeData(), day = todayKey(), b = BERRY_BY.get(bid), now = performance.now();
  if (!b || !(D.bag[bid] > 0)) { HS.hold = null; renderHomeBag(); return; }
  const fd = D.feed[m.n] && D.feed[m.n].d === day ? D.feed[m.n] : (D.feed[m.n] = {d:day, n:0});
  if (fd.n >= 3) { homeMsg("Is full for today. Try again tomorrow!", {n:m.n}); return; }
  const fav = favBerry(m.n).id === bid, up = fav ? 15 : 8;
  D.bag[bid]--; if (!D.bag[bid]) { delete D.bag[bid]; HS.hold = null; }
  fd.n++; D.fedN++; D.fr[m.n] = Math.min(100, friendOf(m.n) + up); missionBump("feed");
  m.hop = 1; m.st = m.st === "act" ? m.st : "idle"; m.t = Math.max(m.t, 2000); m.dir = HS.me.x < m.x ? -1 : 1;
  m.emote = {k:fav ? "fav" : "heart", t0:now, dur:2200}; Sound.play(fav ? "up" : "heal");
  const tb = !isFish(m.n) && placedItems().filter(p => p.it.kind === "tabler" || p.it.kind === "counter").map(p => ({x:p.x + p.it.w/2, y:Math.min(HM.D - .3, p.y + p.it.d + .45)})).filter(t => !blocked(t.x, t.y)).sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y))[0];
  if (tb && Math.hypot(tb.x - m.x, tb.y - m.y) > 1 && Math.hypot(tb.x - m.x, tb.y - m.y) < 25) { if (m.st === "act") homeActEnd(m); homeWalk(m, tb, {act:"eat", col:b.col}); }   // takes it to the table to eat
  else { m.eatT = now + 1500; m.eatCol = b.col; } if (fav) burst("spark", m, 9, {sp:1.1, dur:1200, col:"#ffd43b"}); else burst("heart", m, 3);
  homeMsg(fav ? `Loved the <b>${b.name}</b>! It’s its favourite flavour.` : `Ate the <b>${b.name}</b>. Yum!`, {n:m.n, f:friendOf(m.n), f0:friendOf(m.n) - up});
  save(); renderResidents(); renderHomeBag(); checkAch();
}
function renderHomeBag(){
  const el = $("hmBag"); if (!el) return; const D = homeData(), n = bagTotal();
  el.innerHTML = n ? BERRIES.filter(b => D.bag[b.id] > 0).map(b => `<button type="button" class="hm-berry" data-hold="${b.id}" aria-pressed="${HS.hold === b.id}" title="${HS.hold === b.id ? "Put away" : "Hold to feed a Pokémon"}">${itemIcon(b.name)}<b>${D.bag[b.id]}</b></button>`).join("") + (HS.hold ? `<span class="meta hm-hold">Holding a ${esc(BERRY_BY.get(HS.hold).name)}: walk up to a Pokémon to feed it</span>` : "")
    : `<span class="meta">No berries yet${placedItems().some(p => p.it.kind === "tree") ? ": pick some from your Berry tree" : ": a Berry tree in the Shop grows 3 a day"}</span>`;
}
// ---- gifts ----
const GIFT_FURN = () => ITEMS_ALL.filter(it => it.cat === "furn" && !isExclusive(it) && !it.event && it.price && it.price <= 500);
function homeGift(m, day){
  const D = homeData(), r = Math.random(), now = performance.now();
  const g = r < .05 ? {k:"furn", v:pickOne(GIFT_FURN()).id} : r < .35 ? {k:"berry", v:pickOne(BERRIES).id} : {k:"pp", v:20 + Math.floor(Math.random()*5)*10};
  D.gifts.push({n:m.n, x:+m.x.toFixed(2), y:+m.y.toFixed(2), ...g}); D.giftDay[m.n] = day;
  m.emote = {k:"bang", t0:now, dur:1800}; m.hop = 1; m.st = "idle"; m.t = 2500; save();
}
function openGift(i){
  const D = homeData(), g = D.gifts[i]; if (!g || VISIT) return;
  D.gifts.splice(i, 1); Sound.play("pick");
  fx("lid", g.x, g.y, .45, {vx:(Math.random() < .5 ? -1 : 1)*.9, vz:2.2, g:5, dur:800});   // the unwrap: the lid flies off, confetti
  for (let k = 0; k < 14; k++) fx("confetti", g.x, g.y, .4, {sp:1.4, dur:1100, g:3.2, col:["#e2413b", "#ffd43b", "#3fae5a", "#3a8fd6", "#e27ab8"][k % 5]});
  if (g.k === "pp") { earn(g.v, `A gift from ${nickFor(g.n)}`); homeMsg(`Left you a gift: <b>${g.v} PokéPoints</b>!`, {n:g.n}); }
  else if (g.k === "berry") { const b = BERRY_BY.get(g.v); D.bag[g.v] = Math.min(99, (D.bag[g.v] | 0) + 1); homeMsg(`Left you a gift: a <b>${b.name}</b>! ${itemIcon(b.name)}`, {n:g.n}); renderHomeBag(); }
  else { const it = unlockOf("furn", g.v); if (it) { grant(it); homeMsg(`Left you a gift: a <b>${esc(it.name)}</b>! Find it in Decorate.`, {n:g.n}); Sound.play("up"); } }
  save();
}
function drawGift(c, g, now, pixel){
  const ts = HS.ts, X = scrX(g.x), Y = scrY(g.y), s = ts*.32, b = Math.abs(Math.sin(now/500 + g.x))*ts*.05, R = v => pixel ? Math.round(v) : v;
  const wob = Math.max(0, Math.sin(now/260 + g.x*3)) * (Math.sin(now/1700 + g.y) > .55 ? .16 : 0);   // a wobble every few seconds
  if (Math.random() < .02) fx("spark", g.x + (Math.random() - .5)*.5, g.y, .4 + Math.random()*.5, {vx:0, vz:.15, g:0, dur:700, col:"#fff6c4"});
  c.save(); c.translate(R(X), R(Y)); c.rotate(wob*Math.sin(now/60)); c.translate(-R(X), -R(Y));
  softShadow(c, X, Y, s*.7*(1 - b/ts), s*.22, .3, pixel);
  c.fillStyle = "#e2413b"; c.fillRect(R(X - s/2), R(Y - s - b), R(s), R(s)); c.fillStyle = "#ffd43b"; c.fillRect(R(X - s*.09), R(Y - s - b), R(s*.18), R(s)); c.fillRect(R(X - s/2), R(Y - s*.6 - b), R(s), R(s*.16));
  c.beginPath(); c.ellipse(R(X - s*.18), R(Y - s - b - s*.12), s*.2, s*.12, -.5, 0, 7); c.ellipse(R(X + s*.18), R(Y - s - b - s*.12), s*.2, s*.12, .5, 0, 7); c.fill();
  c.restore();
}
// the pickable berries on each tree
function drawTreeBerries(c, p, pixel){
  const left = treeLeft(p); if (left <= 0) return; const b = treeBerry(p), ts = HS.ts, R = v => pixel ? Math.round(v) : v;
  [[.62, 1.25, 1.35], [1.38, 1.3, 1.45], [1.0, 1.25, 1.05]].slice(0, left).forEach(([dx, dy, z]) => {
    const x = scrX(p.x + (p.f ? p.it.w - dx : dx)), y = scrY(p.y + dy) - z*ts, r = ts*.11;
    c.fillStyle = "#28323f"; c.beginPath(); c.arc(R(x), R(y), r + Math.max(1, ts*.02), 0, 7); c.fill();
    c.fillStyle = b.col; c.beginPath(); c.arc(R(x), R(y), r, 0, 7); c.fill(); c.fillStyle = "rgba(255,255,255,.7)"; c.fillRect(R(x - r*.4), R(y - r*.5), Math.max(1, R(r*.35)), Math.max(1, R(r*.35)));
  });
}
// what's in reach of the trainer: a gift, a Pokémon or a tree with berries
function nearestThing(){
  const me = HS.me, D = homeData();
  for (let i = 0; i < D.gifts.length; i++) { const g = D.gifts[i]; if (!VISIT && Math.hypot(g.x - me.x, (g.y - me.y)*1.4) < 1.2) return {k:"gift", i, x:g.x, y:g.y}; }
  const m = nearestMon(1.7); if (m) return {k:"mon", m};
  for (const p of placedItems()) if (p.it.kind === "tree" && Math.hypot(p.x + p.it.w/2 - me.x, (p.y + p.it.d + .3 - me.y)*1.4) < 1.8) return {k:"tree", p};
  for (const p of placedItems()) if (p.it.kind === "badgecase" && Math.hypot(p.x + p.it.w/2 - me.x, (p.y + p.it.d + .3 - me.y)*1.4) < 1.5) return {k:"case", p};
  return null;
}
function homeUseThing(t){
  if (!t) return;
  if (t.k === "gift") openGift(t.i);
  else if (t.k === "tree") pickBerry(t.p);
  else if (t.k === "case") openBadgeCase(t.p.it.region);
  else if (t.k === "mon") { if (HS.hold && !VISIT && !t.m.visitor) feedMon(t.m, HS.hold); else homeInteract(t.m); }
}
// a Badge Case up close: each badge large, with its Gym Leader
function openBadgeCase(g){
  const L = LEAGUES[g - 1], bits = badgeOf(g), R = GENS.find(x => x.g === g).region, st = L.badge === "stamp";
  openModal(`<h2>${esc(R)} ${st ? "stamps" : "badges"}</h2><p class="note">${VISIT ? "" : bits === 255 ? "The full set!" : `${L.gyms.filter((_, k) => bits & (1 << k)).length} of 8. Win more in the ${esc(L.label || "Gym challenge")}.`}</p>
    <div class="case-grid">${L.gyms.map(([nm], k) => { const on = bits & (1 << k), b = badgeArt(g, k);
      return `<figure class="case-b${on ? "" : " off"}">${b ? `<img src="${b.src}" alt="">` : `<span class="bdg b${k}" style="--bc:${TC[L.gyms[k][1].split("/")[0]]}"></span>`}<figcaption><b>${on ? esc(badgeName(g, k)) : "???"}</b><span>${esc(nm)}</span></figcaption></figure>`; }).join("")}</div>
    <div class="actions"><button class="btn primary" type="button" data-close>OK</button></div>`);
}
// ---- weather and seasonal events ----
// Events run every year between two dates (month, day); add more here. `furn` items are only sold while it runs.
const EVENTS = [
  {id:"halloween", name:"Halloween", from:[10, 15], to:[11, 1], night:[52, 24, 100, .3], visitors:[92, 93, 200, 353, 355, 425, 562, 592, 607, 708, 710, 778, 854, 885], furn:["pumpkin", "cobweb"]},
  {id:"winter", name:"Winter holidays", from:[12, 15], to:[1, 5], night:[30, 50, 120, .3], weather:"snow", visitors:[225, 361, 459, 582, 712, 872, 875], furn:["holtree"]},
];
function eventOn(date = new Date()){
  const md = (date.getMonth() + 1)*100 + date.getDate();
  return EVENTS.find(e => { const a = e.from[0]*100 + e.from[1], b = e.to[0]*100 + e.to[1]; return a <= b ? md >= a && md <= b : md >= a || md <= b; }) || null;
}
function weatherToday(){
  const d = new Date(), key = todayKey(), R = rng([...key].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261)), ev = eventOn(d), winter = [11, 0, 1].includes(d.getMonth());
  if (ev && ev.weather) return ev.weather;
  const r = R(); return r < .5 ? "sun" : r < .72 ? "cloud" : winter ? "snow" : "rain";
}
// screen rectangles where the outside shows: window panes, and the open sky/ground of outdoor rooms
function skyRects(pixel){
  const ts = HS.ts, out = [], wallH = HM.WALL*ts, ox = -(HS.camPx ?? Math.round(HS.cam*ts)), oy = -HS.camY;
  for (const r of HS.rooms) {
    const X0 = r.x0*ts, W = r.w*ts;
    if (!r.wall) { out.push({x:X0 + ox, y:0, w:W, h:HS.V.H, out:true}); continue; }
    const A = pixel && roomArt(r);
    for (let i = 1; i < W/ts - 1.5; i += 4.5) {
      if (A && A.win) { const k = ts/32, w = A.win.width*k, h = A.win.height*k; out.push({x:X0 + (i + 1.4)*ts - w/2 + 3*k + ox, y:wallH*.13 + 3*k + oy, w:w - 6*k, h:h - 6*k}); }
      else out.push({x:X0 + i*ts + ts*.6 + ox, y:wallH*.18 + oy, w:ts*1.6, h:wallH*.42});
    }
  }
  return out.filter(q => q.x + q.w > 0 && q.x < HS.V.W);
}
// which = "win": through the window panes; "far": a slower, dimmer layer over outdoor rooms behind everyone (plus snow
// settling on the ground); "out": the near layer over outdoor rooms, on top of everything, with rain splashing on the ground
function drawWeather(c, now, pixel, which){
  const w = HS.weather; if (w === "sun") return;
  for (const q of skyRects(pixel)) {
    if (!!q.out !== (which !== "win")) continue;
    const far = which === "far", ts = HS.ts, P = v => pixel ? Math.round(v) : v;
    c.save(); c.beginPath(); c.rect(q.x, q.y, q.w, q.h); c.clip();
    if (!far && (w === "cloud" || w === "rain")) { c.fillStyle = w === "rain" ? "rgba(60,70,90,.28)" : "rgba(120,130,150,.18)"; c.fillRect(q.x, q.y, q.w, q.h); }
    if (far && w === "snow") { const gy = scrY(0); c.fillStyle = "rgba(255,255,255,.18)"; c.fillRect(q.x, gy, q.w, q.y + q.h - gy);   // a light dusting on the ground
      c.fillStyle = "rgba(255,255,255,.5)"; for (let i = 0; i < q.w*(HM.D*HM.SQ)/(ts*.9); i++) { const sx = (i*0.6180339) % 1, sy = (i*0.7548776) % 1; c.fillRect(P(q.x + sx*q.w), P(gy + sy*(q.y + q.h - gy)), Math.max(1, ts*.05), Math.max(1, ts*.03)); } }
    const n = Math.ceil(q.w*q.h/(ts*ts)*(q.out ? (far ? .8 : 1.1) : 6)), sp = far ? .55 : 1, sz = far ? .6 : 1, al = far ? .35 : 1, seed = far ? 11.7 : 0;
    for (let i = 0; i < n; i++) {
      const sx = (i*73.13 + seed) % 1, sy = (i*37.71 + seed) % 1;
      if (w === "rain") { const y = q.y + ((sy*q.h + now*.6*sp*ts/32*6) % (q.h + ts)) - ts*.5, x = q.x + ((sx*q.w + y*.15) % q.w); c.fillStyle = `rgba(200,220,255,${(.55*al).toFixed(2)})`; c.fillRect(P(x), P(y), Math.max(1, ts*.03*sz), ts*.28*sz); }
      else if (w === "snow") { const y = q.y + ((sy*q.h + now*.05*sp*ts/32*6) % (q.h + ts)) - ts*.3, x = q.x + ((sx*q.w + Math.sin(now/900 + i)*ts*.3 + q.w) % q.w), s = Math.max(1, ts*(.04 + (i % 3)*.02)*sz); c.fillStyle = `rgba(255,255,255,${(.85*al).toFixed(2)})`; c.fillRect(P(x), P(y), s, s); }
    }
    c.restore();
    if (which === "out" && w === "rain" && q.out && Math.random() < .5) fx("splash", (q.x + Math.random()*q.w + HS.camPx)/ts, .3 + Math.random()*(HM.D - .5), 0, {vx:0, vz:0, g:0, dur:380});   // splashes on the ground
  }
}
// night lights: lamps, the fireplace, the TV and pumpkins glow after dark
const GLOW = {stove:[.6, .95, 1.5, "255,150,70"], orb:[.5, 1.1, 1.6, "200,160,255"], lamp:[.5, 1.75, 2.4, "255,214,140"], lamp2:[.5, 1.8, 2.4, "255,214,140"], fire:[1, .9, 3, "255,150,70"], tv:[1, 1.0, 2.2, "120,190,255"], arcade:[.5, 1.2, 1.8, "120,240,255"], desk:[1, 1.3, 1.6, "120,190,255"], pumpkin:[.5, .45, 1.6, "255,150,40"], holtree:[.5, 1.4, 2.2, "255,220,150"], tank:[1, .9, 1.6, "120,200,255"]};
function drawGlows(c, now, pixel, k){
  if (!(k > 0)) return;
  const ts = HS.ts; c.save(); c.globalCompositeOperation = "lighter";
  for (const p of placedItems()) { const G = GLOW[p.it.kind]; if (!G || HS.outA > .5 && HS.spans && HS.spans.some(s => p.x + p.it.w/2 > s.x0 && p.x + p.it.w/2 < s.x1)) continue;
    const screen = p.it.kind === "tv" || p.it.kind === "arcade";   // screens flicker as the picture changes
    const fl = screen ? .82 + .18*Math.abs(Math.sin(now/170 + p.x)*Math.sin(now/530 + p.y)) : 1 + .04*Math.sin(now/(p.it.kind === "fire" || p.it.kind === "pumpkin" || p.it.kind === "stove" ? 140 : 900) + p.x), x = scrX(p.x + G[0]), y = scrY(p.y + p.it.d*.5) - G[1]*ts, r = G[2]*ts*fl;
    // a warm pool on the floor under the light, then the glow itself
    const fy = scrY(p.y + p.it.d) - ts*.1, pr = G[2]*ts*.85*fl;
    c.save(); c.translate(x, fy); c.scale(1, .34); let g = c.createRadialGradient(0, 0, 0, 0, 0, pr); g.addColorStop(0, `rgba(${G[3]},${(.3*k).toFixed(3)})`); g.addColorStop(1, `rgba(${G[3]},0)`); c.fillStyle = g; c.fillRect(-pr, -pr, pr*2, pr*2); c.restore();
    g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${G[3]},${(.42*k).toFixed(3)})`); g.addColorStop(1, `rgba(${G[3]},0)`); c.fillStyle = g; c.fillRect(x - r, y - r, r*2, r*2); }
  c.restore();
}
// how light it is: 0..1 for night and for sunset, fading smoothly around the clock's day/sunset/night hours (tests pin it with DTD_TOD)
function homeLight(){
  const t = window.DTD_TOD; if (t) return {night:t === "night" ? 1 : 0, dusk:t === "sunset" ? 1 : 0};
  const d = new Date(), h = d.getHours() + d.getMinutes()/60, ramp = (a, b) => Math.max(0, Math.min(1, (h - a)/(b - a)));
  return {night:h < 12 ? 1 - ramp(5.5, 6.5) : ramp(19, 20.5), dusk:h < 12 ? 0 : Math.min(ramp(16.5, 17.5), 1 - ramp(19.5, 20.5))};
}
// daylight through the windows: soft slanted patches on the floor (dithered in 2D)
function drawWindowLight(c, pixel, L){
  const day = (1 - L.night)*(1 - .35*L.dusk); if (day < .05) return;
  const y0 = scrY(.05), y1 = scrY(2.6), sh = (y1 - y0)*.45, col = L.dusk > .3 ? "255,196,140" : "255,244,214";
  c.save();
  if (pixel) { if (!HS.litPat || HS.litCol !== col) { const t = mkCanvas(2, 2), x = t.getContext("2d"); x.fillStyle = `rgba(${col},.5)`; x.fillRect(0, 0, 1, 1); x.fillRect(1, 1, 1, 1); HS.litPat = c.createPattern(t, "repeat"); HS.litCol = col; } c.globalAlpha = Math.min(1, day*.55); c.fillStyle = HS.litPat; }
  for (const q of skyRects(pixel)) { if (q.out) continue;
    if (!pixel) { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, `rgba(${col},${(.16*day).toFixed(3)})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; }
    const a = q.x + q.w*.08, b = q.x + q.w*.92; c.beginPath(); c.moveTo(Math.round(a), Math.round(y0)); c.lineTo(Math.round(b), Math.round(y0)); c.lineTo(Math.round(b + sh), Math.round(y1)); c.lineTo(Math.round(a + sh*.8), Math.round(y1)); c.closePath(); c.fill();
    if (state.ui.motion !== "reduced") dustMotes(c, pixel, q, a, b, y0, y1, sh, col, day); }
  c.restore();
}
// dust drifting in a sunbeam: a few specks that float slowly through the beam and twinkle as they turn in the light
function dustMotes(c, pixel, q, a, b, y0, y1, sh, col, day){
  const t = performance.now()/1000, R = rng(Math.round(q.x*7 + q.y*13) + 11), ts = HS.ts;
  c.save(); c.globalAlpha = 1;
  for (let i = 0; i < 18; i++) {
    const u = (R() + t*(.012 + R()*.02)) % 1, v = (R() + Math.sin(t*.3 + i)*.04 + 1) % 1, d = R();   // along the shaft (window → floor), across it, how far down it lands
    const wy = q.y + q.h*.55, fy = y0 + (y1 - y0)*d, fx = a + (b - a)*v + sh*d;   // from the window pane down to the lit patch on the floor
    const y = wy + (fy - wy)*u, x = q.x + q.w*v + (fx - q.x - q.w*v)*u + Math.sin(t*.7 + i*2.3)*ts*.06, tw = .5 + .5*Math.abs(Math.sin(t*(.6 + R()) + i*1.7));
    const al = day*tw*Math.sin(Math.PI*u)*(pixel ? .95 : .7); if (al < .05) continue;
    c.fillStyle = `rgba(255,252,236,${al.toFixed(3)})`;
    if (pixel) c.fillRect(Math.round(x), Math.round(y), 1, 1); else { c.beginPath(); c.arc(x, y, Math.max(.8, ts*.025), 0, 7); c.fill(); }
  }
  c.restore();
}
function eventVisitors(){
  const ev = eventOn(); if (!ev || !ev.visitors || clockTod() !== "night") return [];
  const R = rng([...todayKey()].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 99)), pool = ev.visitors.filter(n => NAT_BY.has(n));
  const a = pool[Math.floor(R()*pool.length)], b = pool[Math.floor(R()*pool.length)];
  return [...new Set([a, b])];
}
// ---- photo mode: hide the UI, pan around, save a PNG or a short GIF with a caption ----
function homeCaption(c, W, H){
  const who = VISIT ? VISIT.who.username : (profile && !profile.guest ? (profile.sb ? profile.uname || profile.name : profile.name) : "My"), txt = `${who}’s Pokémon Home`, pixel = state.mode === "2d", s = Math.max(14, Math.round(H*.05));
  c.font = `700 ${s}px ${pixel ? '"Pixelify Sans", monospace' : '"Chakra Petch", sans-serif'}`; c.textBaseline = "alphabetic"; c.textAlign = "left";
  const tw = c.measureText(txt).width; c.fillStyle = "rgba(11,18,34,.72)"; c.fillRect(s*.6, H - s*2.1, tw + s*1.2, s*1.6); c.fillStyle = "#ffd43b"; c.fillText(txt, s*1.2, H - s*.9);
}
async function homePhoto(kind){
  const cv = HS.cv; if (!cv) return;
  const fname = `pokemon-home-${todayKey()}.${kind}`, done = async blob => { if (!VISIT) { homeData().photos++; missionBump("photo"); save(); checkAch(); } if (!(await saveFile(fname, blob))) homeMsg("Saving files isn’t available here. Try another browser."); };
  if (kind === "png") { const o = mkCanvas(cv.width, cv.height), x = o.getContext("2d"); x.drawImage(cv, 0, 0); homeCaption(x, o.width, o.height); done(await new Promise(r => o.toBlob(r, "image/png"))); return; }
  if (!window.GifKit) { homeMsg("The GIF maker didn’t load. Save a PNG instead."); return; }
  const W = Math.min(640, cv.width), H = Math.round(cv.height*W/cv.width), o = mkCanvas(W, H), x = o.getContext("2d", {willReadFrequently:true}); x.imageSmoothingEnabled = state.mode !== "2d";
  const frames = [], n = 30, step = 80;
  homeMsg("Recording… hold still!");
  for (let i = 0; i < n; i++) { x.drawImage(cv, 0, 0, W, H); homeCaption(x, W, H); frames.push(x.getImageData(0, 0, W, H).data); await new Promise(r => setTimeout(r, step)); }
  const sample = new Uint8Array(W*H*4*3); [0, 15, 29].forEach((f, k) => sample.set(frames[f], k*W*H*4));
  const palette = GifKit.quantize(sample, 256, {format:"rgb565"}), enc = GifKit.GIFEncoder();
  frames.forEach((d, i) => enc.writeFrame(GifKit.applyPalette(d, palette, "rgb565"), W, H, i ? {delay:step} : {palette, delay:step}));
  enc.finish(); homeMsg("Saved your Home GIF!"); done(new Blob([enc.bytes()], {type:"image/gif"}));
}
// ---- phone controls: a joystick and a Play button (tap-to-walk still works) ----
function homePad(){
  const pad = $("scBody").querySelector(".home-pad"); if (!pad || !matchMedia("(pointer:coarse)").matches) return;
  pad.removeAttribute("aria-hidden");
  pad.innerHTML = `<div class="hm-joy" id="hmJoy" aria-label="Walk"><i></i></div><button class="hm-play" type="button" id="hmPlay">Play</button>`;
  const joy = $("hmJoy"), knob = joy.querySelector("i");
  const move = e => { const r = joy.getBoundingClientRect(), dx = e.clientX - (r.left + r.width/2), dy = e.clientY - (r.top + r.height/2), l = Math.hypot(dx, dy), max = r.width*.38, k = l > max ? max/l : 1;
    knob.style.transform = `translate(${dx*k}px, ${dy*k}px)`; HS.joy = l > 6 ? {x:dx/Math.max(l, max), y:dy/Math.max(l, max)} : null; };
  joy.addEventListener("pointerdown", e => { joy.setPointerCapture(e.pointerId); HS.me.path = null; move(e); e.preventDefault(); });
  joy.addEventListener("pointermove", e => { if (joy.hasPointerCapture(e.pointerId)) move(e); });
  const stop = () => { HS.joy = null; knob.style.transform = ""; };
  joy.addEventListener("pointerup", stop); joy.addEventListener("pointercancel", stop);
  $("hmPlay").addEventListener("click", () => homeUseThing(nearestThing()));
}
// ---- decorating helpers: undo (last 20 changes), rotate (rugs), drag to move ----
const ROTATES = new Set(["rug", "rugr", "rugt"]);
const canRotate = it => it && ROTATES.has(it.kind) && it.w !== it.d;
const rotItem = (it, r) => r ? {...it, w:it.d, d:it.w, rot:1} : it;
function decoSnap(){ HS.undo.push(JSON.stringify(homeData().items)); if (HS.undo.length > 20) HS.undo.shift(); }
function decoUndo(){ if (!HS.undo.length) return; homeData().items = JSON.parse(HS.undo.pop()); HS.sel = null; HS.place = null; HS.layerKey = ""; save(); Sound.play("back"); renderDecoBar(); }

