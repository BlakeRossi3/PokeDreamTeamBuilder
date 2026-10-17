// ================= QUIZ =================
const QZ = {
  sil:{label:"Who’s that Pokémon?"},
  type:{label:"Super effective?"},
  stat:{label:"Guess by stats"},
  typing:{label:"Name the type"},
  daily:{label:"Daily 10"},
};
const DAILY_MODES = ["sil", "typing", "type", "stat", "sil", "type", "typing", "sil", "stat", "sil"];
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
// the same ten questions for everyone on a given day
function dailySet(key){
  const seed = [...key].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261), R = rng(seed), keep = Math.random, keepMode = qz.mode, keepGen = qz.gen;
  Math.random = R; qz.gen = 0;
  try { return DAILY_MODES.map(md => { qz.mode = md; return {...qzMake(), mode:md}; }); }
  finally { Math.random = keep; qz.mode = keepMode; qz.gen = keepGen; }
}
function dailyState(){ const k = todayKey(), d = state.games.daily; return d && d.d === k ? d : (state.games.daily = {d:k, i:0, s:0, r:""}); }
const qz = {mode:"sil", gen:0, streak:0, cur:null, next:null, done:false};
const qzPool = () => qz.gen ? GENS[qz.gen - 1].mons : NATBASE;
const pickOne = a => a[Math.floor(Math.random()*a.length)];
function qzMake(){
  const P = qzPool();
  for (let tries = 0; tries < 40; tries++) {
    const a = pickOne(P);
    if (qz.mode === "sil" || qz.mode === "stat") {
      const others = shuffle(P.filter(m => m.num !== a.num && (qz.mode !== "stat" || bst(m) !== bst(a)))).slice(0, 3);
      return {a:a.num, ans:a.num, opts:shuffle([a, ...others]).map(m => m.num)};
    }
    if (qz.mode === "type") {
      const se = TYPE_ORDER.filter(t => effOf(t, a.types) >= 2), no = TYPE_ORDER.filter(t => effOf(t, a.types) <= 1);
      if (!se.length || no.length < 3) continue;
      const right = pickOne(se); return {a:a.num, ans:right, opts:shuffle([right, ...shuffle(no).slice(0, 3)])};
    }
    if (qz.mode === "typing") {
      const right = a.types.join("/"), seen = new Set([right]), wrong = [];
      for (const m of shuffle(NATBASE)) { const k = m.types.join("/"); if (!seen.has(k)) { seen.add(k); wrong.push(k); } if (wrong.length === 3) break; }
      return {a:a.num, ans:right, opts:shuffle([right, ...wrong])};
    }
  }
  return {a:1, ans:1, opts:[1, 4, 7, 25]};
}
function renderQuiz(){
  qz.streak = 0; qz.next = null;
  if (qz.mode === "daily") { const D = dailyState(); qz.dq = dailySet(D.d); if (D.i >= 10) return renderDailyDone(); }
  $("scBody").innerHTML = `<div class="qz-wrap">
    <div class="segrow qz-modes" role="group">${Object.entries(QZ).map(([k, v]) => `<button type="button" data-qm="${k}" aria-pressed="${qz.mode === k}">${v.label}</button>`).join("")}</div>
    ${qz.mode === "daily" ? `<div class="qz-bar"><span>Question <b id="qzStreak">${dailyState().i + 1}</b> of 10</span><span>Score <b id="qzBest">${dailyState().s}</b></span><span class="qz-dots" id="qzDots">${dailyDots()}</span></div>`
    : `<div class="qz-bar"><span>Streak <b id="qzStreak">0</b></span><span>Best <b id="qzBest">${state.games.qbest[qz.mode]}</b></span>
      <select class="select" id="qzGen" aria-label="Which Pokémon">${["All generations", ...GENS.map(g => `Gen ${ROMAN[g.g]} · ${g.region}`)].map((l, i) => `<option value="${i}" ${qz.gen === i ? "selected" : ""}>${l}</option>`).join("")}</select></div>`}
    <p class="qz-prompt" id="qzPrompt"></p>
    <div class="qz-stage" id="qzStage"></div>
    <div class="qz-opts" id="qzOpts"></div>
    <div class="qz-foot"><p class="qz-msg" id="qzMsg" role="status"></p><button class="btn primary" type="button" id="qzNext" hidden>Next ▸</button></div></div>`;
  nav.onClick = e => {
    const m = e.target.closest("[data-qm]"); if (m) { qz.mode = m.dataset.qm; Sound.play("select"); renderQuiz(); return; }
    const b = e.target.closest("[data-qa]"); if (b) { qzAnswer(b.dataset.qa); return; }
    if (e.target.closest("#qzNext")) { Sound.play("select"); if (qz.mode === "daily" && dailyState().i >= 10) renderDailyDone(); else qzNew(); }
    if (e.target.closest("#dlShare")) shareDaily();
  };
  nav.onChange = e => { if (e.target.id === "qzGen") { qz.gen = +e.target.value; qz.next = null; qzNew(); } };
  setMusic("title"); qzNew();
}
function qzNew(){
  const daily = qz.mode === "daily";
  const q = qz.cur = daily ? qz.dq[dailyState().i] : qz.next || qzMake(); qz.next = daily ? qz.dq[dailyState().i + 1] || null : qzMake(); qz.done = false;
  if (qz.next) ensurePack(spKey(qz.next.a, false, state.mode)).catch(() => {});
  const md = q.mode || qz.mode, m = NAT_BY.get(q.a), sil = md === "sil", hide = md === "stat";
  if (daily) { $("qzStreak").textContent = dailyState().i + 1; }
  $("qzPrompt").innerHTML = {sil:"Who’s that Pokémon?", type:`Which attack type is super effective against <b>${esc(m.name)}</b>?`, stat:"Which Pokémon has these base stats?", typing:`What type is <b>${esc(m.name)}</b>?`}[md];
  $("qzStage").classList.remove("reveal"); $("qzStage").classList.toggle("stats", hide);
  $("qzStage").innerHTML = (hide ? `<div class="qz-statbox">${statsHTML({stats:m.stats}, true)}</div>` : "") +
    `<div class="stage${hide ? " qz-hidden" : ""}"><img class="spr${sil || hide ? " sil" : ""}" data-num="${q.a}" data-mode="${state.mode}" data-zoom="3" alt="" draggable="false"></div>` +
    (md === "type" ? `<div class="qz-types">${typeBadges(m.types)}</div>` : "");
  const lab = v => md === "type" ? `<span class="tb" style="${tStyle(v)}">${v}</span>` : md === "typing" ? v.split("/").map(t => `<span class="tb" style="${tStyle(t)}">${t}</span>`).join("") : esc(monName(+v));
  $("qzOpts").innerHTML = q.opts.map((v, i) => `<button class="btn qz-opt" type="button" data-qa="${v}"><span class="k" aria-hidden="true">${i + 1}</span>${lab(v)}</button>`).join("");
  $("qzMsg").textContent = ""; $("qzNext").hidden = true;
  paintAll($("qzStage"));
}
function qzAnswer(v){
  if (qz.done) return; qz.done = true;
  const q = qz.cur, ok = String(v) === String(q.ans), m = NAT_BY.get(q.a), md = q.mode || qz.mode;
  const img = $("qzStage").querySelector("img"); img.classList.remove("sil"); img.parentElement.classList.remove("qz-hidden"); $("qzStage").classList.add("reveal");
  $("qzOpts").querySelectorAll("[data-qa]").forEach(b => { b.classList.toggle("right", String(b.dataset.qa) === String(q.ans)); b.classList.toggle("wrong", b.dataset.qa === String(v) && !ok); b.disabled = true; });
  const G9 = state.games.qbest;
  if (qz.mode === "daily") {
    const D = dailyState(); D.r += ok ? "1" : "0"; D.s += ok ? 1 : 0; D.i++;
    if (D.i >= 10) { state.games.dailyN++; state.games.dailyBest = Math.max(state.games.dailyBest, D.s); missionBump("daily10"); }
    save(); Sound.play(ok ? "right" : "wrong");
    if (ok) earn(5, "Daily 10");
    if (D.i >= 10) setTimeout(() => earn(25 + (D.s === 10 ? 50 : 0), D.s === 10 ? "Perfect Daily 10!" : "Daily 10 finished"), 700);
    $("qzBest").textContent = D.s; $("qzDots").innerHTML = dailyDots();
  } else if (ok) { qz.streak++; if (qz.streak > (G9[qz.mode] || 0)) { G9[qz.mode] = qz.streak; if (qz.mode === "sil") state.games.quizBest = qz.streak; save(); } Sound.play("right"); earn(qz.streak % 10 === 0 ? 23 : 3, qz.streak % 10 === 0 ? `${qz.streak} in a row!` : "Correct"); } else { qz.streak = 0; Sound.play("wrong"); }
  if (qz.mode !== "daily") { $("qzStreak").textContent = qz.streak; $("qzBest").textContent = G9[qz.mode]; }
  const ansTxt = md === "type" ? `${esc(q.ans)} hits ${esc(m.name)} super effectively` : md === "typing" ? `${esc(m.name)} is ${esc(q.ans.replace("/", " / "))}` : `It’s <b>${esc(m.name)}</b>`;
  $("qzMsg").innerHTML = ok ? `Correct! ${ansTxt}.${qz.mode !== "daily" && qz.streak >= 3 ? ` ${qz.streak} in a row.` : ""}` : `Not quite. ${ansTxt}.`;
  const nx = $("qzNext"); nx.hidden = false; nx.textContent = qz.mode === "daily" && dailyState().i >= 10 ? "See results ▸" : "Next ▸"; nx.focus();
}
const dailyDots = () => { const D = dailyState(); return Array.from({length:10}, (_, i) => `<i class="${i < D.r.length ? (D.r[i] === "1" ? "ok" : "no") : ""}"></i>`).join(""); };
function renderDailyDone(){
  const D = dailyState(), msg = D.s === 10 ? "Perfect score!" : D.s >= 8 ? "Great job!" : D.s >= 5 ? "Nice work." : "Tomorrow’s another chance.";
  const t = new Date(); t.setHours(24, 0, 0, 0); const h = Math.floor((t - Date.now())/36e5), mn = Math.floor((t - Date.now())/6e4) % 60;
  $("scBody").innerHTML = `<div class="qz-wrap">
    <div class="segrow qz-modes" role="group">${Object.entries(QZ).map(([k, v]) => `<button type="button" data-qm="${k}" aria-pressed="${qz.mode === k}">${v.label}</button>`).join("")}</div>
    <div class="daily-done"><span class="k">Daily 10 · ${esc(D.d)}</span><b class="daily-score">${D.s}<small>/10</small></b><span class="qz-dots big">${dailyDots()}</span><p>${msg} New questions in ${h}h ${mn}m.</p>
      <div class="actions"><button class="btn primary" type="button" id="dlShare">Copy result</button><button class="btn" type="button" data-qm="sil">Keep playing</button></div>
      <p class="note">Everyone gets the same ten questions each day. Best daily score: ${state.games.dailyBest}/10 · Days played: ${state.games.dailyN}</p></div></div>`;
  nav.onClick = e => { const m = e.target.closest("[data-qm]"); if (m) { qz.mode = m.dataset.qm; Sound.play("select"); renderQuiz(); return; } if (e.target.closest("#dlShare")) shareDaily(); };
  if (D.s >= 8) Sound.play("victory");
}
async function shareDaily(){
  const D = dailyState(), txt = `Dream Team Dex · Daily 10 · ${D.d}\n${D.s}/10 ${[...D.r].map(c => c === "1" ? "🟩" : "🟥").join("")}`;
  try { await navigator.clipboard.writeText(txt); toast("Result copied. Paste it anywhere to share."); } catch(e){ toast(txt); }
}
document.addEventListener("keydown", e => {
  if (nav.screen !== "quiz" || $("screen").hidden || !$("modalWrap").hidden || e.target.closest("select, input")) return;
  if (/^[1-4]$/.test(e.key) && !qz.done) { const b = $("qzOpts").querySelectorAll("[data-qa]")[+e.key - 1]; if (b) { e.preventDefault(); qzAnswer(b.dataset.qa); } }
});

