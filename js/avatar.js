// Customisable cartoon characters: a torso, a head with a drawn face, arms with
// elbows and legs with knees, all built from simple shapes and animated in code.
// A look is a small object of option indices, cheap to send in presence.
import * as THREE from 'three';
import { toon, noOutline, roundedBox } from './fx.js';

export const CLOTH = ['#f4b63f', '#ea6a4f', '#4fb3a9', '#8f73e3', '#5b9bd5', '#e88fb4', '#8fbf5a', '#f08a3c', '#fbf3e4', '#2b2036', '#3d6fd1', '#b8323f'];
export const SKIN = ['#ffd9b8', '#f1c27d', '#d9a066', '#b07a4a', '#8d5524', '#5c3a21', '#9ad1a0', '#a9c6ff'];
export const HAIR = ['#2b1d16', '#5a3a22', '#a0622d', '#e3b04b', '#f2e6c9', '#c9483a', '#8f73e3', '#4fb3a9', '#e88fb4', '#fbf3e4'];
export const OPTIONS = {
  h: ['Chauve', 'Court', 'Mi-long', 'Long', 'Couettes', 'Afro', 'Crête', 'Chignon'],
  t: ['T-shirt', 'Pull', 'Sweat à capuche', 'Chemise', 'Débardeur'],
  b: ['Pantalon', 'Short', 'Jupe'],
  hat: ['Aucun', 'Bonnet', 'Casquette', 'Haut-de-forme', 'Couronne', 'Oreilles de chat', 'Fleur'],
  acc: ['Aucun', 'Lunettes rondes', 'Lunettes de soleil', 'Nœud papillon', 'Écharpe'],
  e: ['Ronds', 'Grands', 'Ovales', 'Endormis', 'Malins', 'Étoiles'],
  m: ['Sourire', 'Grand sourire', 'Neutre', 'Chat', 'Dents', 'Langue'],
  br: ['Aucun', 'Fins', 'Épais'],
  x: ['Rien', 'Joues roses', 'Taches de rousseur', 'Moustache']
};
// expressions a player can pull on purpose (keys 1 to 6)
export const EXPRESSIONS = [
  { id: 'happy', label: 'Content', icon: '🙂' }, { id: 'laugh', label: 'Rire', icon: '😂' },
  { id: 'sad', label: 'Triste', icon: '😢' }, { id: 'shock', label: 'Choqué', icon: '😮' },
  { id: 'angry', label: 'Fâché', icon: '😠' }, { id: 'wink', label: 'Clin d\'œil', icon: '😉' }
];

const FIELDS = { s: SKIN.length, h: 8, hc: HAIR.length, t: 5, tc: CLOTH.length, b: 3, bc: CLOTH.length, sh: CLOTH.length, hat: 7, hac: CLOTH.length, acc: 5, ac: CLOTH.length, e: 6, m: 6, br: 3, x: 4 };
const DEFAULT = { s: 0, h: 1, hc: 1, t: 0, tc: 0, b: 0, bc: 10, sh: 9, hat: 0, hac: 1, acc: 0, ac: 1, e: 0, m: 0, br: 1, x: 1 };
export function cleanLook(l) {
  const out = {};
  for (const k in FIELDS) {
    const v = l && Number.isInteger(l[k]) ? l[k] : DEFAULT[k];
    out[k] = Math.max(0, Math.min(FIELDS[k] - 1, v));
  }
  return out;
}
export const lookKey = l => Object.keys(FIELDS).map(k => l[k]).join('.');
export function randomLook(rand = Math.random) {
  const pick = n => Math.floor(rand() * n), out = {};
  for (const k in FIELDS) out[k] = pick(FIELDS[k]);
  if (rand() < 0.5) out.hat = 0;
  if (rand() < 0.5) out.acc = 0;
  if (out.s >= 6 && rand() < 0.7) out.s = pick(6); // fantasy skins stay a rare treat
  return out;
}
export function seededRand(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/* shared geometry and materials: built once, never disposed */
const GEO = {}, MAT = {};
const geo = (k, f) => GEO[k] || (GEO[k] = f());
const mat = c => MAT[c] || (MAT[c] = toon(c));
const matDS = c => MAT['ds' + c] || (MAT['ds' + c] = toon(c, { side: THREE.DoubleSide }));
const flat = c => MAT['flat' + c] || (MAT['flat' + c] = noOutline(new THREE.MeshBasicMaterial({ color: c })));
function part(geometry, material, x, y, z, parent) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m);
  return m;
}
const capsule = (r, l) => geo('cap' + r + ':' + l, () => new THREE.CapsuleGeometry(r, l, 6, 12));
const sphere = r => geo('sph' + r, () => new THREE.SphereGeometry(r, 18, 14));
const cap = (r, t) => geo('cap' + r + 't' + t, () => new THREE.SphereGeometry(r, 22, 12, 0, Math.PI * 2, 0, Math.PI * t));
const cyl = (a, b, h, open) => geo('cyl' + [a, b, h, open], () => new THREE.CylinderGeometry(a, b, h, 22, 1, !!open));
const cone = (r, h) => geo('cone' + r + ':' + h, () => new THREE.ConeGeometry(r, h, 12));
const torus = (r, t, arc = Math.PI * 2) => geo('tor' + [r, t, arc], () => new THREE.TorusGeometry(r, t, 8, 24, arc));
// the face is drawn on a slice of sphere just in front of the head
const FACE_GEO = () => geo('face', () => new THREE.SphereGeometry(0.203, 28, 18, 1.05 * Math.PI, 0.9 * Math.PI, 0.2 * Math.PI, 0.6 * Math.PI));

