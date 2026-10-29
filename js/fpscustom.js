// The players' own battle maps, made in the map editor (js/mapeditor.js) and kept as JSON:
// { v, name, w, d, theme, floor: [c1, c2], walls, wallH, void, items: [...] }.
// Every solid thing is a box { t, x0, x1, z0, z1, y0, y1, c }: `block`, `wall` (its openings in
// `holes`, [from, to, 'd' door or 'w' window] along its length from its start) and `stairs`
// (`dir`: the way they climb, 0 +x, 1 -x, 2 +z, 3 -z). The rest are points { t, x, y, z }:
// `spawn` (the side of x = 0 says the team), `pickup` (`k`), `pad` (`vx`, `vy`, `vz`) and `flag`
// (the Rouges' at x < 0). With `void`, there is no floor: you build the ground yourself, and
// falling off it is out. Whoever creates a room with a map sends it to those who join.
import * as THREE from 'three';
import { toon, noOutline } from './fx.js';
import { makeKit } from './fpsmap.js';
import { setWorld, nearestSpot, spotAt, blocked, groundAt, TALL } from './world.js';

export const KINDS = { health: 'Soin', armor: 'Armure', rocket: 'Lance-roquettes', railgun: 'Railgun' };
export const THEMES = { jour: 'Jour', soir: 'Coucher de soleil', nuit: 'Nuit' };
export const LIMIT = 1500;        // items in a map
const RISE = 0.24;                // a stair step: under what you climb without jumping
const LIFT = 20;                  // a map with a void is built this high, its void below
const DOOR = 2.4, SILL = 1.0, LINTEL = 2.0;

const num = (v, lo, hi, d = 0) => { v = Number(v); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v * 100) / 100)) : d; };
const col = (c, d) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : d;

export function blankMap() {
  const items = [];
  for (const s of [-1, 1]) {
    for (const z of [-4, 0, 4]) items.push({ t: 'spawn', x: s * 16, y: 0, z });
    items.push({ t: 'flag', x: s * 18, y: 0, z: 0 });
  }
  items.push({ t: 'pickup', k: 'health', x: 0, y: 0, z: 0 });
  return { v: 1, name: 'Ma carte', w: 40, d: 30, theme: 'jour', floor: ['#7aa35a', '#82ab62'], walls: true, wallH: 4, void: false, items };
}

// a map from anywhere (a friend, a file): only what we know, within sane limits
export function cleanMap(m) {
  if (!m || typeof m !== 'object') return null;
  const w = num(m.w, 10, 120, 40), d = num(m.d, 10, 120, 30), X = w / 2, Z = d / 2;
  const out = {
    v: 1, name: String(m.name || 'Carte sans nom').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 30) || 'Carte sans nom',
    w, d, theme: THEMES[m.theme] ? m.theme : 'jour',
    floor: [col(m.floor && m.floor[0], '#7aa35a'), col(m.floor && m.floor[1], '#82ab62')],
    walls: m.walls !== false, wallH: num(m.wallH, 1, 20, 4), void: !!m.void, items: []
  };
  for (const it of Array.isArray(m.items) ? m.items.slice(0, LIMIT) : []) {
    if (!it || typeof it !== 'object') continue;
    if (it.t === 'block' || it.t === 'wall' || it.t === 'stairs') {
      const b = { t: it.t, x0: num(it.x0, -X, X), x1: num(it.x1, -X, X), z0: num(it.z0, -Z, Z), z1: num(it.z1, -Z, Z), y0: num(it.y0, -10, 30), y1: num(it.y1, -10, 40), c: col(it.c, '#b07a45') };
      if (b.x1 < b.x0) [b.x0, b.x1] = [b.x1, b.x0];
      if (b.z1 < b.z0) [b.z0, b.z1] = [b.z1, b.z0];
      if (b.y1 < b.y0) [b.y0, b.y1] = [b.y1, b.y0];
      if (b.x1 - b.x0 < 0.05 || b.z1 - b.z0 < 0.05 || b.y1 - b.y0 < 0.05) continue;
      if (it.t === 'stairs') b.dir = [0, 1, 2, 3].includes(it.dir) ? it.dir : 0;
      if (it.t === 'wall') {
        const len = Math.max(b.x1 - b.x0, b.z1 - b.z0);
        b.holes = (Array.isArray(it.holes) ? it.holes.slice(0, 20) : []).filter(Array.isArray)
          .map(([a, c, k]) => [num(a, 0, len), num(c, 0, len), k === 'w' ? 'w' : 'd']).filter(h => h[1] - h[0] >= 0.3);
      }
      out.items.push(b);
    } else if (it.t === 'spawn' || it.t === 'pickup' || it.t === 'pad' || it.t === 'flag') {
      const p = { t: it.t, x: num(it.x, -X, X), y: num(it.y, -10, 40), z: num(it.z, -Z, Z) };
      if (it.t === 'pickup') p.k = KINDS[it.k] ? it.k : 'health';
      if (it.t === 'pad') { p.vx = num(it.vx, -15, 15); p.vy = num(it.vy, 0, 20, 9.5); p.vz = num(it.vz, -15, 15); }
      out.items.push(p);
    }
  }
  // one flag a side: the first one found
  const seen = new Set();
  out.items = out.items.filter(it => { if (it.t !== 'flag') return true; const s = it.x < 0 ? 0 : 1; if (seen.has(s)) return false; seen.add(s); return true; });
  return out;
}

