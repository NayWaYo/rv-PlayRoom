// The battle map, "le Fort": a big cardboard fort at night. A tall central hall with a
// crawl tunnel under its stage, two wings with rooms below and an open floor above,
// stairs and balconies, windows to shoot through and shelves to crawl under.
// Every solid piece is both drawn and returned as a box for the world module.
import * as THREE from 'three';
import { toon, noOutline } from './fx.js';

const H = 3.5;      // the upper floor
const ROOF = 3.2;   // ceiling of the rooms below it
const WALL = 6;     // outer walls
export const BOUNDS = { x0: -15.6, x1: 15.6, z0: -11.6, z1: 11.6 };

export function buildMap(scene) {
  const boxes = [];
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mats = new Map();
  const mat = c => { if (!mats.has(c)) mats.set(c, toon(c)); return mats.get(c); };
  // a solid block from (x0, y0, z0) to (x1, y1, z1)
  function solid(x0, x1, z0, z1, y0, y1, color, opts = {}) {
    const m = new THREE.Mesh(geo, opts.flat ? noOutline(toon(color)) : mat(color));
    m.scale.set(x1 - x0, y1 - y0, z1 - z0);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.castShadow = !opts.noShadow; m.receiveShadow = true;
    scene.add(m);
    if (!opts.ghost) boxes.push({ x0, x1, z0, z1, y0, y1 });
    return m;
  }
  // a wall along x (at z) or along z (at x), with openings: [from, to, bottom, top]
  function wallX(z, x0, x1, y0, y1, color, holes = [], t = 0.3) {
    pieces(x0, x1, y0, y1, holes, (a, b, c, d) => solid(a, b, z - t / 2, z + t / 2, c, d, color));
  }
  function wallZ(x, z0, z1, y0, y1, color, holes = [], t = 0.3) {
    pieces(z0, z1, y0, y1, holes, (a, b, c, d) => solid(x - t / 2, x + t / 2, a, b, c, d, color));
  }
  function pieces(s0, s1, y0, y1, holes, put) {
    let s = s0;
    for (const [h0, h1, hb, ht] of holes.slice().sort((p, q) => p[0] - q[0])) {
      if (h0 > s) put(s, h0, y0, y1);
      if (hb > y0) put(h0, h1, y0, hb);        // under a window
      if (ht < y1) put(h0, h1, ht, y1);        // over a door or a window
      s = h1;
    }
    if (s < s1) put(s, s1, y0, y1);
  }
  const crate = (x, z, s, h, y = 0, c = '#b07a45') => solid(x - s / 2, x + s / 2, z - s / 2, z + s / 2, y, y + h, c);
  const door = (a, b) => [a, b, 0, 2.4], win = (a, b) => [a, b, 1.0, 2.0], vent = (a, b) => [a, b, 0, 1.3];

  // colours
  const OUT = '#52629c', CARD = '#e3b97f', CARD2 = '#d39f63', SLAB = '#c98b52', RAIL = '#f4b63f';
  const STAGE = '#ea6a4f', STAIR = '#8f73e3', SHELF = '#4fb3a9', TRIM = '#fbf3e4';

  // floor: a checker of two felt colours per zone, drawn only
  const floorTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const x = cv.getContext('2d');
    x.fillStyle = '#5a4778'; x.fillRect(0, 0, 128, 128);
    x.fillStyle = '#634f84'; x.fillRect(0, 0, 64, 64); x.fillRect(64, 64, 64, 64);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(16, 12); t.magFilter = THREE.NearestFilter;
    return t;
  })();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(32, 24), noOutline(toon('#ffffff', { map: floorTex })));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  // outer walls
  wallX(-11.8, -16, 16, 0, WALL, OUT, [], 0.4); wallX(11.8, -16, 16, 0, WALL, OUT, [], 0.4);
  wallZ(-15.8, -12, 12, 0, WALL, OUT, [], 0.4); wallZ(15.8, -12, 12, 0, WALL, OUT, [], 0.4);

  /* ----- the west wing: two rooms under an open upper floor ----- */
  solid(-15.6, -4, -11.6, 11.6, ROOF, H, SLAB);                        // floor above, overhanging the hall as a balcony
  wallZ(-6, -11.6, 11.6, 0, ROOF, CARD, [door(-8, -6), win(-1.5, 1.5), door(5, 7)]);
  wallX(0, -15.6, -6.15, 0, ROOF, CARD2, [door(-12, -10), vent(-8.2, -7)]);
  solid(-13.4, -11, 5, 7, 0, 0.8, '#7a4a2b');                           // a big table to hide behind
  crate(-9, 9.5, 0.9, 0.9); crate(-14.4, -3, 0.9, 1.3); crate(-12.5, -9.5, 0.8, 0.6); crate(-12.5, -10.4, 0.8, 1.2, 0, '#c98b52');
  // upstairs: a hut, crates, low walls
  wallZ(-10, -10, -6, H, H + 2.4, CARD2, [door(-8.6, -7.4).map((v, i) => i > 1 ? v + H : v)]);
  wallX(-10, -14, -10, H, H + 2.4, CARD2); wallX(-6, -14, -10, H, H + 2.4, CARD2, [win(-12.6, -11.4).map((v, i) => i > 1 ? v + H : v)]);
  solid(-14.3, -9.85, -10.15, -5.85, H + 2.4, H + 2.6, STAGE);         // its roof
  crate(-9, -2.5, 1, 1, H); crate(-12, 4, 1, 1.1, H); crate(-8, 8, 1.2, 1.4, H); crate(-13.5, 9, 0.8, 0.6, H);
  solid(-12, -11.7, -2, 2, H, H + 1.0, CARD);                           // low wall: duck behind it

  /* ----- the east wing: a warehouse with shelves under another open floor ----- */
  solid(4, 15.6, -11.6, 11.6, ROOF, H, SLAB);
  wallZ(6, -11.6, 11.6, 0, ROOF, CARD, [door(-7, -5), win(1, 3), door(6, 8)]);
  for (const x of [8.4, 11.4, 14.4]) {
    for (const [z0, z1] of [[-10, -2], [2, 10]]) {
      if (x === 11.4 && z0 < 0) {                                       // this one has a gap underneath: crawl through
        solid(x - 0.4, x + 0.4, -10, -6, 0, 2.2, SHELF);
        solid(x - 0.4, x + 0.4, -6, -3, 1.3, 2.2, SHELF);
        solid(x - 0.4, x + 0.4, -3, -2, 0, 2.2, SHELF);
      } else solid(x - 0.4, x + 0.4, z0, z1, 0, 2.2, SHELF);
    }
  }
  crate(9.9, 6, 0.8, 0.8); crate(12.9, -8, 0.8, 1.0); crate(7, 10, 0.9, 1.2);
  // upstairs: a chimney stack, crates, a low wall
  solid(11, 13, -1, 1, H, WALL, '#a5524a');
  crate(9, 4, 1, 1, H); crate(13, -6, 1.1, 1.2, H); crate(8.5, -8.5, 1, 0.7, H); crate(14, 8, 1, 1.4, H);
  solid(8, 8.3, -6, -2, H, H + 1.0, CARD);

  /* ----- the hall ----- */
  // balcony railings, with a gap where the stairs arrive
  wallZ(-4.05, -11.6, 1, H, H + 1, RAIL, [], 0.12); wallZ(-4.05, 2.05, 11.6, H, H + 1, RAIL, [], 0.12);
  wallZ(4.05, -11.6, -2.05, H, H + 1, RAIL, [], 0.12); wallZ(4.05, -1, 11.6, H, H + 1, RAIL, [], 0.12);
  // stairs: west goes up towards -z, east towards +z
  const N = 15, rise = H / N, run = 0.33;
  for (let k = 1; k <= N; k++) {
    const zW = 7 - (k - 1) * run, zE = -7 + (k - 1) * run;
    solid(-4, -2.6, zW - run, zW, 0, k * rise, STAIR);
    solid(2.6, 4, zE, zE + run, 0, k * rise, STAIR);
  }
  solid(-4, -2.6, 1, 7 - N * run, 0, H, STAIR);                         // landings
  solid(2.6, 4, -7 + N * run, -1, 0, H, STAIR);
  // the stage, with a tunnel under it along x
  solid(-2, 2, -2, -0.6, 0, 1.6, STAGE); solid(-2, 2, 0.6, 2, 0, 1.6, STAGE);
  solid(-2, 2, -0.6, 0.6, 1.3, 1.6, STAGE);
  crate(2.5, 1.4, 0.8, 1.05); crate(2.5, 2.3, 0.8, 0.55, 0, '#c98b52');   // steps up onto it
  crate(-2.5, -1.4, 0.8, 1.05); crate(-2.5, -2.3, 0.8, 0.55, 0, '#c98b52');
  // cover
  crate(-1, 7, 1, 1); crate(3, 8.5, 1.1, 1.2); crate(-3, -8, 1.1, 1.2); crate(1, -7, 1, 1);
  solid(-1.5, 1.5, 9.5, 9.8, 0, 1.0, CARD); solid(-1.5, 1.5, -9.8, -9.5, 0, 1.0, CARD);
  crate(0, 4.5, 0.7, 0.5); crate(-0.5, -4.5, 0.7, 0.5);

  // trims along the top of the upper floors' edges, drawn only
  for (const x of [-4, 4]) { const m = solid(x - 0.06, x + 0.06, -11.6, 11.6, ROOF - 0.12, ROOF, TRIM, { ghost: true, noShadow: true }); m.castShadow = false; }

  /* ----- light: a cool moon, warm lamps ----- */
  scene.background = new THREE.Color('#171230');
  scene.add(new THREE.HemisphereLight(0xffe6cc, 0x403060, 1.5));
  const moon = new THREE.DirectionalLight(0xb8c4ff, 1.4);
  moon.position.set(-10, 20, 8); moon.target.position.set(0, 0, 0);
  moon.castShadow = true;
  const sc = moon.shadow.camera; sc.left = -18; sc.right = 18; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 50;
  moon.shadow.mapSize.set(2048, 2048); moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.03;
  scene.add(moon, moon.target);
  for (const [x, y, z, c] of [[0, 5, 0, 0xffb36b], [-11, 2.6, -5, 0xffc27a], [11, 2.6, 5, 0x9fd8ff], [-10, 5.6, 6, 0xffa860]]) {
    const l = new THREE.PointLight(c, 9, 14, 1.6); l.position.set(x, y, z); scene.add(l);
  }

  const spawns = [[-14, 0, -10], [-14, 0, 10], [14.8, 0, -10.5], [14.8, 0, 10.5], [-13.2, H, 0], [12, H, 3], [0, 0, -11], [0, 0, 11],
    [-5, H, -10], [5, H, 10], [-8, 0, 3], [9.9, 0, -1]];
  return { bounds: BOUNDS, boxes, spawns };
}
