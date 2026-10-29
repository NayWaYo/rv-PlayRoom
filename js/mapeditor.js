// The map editor (#editeur): your list of maps, then a map seen from above on a grid, with
// tools to draw blocks, floors, walls (doors and windows cut into them), stairs, and to place
// spawn points, pickups, jump pads and the two flags; a 3D view to fly around it; a check
// before playing. Maps are kept in this browser (js/fpscustom.js) and sent to friends by the
// room they play in. Keyboard and mouse only.
import * as THREE from 'three';
import { blankMap, cleanMap, buildMap, checkMap, mapBoxes, steps, wallHoles, savedMaps, storeMaps, keepMap, KINDS, THEMES, LIMIT } from './fpscustom.js';

const PALETTE = ['#b07a45', '#c98b52', '#e8dcc8', '#c9bfae', '#a39a8a', '#8f8676', '#5b4f45', '#3a3f4b', '#c9483a', '#3d6fd1', '#f4b63f', '#5f9a45', '#8f73e3', '#e07ab8'];
const TOOLS = [
  { id: 'select', icon: '🖱️', name: 'Sélection', help: 'Clique pour choisir, fais glisser pour déplacer, tire un bord pour agrandir. Clic droit : supprimer.' },
  { id: 'block', icon: '🧱', name: 'Bloc', help: 'Fais glisser pour dessiner un bloc (une caisse, un mur épais, une estrade) posé sur l\'étage.' },
  { id: 'slab', icon: '⬛', name: 'Plancher', help: 'Fais glisser pour dessiner un plancher dont le dessus est à la hauteur de l\'étage : une mezzanine, un toit, ou le sol d\'une carte au-dessus du vide.' },
  { id: 'wall', icon: '🧱', name: 'Mur', help: 'Fais glisser pour tracer un mur droit, sur l\'étage.' },
  { id: 'door', icon: '🚪', name: 'Porte', help: 'Clique sur un mur pour y percer une porte. Clique sur une porte pour la reboucher.' },
  { id: 'window', icon: '🪟', name: 'Fenêtre', help: 'Clique sur un mur pour y percer une fenêtre. Clique dessus pour la reboucher.' },
  { id: 'stairs', icon: '🪜', name: 'Escalier', help: 'Fais glisser dans le sens de la montée : l\'escalier part de l\'étage et monte de la hauteur choisie.' },
  { id: 'spawn', icon: '🧍', name: 'Apparition', help: 'Clique pour un point d\'apparition. À gauche (x < 0) les Rouges, à droite les Bleus.' },
  { id: 'pickup', icon: '❤️', name: 'Bonus', help: 'Clique pour poser un bonus : soin, armure, ou une arme lourde.' },
  { id: 'pad', icon: '🟢', name: 'Tremplin', help: 'Clique pour un tremplin qui saute droit en l\'air, ou fais glisser vers où il doit envoyer.' },
  { id: 'flag', icon: '🚩', name: 'Drapeau', help: 'Clique pour placer le drapeau du camp : à gauche celui des Rouges, à droite celui des Bleus. Un seul par camp.' }
];
const PICK_ICON = { health: '❤️', armor: '🛡️', rocket: '🚀', railgun: '⚡' };
const RED = '#e2574a', BLUE = '#4a7fe0';
const $el = (t, cls, txt) => { const e = document.createElement(t); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const fmt = v => String(Math.round(v * 100) / 100).replace('.', ',');
const isBox = it => it.t === 'block' || it.t === 'wall' || it.t === 'stairs';

let ui = null;

export function openMapEditor(o) {
  if (!ui) ui = build(o);
  ui.list();
}

function build({ toast, sfx, onPlay, onQuit }) {
  injectStyle();
  const root = $el('div', 'me'); root.id = 'mapEditor';
  document.body.append(root);

  /* ---------- the list of your maps ---------- */
  const listEl = $el('div', 'me-list');
  root.append(listEl);
  function list() {
    stop3d(); editing = false;
    listEl.hidden = false; work.hidden = true;
    listEl.textContent = '';
    const card = $el('div', 'me-card');
    const head = $el('div', 'me-card-head');
    head.append($el('h1', null, '✏️ Éditeur de cartes'), $el('p', null, 'Dessine ta carte de bataille vue de dessus, vérifie-la, puis lance une partie dessus : tes amis la reçoivent en rejoignant, sans rien installer.'));
    card.append(head);
    const row = $el('div', 'me-row');
    const nb = $el('button', 'btn', '+ Nouvelle carte'); nb.type = 'button';
    nb.addEventListener('click', () => { open({ id: null, map: blankMap() }); sfx.pop(); });
    const ib = $el('button', 'btn ghost', '📂 Importer un fichier'); ib.type = 'button';
    const file = $el('input'); file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true;
    ib.addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      const f = file.files[0]; file.value = '';
      if (!f) return;
      try {
        const m = cleanMap(JSON.parse(await f.text()));
        if (!m) throw new Error('vide');
        const id = keepMap(m); toast(`Carte « ${m.name} » importée`); list(); if (id) open({ id, map: m });
      } catch (e) { toast('Ce fichier n\'est pas une carte.'); }
    });
    row.append(nb, ib, file);
    card.append(row);
    const maps = savedMaps();
    const ul = $el('div', 'me-maps');
    if (!maps.length) ul.append($el('p', 'me-empty', 'Aucune carte pour l\'instant. Commence par « Nouvelle carte » : il y a déjà les points d\'apparition et les drapeaux, il ne reste qu\'à construire.'));
    for (const e of maps) {
      const m = cleanMap(e.map); if (!m) continue;
      const li = $el('div', 'me-map');
      const t = $el('div', 'me-map-t');
      t.append($el('b', null, m.name), $el('small', null, `${m.w} × ${m.d} m · ${m.items.length} éléments · ${THEMES[m.theme]}${m.void ? ' · au-dessus du vide' : ''}`));
      const acts = $el('div', 'me-map-a');
      const btn = (txt, fn, cls = 'btn ghost') => { const b = $el('button', cls, txt); b.type = 'button'; b.addEventListener('click', fn); acts.append(b); return b; };
      btn('▶ Jouer', () => play(m), 'btn');
      btn('✏️ Modifier', () => open({ id: e.id, map: m }));
      btn('⧉', () => { const c = JSON.parse(JSON.stringify(m)); c.name = (m.name + ' (copie)').slice(0, 30); keepMap(c); list(); }).title = 'Dupliquer';
      btn('⬇', () => download(m)).title = 'Exporter en fichier';
      btn('🗑', () => { if (confirm(`Supprimer la carte « ${m.name} » ? C'est définitif.`)) { storeMaps(savedMaps().filter(x => x.id !== e.id)); list(); } }).title = 'Supprimer';
      li.append(t, acts); ul.append(li);
    }
    card.append(ul);
    const back = $el('button', 'mode-switch', '← Accueil'); back.type = 'button';
    back.addEventListener('click', onQuit);
    card.append(back);
    listEl.append(card);
    nb.focus();
  }
  function download(m) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(m)], { type: 'application/json' }));
    a.download = (m.name.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'carte') + '.json';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function play(m) {
    const r = checkMap(m);
    if (r.errors.length) { toast('Cette carte n\'est pas prête : ouvre-la et touche « Vérifier ».', 4000); return; }
    onPlay(m);
  }

  /* ---------- the editor ---------- */
  const work = $el('div', 'me-work'); work.hidden = true;
  root.append(work);
  const bar = $el('div', 'me-bar'), tools = $el('div', 'me-tools'), stage = $el('div', 'me-stage'), side = $el('div', 'me-side');
  work.append(bar, tools, stage, side);
  const cv = $el('canvas', 'me-canvas'); cv.tabIndex = 0;
  const hint = $el('div', 'me-hint');
  const opts = $el('div', 'me-opts');
  stage.append(cv, opts, hint);
  const g = cv.getContext('2d');

  let entry = null, map = null, editing = false, undo = [], redo = [], saveT = 0;
  let tool = 'select', level = 0, sel = -1, issues = null;
  const set = { block: 1, wall: 3, stairs: 3, color: '#b07a45', kind: 'health', padUp: 9.5, fine: false };
  const view = { cx: 0, cz: 0, s: 20 };

  // the top bar
  const name = $el('input', 'me-name'); name.maxLength = 30; name.setAttribute('aria-label', 'Nom de la carte');
  name.addEventListener('change', () => commit(() => { map.name = name.value.trim().slice(0, 30) || 'Ma carte'; }));
  const tb = (txt, fn, title, cls = 'btn ghost') => { const b = $el('button', cls, txt); b.type = 'button'; if (title) b.title = title; b.addEventListener('click', fn); return b; };
  const bUndo = tb('↶', () => doUndo(), 'Annuler (Ctrl+Z)'), bRedo = tb('↷', () => doRedo(), 'Refaire (Ctrl+Y)');
  const b3d = tb('🧊 Vue 3D', () => toggle3d(), 'Voler dans la carte');
  bar.append(tb('← Mes cartes', () => { flush(); list(); }), name, bUndo, bRedo, b3d,
    tb('✔ Vérifier', () => { runCheck(); }), tb('▶ Jouer', () => { flush(); const r = runCheck(); if (!r.errors.length) onPlay(map); }, 'Créer une bataille sur cette carte', 'btn'));

  // the tools
  const toolBtns = {};
  TOOLS.forEach((t, i) => {
    const b = $el('button', 'me-tool'); b.type = 'button';
    b.title = `${t.name} (${(i + 1) % 10 === 0 && i ? '0' : i < 9 ? i + 1 : String.fromCharCode(48 + ((i + 1) % 10))}) : ${t.help}`;
    b.append($el('b', null, t.icon), $el('span', null, t.name));
    b.addEventListener('click', () => pickTool(t.id));
    toolBtns[t.id] = b; tools.append(b);
  });
  function pickTool(id) {
    tool = id; drag = null;
    for (const k in toolBtns) toolBtns[k].setAttribute('aria-pressed', String(k === id));
    renderOpts(); draw();
  }

  // the tool's options, over the plan
  function renderOpts() {
    opts.textContent = '';
    const T = TOOLS.find(t => t.id === tool);
    hint.textContent = T.help + '  ·  Molette : zoom · clic molette ou Espace + glisser : se déplacer · Maj : pas fin';
    const field = (label, inp) => { const l = $el('label', 'me-f'); l.append($el('span', null, label), inp); opts.append(l); return inp; };
    const number = (label, v, min, max, step, fn) => {
      const i = $el('input'); i.type = 'number'; i.min = min; i.max = max; i.step = step; i.value = v;
      i.addEventListener('change', () => { const n = Math.max(min, Math.min(max, Number(i.value) || 0)); i.value = n; fn(n); draw(); });
      return field(label, i);
    };
    number('Étage (m)', level, map && map.void ? -10 : 0, 30, 0.5, v => { level = v; });
    if (tool === 'block') number('Hauteur', set.block, 0.1, 20, 0.1, v => { set.block = v; });
    if (tool === 'wall') number('Hauteur', set.wall, 0.3, 20, 0.1, v => { set.wall = v; });
    if (tool === 'stairs') number('Monte de', set.stairs, 0.5, 15, 0.1, v => { set.stairs = v; });
    if (tool === 'pad') number('Poussée vers le haut', set.padUp, 4, 20, 0.5, v => { set.padUp = v; });
    if (tool === 'pickup') {
      const s = $el('select'); for (const k in KINDS) { const op = $el('option', null, PICK_ICON[k] + ' ' + KINDS[k]); op.value = k; s.append(op); }
      s.value = set.kind; s.addEventListener('change', () => { set.kind = s.value; }); field('Bonus', s);
    }
    if (['block', 'slab', 'wall', 'stairs'].includes(tool)) opts.append(swatches(set.color, c => { set.color = c; renderOpts(); }));
  }
  function swatches(cur, fn) {
    const box = $el('div', 'me-sw');
    for (const c of PALETTE) {
      const b = $el('button'); b.type = 'button'; b.style.background = c; b.title = c;
      b.setAttribute('aria-pressed', String(c === cur)); b.addEventListener('click', () => fn(c)); box.append(b);
    }
    const ci = $el('input'); ci.type = 'color'; ci.value = cur; ci.title = 'Autre couleur';
    ci.addEventListener('change', () => fn(ci.value)); box.append(ci);
    return box;
  }

  /* ---------- editing, undo, saving ---------- */
  function open(e) {
    entry = { id: e.id, map: e.map }; map = cleanMap(e.map); editing = true;
    undo = []; redo = []; sel = -1; issues = null; level = 0;
    if (!entry.id) entry.id = keepMap(map);
    listEl.hidden = true; work.hidden = false;
    name.value = map.name;
    view.cx = 0; view.cz = 0; fit();
    pickTool('select'); renderSide(); cv.focus();
  }
  function fit() {
    const r = stage.getBoundingClientRect();
    view.s = Math.max(4, Math.min(60, Math.min((r.width - 40) / (map.w + 2), (r.height - 100) / (map.d + 2))));
  }
  const snapshot = () => JSON.stringify(map);
  function commit(fn) { const before = snapshot(); fn(); changed(before); }
  function changed(before) {
    if (before === snapshot()) { draw(); return; }
    undo.push(before); if (undo.length > 150) undo.shift(); redo = [];
    issues = null; save(); renderSide(); draw();
  }
  function restore(s) { map = JSON.parse(s); if (sel >= map.items.length) sel = -1; name.value = map.name; issues = null; save(); renderSide(); renderOpts(); draw(); }
  function doUndo() { if (!undo.length) return; redo.push(snapshot()); restore(undo.pop()); }
  function doRedo() { if (!redo.length) return; undo.push(snapshot()); restore(redo.pop()); }
  function save() { clearTimeout(saveT); saveT = setTimeout(flush, 400); }
  function flush() {
    clearTimeout(saveT);
    if (!map || !editing) return;
    if (!keepMap(map, entry.id)) toast('Impossible d\'enregistrer : la mémoire du navigateur est pleine.');
  }
  addEventListener('beforeunload', flush);

  /* ---------- the plan ---------- */
  const W = () => cv.clientWidth, H = () => cv.clientHeight;
  const sx = x => W() / 2 + (x - view.cx) * view.s, sz = z => H() / 2 + (z - view.cz) * view.s;
  const wx = px => (px - W() / 2) / view.s + view.cx, wz = py => (py - H() / 2) / view.s + view.cz;
  const grid = () => set.fine ? 0.1 : 0.5;
  const snap = v => Math.round(v / grid()) * grid();
  const inX = x => Math.max(-map.w / 2, Math.min(map.w / 2, x)), inZ = z => Math.max(-map.d / 2, Math.min(map.d / 2, z));
  const above = it => (isBox(it) ? it.y0 : it.y) >= level + 2;   // over the floor you work on: faded

  function draw() {
    if (!map || work.hidden) return;
    const dpr = devicePixelRatio || 1, w = W(), h = H();
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#1b1424'; g.fillRect(0, 0, w, h);
    const X = map.w / 2, Z = map.d / 2;
    // the ground, each half tinted by its team
    g.fillStyle = map.void ? '#24395a' : map.floor[0]; g.fillRect(sx(-X), sz(-Z), map.w * view.s, map.d * view.s);
    g.fillStyle = 'rgba(226,87,74,.10)'; g.fillRect(sx(-X), sz(-Z), X * view.s, map.d * view.s);
    g.fillStyle = 'rgba(74,127,224,.10)'; g.fillRect(sx(0), sz(-Z), X * view.s, map.d * view.s);
    // the grid
    const step = view.s < 8 ? 5 : 1;
    g.lineWidth = 1;
    for (let x = -X; x <= X + 1e-6; x += step) { g.strokeStyle = Math.abs(x % 5) < 1e-6 ? 'rgba(0,0,0,.28)' : 'rgba(0,0,0,.12)'; line(sx(x), sz(-Z), sx(x), sz(Z)); }
    for (let z = -Z; z <= Z + 1e-6; z += step) { g.strokeStyle = Math.abs(z % 5) < 1e-6 ? 'rgba(0,0,0,.28)' : 'rgba(0,0,0,.12)'; line(sx(-X), sz(z), sx(X), sz(z)); }
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.setLineDash([6, 4]); line(sx(0), sz(-Z), sx(0), sz(Z)); g.setLineDash([]);
    g.strokeStyle = map.walls ? '#8f8676' : 'rgba(255,255,255,.4)'; g.lineWidth = map.walls ? 4 : 1.5;
    g.strokeRect(sx(-X), sz(-Z), map.w * view.s, map.d * view.s);
    // the boxes, low ones first
    const order = map.items.map((it, i) => i).filter(i => isBox(map.items[i])).sort((a, b) => map.items[a].y1 - map.items[b].y1);
    for (const i of order) drawBox(map.items[i], i === sel);
    for (let i = 0; i < map.items.length; i++) if (!isBox(map.items[i])) drawPoint(map.items[i], i === sel);
    // what is being drawn
    if (drag && drag.ghost) drawBox(drag.ghost, false, true);
    if (drag && drag.kind === 'pad') {
      g.strokeStyle = '#7dfc9c'; g.lineWidth = 2; g.setLineDash([5, 4]); line(sx(drag.x0), sz(drag.z0), sx(drag.x), sz(drag.z)); g.setLineDash([]);
    }
    if (issues) for (const e of [...issues.errors, ...issues.warnings]) if (e.it && map.items.includes(e.it)) {
      const [px, pz] = isBox(e.it) ? [(e.it.x0 + e.it.x1) / 2, (e.it.z0 + e.it.z1) / 2] : [e.it.x, e.it.z];
      g.strokeStyle = issues.errors.includes(e) ? '#ff5d5d' : '#ffc94d'; g.lineWidth = 3;
      g.beginPath(); g.arc(sx(px), sz(pz), 16, 0, Math.PI * 2); g.stroke();
    }
    // the cursor's place
    if (hover) {
      g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '12px system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillText(`x ${fmt(snap(hover.x))}  z ${fmt(snap(hover.z))}  ·  étage ${fmt(level)} m`, 10, h - 22);
    }
  }
  function line(a, b, c, d) { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }
  function drawBox(it, on, ghost) {
    const x = sx(it.x0), z = sz(it.z0), w = (it.x1 - it.x0) * view.s, d = (it.z1 - it.z0) * view.s;
    const faded = !ghost && above(it);
    g.globalAlpha = ghost ? 0.6 : faded ? 0.28 : 1;
    // higher is lighter
    g.fillStyle = it.c; g.fillRect(x, z, w, d);
    const lift = Math.max(0, Math.min(0.35, it.y1 / 12));
    g.fillStyle = `rgba(255,255,255,${lift})`; g.fillRect(x, z, w, d);
    if (it.t === 'stairs') {
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1;
      for (const s of steps(it)) { g.strokeRect(sx(s.x0), sz(s.z0), (s.x1 - s.x0) * view.s, (s.z1 - s.z0) * view.s); }
      const cx = x + w / 2, cz = z + d / 2, [ux, uz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][it.dir], L = Math.min(Math.max(w, d) * 0.35, 40);
      g.strokeStyle = '#fff'; g.lineWidth = 2.5; line(cx - ux * L, cz - uz * L, cx + ux * L, cz + uz * L);
      g.beginPath(); g.moveTo(cx + ux * L, cz + uz * L); g.lineTo(cx + ux * (L - 8) - uz * 6, cz + uz * (L - 8) + ux * 6); g.lineTo(cx + ux * (L - 8) + uz * 6, cz + uz * (L - 8) - ux * 6); g.closePath(); g.fillStyle = '#fff'; g.fill();
    }
    if (it.t === 'wall') {
      const alongX = it.x1 - it.x0 >= it.z1 - it.z0;
      for (const [a, b, k] of it.holes || []) {
        const s0 = (alongX ? it.x0 : it.z0) + a, s1 = (alongX ? it.x0 : it.z0) + b;
        g.fillStyle = k === 'w' ? '#bfe6ff' : '#2a1e33';
        if (alongX) g.fillRect(sx(s0), z - 1, (s1 - s0) * view.s, d + 2); else g.fillRect(x - 1, sz(s0), w + 2, (s1 - s0) * view.s);
      }
    }
    g.strokeStyle = on ? '#fff' : 'rgba(0,0,0,.55)'; g.lineWidth = on ? 2.5 : 1;
    if (faded) g.setLineDash([4, 3]);
    g.strokeRect(x, z, w, d); g.setLineDash([]);
    if (w > 34 && d > 16 && it.t !== 'stairs') {
      g.fillStyle = 'rgba(0,0,0,.6)'; g.font = '11px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(it.y0 ? `${fmt(it.y0)}→${fmt(it.y1)}` : `↑${fmt(it.y1)}`, x + w / 2, z + d / 2);
    }
    if (on && !ghost) { g.fillStyle = '#fff'; for (const [a, b] of [[x, z], [x + w, z], [x, z + d], [x + w, z + d]]) g.fillRect(a - 4, b - 4, 8, 8); }
    g.globalAlpha = 1;
  }
  function drawPoint(it, on) {
    const x = sx(it.x), z = sz(it.z), r = Math.max(7, Math.min(14, view.s * 0.45));
    g.globalAlpha = above(it) ? 0.35 : 1;
    const team = it.x < 0 ? RED : BLUE;
    g.beginPath(); g.arc(x, z, r, 0, Math.PI * 2);
    g.fillStyle = it.t === 'spawn' || it.t === 'flag' ? team : it.t === 'pad' ? '#3fbf6a' : '#fff6e6'; g.fill();
    g.strokeStyle = on ? '#fff' : 'rgba(0,0,0,.6)'; g.lineWidth = on ? 3 : 1.5; g.stroke();
    g.font = `${Math.round(r * 1.2)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#fff';
    g.fillText(it.t === 'spawn' ? '🧍' : it.t === 'flag' ? '🚩' : it.t === 'pad' ? '⤴' : PICK_ICON[it.k], x, z + 1);
    if (it.t === 'pad' && (it.vx || it.vz)) {
      const t = 2 * it.vy / 9.8; // how long it flies, about
      g.strokeStyle = '#7dfc9c'; g.lineWidth = 2; g.setLineDash([5, 4]); line(x, z, sx(it.x + it.vx * t), sz(it.z + it.vz * t)); g.setLineDash([]);
    }
    if (it.y) { g.font = '10px system-ui, sans-serif'; g.fillStyle = '#fff'; g.fillText(`↑${fmt(it.y)}`, x, z + r + 8); }
    g.globalAlpha = 1;
  }

  /* ---------- the mouse on the plan ---------- */
  let drag = null, hover = null, space = false;
  // what's under a screen point: points first, then the highest box not faded, then any
  function hit(px, py) {
    const x = wx(px), z = wz(py), r = Math.max(0.4, 12 / view.s);
    let best = -1, bd = Infinity;
    map.items.forEach((it, i) => { if (!isBox(it)) { const d = Math.hypot(it.x - x, it.z - z); if (d < r && d < bd) { bd = d; best = i; } } });
    if (best >= 0) return best;
    const pad = 4 / view.s;
    const under = map.items.map((it, i) => i).filter(i => { const it = map.items[i]; return isBox(it) && x > it.x0 - pad && x < it.x1 + pad && z > it.z0 - pad && z < it.z1 + pad; });
    under.sort((a, b) => (above(map.items[a]) - above(map.items[b])) || (map.items[b].y1 - map.items[a].y1));
    return under.length ? under[0] : -1;
  }
  // the edges of the chosen box near a screen point, to stretch it
  function edges(px, py) {
    const it = map.items[sel]; if (!it || !isBox(it)) return null;
    const t = 7, x = px, z = py, X0 = sx(it.x0), X1 = sx(it.x1), Z0 = sz(it.z0), Z1 = sz(it.z1);
    if (x < X0 - t || x > X1 + t || z < Z0 - t || z > Z1 + t) return null;
    const e = { x0: Math.abs(x - X0) < t, x1: Math.abs(x - X1) < t, z0: Math.abs(z - Z0) < t, z1: Math.abs(z - Z1) < t };
    if (e.x0 && e.x1) e.x0 = false; if (e.z0 && e.z1) e.z0 = false;
    return e.x0 || e.x1 || e.z0 || e.z1 ? e : null;
  }
  // how high a point stands: on the highest thing under it, up to a little over the floor you work on
  function surface(x, z) {
    let y = map.void ? null : 0;
    for (const B of mapBoxes(map)) if (x > B.x0 && x < B.x1 && z > B.z0 && z < B.z1 && B.y1 <= level + 1.7 && (y == null || B.y1 > y)) y = B.y1;
    return y == null ? level : Math.round(y * 100) / 100;
  }
  const local = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    cv.focus(); cv.setPointerCapture(e.pointerId);
    const [px, py] = local(e), x = wx(px), z = wz(py);
    if (e.button === 1 || (e.button === 0 && space)) { drag = { kind: 'pan', px, py, cx: view.cx, cz: view.cz }; return; }
    if (e.button === 2) { const i = hit(px, py); if (i >= 0) { commit(() => { map.items.splice(i, 1); }); sel = -1; renderSide(); draw(); } return; }
    if (e.button !== 0) return;
    if (tool === 'select') {
      const ed = edges(px, py);
      if (ed) { drag = { kind: 'resize', ed, before: snapshot() }; return; }
      sel = hit(px, py); renderSide();
      if (sel >= 0) { const it = map.items[sel]; drag = { kind: 'move', x0: snap(x), z0: snap(z), orig: JSON.parse(JSON.stringify(it)), before: snapshot() }; }
      draw(); return;
    }
    if (['block', 'slab', 'wall', 'stairs'].includes(tool)) { drag = { kind: 'draw', x0: inX(snap(x)), z0: inZ(snap(z)) }; drag.ghost = shape(drag, drag.x0, drag.z0); draw(); return; }
    if (tool === 'door' || tool === 'window') { cut(x, z, tool === 'door' ? 'd' : 'w'); return; }
    if (tool === 'pad') { drag = { kind: 'pad', x0: inX(snap(x)), z0: inZ(snap(z)), x: inX(snap(x)), z: inZ(snap(z)) }; draw(); return; }
    place(inX(snap(x)), inZ(snap(z)));
  });
  cv.addEventListener('pointermove', e => {
    const [px, py] = local(e), x = wx(px), z = wz(py);
    hover = { x, z };
    if (!drag) {
      const ed = tool === 'select' && edges(px, py);
      cv.style.cursor = space ? 'grab' : ed ? ((ed.x0 || ed.x1) && (ed.z0 || ed.z1) ? 'nwse-resize' : ed.x0 || ed.x1 ? 'ew-resize' : 'ns-resize') : tool === 'select' ? 'default' : 'crosshair';
      draw(); return;
    }
    if (drag.kind === 'pan') { view.cx = drag.cx - (px - drag.px) / view.s; view.cz = drag.cz - (py - drag.py) / view.s; draw(); return; }
    if (drag.kind === 'draw') { drag.ghost = shape(drag, inX(snap(x)), inZ(snap(z))); draw(); return; }
    if (drag.kind === 'pad') { drag.x = inX(snap(x)); drag.z = inZ(snap(z)); draw(); return; }
    const it = map.items[sel]; if (!it) return;
    if (drag.kind === 'move') {
      const dx = snap(x) - drag.x0, dz = snap(z) - drag.z0, o = drag.orig;
      if (isBox(it)) {
        const lim = (a, b, half) => Math.max(-half - a, Math.min(half - b, 0));
        const mx = dx + lim(o.x0 + dx, o.x1 + dx, map.w / 2), mz = dz + lim(o.z0 + dz, o.z1 + dz, map.d / 2);
        Object.assign(it, { x0: o.x0 + mx, x1: o.x1 + mx, z0: o.z0 + mz, z1: o.z1 + mz });
      } else {
        it.x = inX(o.x + dx); it.z = inZ(o.z + dz);
        if (dx || dz) it.y = surface(it.x, it.z);
      }
      draw(); return;
    }
    if (drag.kind === 'resize') {
      const ed = drag.ed, m = 0.1;
      if (ed.x0) it.x0 = Math.min(inX(snap(x)), it.x1 - m); if (ed.x1) it.x1 = Math.max(inX(snap(x)), it.x0 + m);
      if (ed.z0) it.z0 = Math.min(inZ(snap(z)), it.z1 - m); if (ed.z1) it.z1 = Math.max(inZ(snap(z)), it.z0 + m);
      if (it.t === 'wall') clipHoles(it);
      draw();
    }
  });
  cv.addEventListener('pointerup', e => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.kind === 'draw') { const s = d.ghost; if (s) add(s); return; }
    if (d.kind === 'pad') {
      const dx = d.x - d.x0, dz = d.z - d.z0, far = Math.hypot(dx, dz), t = 2 * set.padUp / 9.8;
      const v = far > 0.4 ? Math.min(15, far / t) : 0;
      add({ t: 'pad', x: d.x0, y: surface(d.x0, d.z0), z: d.z0, vx: far > 0.4 ? Math.round(dx / far * v * 10) / 10 : 0, vy: set.padUp, vz: far > 0.4 ? Math.round(dz / far * v * 10) / 10 : 0 });
      return;
    }
    if (d.kind === 'move' || d.kind === 'resize') changed(d.before);
    draw();
  });
  cv.addEventListener('pointerleave', () => { hover = null; draw(); });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const [px, py] = local(e), x = wx(px), z = wz(py);
    view.s = Math.max(3, Math.min(120, view.s * Math.exp(-e.deltaY * 0.0015)));
    view.cx = x - (px - W() / 2) / view.s; view.cz = z - (py - H() / 2) / view.s;
    draw();
  }, { passive: false });

  // the shape a drag draws, from (a, b) to (x, z)
  function shape(d, x, z) {
    const lo = Math.min, hi = Math.max, c = set.color;
    if (tool === 'wall') {
      const alongX = Math.abs(x - d.x0) >= Math.abs(z - d.z0);
      if (alongX) { const a = lo(d.x0, x), b = hi(d.x0, x); return { t: 'wall', x0: a, x1: b === a ? a + 1 : b, z0: d.z0 - 0.15, z1: d.z0 + 0.15, y0: level, y1: level + set.wall, c, holes: [] }; }
      const a = lo(d.z0, z), b = hi(d.z0, z); return { t: 'wall', x0: d.x0 - 0.15, x1: d.x0 + 0.15, z0: a, z1: b, y0: level, y1: level + set.wall, c, holes: [] };
    }
    let x0 = lo(d.x0, x), x1 = hi(d.x0, x), z0 = lo(d.z0, z), z1 = hi(d.z0, z);
    if (x1 - x0 < 0.1) x1 = x0 + grid() * 2;
    if (z1 - z0 < 0.1) z1 = z0 + grid() * 2;
    if (tool === 'block') return { t: 'block', x0, x1, z0, z1, y0: level, y1: level + set.block, c };
    if (tool === 'slab') return { t: 'block', x0, x1, z0, z1, y0: level - 0.3, y1: level, c };
    // stairs climb the way you drag, along the longer side
    const alongX = Math.abs(x - d.x0) >= Math.abs(z - d.z0);
    const dir = alongX ? (x >= d.x0 ? 0 : 1) : (z >= d.z0 ? 2 : 3);
    if (alongX && z1 - z0 < 1.2) { z0 = d.z0 - 0.75; z1 = d.z0 + 0.75; }
    if (!alongX && x1 - x0 < 1.2) { x0 = d.x0 - 0.75; x1 = d.x0 + 0.75; }
    return { t: 'stairs', x0, x1, z0, z1, y0: level, y1: level + set.stairs, dir, c };
  }
  function add(it) {
    if (map.items.length >= LIMIT) { toast(`La carte est pleine (${LIMIT} éléments).`); return; }
    if (it.t === 'block' && (it.y1 <= 0 && !map.void)) { toast('Ce plancher est sous le sol : monte d\'un étage pour en faire une mezzanine.'); return; }
    commit(() => { map.items.push(it); });
    sel = map.items.length - 1;
    if (it.t === 'stairs' && (Math.max(it.x1 - it.x0, it.z1 - it.z0) / Math.ceil((it.y1 - it.y0) / 0.24)) < 0.25) toast('Escalier très raide : allonge-le, sinon on aura du mal à le monter.', 3500);
    renderSide(); draw();
  }
  function place(x, z) {
    const y = surface(x, z);
    if (tool === 'spawn') add({ t: 'spawn', x, y, z });
    if (tool === 'pickup') add({ t: 'pickup', k: set.kind, x, y, z });
    if (tool === 'flag') {
      if (Math.abs(x) < 0.5) { toast('Un drapeau va d\'un côté : à gauche les Rouges, à droite les Bleus.'); return; }
      commit(() => { map.items = map.items.filter(it => !(it.t === 'flag' && (it.x < 0) === (x < 0))); map.items.push({ t: 'flag', x, y, z }); });
      sel = map.items.length - 1; renderSide(); draw();
    }
  }
  // a door or a window in the wall under (x, z), or the one there filled in
  function cut(x, z, k) {
    const pad = 0.4;
    const i = map.items.findIndex(it => it.t === 'wall' && x > it.x0 - pad && x < it.x1 + pad && z > it.z0 - pad && z < it.z1 + pad && !above(it));
    if (i < 0) { toast('Clique sur un mur.'); return; }
    const it = map.items[i], alongX = it.x1 - it.x0 >= it.z1 - it.z0, len = alongX ? it.x1 - it.x0 : it.z1 - it.z0;
    const at = (alongX ? x - it.x0 : z - it.z0);
    commit(() => {
      const old = it.holes.findIndex(([a, b]) => at >= a && at <= b);
      if (old >= 0) { it.holes.splice(old, 1); return; }
      const half = k === 'd' ? 0.8 : 0.7;
      const a = Math.max(0, Math.min(len - 2 * half, snap(at) - half)), b = Math.min(len, a + 2 * half);
      if (b - a < 0.3) return;
      it.holes = it.holes.filter(([p, q]) => q <= a || p >= b);
      it.holes.push([Math.round(a * 100) / 100, Math.round(b * 100) / 100, k]);
      it.holes.sort((p, q) => p[0] - q[0]);
    });
    sel = i; renderSide(); draw();
  }
  function clipHoles(it) {
    const len = Math.max(it.x1 - it.x0, it.z1 - it.z0);
    it.holes = (it.holes || []).filter(h => h[0] < len - 0.3).map(([a, b, k]) => [a, Math.min(b, len), k]);
  }
  // the same thing on the other side of the middle line
  function mirrored(it) {
    const c = JSON.parse(JSON.stringify(it));
    if (isBox(c)) {
      [c.x0, c.x1] = [-it.x1, -it.x0];
      if (c.t === 'stairs' && c.dir < 2) c.dir = 1 - c.dir;
      if (c.t === 'wall' && it.x1 - it.x0 >= it.z1 - it.z0) { const len = it.x1 - it.x0; c.holes = it.holes.map(([a, b, k]) => [Math.round((len - b) * 100) / 100, Math.round((len - a) * 100) / 100, k]).reverse(); }
    } else { c.x = -it.x; if (c.t === 'pad') c.vx = -it.vx; }
    return c;
  }
  function mirrorSel() {
    const it = map.items[sel]; if (!it) return;
    const c = mirrored(it);
    commit(() => {
      if (c.t === 'flag') map.items = map.items.filter(o => !(o.t === 'flag' && (o.x < 0) === (c.x < 0)));
      map.items.push(c);
    });
    sel = map.items.indexOf(c); renderSide(); draw();
  }
  function mirrorHalf() {
    if (!confirm('Remplacer toute la moitié droite (Bleus) par le reflet de la moitié gauche (Rouges) ?')) return;
    commit(() => {
      const cx = it => isBox(it) ? (it.x0 + it.x1) / 2 : it.x;
      const left = map.items.filter(it => cx(it) < 0), mid = map.items.filter(it => cx(it) === 0);
      map.items = [...left, ...mid, ...left.map(mirrored)].slice(0, LIMIT);
    });
    sel = -1; renderSide(); draw();
  }
  function duplicate() {
    const it = map.items[sel]; if (!it || it.t === 'flag') return;
    const c = JSON.parse(JSON.stringify(it)), d = 1;
    if (isBox(c)) { c.x0 += d; c.x1 += d; c.z0 += d; c.z1 += d; if (c.x1 > map.w / 2 || c.z1 > map.d / 2) { c.x0 -= 2 * d; c.x1 -= 2 * d; c.z0 -= 2 * d; c.z1 -= 2 * d; } }
    else { c.x = inX(c.x + d); c.z = inZ(c.z + d); }
    add(c);
  }

  /* ---------- the side panel: the chosen thing, or the map ---------- */
  function renderSide() {
    side.textContent = '';
    if (issues) side.append(issueBox());
    const it = map.items[sel];
    if (it) side.append(itemBox(it)); else side.append(mapBox());
  }
  const row = (label, inp) => { const l = $el('label', 'me-f'); l.append($el('span', null, label), inp); return l; };
  function numIn(v, step, fn, min = -200, max = 200) {
    const i = $el('input'); i.type = 'number'; i.step = step; i.value = Math.round(v * 100) / 100;
    i.addEventListener('change', () => { const n = Number(i.value); if (Number.isFinite(n)) commit(() => fn(Math.max(min, Math.min(max, Math.round(n * 100) / 100)))); else i.value = v; });
    return i;
  }
  const NAMES = { block: 'Bloc', wall: 'Mur', stairs: 'Escalier', spawn: 'Point d\'apparition', pickup: 'Bonus', pad: 'Tremplin', flag: 'Drapeau' };
  function itemBox(it) {
    const box = $el('section', 'me-panel');
    let title = NAMES[it.t];
    if (it.t === 'spawn' || it.t === 'flag') title += it.x < 0 ? ' · Rouges' : ' · Bleus';
    box.append($el('h3', null, title));
    const grid2 = $el('div', 'me-grid');
    if (isBox(it)) {
      const X = map.w / 2, Z = map.d / 2;
      grid2.append(row('x de', numIn(it.x0, 0.1, v => { it.x0 = Math.min(v, it.x1 - 0.1); }, -X, X)), row('à', numIn(it.x1, 0.1, v => { it.x1 = Math.max(v, it.x0 + 0.1); }, -X, X)),
        row('z de', numIn(it.z0, 0.1, v => { it.z0 = Math.min(v, it.z1 - 0.1); }, -Z, Z)), row('à', numIn(it.z1, 0.1, v => { it.z1 = Math.max(v, it.z0 + 0.1); }, -Z, Z)),
        row('Bas', numIn(it.y0, 0.1, v => { it.y0 = Math.min(v, it.y1 - 0.1); }, -10, 30)), row('Haut', numIn(it.y1, 0.1, v => { it.y1 = Math.max(v, it.y0 + 0.1); }, -10, 40)));
      box.append(grid2);
      if (it.t === 'stairs') {
        const s = $el('select');
        ['vers la droite (+x)', 'vers la gauche (−x)', 'vers le bas (+z)', 'vers le haut (−z)'].forEach((n, i) => { const o = $el('option', null, n); o.value = i; s.append(o); });
        s.value = it.dir; s.addEventListener('change', () => commit(() => { it.dir = Number(s.value); }));
        box.append(row('Monte', s));
      }
      if (it.t === 'wall') {
        const hs = $el('div', 'me-holes');
        if (!it.holes.length) hs.append($el('small', null, 'Pas d\'ouverture : outils Porte et Fenêtre.'));
        it.holes.forEach((h, k) => {
          const r = $el('div', 'me-hole'); r.append($el('span', null, `${h[2] === 'w' ? '🪟 Fenêtre' : '🚪 Porte'} à ${fmt(h[0])} m`));
          const b = $el('button', 'btn ghost', '×'); b.type = 'button'; b.title = 'Reboucher';
          b.addEventListener('click', () => commit(() => { it.holes.splice(k, 1); })); r.append(b); hs.append(r);
        });
        box.append(hs);
      }
      box.append(swatches(it.c, c => commit(() => { it.c = c; })));
    } else {
      grid2.append(row('x', numIn(it.x, 0.1, v => { it.x = v; }, -map.w / 2, map.w / 2)), row('z', numIn(it.z, 0.1, v => { it.z = v; }, -map.d / 2, map.d / 2)), row('Hauteur', numIn(it.y, 0.1, v => { it.y = v; }, -10, 40)));
      box.append(grid2);
      if (it.t === 'pickup') {
        const s = $el('select'); for (const k in KINDS) { const o = $el('option', null, PICK_ICON[k] + ' ' + KINDS[k]); o.value = k; s.append(o); }
        s.value = it.k; s.addEventListener('change', () => commit(() => { it.k = s.value; })); box.append(row('Bonus', s));
      }
      if (it.t === 'pad') {
        const g3 = $el('div', 'me-grid');
        g3.append(row('Poussée x', numIn(it.vx, 0.5, v => { it.vx = v; }, -15, 15)), row('vers le haut', numIn(it.vy, 0.5, v => { it.vy = v; }, 0, 20)), row('Poussée z', numIn(it.vz, 0.5, v => { it.vz = v; }, -15, 15)));
        box.append(g3);
      }
    }
    const acts = $el('div', 'me-row');
    const b = (t, fn, title) => { const x = $el('button', 'btn ghost', t); x.type = 'button'; if (title) x.title = title; x.addEventListener('click', fn); acts.append(x); };
    if (it.t !== 'flag') b('⧉ Dupliquer', duplicate, 'Ctrl+D');
    b('⇋ Miroir', mirrorSel, 'Une copie de l\'autre côté de la ligne du milieu (Ctrl+M)');
    b('🗑 Supprimer', () => { commit(() => { map.items.splice(sel, 1); }); sel = -1; renderSide(); draw(); }, 'Suppr');
    box.append(acts);
    return box;
  }
  function mapBox() {
    const box = $el('section', 'me-panel');
    box.append($el('h3', null, 'La carte'));
    const g2 = $el('div', 'me-grid');
    const size = (v, fn) => { const s = $el('select'); for (let n = 10; n <= 120; n += 5) { const o = $el('option', null, n + ' m'); o.value = n; s.append(o); } s.value = v; s.addEventListener('change', () => { const n = Number(s.value); commit(() => fn(n)); fit(); draw(); }); return s; };
    g2.append(row('Largeur', size(map.w, n => { map.w = n; })), row('Profondeur', size(map.d, n => { map.d = n; })));
    box.append(g2);
    const th = $el('select'); for (const k in THEMES) { const o = $el('option', null, THEMES[k]); o.value = k; th.append(o); }
    th.value = map.theme; th.addEventListener('change', () => commit(() => { map.theme = th.value; }));
    box.append(row('Ambiance', th));
    const check = (label, v, fn) => { const l = $el('label', 'me-check'); const c = $el('input'); c.type = 'checkbox'; c.checked = v; c.addEventListener('change', () => { commit(() => fn(c.checked)); renderOpts(); }); l.append(c, $el('span', null, label)); return l; };
    box.append(check('Murs tout autour', map.walls, v => { map.walls = v; }));
    if (map.walls) box.append(row('Hauteur des murs', numIn(map.wallH, 0.5, v => { map.wallH = v; }, 1, 20)));
    box.append(check('Au-dessus du vide (pas de sol : qui tombe est éliminé)', map.void, v => { map.void = v; }));
    if (!map.void) {
      box.append($el('small', 'me-lbl', 'Sol, en damier'));
      box.append(swatches(map.floor[0], c => commit(() => { map.floor[0] = c; })), swatches(map.floor[1], c => commit(() => { map.floor[1] = c; })));
    } else box.append($el('small', 'me-lbl', 'Construis le sol avec l\'outil Plancher, à l\'étage 0.'));
    const acts = $el('div', 'me-row');
    const mb = $el('button', 'btn ghost', '⇋ Gauche → droite'); mb.type = 'button'; mb.title = 'Recopier la moitié des Rouges, en miroir, chez les Bleus';
    mb.addEventListener('click', mirrorHalf); acts.append(mb);
    box.append(acts);
    const pts = t => map.items.filter(it => it.t === t).length;
    box.append($el('p', 'me-stats', `${map.items.length} / ${LIMIT} éléments · ${pts('spawn')} apparitions · ${pts('pickup')} bonus · ${pts('pad')} tremplins · ${pts('flag')} / 2 drapeaux`));
    box.append($el('p', 'me-keys', 'Touches : 1 à 9 et 0, − les outils · Ctrl+Z annuler · Ctrl+Y refaire · Suppr effacer · Ctrl+D dupliquer · Ctrl+M miroir · Page haut / bas changer d\'étage · Échap désélectionner'));
    return box;
  }
  function runCheck() {
    issues = checkMap(map);
    renderSide(); draw();
    if (!issues.errors.length && !issues.warnings.length) toast('Tout est bon : la carte est prête !');
    else if (!issues.errors.length) toast('La carte est jouable, avec quelques conseils.');
    else toast('À corriger avant de jouer : voir à droite.');
    return issues;
  }
  function issueBox() {
    const box = $el('section', 'me-panel me-issues');
    box.append($el('h3', null, issues.errors.length ? '⛔ À corriger' : issues.warnings.length ? '✅ Jouable' : '✅ Tout est bon'));
    for (const e of [...issues.errors.map(e => [e, 'err']), ...issues.warnings.map(e => [e, 'warn'])]) {
      const b = $el('button', 'me-issue ' + e[1], e[0].msg); b.type = 'button';
      b.addEventListener('click', () => {
        if (!e[0].it) return;
        const i = map.items.indexOf(e[0].it); if (i < 0) return;
        sel = i; const it = e[0].it;
        [view.cx, view.cz] = isBox(it) ? [(it.x0 + it.x1) / 2, (it.z0 + it.z1) / 2] : [it.x, it.z];
        level = isBox(it) ? it.y0 : Math.max(0, it.y - 0.5);
        renderOpts(); renderSide(); draw();
      });
      box.append(b);
    }
    const x = $el('button', 'mode-switch', 'Fermer'); x.type = 'button'; x.addEventListener('click', () => { issues = null; renderSide(); draw(); });
    box.append(x);
    return box;
  }

  /* ---------- the keyboard ---------- */
  addEventListener('keydown', e => {
    if (work.hidden || !editing) return;
    if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.target !== cv) return;
    if (in3d) { keys3[e.code] = true; if (e.code === 'Escape') toggle3d(); return; }
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.code === 'KeyZ') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
    if (ctrl && e.code === 'KeyY') { e.preventDefault(); doRedo(); return; }
    if (ctrl && e.code === 'KeyD') { e.preventDefault(); duplicate(); return; }
    if (ctrl && e.code === 'KeyM') { e.preventDefault(); mirrorSel(); return; }
    if (ctrl) return;
    if (e.code === 'Space') { space = true; cv.style.cursor = 'grab'; e.preventDefault(); return; }
    if (e.code === 'Delete' || e.code === 'Backspace') { if (sel >= 0) { commit(() => { map.items.splice(sel, 1); }); sel = -1; renderSide(); draw(); } e.preventDefault(); return; }
    if (e.code === 'Escape') { sel = -1; drag = null; renderSide(); draw(); return; }
    if (e.code === 'PageUp' || e.code === 'PageDown') { level = Math.max(map.void ? -10 : 0, Math.min(30, level + (e.code === 'PageUp' ? 0.5 : -0.5))); renderOpts(); draw(); e.preventDefault(); return; }
    if (e.key === 'Shift') { set.fine = true; return; }
    const m = e.code.match(/^(?:Digit|Numpad)(\d)$/);
    if (m) { const i = (Number(m[1]) + 9) % 10; if (TOOLS[i]) pickTool(TOOLS[i].id); return; }
    if (e.code === 'Minus' || e.code === 'NumpadSubtract' || e.key === ')') { if (TOOLS[10]) pickTool(TOOLS[10].id); return; }
    const pan = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.code];
    if (pan) { view.cx += pan[0] * 60 / view.s; view.cz += pan[1] * 60 / view.s; draw(); e.preventDefault(); }
  });
  addEventListener('keyup', e => {
    if (in3d) { keys3[e.code] = false; return; }
    if (e.code === 'Space') { space = false; cv.style.cursor = ''; }
    if (e.key === 'Shift') set.fine = false;
  });
  addEventListener('resize', () => { if (!work.hidden) draw(); if (in3d) size3d(); });

  /* ---------- flying around it in 3D ---------- */
  let in3d = false, r3 = null, s3 = null, cam = null, raf = 0, last = 0;
  const keys3 = {}, look = { yaw: 0, pitch: -0.5 };
  const v3 = $el('div', 'me-3d'); v3.hidden = true;
  const v3hint = $el('div', 'me-hint', 'Clique pour viser à la souris · ZQSD ou flèches : avancer · Espace / C : monter, descendre · Maj : plus vite · Échap : retour au plan');
  v3.append(v3hint); stage.append(v3);
  function toggle3d() {
    in3d = !in3d;
    b3d.textContent = in3d ? '🗺️ Plan' : '🧊 Vue 3D';
    v3.hidden = !in3d; cv.hidden = in3d; opts.hidden = in3d; hint.hidden = in3d;
    if (in3d) start3d(); else { stop3d(); cv.focus(); draw(); }
  }
  function start3d() {
    if (!r3) {
      r3 = new THREE.WebGLRenderer({ antialias: true });
      r3.shadowMap.enabled = true; r3.shadowMap.type = THREE.PCFSoftShadowMap;
      r3.outputColorSpace = THREE.SRGBColorSpace;
      r3.domElement.className = 'me-gl'; v3.prepend(r3.domElement);
      r3.domElement.addEventListener('click', () => { try { const p = r3.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} });
      addEventListener('mousemove', e => {
        if (!in3d || document.pointerLockElement !== r3.domElement) return;
        look.yaw -= e.movementX * 0.0025; look.pitch = Math.max(-1.5, Math.min(1.5, look.pitch - e.movementY * 0.0025));
      });
    }
    s3 = new THREE.Scene();
    const m = cleanMap(map), built = buildMap(s3, m);
    const L = m.void ? 20 : 0;
    // the points, which a battle draws its own way
    const mk = (geo, c, x, y, z) => { const o = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: c })); o.position.set(x, y, z); s3.add(o); return o; };
    const pole = new THREE.CylinderGeometry(0.25, 0.25, 1.8, 16), ball = new THREE.SphereGeometry(0.3, 16, 12), disc = new THREE.CylinderGeometry(0.6, 0.6, 0.1, 20), stick = new THREE.CylinderGeometry(0.04, 0.04, 2, 8), cloth = new THREE.BoxGeometry(0.7, 0.45, 0.04);
    for (const it of m.items) {
      if (it.t === 'spawn') mk(pole, it.x < 0 ? RED : BLUE, it.x, it.y + L + 0.9, it.z).material.transparent = true;
      if (it.t === 'pickup') mk(ball, { health: '#ff5d73', armor: '#59a7ff', rocket: '#ff9a3c', railgun: '#b07cff' }[it.k], it.x, it.y + L + 0.6, it.z);
      if (it.t === 'pad') mk(disc, '#3fbf6a', it.x, it.y + L + 0.05, it.z);
      if (it.t === 'flag') { mk(stick, '#eee', it.x, it.y + L + 1, it.z); mk(cloth, it.x < 0 ? RED : BLUE, it.x + 0.35, it.y + L + 1.7, it.z); }
    }
    cam = new THREE.PerspectiveCamera(70, 1, 0.05, built.far + 40);
    const it = map.items[sel];
    const [cx, cz] = it ? (isBox(it) ? [(it.x0 + it.x1) / 2, (it.z0 + it.z1) / 2] : [it.x, it.z]) : [view.cx, view.cz];
    cam.position.set(cx, L + level + Math.max(6, Math.min(25, Math.max(map.w, map.d) * 0.3)), cz + Math.max(6, Math.min(25, map.d * 0.4)));
    look.yaw = 0; look.pitch = -0.7;
    size3d(); last = performance.now();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function size3d() { if (!r3) return; const r = stage.getBoundingClientRect(); r3.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r3.setSize(r.width, r.height); cam.aspect = r.width / Math.max(1, r.height); cam.updateProjectionMatrix(); }
  function frame(t) {
    if (!in3d) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    const sp = (keys3.ShiftLeft || keys3.ShiftRight ? 16 : 6) * dt;
    const f = (keys3.KeyW || keys3.ArrowUp ? 1 : 0) - (keys3.KeyS || keys3.ArrowDown ? 1 : 0), s = (keys3.KeyD || keys3.ArrowRight ? 1 : 0) - (keys3.KeyA || keys3.ArrowLeft ? 1 : 0);
    const u = (keys3.Space ? 1 : 0) - (keys3.KeyC || keys3.ControlLeft ? 1 : 0);
    const fx = -Math.sin(look.yaw) * Math.cos(look.pitch), fy = Math.sin(look.pitch), fz = -Math.cos(look.yaw) * Math.cos(look.pitch);
    cam.position.x += (fx * f + Math.cos(look.yaw) * s) * sp; cam.position.z += (fz * f - Math.sin(look.yaw) * s) * sp; cam.position.y += (fy * f + u) * sp;
    cam.rotation.set(look.pitch, look.yaw, 0, 'YXZ');
    r3.render(s3, cam);
  }
  function stop3d() {
    cancelAnimationFrame(raf);
    if (in3d) { in3d = false; b3d.textContent = '🧊 Vue 3D'; v3.hidden = true; cv.hidden = false; opts.hidden = false; hint.hidden = false; }
    if (document.pointerLockElement) document.exitPointerLock();
    for (const k in keys3) keys3[k] = false;
    if (s3) { s3.traverse(o => { if (o.geometry) o.geometry.dispose(); }); s3 = null; }
  }
  document.addEventListener('pointerlockchange', () => { v3hint.hidden = !!document.pointerLockElement && in3d; });

  return { list };
}

function injectStyle() {
  const s = document.createElement('style');
  s.textContent = `
.me{position:fixed;inset:0;z-index:30;background:#140e1b;color:var(--cream);font-family:inherit}
.me .btn{font-size:14px;padding:8px 12px}
.me-list{position:absolute;inset:0;overflow:auto;display:grid;place-items:start center;padding:32px 16px}
.me-card{width:min(760px,100%);background:var(--plum);border:1px solid var(--line);border-top:6px solid var(--marigold);border-radius:24px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.45)}
.me-card h1{margin:0;font-family:var(--display);font-size:32px}
.me-card-head p{color:var(--muted);line-height:1.45;margin:8px 0 14px}
.me-row{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
.me-maps{display:flex;flex-direction:column;gap:8px;margin:14px 0}
.me-empty{color:var(--muted);line-height:1.45}
.me-map{display:flex;align-items:center;gap:10px;justify-content:space-between;background:var(--night);border:1px solid var(--line);border-radius:16px;padding:10px 12px;flex-wrap:wrap}
.me-map-t{display:flex;flex-direction:column;min-width:0}
.me-map-t b{font-size:17px}.me-map-t small{color:var(--muted)}
.me-map-a{display:flex;gap:6px;flex-wrap:wrap}
.me-work{position:absolute;inset:0;display:grid;grid-template-columns:96px 1fr 300px;grid-template-rows:auto 1fr}
.me-bar{grid-column:1/-1;display:flex;gap:8px;align-items:center;padding:8px 10px;background:var(--plum);border-bottom:1px solid var(--line);flex-wrap:wrap}
.me-name{flex:1;min-width:140px;max-width:320px;font:inherit;font-weight:800;font-size:16px;padding:7px 10px;border-radius:10px;border:1px solid var(--line);background:var(--night);color:var(--cream)}
.me-tools{display:flex;flex-direction:column;gap:4px;padding:8px 6px;background:var(--plum);border-right:1px solid var(--line);overflow:auto}
.me-tool{display:flex;flex-direction:column;align-items:center;gap:1px;padding:6px 2px;border-radius:12px;border:2px solid transparent;background:var(--night);color:var(--cream);font:inherit;cursor:pointer}
.me-tool b{font-size:20px;line-height:1.1}.me-tool span{font-size:11px;font-weight:700}
.me-tool[aria-pressed="true"]{border-color:var(--marigold);background:var(--plum-2)}
.me-stage{position:relative;overflow:hidden;min-width:0;min-height:0}
.me-canvas{position:absolute;inset:0;width:100%;height:100%;outline:none;touch-action:none}
.me-opts{position:absolute;left:10px;top:10px;right:10px;display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;pointer-events:none}
.me-opts>*{pointer-events:auto;background:rgba(34,24,44,.92);border:1px solid var(--line);border-radius:12px;padding:6px 8px}
.me-hint{position:absolute;left:10px;right:10px;bottom:30px;color:var(--muted);font-size:12px;line-height:1.35;pointer-events:none;text-shadow:0 1px 2px #000}
.me-f{display:flex;flex-direction:column;gap:2px;font-size:11px;font-weight:700;color:var(--muted)}
.me-f input,.me-f select{font:inherit;font-size:14px;color:var(--cream);background:var(--night);border:1px solid var(--line);border-radius:8px;padding:4px 6px;min-width:0;width:100%}
.me-opts .me-f input{width:80px}
.me-sw{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:6px 0}
.me-sw button{width:22px;height:22px;border-radius:6px;border:2px solid rgba(0,0,0,.4);cursor:pointer;padding:0}
.me-sw button[aria-pressed="true"]{border-color:#fff;box-shadow:0 0 0 2px var(--marigold)}
.me-sw input{width:28px;height:24px;padding:0;border:0;background:none;cursor:pointer}
.me-side{background:var(--plum);border-left:1px solid var(--line);overflow:auto;padding:10px}
.me-panel{background:var(--night);border:1px solid var(--line);border-radius:16px;padding:10px 12px;margin-bottom:10px}
.me-panel h3{margin:0 0 8px;font-size:15px}
.me-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 8px;margin-bottom:8px}
.me-check{display:flex;gap:8px;align-items:flex-start;font-size:13px;margin:8px 0;cursor:pointer}
.me-lbl{display:block;color:var(--muted);font-size:12px;margin-top:8px}
.me-stats,.me-keys{color:var(--muted);font-size:12px;line-height:1.4;margin:8px 0 0}
.me-holes{display:flex;flex-direction:column;gap:4px;margin-bottom:6px;font-size:13px}
.me-hole{display:flex;justify-content:space-between;align-items:center}
.me-hole .btn{padding:2px 8px}
.me-issue{display:block;width:100%;text-align:left;font:inherit;font-size:13px;line-height:1.35;color:var(--cream);background:var(--plum-2);border:0;border-left:4px solid #ff5d5d;border-radius:8px;padding:6px 8px;margin:4px 0;cursor:pointer}
.me-issue.warn{border-left-color:#ffc94d}
.me-3d{position:absolute;inset:0}
.me-gl{display:block;width:100%;height:100%;cursor:crosshair}
`;
  document.head.append(s);
}