// the steps of a flight of stairs, as boxes { x0, x1, z0, z1, y0, y1 }
export function steps(s) {
  const alongX = s.dir < 2, len = alongX ? s.x1 - s.x0 : s.z1 - s.z0, h = s.y1 - s.y0;
  const n = Math.max(1, Math.ceil(h / RISE)), run = len / n, up = s.dir % 2 === 0;
  const out = [];
  for (let k = 1; k <= n; k++) {
    const a = up ? (k - 1) * run : len - k * run, b = a + run, top = s.y0 + k * h / n;
    out.push(alongX ? { x0: s.x0 + a, x1: s.x0 + b, z0: s.z0, z1: s.z1, y0: s.y0, y1: top } : { x0: s.x0, x1: s.x1, z0: s.z0 + a, z1: s.z0 + b, y0: s.y0, y1: top });
  }
  return out;
}
// a wall's openings, as makeKit wants them: [from, to, bottom, top] along its axis
export function wallHoles(b) {
  const alongX = b.x1 - b.x0 >= b.z1 - b.z0, s0 = alongX ? b.x0 : b.z0;
  return (b.holes || []).map(([a, c, k]) => [s0 + a, s0 + c, k === 'w' ? Math.min(b.y1, b.y0 + SILL) : b.y0, Math.min(b.y1, b.y0 + (k === 'w' ? LINTEL : DOOR))])
    .filter(h => h[3] > h[2]).sort((p, q) => p[0] - q[0]);
}

// the solid boxes of a map, without drawing anything (the editor's check)
export function mapBoxes(m, lift = 0) {
  const boxes = [];
  const add = (x0, x1, z0, z1, y0, y1) => boxes.push({ x0, x1, z0, z1, y0: y0 + lift, y1: y1 + lift });
  for (const it of m.items) {
    if (it.t === 'block') add(it.x0, it.x1, it.z0, it.z1, it.y0, it.y1);
    else if (it.t === 'stairs') for (const s of steps(it)) add(s.x0, s.x1, s.z0, s.z1, s.y0, s.y1);
    else if (it.t === 'wall') {
      const alongX = it.x1 - it.x0 >= it.z1 - it.z0;
      const [s0, s1] = alongX ? [it.x0, it.x1] : [it.z0, it.z1];
      let s = s0; const put = (a, b, y0, y1) => alongX ? add(a, b, it.z0, it.z1, y0, y1) : add(it.x0, it.x1, a, b, y0, y1);
      for (const [h0, h1, hb, ht] of wallHoles(it)) {
        if (h0 > s) put(s, h0, it.y0, it.y1);
        if (hb > it.y0) put(h0, h1, it.y0, hb);
        if (ht < it.y1) put(h0, h1, ht, it.y1);
        s = Math.max(s, h1);
      }
      if (s < s1) put(s, s1, it.y0, it.y1);
    }
  }
  if (m.walls) {
    const X = m.w / 2, Z = m.d / 2, H = m.wallH;
    add(-X - 0.4, X + 0.4, -Z - 0.4, -Z, 0, H); add(-X - 0.4, X + 0.4, Z, Z + 0.4, 0, H);
    add(-X - 0.4, -X, -Z, Z, 0, H); add(X, X + 0.4, -Z, Z, 0, H);
  }
  return boxes;
}
const boundsOf = m => ({ x0: -m.w / 2 + 0.4, x1: m.w / 2 - 0.4, z0: -m.d / 2 + 0.4, z1: m.d / 2 - 0.4 });
const fallOf = m => m.void ? LIFT - 3 : undefined;

