// The third battle map, "la Chambre": a child's bedroom at night, and everyone is toy-sized.
// A bed in the west (crawl under it, climb a racing track or a pile of books onto the
// mattress), a desk in the east reached by a staircase of books, a block castle in the
// middle, a toy box to hide in, a big ball, a toy car.
import * as THREE from 'three';
import { toon, noOutline, makeGlow } from './fx.js';
import { makeKit } from './fpsmap.js';

const BED = 3.3;    // the mattress
const DESK = 4.4;   // the desk top
const WALL = 10;    // the room's walls, up to the ceiling
export const BOUNDS = { x0: -15.6, x1: 15.6, z0: -11.6, z1: 11.6 };

export function buildMap(scene) {
  const { boxes, solid, wallX, wallZ, crate, door, floor } = makeKit(scene);

  // colours
  const PAPER = '#9fc6e8', SKIRT = '#fbf3e4', WOOD = '#b07a45', WOOD2 = '#c98b52', SHEET = '#fbf3e4', BLANKET = '#e88fb4';
  const PILLOW = '#f4e7c9', TRACK = '#ea6a4f', BOXC = '#5b9bd5', GREY = '#9aa8c7', DARK = '#3a3340';
  const TOYS = ['#ea6a4f', '#4fb3a9', '#f4b63f', '#8f73e3', '#5b9bd5', '#8fbf5a', '#f08a3c', '#e88fb4'];
  let toy = 0; const nextToy = () => TOYS[toy++ % TOYS.length];

  floor(32, 24, '#c98b52', '#bd8049');
  // a round rug in the middle, drawn only
  const rug = new THREE.Mesh(new THREE.CircleGeometry(6.5, 40), noOutline(toon('#8f73e3')));
  rug.rotation.x = -Math.PI / 2; rug.position.y = 0.01; rug.receiveShadow = true; scene.add(rug);
  const rug2 = new THREE.Mesh(new THREE.RingGeometry(5.2, 5.7, 40), noOutline(toon('#f4b63f')));
  rug2.rotation.x = -Math.PI / 2; rug2.position.y = 0.02; scene.add(rug2);

  // walls, a window onto the night, skirting boards, a ceiling
  wallX(-11.8, -16, 16, 0, WALL, PAPER, [], 0.4); wallX(11.8, -16, 16, 0, WALL, PAPER, [[-4, 4, 4, 8]], 0.4);
  wallZ(-15.8, -12, 12, 0, WALL, PAPER, [], 0.4); wallZ(15.8, -12, 12, 0, WALL, PAPER, [], 0.4);
  for (const z of [-11.55, 11.55]) solid(-15.6, 15.6, z - 0.05, z + 0.05, 0, 0.4, SKIRT, { ghost: true, noShadow: true });
  for (const x of [-15.55, 15.55]) solid(x - 0.05, x + 0.05, -11.6, 11.6, 0, 0.4, SKIRT, { ghost: true, noShadow: true });
  solid(-4.3, 4.3, 11.5, 11.7, 3.7, 4, SKIRT, { ghost: true }); // window sill
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(32, 24), noOutline(toon('#e8ecf5')));
  ceiling.rotation.x = Math.PI / 2; ceiling.position.y = WALL; scene.add(ceiling);

  /* ----- the bed: crawl under it, climb onto it ----- */
  for (const z of [-1, 5.3, 11]) for (const x of [-15.6, -8.1]) solid(x, x + 0.6, z, z + 0.6, 0, 1.5, WOOD);
  solid(-15.6, -7.5, -1, 11.6, 1.5, 2.2, WOOD);                          // frame: 1.5 above the floor, crouch under
  solid(-15.1, -7.5, -1, 11.6, 2.2, BED, SHEET);                         // mattress
  solid(-15.6, -15.1, -1, 11.6, 1.5, 6.5, WOOD2);                        // headboard
  solid(-15, -13, 1, 10, BED, BED + 0.6, PILLOW);                        // a pillow, just low enough to hop onto
  solid(-11, -7.5, -1, 11.6, BED, BED + 0.2, BLANKET);                   // the blanket, folded back
  crate(-9.4, 8.2, 1.6, 1.7, BED + 0.2, '#a0622d'); crate(-9.4, 8.2, 1.2, 1.1, BED + 1.9, '#b8763a'); // teddy bear
  crate(-13, 3, 0.8, 0.6, 0, nextToy()); crate(-10, 9, 0.9, 0.9, 0, nextToy());  // lost under the bed
  // a racing track up to the side of the bed, for everyone (bots too)
  for (let k = 1; k <= 15; k++) {
    const z0 = -6 + (k - 1) * 0.33;
    solid(-12, -10.6, z0, z0 + 0.33, 0, k * BED / 15, k % 2 ? TRACK : '#fbf3e4');
  }
  // a pile of books, a hop at a time, up to the foot of the bed
  [-3.4, -4.3, -5.2, -6.1, -7.0].forEach((x, i) => solid(x - 0.45, x + 0.45, 3.6, 5.4, 0, (i + 1) * 0.55, nextToy()));

  /* ----- the desk, and a staircase of books up to it ----- */
  for (const [x, z] of [[7, -3.6], [15, -3.6], [7, -11.6], [15, -11.6]]) solid(x, x + 0.6, z, z + 0.6, 0, DESK - 0.4, WOOD);
  solid(7, 15.6, -11.6, -3, DESK - 0.4, DESK, WOOD2);
  solid(11.5, 15, -11.6, -4, 2.8, DESK - 0.4, WOOD);                    // a drawer
  for (let k = 1; k <= 20; k++) {
    const x0 = 1 + (k - 1) * 0.3;
    solid(x0, x0 + 0.3, -6.6, -5.2, 0, k * DESK / 20, TOYS[k % TOYS.length]);
  }
  crate(8.6, -9.8, 1.4, 2.2, 0, GREY);                                  // the bin under the desk
  // on the desk: a laptop, a pencil pot, an eraser, the lamp
  solid(9, 12, -9.5, -7, DESK, DESK + 0.2, GREY); solid(9, 12, -9.8, -9.5, DESK, DESK + 2.2, DARK);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.8), new THREE.MeshBasicMaterial({ color: '#7fe8ff' }));
  screen.position.set(10.5, DESK + 1.2, -9.44); scene.add(screen);
  crate(8, -10.6, 0.9, 1.8, DESK, '#4fb3a9'); crate(12.2, -4.5, 1.2, 0.5, DESK, '#e88fb4');
  solid(13.6, 14.6, -10.6, -9.6, DESK, DESK + 0.3, DARK); solid(14, 14.2, -10.2, -10, DESK + 0.3, DESK + 3.6, DARK);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.2, 1, 16, 1, true), toon('#f4b63f', { side: THREE.DoubleSide }));
  shade.position.set(13.5, DESK + 3.5, -9.4); shade.rotation.z = 0.35; scene.add(shade);
  const bulb = makeGlow('#ffd08a', 3, 0.8); bulb.position.set(13.3, DESK + 3, -9.2); scene.add(bulb);

  /* ----- the block castle in the middle: two gates, the rocket launcher inside ----- */
  for (const [x, z] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) {
    crate(x, z, 1.4, 3.2, 0, nextToy());
    crate(x, z, 0.6, 0.6, 3.2, nextToy());
  }
  wallX(-2.5, -1.8, 1.8, 0, 1.4, '#f4b63f', [], 0.5); wallX(2.5, -1.8, 1.8, 0, 1.4, '#f4b63f', [door(-0.7, 0.7)], 0.5);
  wallZ(-2.5, -1.8, 1.8, 0, 1.4, '#4fb3a9', [], 0.5); wallZ(2.5, -1.8, 1.8, 0, 1.4, '#4fb3a9', [door(-0.7, 0.7)], 0.5);

  /* ----- the toy box against the south wall: get in through the front ----- */
  wallX(-8, -3, 3, 0, 2.6, BOXC, [door(-0.9, 0.9)], 0.3);
  wallZ(-3, -11.6, -8.15, 0, 2.6, BOXC); wallZ(3, -11.6, -8.15, 0, 2.6, BOXC);
  solid(-3, 3, -11.6, -11.3, 2.6, 6.5, '#3d6fd1');                     // its lid, open against the wall
  crate(-2, -10.5, 0.8, 0.8, 0, nextToy()); crate(2, -10.6, 0.7, 1.1, 0, nextToy());

  /* ----- toys on the floor ----- */
  // the ball: round, so a disc for the world
  const ball = new THREE.Group();
  ball.add(new THREE.Mesh(new THREE.SphereGeometry(1.3, 24, 16), toon('#ea6a4f')));
  const band = new THREE.Mesh(new THREE.TorusGeometry(1.31, 0.18, 8, 32), toon('#fbf3e4')); band.rotation.x = 1.2; ball.add(band);
  ball.position.set(5, 1.3, 7); ball.traverse(o => { o.castShadow = true; }); scene.add(ball);
  // a toy car
  solid(-7.5, -4.5, -7, -5.6, 0.4, 1.3, '#ea6a4f'); solid(-6.8, -5.3, -6.9, -5.7, 1.3, 2.0, '#7fe8ff');
  for (const [x, z] of [[-7, -7.05], [-5, -7.05], [-7, -5.55], [-5, -5.55]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16), toon(DARK)); w.rotation.x = Math.PI / 2; w.position.set(x, 0.4, z); scene.add(w);
  }
  // letter blocks
  crate(-5.5, -2, 1.2, 1.2, 0, nextToy()); crate(8, 3, 1.2, 1.2, 0, nextToy()); crate(8, 3, 1, 1, 1.2, nextToy());
  crate(1.8, 9.6, 1.2, 1.2, 0, nextToy()); crate(-2.2, 7, 1.2, 1.2, 0, nextToy());
  // the bookshelf on the east wall, with book spines
  solid(14.2, 15.6, 3, 11, 0, 6.5, WOOD);
  for (const y of [0.3, 2.4, 4.5]) for (let z = 3.3; z < 10.7; z += 0.55) {
    const h = 1.2 + ((z * 7) % 0.6);
    solid(14.1, 14.2, z, z + 0.45, y, y + h, nextToy(), { ghost: true, noShadow: true, flat: true });
  }

  /* ----- night outside, a lamp on the desk, a night light under the bed ----- */
  scene.background = new THREE.Color('#1d1838');
  const moon = new THREE.Mesh(new THREE.SphereGeometry(3, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff4d6' }));
  moon.position.set(8, 16, 45); scene.add(moon);
  const pts = new Float32Array(300 * 3);
  for (let i = 0; i < 300; i++) pts.set([(Math.random() - 0.5) * 140, 4 + Math.random() * 50, 40 + Math.random() * 30], i * 3);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 2, sizeAttenuation: false })));
  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x3a3060, 1.4));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.1);
  sun.position.set(-6, 22, 6); sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  const sc = sun.shadow.camera; sc.left = -18; sc.right = 18; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 50;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  for (const [x, y, z, c, p, r] of [[13, DESK + 2.6, -8.5, 0xffd08a, 16, 16], [-11, 0.8, 5, 0x9fd8ff, 5, 7], [0, 8, 0, 0xffe6cc, 8, 22], [0, 1.6, -10, 0xffc27a, 4, 5]]) {
    const l = new THREE.PointLight(c, p, r, 1.6); l.position.set(x, y, z); scene.add(l);
  }

  const spawns = [[-9, BED + 0.2, 2], [-12.5, BED, 9], [-6, 0, 9], [-14, 0, -8], [-5, 0, -9.5], [0, 0, 6], [4, 0, -3],
    [10, DESK, -5], [14.5, DESK, -7.5], [12.5, 0, 10.5], [12, 0, 1], [5, 0, -10]];
  // health under the bed, under the desk and in the toy box; armor on the pillow and by the
  // bookshelf; the rocket launcher in the castle, the railgun on the desk
  const pickups = [['health', -11, 0, 6], ['health', 9.5, 0, -6], ['health', 0, 0, -10], ['armor', -14, BED + 0.6, 5], ['armor', 12.5, 0, 7.5],
    ['rocket', 0, 0, 0], ['railgun', 14, DESK, -5.5]];
  return { bounds: BOUNDS, boxes, discs: [{ x: 5, z: 7, r: 1.3 }], spawns, pickups };
}