export function buildAvatar(look, tag) {
  const L = cleanLook(look);
  const skin = SKIN[L.s], topC = CLOTH[L.tc], botC = CLOTH[L.bc], shoeC = CLOTH[L.sh], hairC = HAIR[L.hc], hatC = CLOTH[L.hac], accC = CLOTH[L.ac];
  const g = new THREE.Group(), hop = new THREE.Group(); g.add(hop);
  const hips = new THREE.Group(); hips.position.y = 0.6; hop.add(hips);
  const spine = new THREE.Group(); hips.add(spine);

  // torso and top
  const sleeveLong = L.t === 1 || L.t === 2 || L.t === 3, sleeveC = L.t === 4 ? skin : topC;
  part(roundedBox(0.4, 0.48, 0.25), mat(topC), 0, 0.25, 0, spine);
  part(cyl(0.2, 0.2, 0.06), mat(L.b === 0 || L.b === 1 ? botC : topC), 0, 0.02, 0, spine); // waistband
  if (L.t === 2) { // hoodie: hood behind the neck and a front pocket
    const hood = part(torus(0.12, 0.05), mat(topC), 0, 0.5, 0.07, spine); hood.rotation.x = Math.PI / 2 - 0.3;
    part(roundedBox(0.26, 0.11, 0.03), mat(topC), 0, 0.14, -0.125, spine);
  }
  if (L.t === 3) { // shirt: white collar and buttons
    for (const s of [-1, 1]) { const c = part(cone(0.05, 0.1), mat('#fbf3e4'), s * 0.05, 0.46, -0.11, spine); c.rotation.set(-1.2, 0, s * 2.2); }
    for (let i = 0; i < 3; i++) part(sphere(0.014), flat('#fbf3e4'), 0, 0.36 - i * 0.1, -0.128, spine);
  }
  if (L.t === 4) part(roundedBox(0.3, 0.06, 0.2), mat(skin), 0, 0.5, 0, spine); // tank top shows the shoulders
  part(cyl(0.065, 0.07, 0.1), mat(skin), 0, 0.52, 0, spine); // neck

  // head
  const head = new THREE.Group(); head.position.y = 0.76; head.scale.setScalar(1.18); spine.add(head);
  part(sphere(0.2), mat(skin), 0, 0, 0, head);
  part(sphere(0.045), mat(skin), -0.198, 0, 0, head).scale.set(0.5, 1, 0.8); // ears
  part(sphere(0.045), mat(skin), 0.198, 0, 0, head).scale.set(0.5, 1, 0.8);
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const faceMat = noOutline(toon('#ffffff', { map: tex, transparent: true, alphaTest: 0.4 }));
  const faceMesh = new THREE.Mesh(FACE_GEO(), faceMat); head.add(faceMesh);
  buildHair(L, head, hairC);
  buildHat(L, head, hatC);
  buildAccessory(L, head, spine, accC);

  // arms: shoulder pivot, elbow pivot, hand
  const arms = [-1, 1].map(sx => {
    const sh = new THREE.Group(); sh.position.set(sx * 0.255, 0.43, 0); spine.add(sh);
    part(capsule(0.068, 0.12), mat(sleeveC), 0, -0.11, 0, sh);
    const el = new THREE.Group(); el.position.y = -0.24; sh.add(el);
    part(capsule(0.062, 0.1), mat(sleeveLong ? topC : skin), 0, -0.09, 0, el);
    part(sphere(0.072), mat(skin), 0, -0.21, -0.01, el);
    return { sh, el, sx };
  });
  // legs: hip pivot, knee pivot, shoe
  const legs = [-1, 1].map(sx => {
    const hip = new THREE.Group(); hip.position.set(sx * 0.1, 0, 0); hips.add(hip);
    part(capsule(0.085, 0.13), mat(L.b === 2 ? skin : botC), 0, -0.13, 0, hip);
    const knee = new THREE.Group(); knee.position.y = -0.28; hip.add(knee);
    part(capsule(0.075, 0.12), mat(L.b === 0 ? botC : skin), 0, -0.12, 0, knee);
    part(roundedBox(0.14, 0.09, 0.23), mat(shoeC), 0, -0.27, -0.035, knee);
    return { hip, knee, sx };
  });
  if (L.b === 2) part(cyl(0.2, 0.31, 0.28, true), matDS(botC), 0, -0.1, 0, hips); // skirt

  if (tag) { tag.position.y = 2.08; g.add(tag); }
  return {
    g, hop, hips, spine, head, arms, legs, look: L, key: lookKey(L), face: { cv, ctx: cv.getContext('2d'), tex, mat: faceMat, key: '' },
    x: 0, z: 0, yaw: 0, tx: 0, tz: 0, tyaw: 0, seat: -1, walk: 0, init: false,
    expr: 'idle', exprUntil: 0, blinkAt: 1 + Math.random() * 3, blinkEnd: 0, jump: 0, jumpV: 0, land: 0, lean: 0
  };
}