export function buildMap(scene, m) {
  const { boxes, solid, wallX, wallZ, floor } = makeKit(scene);
  const L = m.void ? LIFT : 0, X = m.w / 2, Z = m.d / 2;
  if (!m.void) floor(m.w, m.d, m.floor[0], m.floor[1]);
  else { // the sea far below
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), noOutline(toon(m.theme === 'nuit' ? '#1d3557' : '#4a9fd8')));
    sea.rotation.x = -Math.PI / 2; scene.add(sea);
  }
  for (const it of m.items) {
    if (it.t === 'block') solid(it.x0, it.x1, it.z0, it.z1, it.y0 + L, it.y1 + L, it.c);
    else if (it.t === 'stairs') for (const s of steps(it)) solid(s.x0, s.x1, s.z0, s.z1, s.y0 + L, s.y1 + L, it.c);
    else if (it.t === 'wall') {
      const holes = wallHoles(it).map(([a, b, c, d]) => [a, b, c + L, d + L]);
      if (it.x1 - it.x0 >= it.z1 - it.z0) wallX((it.z0 + it.z1) / 2, it.x0, it.x1, it.y0 + L, it.y1 + L, it.c, holes, it.z1 - it.z0);
      else wallZ((it.x0 + it.x1) / 2, it.z0, it.z1, it.y0 + L, it.y1 + L, it.c, holes, it.x1 - it.x0);
    }
  }
  if (m.walls) {
    const c = '#8f8676', H = m.wallH;
    wallX(-Z - 0.2, -X - 0.4, X + 0.4, 0, H, c, [], 0.4); wallX(Z + 0.2, -X - 0.4, X + 0.4, 0, H, c, [], 0.4);
    wallZ(-X - 0.2, -Z, Z, 0, H, c, [], 0.4); wallZ(X + 0.2, -Z, Z, 0, H, c, [], 0.4);
  }

  // the light of its time of day
  const T = {
    jour: { sky: '#9fd3ff', hemi: [0xfff4e0, 0x6a8a50, 1.6], sun: [0xfff1dc, 1.6] },
    soir: { sky: '#f4a26b', hemi: [0xffd6b0, 0x5a4060, 1.4], sun: [0xffb070, 1.5] },
    nuit: { sky: '#171230', hemi: [0xffe6cc, 0x403060, 1.3], sun: [0xb8c4ff, 1.2] }
  }[m.theme];
  const span = Math.max(m.w, m.d), far = Math.max(60, Math.min(170, span * 1.4));
  scene.background = new THREE.Color(T.sky);
  scene.fog = new THREE.Fog(T.sky, far * 0.5, far);
  scene.add(new THREE.HemisphereLight(...T.hemi));
  const sun = new THREE.DirectionalLight(...T.sun);
  sun.position.set(-span * 0.4, 40 + L, span * 0.3); sun.target.position.set(0, L, 0);
  sun.castShadow = true;
  const sc = sun.shadow.camera; sc.left = -X - 6; sc.right = X + 6; sc.top = Z + 6; sc.bottom = -Z - 6; sc.near = 1; sc.far = 120 + L;
  const res = span > 60 ? 4096 : 2048;
  sun.shadow.mapSize.set(res, res); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);

  const pts = t => m.items.filter(it => it.t === t);
  const spawns = pts('spawn').map(p => [p.x, p.y + L, p.z]);
  const pickups = pts('pickup').map(p => [p.k, p.x, p.y + L, p.z]);
  const pads = pts('pad').map(p => [p.x, p.y + L, p.z, p.vx, p.vy, p.vz]);
  const flags = pts('flag').sort((a, b) => a.x - b.x).map(p => [p.x, p.y + L, p.z]);
  return { bounds: boundsOf(m), boxes, spawns, pickups, pads, flags, fall: fallOf(m), far };
}

