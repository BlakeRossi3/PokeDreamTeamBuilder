// ================= HALL OF FAME GALLERY =================
// Every team's Hall of Fame scene as a card. 2D and 3D scenes are staged separately, so each tab shows that style.
let galMode = null, galTok = 0, hofReturn = null;
async function hofCardArt(cv, id, mode, tok){
  const sc = sceneOf(id, mode), t = teamOf(id), tr = trainerOf(id), pixel = mode === "2d";
  const still = n => !!(sc.items[String(n)] && sc.items[String(n)].st);
  const keyOf = n => { const sh = isShinyMember(id, n) || state.shiny; return pixel ? spKey(n, sh, "2d") : still(n) ? hdKey(n, sh) : spKey(n, sh, "3d"); };
  const mons = await Promise.all(t.map(async (n, idx) => ({n, idx, ball:ballOf(id, n), name:nickOf(id, n), hd: !pixel && still(n), spr: await getSprite(keyOf(n), n).catch(() => null)})));
  const trainer = await getSprite(pixel ? "t2d" : "t3f", tr).catch(() => null);
  try { await Promise.all([document.fonts.load('italic 700 30px "Chakra Petch"'), document.fonts.load('700 20px "Pixelify Sans"')]); } catch(e){}
  if (tok !== galTok || !cv.isConnected) return;
  const A = {mons:mons.filter(m => m.spr), trainer, trStyle:pixel ? "pixel" : "hd", tr};
  const k = pixel ? 2 : 1, V = {W:cv.width/k, H:cv.height/k}, S = {x:0, y:0, w:V.W, h:V.H};
  const c = pixel ? mkCanvas(V.W, V.H) : cv, ctx = c.getContext("2d");
  renderScene(ctx, V, S, 2400, {pixel, sc, A, bg:paintBg(sc.bg, todOf(sc), V, S, pixel), teamId:id, layout:"custom", intro:null, camT:0});
  if (pixel) { const x = cv.getContext("2d"); x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0, cv.width, cv.height); }
  cv.closest(".hgal-cv").classList.add("ready");
}
function renderHofGallery(){
  const mode = galMode || state.mode, two = mode === "2d", ts = nonEmptyTeams(), tok = ++galTok;
  $("scBody").innerHTML = `<div class="hgal">
    <div class="hgal-top"><div class="segrow hgal-tabs" role="group" aria-label="Scene style">${[["3d", "3D cards"], ["2d", "2D pixel cards"]].map(([m, l]) => `<button type="button" data-gm="${m}" aria-pressed="${m === mode}">${l}</button>`).join("")}</div>
      <p class="note">Your ${two ? "2D" : "3D"} Hall of Fame scenes. 2D and 3D are staged separately, so each team can have a pixel card and a 3D card. Tap one to open it.</p></div>
    ${ts.length ? `<div class="hgal-grid">${ts.map(t => { const sc = sceneOf(t.id, mode), T = hofTitle(t.id, sc);
      return `<button class="hgal-card" type="button" data-hg="${t.id}"><span class="hgal-cv"><canvas data-hgcv="${t.id}" width="640" height="360" aria-hidden="true"></canvas><i class="hgal-mode">${two ? "2D" : "3D"}</i></span>
        <span class="hgal-t"><b>${esc(T.title)}</b><small>${esc(t.dex)} · ${teamOf(t.id).length} Pokémon · ${esc(SCENE_BY.get(sc.bg).name)}</small></span></button>`; }).join("")}</div>`
      : `<div class="sc-narrow"><p>Build a team first. Every team gets its own Hall of Fame card here.</p><div class="actions"><button class="btn primary" type="button" id="goBuild">Open Team Builder</button></div></div>`}
  </div>`;
  (async () => { for (const cv of $("scBody").querySelectorAll("canvas[data-hgcv]")) { if (tok !== galTok) return; try { await hofCardArt(cv, cv.dataset.hgcv, mode, tok); } catch(e){} } })();
  nav.onClick = e => {
    const m = e.target.closest("[data-gm]"); if (m) { galMode = m.dataset.gm; Sound.play("select"); renderHofGallery(); return; }
    const c = e.target.closest("[data-hg]"); if (c) { Sound.play("confirm"); enterApp(mode, c.dataset.hg); openHof(); hofReturn = mode; return; }
    if (e.target.closest("#goBuild")) enterApp(state.mode);
  };
  nav.cleanup = () => { galTok++; };
  setMusic("title");
}