function buildHair(L, head, c) {
  const m = mat(c);
  if (L.h === 0) return;
  if (L.h === 5) { const a = part(cap(0.27, 0.56), m, 0, -0.02, 0.05, head); a.rotation.x = 0.35; return; }
  const top = part(cap(0.213, 0.42), m, 0, 0, 0, head); top.rotation.x = 0.32;
  if (L.h === 2) { const b = part(geo('hairMid', () => new THREE.SphereGeometry(0.218, 22, 12, 0, Math.PI, 0.1 * Math.PI, 0.62 * Math.PI)), m, 0, 0, 0, head); b.rotation.y = 0; }
  if (L.h === 3) { part(cap(0.218, 0.5), m, 0, 0, 0.01, head).rotation.x = 0.9; part(roundedBox(0.36, 0.42, 0.09), m, 0, -0.17, 0.12, head); }
  if (L.h === 4) for (const s of [-1, 1]) part(sphere(0.085), m, s * 0.22, -0.03, 0.06, head);
  if (L.h === 6) for (let i = 0; i < 5; i++) { const k = part(cone(0.04, 0.13), m, 0, 0.2 - Math.abs(i - 1.5) * 0.012, -0.1 + i * 0.06, head); k.rotation.x = -0.2 + i * 0.12; }
  if (L.h === 7) part(sphere(0.09), m, 0, 0.17, 0.11, head);
}
function buildHat(L, head, c) {
  const m = mat(c);
  if (L.hat === 1) {
    const b = part(cap(0.226, 0.44), m, 0, 0.0, 0, head); b.rotation.x = 0.32;
    const band = part(torus(0.212, 0.035), m, 0, 0.055, 0.05, head); band.rotation.x = Math.PI / 2 + 0.32;
    part(sphere(0.06), mat('#fbf3e4'), 0, 0.23, 0.04, head);
  } else if (L.hat === 2) {
    const b = part(cap(0.222, 0.4), m, 0, 0, 0, head); b.rotation.x = 0.3;
    const v = part(roundedBox(0.22, 0.025, 0.15), m, 0, 0.125, -0.2, head); v.rotation.x = 0.3;
  } else if (L.hat === 3) {
    part(cyl(0.25, 0.25, 0.02), m, 0, 0.15, 0, head);
    part(cyl(0.14, 0.14, 0.26), m, 0, 0.28, 0, head);
    part(cyl(0.143, 0.143, 0.05), mat('#2b2036'), 0, 0.19, 0, head);
  } else if (L.hat === 4) {
    const gold = matDS('#f4c430');
    part(cyl(0.15, 0.15, 0.09, true), gold, 0, 0.19, 0, head);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; part(cone(0.035, 0.08), gold, Math.sin(a) * 0.15, 0.27, Math.cos(a) * 0.15, head); }
    part(sphere(0.022), flat('#ea6a4f'), 0, 0.19, -0.152, head);
  } else if (L.hat === 5) {
    for (const s of [-1, 1]) {
      const e = part(cone(0.07, 0.14), m, s * 0.12, 0.19, 0, head); e.rotation.z = -s * 0.35;
      const i = part(cone(0.04, 0.08), mat('#ffb3c1'), s * 0.118, 0.185, -0.03, head); i.rotation.z = -s * 0.35;
    }
  } else if (L.hat === 6) {
    const f = new THREE.Group(); f.position.set(0.15, 0.12, -0.1); head.add(f);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; part(sphere(0.035), m, Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0, f); }
    part(sphere(0.03), mat('#f4c430'), 0, 0, -0.01, f);
  }
}
function buildAccessory(L, head, spine, c) {
  if (L.acc === 1 || L.acc === 2) {
    const frame = L.acc === 1 ? mat('#2b2036') : mat('#1b1420');
    for (const s of [-1, 1]) {
      if (L.acc === 1) part(torus(0.048, 0.01), frame, s * 0.085, 0.015, -0.2, head);
      else part(roundedBox(0.1, 0.07, 0.02), mat('#1b1420'), s * 0.085, 0.015, -0.2, head);
    }
    part(roundedBox(0.06, 0.012, 0.012), frame, 0, 0.025, -0.205, head);
    for (const s of [-1, 1]) part(roundedBox(0.012, 0.012, 0.18), frame, s * 0.17, 0.02, -0.11, head);
  } else if (L.acc === 3) {
    for (const s of [-1, 1]) { const b = part(cone(0.045, 0.08), mat(c), s * 0.04, 0.47, -0.13, spine); b.rotation.z = s * Math.PI / 2; }
    part(sphere(0.022), mat(c), 0, 0.47, -0.135, spine);
  } else if (L.acc === 4) {
    const r = part(torus(0.1, 0.045), mat(c), 0, 0.5, 0, spine); r.rotation.x = Math.PI / 2;
    const tail = part(roundedBox(0.08, 0.2, 0.04), mat(c), 0.07, 0.38, -0.12, spine); tail.rotation.z = 0.15;
  }
}