// is the map ready to play? errors stop it, warnings don't. Each comes with the item it's about.
// Sets the world (collisions and the bots' grid) to this map: only for the editor.
export function checkMap(m) {
  const errors = [], warnings = [];
  const L = m.void ? LIFT : 0;
  setWorld({ ...boundsOf(m), boxes: mapBoxes(m, L), fall: fallOf(m) });
  // where a point stands for the bots: on their main area, close to it
  const reach = p => { const n = nearestSpot(p.x, p.y + L, p.z); return !!n && n.main && Math.hypot(n.x - p.x, n.z - p.z) < 1.2 && Math.abs(n.y - (p.y + L)) < 0.6; };
  const spawns = m.items.filter(it => it.t === 'spawn');
  const red = spawns.filter(p => p.x < 0), blue = spawns.filter(p => p.x > 0);
  if (spawns.length < 2) errors.push({ msg: 'Il faut au moins deux points d\'apparition.' });
  if (!red.length) errors.push({ msg: 'Aucun point d\'apparition chez les Rouges (à gauche, x < 0).' });
  if (!blue.length) errors.push({ msg: 'Aucun point d\'apparition chez les Bleus (à droite, x > 0).' });
  for (const p of spawns) {
    if (blocked(p.x, p.z, p.y + L, TALL)) errors.push({ msg: 'Un point d\'apparition est coincé dans un bloc.', it: p });
    else if (!reach(p)) errors.push({ msg: 'Un point d\'apparition est hors de la zone où l\'on circule (les robots n\'y vont pas).', it: p });
    else if (m.void && groundAt(p.x, p.z, p.y + L + 0.3) < L - 2) errors.push({ msg: 'Un point d\'apparition est au-dessus du vide.', it: p });
  }
  const flags = m.items.filter(it => it.t === 'flag');
  if (!flags.some(f => f.x < 0)) errors.push({ msg: 'Il manque le drapeau des Rouges (à gauche) pour la capture du drapeau.' });
  if (!flags.some(f => f.x > 0)) errors.push({ msg: 'Il manque le drapeau des Bleus (à droite) pour la capture du drapeau.' });
  for (const f of flags) if (!reach(f)) errors.push({ msg: 'Un drapeau est hors d\'atteinte des robots.', it: f });
  for (const p of m.items.filter(it => it.t === 'pickup' || it.t === 'pad')) if (!reach(p)) warnings.push({ msg: (p.t === 'pad' ? 'Un tremplin' : 'Un bonus') + ' est hors d\'atteinte des robots.', it: p });
  if (!spotAt(0)) errors.push({ msg: 'Il n\'y a nulle part où marcher.' });
  if (spawns.length < 6) warnings.push({ msg: 'Peu de points d\'apparition : on réapparaît souvent au même endroit (6 ou plus conseillés).' });
  if (!m.items.some(it => it.t === 'pickup')) warnings.push({ msg: 'Aucun bonus à ramasser.' });
  return { errors, warnings };
}

/* ---------- the maps you made, kept in this browser ---------- */
const KEY = 'playroom-maps';
export function savedMaps() {
  try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a.filter(e => e && e.id && e.map) : []; } catch (e) { return []; }
}
export function storeMaps(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
}
export function keepMap(map, id) {
  const list = savedMaps(), i = list.findIndex(e => e.id === id);
  const e = { id: id || 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), map, at: Date.now() };
  if (i >= 0) list[i] = e; else list.unshift(e);
  return storeMaps(list) ? e.id : null;
}
// a short fingerprint of a map, to tell two versions apart
export function mapId(m) {
  const s = JSON.stringify(m); let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
