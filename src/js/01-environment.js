// ================= ENVIRONMENT =================
// The same page runs as a claude.ai artifact (cloud sync, claude.ai downloads) and as a normal website.
const ON_CLAUDE = !!(window.claude && window.claude.use);
const BUILD = "/*BUILD*/"; // set for the website build so updated sprite packs never mix with cached old ones
const PACKV = {}/*PACKV*/;   // the website build fills in a short hash of each pack, so unchanged packs stay cached across deploys
const packUrl = path => { const v = PACKV[path] || BUILD; return v ? `${path}?v=${v}` : path; };