/* ---------- the face, drawn on a canvas ---------- */
const DARK = '#1b1420';
function star(x, cx, cy, r) {
  x.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  x.closePath();
}
function eye(x, L, mode, cx, cy, side) {
  x.fillStyle = DARK; x.strokeStyle = DARK; x.lineCap = 'round'; x.lineWidth = 7;
  if (mode === 'closed') { x.beginPath(); x.moveTo(cx - 14, cy); x.quadraticCurveTo(cx, cy + 9, cx + 14, cy); x.stroke(); return; }
  if (mode === 'arc') { x.beginPath(); x.moveTo(cx - 15, cy + 5); x.quadraticCurveTo(cx, cy - 14, cx + 15, cy + 5); x.stroke(); return; }
  if (mode === 'squint') { x.beginPath(); x.moveTo(cx - 12 * side, cy - 11); x.lineTo(cx + 10 * side, cy); x.lineTo(cx - 12 * side, cy + 11); x.stroke(); return; }
  if (mode === 'wide') {
    x.fillStyle = '#ffffff'; x.beginPath(); x.arc(cx, cy, 20, 0, Math.PI * 2); x.fill(); x.lineWidth = 4; x.stroke();
    x.fillStyle = DARK; x.beginPath(); x.arc(cx, cy + 2, 7, 0, Math.PI * 2); x.fill(); return;
  }
  const glint = (gx, gy, r) => { x.fillStyle = '#ffffff'; x.beginPath(); x.arc(gx, gy, r, 0, Math.PI * 2); x.fill(); };
  switch (L.e) {
    case 1: x.beginPath(); x.ellipse(cx, cy, 17, 22, 0, 0, Math.PI * 2); x.fill(); glint(cx + 6, cy - 8, 7); glint(cx - 5, cy + 8, 3); break;
    case 2: x.beginPath(); x.ellipse(cx, cy, 9, 18, 0, 0, Math.PI * 2); x.fill(); glint(cx + 2, cy - 7, 3); break;
    case 3: x.beginPath(); x.arc(cx, cy, 14, 0, Math.PI); x.fill(); x.beginPath(); x.moveTo(cx - 17, cy); x.lineTo(cx + 17, cy); x.lineWidth = 5; x.stroke(); break;
    case 4:
      x.beginPath(); x.ellipse(cx, cy + 2, 15, 12, 0, 0, Math.PI * 2); x.fill(); glint(cx + 4, cy - 2, 4);
      x.fillStyle = SKIN[L.s]; x.beginPath(); x.moveTo(cx - 20, cy - 16); x.lineTo(cx + 20, cy - 16); x.lineTo(cx + 20 * side, cy - 2); x.closePath(); x.fill();
      x.lineWidth = 5; x.beginPath(); x.moveTo(cx - 17 * side, cy - 9); x.lineTo(cx + 17 * side, cy - 1); x.stroke(); break;
    case 5: star(x, cx, cy, 19); x.fillStyle = '#f4b63f'; x.fill(); x.lineWidth = 4; x.stroke(); break;
    default: x.beginPath(); x.arc(cx, cy, 15, 0, Math.PI * 2); x.fill(); glint(cx + 5, cy - 6, 5);
  }
}
function brow(x, w, cx, cy, shape, side) {
  // side: -1 left eye on the canvas, 1 right; "inner" is the end nearest the middle
  const inner = cx + 14 * -side, outer = cx - 14 * -side;
  const [yi, yo] = shape === 'sad' ? [cy - 42, cy - 28] : shape === 'angry' ? [cy - 22, cy - 38] : shape === 'up' ? [cy - 44, cy - 42] : [cy - 32, cy - 33];
  x.strokeStyle = DARK; x.lineWidth = w; x.lineCap = 'round';
  x.beginPath(); x.moveTo(outer, yo); x.quadraticCurveTo(cx, Math.min(yi, yo) - 5, inner, yi); x.stroke();
}
function mouth(x, kind, my) {
  x.fillStyle = DARK; x.strokeStyle = DARK; x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = 7;
  const tongue = (tx, ty, rx, ry) => { x.fillStyle = '#ff7f8e'; x.beginPath(); x.ellipse(tx, ty, rx, ry, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = DARK; };
  switch (kind) {
    case 'grin': x.beginPath(); x.moveTo(96, my - 6); x.lineTo(160, my - 6); x.quadraticCurveTo(128, my + 46, 96, my - 6); x.fill();
      x.save(); x.clip(); tongue(128, my + 20, 16, 10); x.restore(); break;
    case 'open': x.beginPath(); x.ellipse(128, my + 4, 26, 24, 0, 0, Math.PI * 2); x.fill(); x.save(); x.clip(); tongue(128, my + 22, 16, 10); x.restore(); break;
    case 'laugh': x.beginPath(); x.moveTo(90, my - 8); x.lineTo(166, my - 8); x.quadraticCurveTo(128, my + 54, 90, my - 8); x.fill();
      x.save(); x.clip(); tongue(128, my + 26, 20, 12); x.restore(); break;
    case 'flat': x.beginPath(); x.moveTo(106, my + 4); x.lineTo(150, my + 4); x.stroke(); break;
    case 'cat': x.lineWidth = 6; x.beginPath(); x.moveTo(102, my - 2); x.quadraticCurveTo(115, my + 14, 128, my); x.quadraticCurveTo(141, my + 14, 154, my - 2); x.stroke(); break;
    case 'teeth':
      x.beginPath(); x.roundRect(96, my - 8, 64, 28, 12); x.fill();
      x.fillStyle = '#ffffff'; x.fillRect(102, my - 4, 52, 10); break;
    case 'tongue': x.beginPath(); x.moveTo(98, my); x.quadraticCurveTo(128, my + 22, 158, my); x.stroke();
      tongue(140, my + 14, 10, 12); x.lineWidth = 3; x.beginPath(); x.moveTo(140, my + 8); x.lineTo(140, my + 20); x.stroke(); break;
    case 'frown': x.beginPath(); x.moveTo(104, my + 14); x.quadraticCurveTo(128, my - 8, 152, my + 14); x.stroke(); break;
    case 'o': x.beginPath(); x.ellipse(128, my + 4, 12, 16, 0, 0, Math.PI * 2); x.fill(); break;
    case 'grumpy': x.beginPath(); x.moveTo(106, my + 10); x.quadraticCurveTo(128, my - 2, 150, my + 10); x.stroke(); break;
    default: x.beginPath(); x.moveTo(98, my); x.quadraticCurveTo(128, my + 22, 158, my); x.stroke();
  }
}
const MOUTHS = ['smile', 'grin', 'flat', 'cat', 'teeth', 'tongue'];
export function drawFace(x, L, expr, blink) {
  x.clearRect(0, 0, 256, 256);
  const EY = 112, EX = [88, 168], MY = 172;
  const blushy = L.x === 1 || ['happy', 'cheer', 'laugh', 'shock', 'wink'].includes(expr);
  if (blushy) { x.fillStyle = 'rgba(255,110,130,.45)'; for (const bx of [58, 198]) { x.beginPath(); x.ellipse(bx, 150, 20, 13, 0, 0, Math.PI * 2); x.fill(); } }
  if (L.x === 2) { x.fillStyle = 'rgba(140,80,40,.55)'; for (const [fx, fy] of [[60, 140], [72, 150], [56, 156], [196, 140], [184, 150], [200, 156]]) { x.beginPath(); x.arc(fx, fy, 3.5, 0, Math.PI * 2); x.fill(); } }
  // eyes
  const modes = { happy: ['arc', 'arc'], cheer: ['arc', 'arc'], laugh: ['squint', 'squint'], shock: ['wide', 'wide'], wink: [null, 'arc'] }[expr] || [null, null];
  EX.forEach((cx, i) => eye(x, L, blink && modes[i] !== 'wide' ? 'closed' : modes[i], cx, EY, i ? 1 : -1));
  // brows
  const shape = expr === 'sad' ? 'sad' : expr === 'angry' ? 'angry' : expr === 'shock' ? 'up' : 'normal';
  const bw = L.br === 2 ? 11 : L.br === 1 ? 5 : shape !== 'normal' ? 5 : 0;
  if (bw) EX.forEach((cx, i) => brow(x, bw, cx, EY, shape, i ? 1 : -1));
  if (expr === 'sad') { x.fillStyle = '#7fc8ff'; x.beginPath(); x.moveTo(EX[0] - 6, EY + 18); x.quadraticCurveTo(EX[0] - 16, EY + 40, EX[0] - 6, EY + 42); x.quadraticCurveTo(EX[0] + 4, EY + 40, EX[0] - 6, EY + 18); x.fill(); }
  // mouth
  const kind = { happy: 'grin', cheer: 'open', laugh: 'laugh', sad: 'frown', shock: 'o', angry: 'grumpy', wink: 'tongue' }[expr] || MOUTHS[L.m];
  mouth(x, kind, MY);
  if (L.x === 3) { x.fillStyle = DARK; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(128 + s * 18, MY - 16, 20, 8, s * 0.35, 0, Math.PI * 2); x.fill(); } }
}

