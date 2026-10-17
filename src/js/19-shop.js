// ================= SHOP =================
let shopCat = "furn";
function renderShop(){
  const ev = eventOn(), G = state.games, items = ITEMS_ALL.filter(it => it.cat === shopCat && (!it.event || (ev && ev.id === it.event) || owns(it.cat, it.id)));
  const sorted = [...items].sort((a, b) => (isExclusive(a) - isExclusive(b)) || (b.free - a.free) || (a.price - b.price));
  const card = it => {
    const ex = isExclusive(it), have = owns(it.cat, it.id), multi = it.cat === "furn" && !ex, hidden = ex && !have;
    const n = it.cat === "furn" ? furnCount(it.id) : 0;
    return `<div class="shop-item${have ? " owned" : ""}${hidden ? " mystery" : ""}${ex ? " ex" : ""}">
      ${hidden ? `<span class="it-thumb q">?</span>` : itemThumb(it)}
      <b>${hidden ? (it.tower ? "Tower exclusive" : "Gym exclusive") : esc(it.name)}</b>
      <span class="meta">${it.event ? `<span class="pill ev">${esc((EVENTS.find(e => e.id === it.event) || {}).name || "Event")} · limited time</span> ` : ""}${hidden ? (it.tower ? "Win streaks in the Battle Tower" : "Beat Gym Leaders to find it") : ex ? `From ${esc(it.from || "a Gym Leader")}` : it.free ? "Starter item" : have && !multi ? "Owned" : multi && n ? `Owned × ${n}` : ""}</span>
      ${ex || it.free || (have && !multi) ? "" : `<button class="btn sm${G.pp >= it.price ? " primary" : ""}" type="button" data-buy="${it.id}">${fmtPP(it.price)}</button>`}
      ${it.cat === "house" && have ? (houseOf().id === it.id ? `<span class="pill">Your house</span>` : `<button class="btn sm" type="button" data-house="${it.id}">Use</button>`) : ""}
    </div>`;
  };
  const ex = items.filter(isExclusive), exGot = ex.filter(it => owns(it.cat, it.id)).length;
  $("scBody").innerHTML = `<div class="shop">
    <div class="shop-top"><div class="shop-bal"><span class="meta">Your PokéPoints</span><b id="shopBal">${fmtPP(G.pp)}</b></div>
      <p class="note">Earn PokéPoints from quizzes, achievements, rivals, Versus and Gyms. Gym Leaders also give exclusive rewards you can’t buy here.</p></div>
    <div class="segrow shop-tabs" role="group">${CAT_ORDER.map(c => `<button type="button" data-scat="${c}" aria-pressed="${c === shopCat}">${CAT[c].name}</button>`).join("")}</div>
    ${ex.length ? `<p class="meta shop-ex">Exclusives found: ${exGot} / ${ex.length}</p>` : ""}
    <div class="shop-grid">${sorted.filter(it => !isExclusive(it) || owns(it.cat, it.id)).map(card).join("")}</div>
    ${ex.length - exGot ? `<div class="set-sub shop-find">Still to find · ${ex.length - exGot}</div><div class="shop-q" aria-label="${ex.length - exGot} exclusives still to find">${ex.filter(it => !owns(it.cat, it.id)).map(it => `<span class="q-tile" title="${it.champ ? "A Champion’s reward" : it.e4 ? "An Elite Four reward" : it.tower ? "A Battle Tower reward" : "A Gym Leader’s reward"}">?</span>`).join("")}</div><p class="note">Exclusives come from Gym Leaders, the Elite Four, Champions and the Battle Tower. They’re never sold here.</p>` : ""}
    ${shopCat === "house" ? `<p class="note">How your house looks from the front yard and the garden.</p>` : ""}
    ${shopCat === "furn" || shopCat === "exp" || shopCat === "house" ? `<div class="actions"><button class="btn" type="button" data-go-home>Go to my Home</button></div>` : ""}
    ${shopCat === "icon" ? `<p class="note">Choose your profile icon on your Trainer card.</p>` : ""}</div>`;
  paintThumbs($("scBody")); $("scPP").innerHTML = fmtPP(G.pp);
  nav.onClick = e => {
    const t = e.target.closest("[data-scat]"); if (t) { shopCat = t.dataset.scat; Sound.play("select"); renderShop(); return; }
    const b = e.target.closest("[data-buy]"); if (b) { const it = unlockOf(shopCat, b.dataset.buy); if (it && buy(it)) { if (it.cat === "house") { G.home.house = it.id; save(); } renderShop(); } return; }
    const hu = e.target.closest("[data-house]"); if (hu) { G.home.house = hu.dataset.house; save(); Sound.play("confirm"); toast(`Your house is now a ${unlockOf("house", hu.dataset.house).name.toLowerCase()}.`); renderShop(); return; }
    if (e.target.closest("[data-go-home]")) { Sound.play("select"); openScreen("home"); }
  };
  setMusic("field");
}

