// ================= 2D ART (pixel art made with Retro Diffusion, see Credits) =================
// Hall of Fame backgrounds (hof/<scene>[_sunset|_night]), Home furniture (furn/<id>), rooms (room/…) and room
// dividers (div/…). Used in the 2D style only; the canvas drawings stay as the 3D look and as the fallback until
// an image has decoded. The images are embedded in the page at build time from art/2d/.
const ART_SRC = /*ART2D*/;
const ART = new Map();
const artOf = k => ART.get(k) || null;
function artReady(){   // drop anything that was drawn before the art arrived
  if (typeof furnCache !== "undefined") furnCache.clear();
  if (typeof HS !== "undefined") HS.layerKey = "";
  for (const st of [typeof hofStage !== "undefined" && hofStage, typeof startStage !== "undefined" && startStage]) if (st) st.bgKey = "";
}
let artTimer = 0;
function artLoad(src){
  for (const [k, url] of Object.entries(src || {})) {
    const img = new Image();
    img.onload = () => { ART.set(k, img); clearTimeout(artTimer); artTimer = setTimeout(artReady, 30); };
    img.src = url;
  }
}
// the website keeps the art in its own cached file (fetched right away, after the page); the single-page build has it inline
if (ART_SRC) artLoad(ART_SRC);
else fetch(packUrl("art2d.json")).then(r => r.ok ? r.json() : null).then(artLoad).catch(() => {});   // without it the canvas drawings are used
// the image for a scene at a time of day, falling back to its daytime picture
const hofArt = (id, tod) => artOf(`hof/${id}_${tod}`) || artOf(`hof/${id}`);