/* ---------- animation ---------- */
export function react(a, expr, secs = 2.2) {
  if (!a) return;
  a.expr = expr; a.exprUntil = performance.now() / 1000 + secs;
  if ((expr === 'cheer' || expr === 'happy') && a.jump === 0) a.jumpV = expr === 'cheer' ? 3.4 : 2.2;
  if (expr === 'shock' && a.jump === 0) a.jumpV = 1.8;
}
// shoulder raise (sideways), shoulder forward, elbow bend forward, elbow fold inward, head tilt
const POSE = {
  idle: [0.1, 0.05, 0.25, 0, 0], happy: [0.45, 0, 0.3, 0, 0.1], cheer: [2.75, 0, 0.15, 0, 0.15],
  laugh: [0.25, 0.55, 1.5, 0, 0.25], sad: [0.04, 0.12, 0.05, 0, -0.4], shock: [0.35, 2.3, 1.3, 0, 0.1],
  angry: [0.75, -0.15, 0, 1.9, -0.1], wink: [0.3, 1.3, 1.6, 0, 0.12], seated: [0.15, 0.95, 0.55, 0, -0.1]
};
const lerp = (o, k, v, f) => { o[k] += (v - o[k]) * f; };
export function animateAvatar(a, dt, t, moving) {
  if (a.exprUntil && t > a.exprUntil) { a.expr = 'idle'; a.exprUntil = 0; }
  const ex = a.expr, seated = a.seat >= 0;
  if (t > a.blinkAt) { a.blinkEnd = t + 0.12; a.blinkAt = t + 2 + Math.random() * 3.5; }
  const blink = t < a.blinkEnd;
  const fk = ex + (blink ? ':b' : '');
  if (fk !== a.face.key) { a.face.key = fk; drawFace(a.face.ctx, a.look, ex, blink); a.face.tex.needsUpdate = true; }
  // jumps
  if (a.jumpV !== 0 || a.jump > 0) {
    a.jumpV -= 9.8 * dt; a.jump += a.jumpV * dt;
    if (a.jump <= 0) { a.jump = 0; a.jumpV = 0; a.land = 0.16; }
  }
  // squash and stretch, from the feet
  let sy = 1 + Math.sin(t * 2.1 + a.x * 3) * 0.012;
  if (a.land > 0) { a.land = Math.max(0, a.land - dt); sy -= a.land * 0.8; }
  if (a.jumpV > 0) sy += 0.06;
  const sx = 1 / Math.sqrt(sy);
  a.hop.scale.set(sx, sy, sx);
  a.hop.position.y = (seated ? -0.07 : 0) + a.jump + (ex === 'laugh' ? Math.abs(Math.sin(t * 24)) * 0.02 : 0) + (moving ? Math.abs(Math.cos(a.walk)) * 0.035 : 0);
  const k = 1 - Math.exp(-dt * 12);
  // legs
  for (const l of a.legs) {
    let hx = 0, kx = 0;
    if (seated) { hx = Math.PI / 2; kx = -Math.PI / 2 + Math.sin(t * 1.3 + l.sx) * 0.06; }
    else if (moving) { const s = Math.sin(a.walk) * l.sx; hx = s * 0.6; kx = -Math.max(0, -s) * 1.0 - 0.05; }
    lerp(l.hip.rotation, 'x', hx, k); lerp(l.knee.rotation, 'x', kx, k);
  }
  // spine and head
  a.lean = Math.max(0, a.lean - dt * 2.2);
  const pose = POSE[ex === 'idle' && seated ? 'seated' : ex] || POSE.idle;
  lerp(a.spine.rotation, 'x', -a.lean * 0.4 + (ex === 'sad' ? 0.12 : 0) + (moving ? -0.08 : 0), k);
  a.spine.rotation.z = moving ? Math.sin(a.walk) * 0.04 : seated ? Math.sin(t * 1.1 + a.x) * 0.02 : 0;
  lerp(a.head.rotation, 'x', pose[4] + (ex === 'laugh' ? Math.sin(t * 24) * 0.05 : 0), k);
  lerp(a.head.rotation, 'y', moving ? 0 : Math.sin(t * 0.5 + a.x * 2) * 0.18, k * 0.3);
  a.head.rotation.z = ex === 'wink' ? 0.15 : ex === 'angry' ? Math.sin(t * 20) * 0.03 : 0;
  // arms
  for (const r of a.arms) {
    let up = pose[0], fwd = pose[1], bend = pose[2], fold = pose[3];
    if (ex === 'cheer') up += Math.sin(t * 14 + r.sx) * 0.25;
    if (ex === 'wink' && r.sx < 0) { up = POSE.idle[0]; fwd = POSE.idle[1]; bend = POSE.idle[2]; }
    if (moving && ex === 'idle') { fwd = -Math.sin(a.walk) * 0.55 * r.sx; bend = 0.35; }
    if (a.lean > 0) { fwd += a.lean * 1.2; bend += a.lean * 0.3; }
    lerp(r.sh.rotation, 'z', r.sx * up, k); lerp(r.sh.rotation, 'x', fwd, k);
    lerp(r.el.rotation, 'x', bend, k); lerp(r.el.rotation, 'z', -r.sx * fold, k);
  }
}

export function disposeAvatar(a) {
  a.face.tex.dispose(); a.face.mat.dispose();
  a.g.traverse(o => { if (o.isSprite) { o.material.map.dispose(); o.material.dispose(); } });
}
