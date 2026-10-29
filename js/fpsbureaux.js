// The fourth battle map, "les Bureaux": an office building at night. A tall lobby in the west
// with a mezzanine on three sides, a staircase and a glass lift; a long corridor through four
// offices in the middle, under an open-plan floor that looks down on the lobby; in the east a
// conference room with rows of benches, a stage with a lectern and a control booth up high,
// and a cafeteria under a roof terrace.
import * as THREE from 'three';
import { toon, noOutline } from './fx.js';
import { makeKit } from './fpsmap.js';

const H = 3.5;      // the upper floor
const ROOF = 3.2;   // ceiling of the rooms below it
const WALL = 7;     // outer walls
export const BOUNDS = { x0: -15.6, x1: 15.6, z0: -11.6, z1: 11.6 };
// the lift: a platform going up to the mezzanine and back down, on a 12-second loop
const LIFT = { x0: -13.4, x1: -11.6, z0: -0.9, z1: 0.9, low: 0.2, period: 12 };

export function buildMap(scene) {
  const { boxes, solid, wallX, wallZ, crate, door, win, stairsX, stairsZ, floor } = makeKit(scene);

  // colours
  const OUT = '#4a5578', BEIGE = '#d9cbb0', BEIGE2 = '#c4b494', SLAB = '#7b8aa8', RAIL = '#f4b63f';
  const DESK = '#b07a45', GREY = '#9aa8c7', DARK = '#3a3340', PLANT = '#8fbf5a', POT = '#ea6a4f';
  const BENCH = '#8f73e3', BENCH2 = '#6f55c4', STAGE = '#ea6a4f', STAIR = '#4fb3a9', PART = '#5b9bd5', WHITE = '#fbf3e4';

  floor(32, 24, '#3e4a6b', '#45527a');

  // outer walls, high windows onto the night
  wallX(-11.8, -16, 16, 0, WALL, OUT, [win(-3, -0.5, H), win(1.5, 4, H), win(9, 13, H)], 0.4);
  wallX(11.8, -16, 16, 0, WALL, OUT, [win(-3, -0.5, H), win(1.5, 4, H)], 0.4);
  wallZ(-15.8, -12, 12, 0, WALL, OUT, [win(-6, -2, H), win(2, 6, H)], 0.4);
  wallZ(15.8, -12, 12, 0, WALL, OUT, [], 0.4);

  /* ----- the lobby: open to the top, a mezzanine on three sides ----- */
  solid(-15.6, -5, -11.6, -8.5, ROOF, H, SLAB);                         // south mezzanine
  solid(-15.6, -5, 8.5, 11.6, ROOF, H, SLAB);                           // north mezzanine
  solid(-15.6, -13.5, -8.5, 8.5, ROOF, H, SLAB);                        // west mezzanine, where the lift arrives
  // railings, open where the stairs and the lift arrive
  wallX(-8.44, -13.5, -5.15, H, H + 1, RAIL, [[-8, -6.6, H, H + 1]], 0.12);
  wallX(8.44, -13.5, -5.15, H, H + 1, RAIL, [], 0.12);
  wallZ(-13.44, -8.5, 8.5, H, H + 1, RAIL, [[-0.9, 0.9, H, H + 1]], 0.12);
  stairsZ(-8, -6.6, -3.55, -1, H, STAIR);                               // up to the south mezzanine
  // the reception desk, a sofa, plants
  solid(-10.5, -7.5, 1.5, 2.3, 0, 1.1, DESK); solid(-10.6, -7.4, 1.4, 2.4, 1.1, 1.2, WHITE);
  solid(-12, -9, 5, 5.8, 0, 0.6, '#ea6a4f'); solid(-12, -9, 5.8, 6.1, 0, 1.1, '#c9483a');
  for (const [x, z] of [[-6, 6], [-6, -2.2], [-14.8, -10.8], [-14.8, 10.8]]) { crate(x, z, 0.7, 0.7, 0, POT); crate(x, z, 0.9, 0.9, 0.7, PLANT); }
  // the lift: four posts, a beam on top, and the platform (a box that moves: see `movers`)
  for (const x of [-13.45, -11.55]) for (const z of [-0.96, 0.96]) solid(x - 0.06, x + 0.06, z - 0.06, z + 0.06, 0, H + 2.6, DARK);
  solid(-13.5, -11.5, -1.02, 1.02, H + 2.6, H + 2.8, DARK, { ghost: true });
  const cabin = solid(LIFT.x0, LIFT.x1, LIFT.z0, LIFT.z1, 0, LIFT.low, RAIL);
  const liftBox = boxes[boxes.length - 1]; liftBox.moving = true;
  // glass on two sides, drawn only, riding with the platform
  const glass = new THREE.MeshBasicMaterial({ color: '#7fe8ff', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
  const panes = [];
  for (const z of [LIFT.z0 + 0.03, LIFT.z1 - 0.03]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(LIFT.x1 - LIFT.x0, 1.1), glass);
    p.position.set((LIFT.x0 + LIFT.x1) / 2, LIFT.low + 0.55, z); scene.add(p); panes.push(p);
  }
  const lamp = new THREE.PointLight(0x9fe8ff, 4, 5, 1.6); lamp.position.set((LIFT.x0 + LIFT.x1) / 2, LIFT.low + 2.2, 0); scene.add(lamp);
  // where its top is at time t (seconds): waits below, rises, waits above, comes back down
  function liftAt(t) {
    const p = t % LIFT.period, ease = k => k * k * (3 - 2 * k), span = H - LIFT.low;
    if (p < 3) return LIFT.low;
    if (p < 6) return LIFT.low + span * ease((p - 3) / 3);
    if (p < 9) return H;
    return H - span * ease((p - 9) / 3);
  }

  /* ----- the middle: a corridor through four offices, an open-plan floor above ----- */
  // the wall onto the lobby: doors below, doors to the mezzanines and windows onto the lobby above
  wallZ(-5, -11.6, 11.6, 0, WALL, BEIGE, [door(-11, -9.3, H), door(-8, -6.5), win(-5.5, -3, H), door(-1, 1), win(3, 5.5, H), door(6.5, 8), door(9.3, 11, H)]);
  solid(-4.85, 5.85, -11.6, 11.6, ROOF, H, SLAB);                       // the floor above
  // the corridor along x, offices on both sides
  wallX(1.35, -4.85, 5.85, 0, ROOF, BEIGE2, [door(-3.5, -2.3), door(3, 4.2)], 0.2);
  wallX(-1.35, -4.85, 5.85, 0, ROOF, BEIGE2, [door(-2, -0.8), door(2, 3.2)], 0.2);
  wallZ(0.5, 1.45, 11.6, 0, ROOF, BEIGE2, [door(5, 6.2)], 0.2);
  wallZ(0.5, -11.6, -1.45, 0, ROOF, BEIGE2, [door(-6.2, -5)], 0.2);
  crate(2.5, -0.85, 0.6, 1.1, 0, '#7fe8ff');                            // a water fountain in the corridor
  // desks, cabinets, a photocopier
  for (const [x0, x1, z0, z1] of [[-4, -2.4, 4, 4.8], [-1.6, 0, 7.5, 8.3], [1.5, 3.1, 3.5, 4.3], [3.5, 5.1, 8, 8.8],
    [-4, -2.4, -4.8, -4], [-1.6, 0, -8.3, -7.5], [1.5, 3.1, -4.3, -3.5], [3.5, 5.1, -8.8, -8]]) solid(x0, x1, z0, z1, 0, 0.8, DESK);
  crate(-4.2, 10.8, 0.8, 1.6, 0, GREY); crate(5.2, 2.2, 0.8, 1.1, 0, GREY); crate(5.2, -10.8, 0.8, 1.6, 0, GREY);
  crate(-4.2, -10.8, 0.7, 0.7, 0, POT); crate(-4.2, -10.8, 0.9, 0.9, 0.7, PLANT);
  // upstairs: cubicles with low partitions, a meeting table
  for (const cx of [-2.6, 3.4]) for (const cz of [-6.5, -1.5, 3.5]) {
    wallX(cz - 1.2, cx - 1.4, cx + 1.4, H, H + 1.3, PART, [], 0.12);
    wallZ(cx, cz - 1.2, cz + 1.2, H, H + 1.3, PART, [], 0.12);
    solid(cx - 1.3, cx - 0.1, cz - 1.1, cz - 0.4, H, H + 0.8, DESK);
  }
  solid(-1, 2, 7.5, 9, H, H + 0.8, DESK);

  /* ----- the east: conference room and cafeteria ----- */
  // the wall onto the middle: doors below, doors to the booth and to the terrace above
  wallZ(6, -11.6, 11.6, 0, WALL, BEIGE, [door(-9, -7.8), door(-6, -4.5, H), door(-1, 1), door(4, 5.2), door(7, 8.5, H)]);
  // between the conference room and the cafeteria: a door below, a window from the terrace above
  wallX(2.15, 6.15, 15.6, 0, WALL, BEIGE, [door(7, 8.2), win(10, 13, H)], 0.3);
  // the control booth, up high over the back of the room
  solid(6.15, 8, -11.6, 2, ROOF, H, SLAB);
  wallZ(8.06, -11.6, 2, H, H + 1, RAIL, [], 0.12);
  crate(7, -10.5, 0.9, 1.0, H, DARK); crate(7, -1, 0.8, 0.8, H, GREY);
  // the stage with its lectern, a screen on the wall
  solid(13.6, 15.6, -10.5, -0.5, 0, 0.5, STAGE); solid(13.2, 13.6, -6.2, -4.7, 0, 0.25, STAGE);
  solid(14.1, 14.7, -6, -4.9, 0.5, 1.7, DESK); solid(14, 14.8, -6.1, -4.8, 1.7, 1.8, WHITE);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#e8ecf5'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#3a3340'; g.font = 'bold 20px sans-serif'; g.fillText('Réunion 9 h', 14, 28);
  [[40, 60], [80, 40], [120, 75], [160, 55], [200, 90]].forEach(([x, h], i) => { g.fillStyle = ['#ea6a4f', '#4fb3a9', '#f4b63f', '#8f73e3', '#5b9bd5'][i]; g.fillRect(x - 14, 118 - h, 28, h); });
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.5), noOutline(toon('#ffffff', { map: tex })));
  screen.position.set(15.55, 3.6, -5.5); screen.rotation.y = -Math.PI / 2; scene.add(screen);
  // rows of benches facing the stage, an aisle down the middle; low cover, a backrest a little higher
  for (const x of [8.6, 9.9, 11.2, 12.5]) for (const [z0, z1] of [[-10.6, -6.3], [-4.6, -0.4]]) {
    solid(x - 0.25, x + 0.25, z0, z1, 0, 0.45, BENCH);
    solid(x - 0.25, x - 0.13, z0, z1, 0.45, 1.0, BENCH2);
  }
  // the cafeteria, with a stairwell up to the roof terrace
  solid(6.15, 15.6, 2.3, 9.9, ROOF, H, SLAB); solid(6.15, 9.95, 9.9, 11.6, ROOF, H, SLAB);
  stairsX(10, 11.4, 14.9, -1, H, STAIR);
  wallX(9.84, 9.95, 15.6, H, H + 1, RAIL, [], 0.08);                     // round the stairwell, on the terrace
  for (const [x, z] of [[8, 5], [11, 5], [8, 8]]) { solid(x - 0.6, x + 0.6, z - 0.6, z + 0.6, 0, 0.75, WHITE); }
  solid(13.5, 15.6, 2.5, 7, 0, 1.1, BEIGE2);                            // the counter
  crate(7.2, 11, 0.9, 2.0, 0, '#ea6a4f');                               // a vending machine
  // on the terrace: a water tank, air conditioners
  crate(13, 5, 1.8, 2.2, H, GREY); crate(9, 4, 1.2, 1, H, GREY); crate(12, 8.5, 1, 0.8, H, DARK);

  /* ----- night outside, office lights inside ----- */
  scene.background = new THREE.Color('#141a33');
  const pts = new Float32Array(400 * 3);
  for (let i = 0; i < 400; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = 110, s = Math.sqrt(1 - u * u);
    pts.set([Math.cos(a) * s * r, Math.abs(u) * r * 0.8 + 6, Math.sin(a) * s * r], i * 3);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 2, sizeAttenuation: false })));
  scene.add(new THREE.HemisphereLight(0xe8eeff, 0x3a3a60, 1.5));
  const moon = new THREE.DirectionalLight(0xc8d4ff, 1.2);
  moon.position.set(10, 22, -8); moon.target.position.set(0, 0, 0);
  moon.castShadow = true;
  const sc = moon.shadow.camera; sc.left = -18; sc.right = 18; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 50;
  moon.shadow.mapSize.set(2048, 2048); moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.03;
  scene.add(moon, moon.target);
  for (const [x, y, z, c, p] of [[-10, 5.5, 0, 0xffd08a, 12], [-2, 2.6, 6, 0xe0f0ff, 6], [3, 2.6, -6, 0xe0f0ff, 6], [0, 6, 0, 0xf0f4ff, 9],
    [11, 5.5, -5, 0xffc27a, 12], [11, 2.6, 6, 0xfff1dc, 7], [11, 6, 7, 0xb8c4ff, 6]]) {
    const l = new THREE.PointLight(c, p, 14, 1.6); l.position.set(x, y, z); scene.add(l);
  }

  // Rouges on the lobby side (x < 0), Bleus on the conference side (x > 0)
  const spawns = [[-14.5, 0, -10], [-14.5, 0, 10], [-9, 0, 9.5], [-14.5, H, -5], [-10, H, 10.5], [-3, 0, -6], [-3, H, 9.5],
    [14.8, 0, -11], [7, 0, -6], [12, 0, 3.5], [8.5, 0, 10.8], [7, H, -8], [14.5, H, 8.8], [2, 0, 10.5], [3.4, H, 8.5]];
  // health in the lobby, the cafeteria and an office; armor upstairs and on the terrace;
  // the rocket launcher on the stage, the railgun at the top of the lift
  const pickups = [['health', -10, 0, -5], ['health', 9.5, 0, 6.5], ['health', -2.5, 0, -9.8], ['armor', 0.5, H, 10.3], ['armor', 11, H, 6.8],
    ['rocket', 14.8, 0.5, -2.5], ['railgun', -14.5, H, 0]];
  // jump pads: in the lobby up to the north mezzanine, in the conference room's aisle up to the booth
  const pads = [[-7.5, 0, 4.5, 0, 10.5, 3], [11.5, 0, -5.45, -3.2, 10.5, 0]];
  const movers = [{ box: liftBox, objs: [cabin, ...panes, lamp], at: liftAt, stops: [LIFT.low, H] }];
  // capture the flag: the Rouges' at the back of the lobby, under the mezzanine, the Bleus' on the stage
  const flags = [[-14.4, 0, -7], [14.8, 0.5, -8.5]];
  return { bounds: BOUNDS, boxes, spawns, pickups, pads, movers, flags };
}
