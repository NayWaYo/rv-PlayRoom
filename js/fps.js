// Foam-dart battle: the blaster, hits, knock-outs, respawns, the frag board and bots.
// Loaded only in a battle room (#fps-CODE). The shooter decides whether a dart hits
// (fine between friends); everyone keeps their own health and score in presence.
// Bots live in the browser of the player who added them, who streams them to the others.
import * as THREE from 'three';
import { toon, roundedBox, makeGlow } from './fx.js';
import { randomLook, seededRand } from './avatar.js';
import { slide, fall, ceilingAt, nearestSpot, randomSpot, findPath, TALL, LOW } from './world.js';

const MAX_HP = 6, RESPAWN = 3, SHIELD = 1.5, RANGE = 60; // health in half hearts; RANGE: the longest shot of all
const MAX_ARMOR = 4; // armor soaks up damage before health
// spread when firing from the hip / while aiming; zoom divides the field of view; kick: recoil
// heavy weapons are picked up from the floor: no reload, `mag` shots, then they're gone
const WEAPONS = {
  pistol: { name: 'Pistolet', cooldown: 0.3, mag: 8, reload: 1.3, spread: 0.012, aimSpread: 0.003, damage: 2, zoom: 1.35, auto: false, muzzle: -0.35, range: 30, kick: 1 },
  rifle: { name: 'Fusil', cooldown: 0.11, mag: 24, reload: 2.0, spread: 0.03, aimSpread: 0.008, damage: 1, zoom: 1.7, auto: true, muzzle: -0.62, range: 30, kick: 0.6, climb: 0.006 },
  smg: { name: 'Mitraillette', cooldown: 0.065, mag: 32, reload: 1.7, spread: 0.05, aimSpread: 0.025, damage: 1, zoom: 1.25, auto: true, muzzle: -0.32, range: 20, kick: 0.45, climb: 0.004 },
  sniper: { name: 'Sniper', cooldown: 1.2, mag: 4, reload: 2.4, spread: 0.09, aimSpread: 0, damage: 4, zoom: 4, auto: false, muzzle: -0.86, range: 60, kick: 1.6, scope: true },
  rocket: { name: 'Lance-roquettes', cooldown: 1.0, mag: 4, heavy: true, spread: 0.01, aimSpread: 0.004, damage: 0, zoom: 1.3, auto: false, muzzle: -0.55, range: 40, kick: 2, splash: 3, splashDmg: 6 },
  railgun: { name: 'Railgun', cooldown: 1.0, mag: 3, heavy: true, spread: 0.02, aimSpread: 0, damage: 99, zoom: 2.2, auto: false, muzzle: -0.75, range: 60, kick: 1.8, charge: 1 }
};
const SLOTS = ['pistol', 'rifle', 'smg', 'sniper', 'rocket', 'railgun'];
const BASIC = 4; // the first four are always in your hands; the others only once picked up
const ROCKET_SPEED = 20;
// on the floor of the map, coming back a while after someone takes them
const PICKUPS = {
  health: { name: 'Soin', every: 15 },
  armor: { name: 'Armure', every: 20 },
  rocket: { name: 'Lance-roquettes', every: 30 },
  railgun: { name: 'Railgun', every: 35 }
};
const FOV = 70;
const BODY_R = 0.32, EYE = 1.5;
const HEAD_Y = 1.38, HEAD_R = 0.27; // where a standing head sits, and how big a target it is (generous: cartoon heads)
const BOT_NAMES = ['Zip', 'Bolt', 'Pixel', 'Turbo', 'Nova', 'Gizmo', 'Rivet', 'Volt'];
const BOT_COLS = ['#ea6a4f', '#4fb3a9', '#8f73e3', '#5b9bd5', '#e88fb4', '#8fbf5a', '#f08a3c', '#f4b63f'];
// what bots carry, and how they fire it: shots per burst, gap between, pause after, aim
const BOT_GUNS = {
  pistol: { burst: 1, gap: 0, pause: 0.9, spread: 0.07, drift: 0.006 },
  rifle: { burst: 4, gap: 0.13, pause: 1.2, spread: 0.09, drift: 0.007 },
  smg: { burst: 6, gap: 0.08, pause: 1.3, spread: 0.11, drift: 0.009 }
};
const BOT_ARMS = Object.keys(BOT_GUNS);
const SHOT_SFX = { rocket: 'whoosh', railgun: 'zap', sniper: 'crack' };
const PAD_COL = { health: '#ea6a4f', armor: '#5b9bd5', rocket: '#8fbf5a', railgun: '#7fe8ff' };

const CSS = `
#fpsBoard{pointer-events:auto;min-width:190px;max-width:240px;background:rgba(28,21,36,.86);border:1px solid var(--line);border-radius:14px;padding:10px 12px;backdrop-filter:blur(6px);font-size:13px}
#fpsBoard h3{margin:0 0 6px;font-family:var(--display);font-size:15px;font-weight:700;display:flex;justify-content:space-between;gap:8px;color:var(--muted)}
#fpsBoard .srow{grid-template-columns:12px 1fr auto auto}
#fpsBoard .srow.me .n{color:var(--marigold)}
#fpsBoard .srow.down{opacity:.5}
#fpsBoard .bots{display:flex;gap:6px;margin-top:8px}
#fpsBoard .bots button{flex:1;border:1px solid var(--line);border-radius:999px;background:var(--plum-2);color:var(--cream);font:inherit;font-weight:800;font-size:12px;padding:4px 6px;cursor:pointer}
#fpsBar{position:fixed;left:50%;bottom:calc(70px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);display:flex;gap:14px;align-items:center;background:rgba(28,21,36,.82);border:1px solid var(--line);border-radius:999px;padding:6px 16px;font-family:var(--display);font-weight:800;font-size:18px;pointer-events:none}
#fpsBar .hp{letter-spacing:2px}
#fpsBar .ammo.low{color:var(--coral)}
#fpsBar .ammo.heavy{color:var(--marigold)}
#fpsScope{position:fixed;inset:0;pointer-events:none;background:radial-gradient(circle at center,transparent 0,transparent min(34vw,34vh),rgba(10,6,16,.94) calc(min(34vw,34vh) + 2px));opacity:0;transition:opacity .12s}
#fpsScope::before,#fpsScope::after{content:'';position:absolute;left:50%;top:50%;background:rgba(10,6,16,.7)}
#fpsScope::before{width:min(68vw,68vh);height:2px;transform:translate(-50%,-50%)}
#fpsScope::after{width:2px;height:min(68vw,68vh);transform:translate(-50%,-50%)}
#fpsScope.on{opacity:1}
#fpsDown{position:fixed;inset:0;display:grid;place-items:center;background:radial-gradient(ellipse at center,rgba(234,106,79,.25),rgba(120,20,30,.55));pointer-events:none;font-family:var(--display);font-weight:800;font-size:26px;text-align:center;text-shadow:0 3px 0 rgba(0,0,0,.4);padding:16px}
#fpsHurt{position:fixed;inset:0;pointer-events:none;box-shadow:inset 0 0 90px 30px rgba(234,106,79,.75);opacity:0;transition:opacity .35s}
#fpsHurt.on{opacity:1;transition:none}
#fpsFeed{position:fixed;left:50%;top:calc(120px + env(safe-area-inset-top,0px));transform:translateX(-50%);display:flex;flex-direction:column;gap:4px;align-items:center;pointer-events:none;font-weight:800;font-size:14px}
#fpsFeed div{background:rgba(28,21,36,.82);border-radius:999px;padding:3px 12px;transition:opacity .6s}
#cross.hit{width:14px;height:14px;margin:-7px 0 0 -7px;background:var(--coral);box-shadow:0 0 0 3px rgba(0,0,0,.4)}
#cross.hit.head{width:22px;height:22px;margin:-11px 0 0 -11px;background:var(--marigold);box-shadow:0 0 0 3px rgba(0,0,0,.4),0 0 16px 4px rgba(244,182,63,.7)}
#fireBtn{pointer-events:auto;position:fixed;right:calc(18px + env(safe-area-inset-right,0px));bottom:calc(172px + env(safe-area-inset-bottom,0px));width:76px;height:76px;border-radius:50%;border:3px solid var(--cream);background:var(--coral);font-size:32px;touch-action:none;box-shadow:0 4px 0 rgba(0,0,0,.35)}
#aimBtn,#swapBtn{pointer-events:auto;position:fixed;width:52px;height:52px;font-size:24px;touch-action:none}
#aimBtn{right:calc(108px + env(safe-area-inset-right,0px));bottom:calc(184px + env(safe-area-inset-bottom,0px))}
#swapBtn{right:calc(30px + env(safe-area-inset-right,0px));bottom:calc(262px + env(safe-area-inset-bottom,0px))}
#aimBtn[aria-pressed="true"]{border-color:var(--marigold);box-shadow:0 0 0 3px rgba(244,182,63,.45)}
@media (max-width:560px){#fpsBoard{min-width:150px;max-width:170px;font-size:12px;padding:8px 10px}}
@media (pointer:coarse){#fpsBar{bottom:calc(150px + env(safe-area-inset-bottom,0px));font-size:16px}}
`;

export function startFps(ctx) {
  const { scene, camera, me, avatars, syncAvatar, sfx, toast, coarse } = ctx;
  const SPAWNS = ctx.spawns; // [x, feet height, z]
  const $ = s => document.querySelector(s);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const now = () => performance.now() / 1000;

  document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));
  const board = el('aside'); board.id = 'fpsBoard'; board.hidden = true;
  const bar = el('div'); bar.id = 'fpsBar'; bar.hidden = true;
  const hpEl = el('span', 'hp'), ammoEl = el('span', 'ammo'); bar.append(hpEl, ammoEl);
  const scopeEl = el('div'); scopeEl.id = 'fpsScope';
  const downEl = el('div'); downEl.id = 'fpsDown'; downEl.hidden = true;
  const hurtEl = el('div'); hurtEl.id = 'fpsHurt';
  const feed = el('div'); feed.id = 'fpsFeed';
  const fireBtn = el('button', null, '🎯'); fireBtn.id = 'fireBtn'; fireBtn.type = 'button'; fireBtn.hidden = true;
  fireBtn.setAttribute('aria-label', 'Tirer');
  // on a phone: aim (on/off) and switch weapons, next to the fire button
  const aimBtn = el('button', 'emote', '🔍'); aimBtn.id = 'aimBtn'; aimBtn.type = 'button'; aimBtn.setAttribute('aria-label', 'Viser'); aimBtn.setAttribute('aria-pressed', 'false');
  const swapBtn = el('button', 'emote', '🔁'); swapBtn.id = 'swapBtn'; swapBtn.type = 'button'; swapBtn.setAttribute('aria-label', 'Changer d\'arme');
  aimBtn.addEventListener('pointerdown', e => { e.preventDefault(); aim(!aiming); });
  swapBtn.addEventListener('pointerdown', e => { e.preventDefault(); cycle(1); });
  document.body.append(scopeEl, hurtEl, downEl, bar, feed, fireBtn, aimBtn, swapBtn);
  $('#scores').after(board); // top right, like the card game's scores
  fireBtn.addEventListener('pointerdown', e => { e.preventDefault(); trigger(true); });
  fireBtn.addEventListener('pointerup', () => trigger(false));
  fireBtn.addEventListener('pointercancel', () => trigger(false));

  /* ---------- world: what stops a dart ---------- */
  const solids = [], people = new Set([...avatars.values()].map(a => a.g));
  scene.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    for (let p = o; p; p = p.parent) if (people.has(p)) return;
    const m = o.material;
    if (m && (m.transparent || m.blending === THREE.AdditiveBlending)) return; // glows
    solids.push(o);
  });
  const ray = new THREE.Raycaster(); ray.far = RANGE;
  function worldHit(o, d, far = RANGE) {
    ray.set(o, d); ray.far = far;
    const h = ray.intersectObjects(solids, false)[0];
    return h ? { dist: h.distance, point: h.point, normal: h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : null } : null;
  }
  // a ray against someone standing at (x, base, z): a vertical cylinder
  function bodyHit(o, d, x, base, z, height) {
    const ox = o.x - x, oz = o.z - z, a = d.x * d.x + d.z * d.z;
    if (a < 1e-6) return null;
    const b = 2 * (ox * d.x + oz * d.z), c = ox * ox + oz * oz - BODY_R * BODY_R;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    if (t < 0.05 || t > RANGE) return null;
    const y = o.y + d.y * t;
    return y >= base && y <= base + height ? t : null;
  }

  /* ---------- who can be shot ---------- */
  // every fighter but the one asking: { id, x, z, base, height, eye, alive }
  // the body is a cylinder up to the neck, the head a ball on top (it follows crouching and jumping)
  function fighters() {
    const out = [];
    if (me.entered) {
      const hy = me.jy + HEAD_Y - me.crouch * 0.3;
      out.push({ id: ctx.myKey(), x: me.x, z: me.z, base: me.jy, height: 1.8 - me.crouch * 0.5, neck: hy - 0.2, head: new THREE.Vector3(me.x, hy, me.z), alive: alive(), self: true });
    }
    for (const a of avatars.values()) {
      if (!a.who || a.seat >= 0) continue;
      const head = a.head.getWorldPosition(new THREE.Vector3());
      out.push({ id: a.who, x: a.x, z: a.z, base: a.y || 0, height: 1.85 - (a.crouch || 0) * 0.5, neck: head.y - 0.2, head, alive: !a.fpDown && !a.fpShield, av: a });
    }
    return out;
  }
  // a ray against a ball
  function ballHit(o, d, c, r) {
    const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
    const b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r, disc = b * b - cc;
    if (disc < 0) return null;
    const t = -b - Math.sqrt(disc);
    return t > 0.05 && t < RANGE ? t : null;
  }

  /* ---------- the blasters in your hands ---------- */
  scene.add(camera);
  const gun = new THREE.Group();
  // held at half size, close to the eye, so it never pokes through a wall you stand against
  const orange = toon('#f08a3c'), blue = toon('#5b9bd5'), yellow = toon('#f4b63f'), grey = toon('#3a3340'), teal = toon('#4fb3a9');
  const purple = toon('#8f73e3'), green = toon('#8fbf5a'), red = toon('#ea6a4f'), cyan = toon('#7fe8ff');
  // each blaster as blocks: size, colour, place, tilt; drawn in your hands and in everyone else's
  const PARTS = {
    pistol: [
      [0.09, 0.1, 0.3, orange, 0, 0, 0], [0.06, 0.06, 0.2, blue, 0, 0.02, -0.22], [0.07, 0.07, 0.03, yellow, 0, 0.02, -0.33],
      [0.07, 0.15, 0.08, blue, 0, -0.11, 0.08, -0.25], [0.035, 0.05, 0.1, grey, 0, 0.075, 0.02]
    ],
    rifle: [
      [0.1, 0.12, 0.46, blue, 0, 0, -0.06], [0.06, 0.06, 0.22, yellow, 0, 0.02, -0.4], [0.075, 0.075, 0.03, orange, 0, 0.02, -0.52],
      [0.06, 0.18, 0.09, teal, 0, -0.13, -0.08, 0.25], [0.07, 0.14, 0.08, grey, 0, -0.1, 0.12, -0.25],
      [0.08, 0.1, 0.2, teal, 0, -0.02, 0.26], [0.045, 0.06, 0.16, grey, 0, 0.09, -0.04]
    ],
    smg: [
      [0.09, 0.11, 0.3, teal, 0, 0, -0.02], [0.05, 0.05, 0.14, grey, 0, 0.02, -0.22], [0.065, 0.065, 0.03, orange, 0, 0.02, -0.3],
      [0.06, 0.14, 0.07, orange, 0, -0.11, 0.07, -0.25], [0.05, 0.2, 0.07, yellow, 0, -0.15, -0.08, 0.1], [0.04, 0.04, 0.18, grey, 0, 0.075, 0]
    ],
    sniper: [
      [0.09, 0.1, 0.56, purple, 0, 0, -0.08], [0.045, 0.045, 0.32, grey, 0, 0.02, -0.5], [0.06, 0.06, 0.03, orange, 0, 0.02, -0.67],
      [0.055, 0.055, 0.24, grey, 0, 0.1, -0.06], [0.075, 0.075, 0.03, blue, 0, 0.1, -0.19], [0.07, 0.07, 0.03, blue, 0, 0.1, 0.07],
      [0.06, 0.15, 0.08, teal, 0, -0.11, 0.1, -0.25], [0.08, 0.13, 0.22, purple, 0, -0.03, 0.3]
    ],
    rocket: [
      [0.17, 0.17, 0.7, green, 0, 0.02, -0.1], [0.21, 0.21, 0.05, orange, 0, 0.02, -0.45], [0.21, 0.21, 0.05, orange, 0, 0.02, 0.25],
      [0.06, 0.15, 0.08, grey, 0, -0.14, 0.02, -0.2], [0.03, 0.08, 0.05, yellow, 0, 0.15, -0.2], [0.08, 0.08, 0.04, red, 0, 0.02, -0.48]
    ],
    railgun: [
      [0.1, 0.12, 0.46, grey, 0, 0, -0.04], [0.03, 0.035, 0.42, teal, 0, 0.055, -0.42], [0.03, 0.035, 0.42, teal, 0, -0.035, -0.42],
      [0.12, 0.13, 0.035, cyan, 0, 0.01, -0.3], [0.12, 0.13, 0.035, cyan, 0, 0.01, -0.44], [0.12, 0.13, 0.035, cyan, 0, 0.01, -0.58],
      [0.06, 0.15, 0.08, orange, 0, -0.13, 0.08, -0.25], [0.09, 0.11, 0.16, purple, 0, 0, 0.26]
    ]
  };
  function model(kind, parent) {
    const g = new THREE.Group();
    for (const [w, h, d, mat, x, y, z, rx] of PARTS[kind]) { const m = new THREE.Mesh(roundedBox(w, h, d), mat); m.position.set(x, y, z); m.rotation.x = rx || 0; g.add(m); }
    parent.add(g); return g;
  }
  const models = {};
  for (const k of SLOTS) models[k] = model(k, gun);
  // long ones held a little further out than the pistol, so the stock stays out of your face
  models.rifle.position.z = -0.16; models.sniper.position.z = -0.22; models.railgun.position.z = -0.14;
  models.rocket.position.set(0.04, 0.03, -0.1); // on the shoulder
  // a blaster in someone else's hands: grip in the right palm, barrel along the forearm
  const HELD = 0.75, GRIP = { pistol: [-0.11, 0.08], rifle: [-0.1, 0.12], smg: [-0.11, 0.07], sniper: [-0.11, 0.1], rocket: [-0.14, 0.02], railgun: [-0.13, 0.08] };
  function holdGun(a, kind) {
    if (a.heldKind === kind) return;
    if (a.held) a.held.parent.remove(a.held);
    const forearm = a.arms.find(r => r.sx > 0).el, [gy, gz] = GRIP[kind];
    const g = model(kind, forearm);
    g.scale.setScalar(HELD); g.rotation.x = -Math.PI / 2;
    g.position.set(0, -0.21 - gz * HELD, -0.01 + gy * HELD); // the hand sits at (0, -0.21, -0.01) on the forearm
    a.held = g; a.heldKind = kind;
  }
  const gunRest = new THREE.Vector3(0.1, -0.1, -0.21), gunAim = new THREE.Vector3(0, -0.075, -0.2);
  gun.scale.setScalar(0.5);
  gun.position.copy(gunRest);
  camera.add(gun);
  let kick = 0;

  /* ---------- darts in the air and stuck on things ---------- */
  const dartGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.12, 8); dartGeo.rotateX(Math.PI / 2);
  const tipGeo = new THREE.SphereGeometry(0.024, 10, 8);
  const dartMats = [toon('#5b9bd5'), toon('#ea6a4f')];
  const darts = [];
  // a foam dart, a rocket (slow, bursts where it lands) or a railgun beam (there at once, then fades)
  function spawnDart(o, h, stuck, kind) {
    if (kind === 'railgun') { beam(o, h); return; }
    const g = new THREE.Group(), rocket = kind === 'rocket';
    if (rocket) {
      g.add(new THREE.Mesh(rocketGeo, green));
      const tip = new THREE.Mesh(rocketTip, red); tip.position.z = -0.17; g.add(tip);
      const flame = makeGlow('#ffb36b', 0.5, 0.9); flame.position.z = 0.16; g.add(flame);
    } else {
      g.add(new THREE.Mesh(dartGeo, dartMats[0]));
      const tip = new THREE.Mesh(tipGeo, dartMats[1]); tip.position.z = -0.07; g.add(tip);
    }
    g.position.copy(o); g.lookAt(h); scene.add(g);
    const len = o.distanceTo(h);
    darts.push({ g, from: o.clone(), to: h.clone(), t: 0, dur: Math.max(0.05, len / (rocket ? ROCKET_SPEED : 38)), stuck, life: rocket ? 0 : 5, rocket });
    if (darts.length > 40) { scene.remove(darts[0].g); darts.shift(); }
  }
  const rocketGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10); rocketGeo.rotateX(Math.PI / 2);
  const rocketTip = new THREE.SphereGeometry(0.055, 10, 8);
  const flashes = []; // beams and blasts, fading out
  function beam(o, h) {
    const len = o.distanceTo(h), g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    const halo = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, len, 8), new THREE.MeshBasicMaterial({ color: '#7fe8ff', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    for (const m of [core, halo]) { m.rotation.x = Math.PI / 2; g.add(m); }
    g.position.lerpVectors(o, h, 0.5); g.lookAt(h); scene.add(g);
    const spark = makeGlow('#7fe8ff', 1.2, 1); spark.position.copy(h); scene.add(spark);
    flashes.push({ objs: [g, spark], t: 0, dur: 0.6, fade: k => { core.material.opacity = 1 - k; halo.material.opacity = 0.5 * (1 - k); g.scale.set(1 - k, 1 - k, 1); spark.material.opacity = 1 - k; } });
  }
  const blastGeo = new THREE.SphereGeometry(1, 20, 14);
  function blast(p, r) {
    const ball = new THREE.Mesh(blastGeo, new THREE.MeshBasicMaterial({ color: '#ffb36b', transparent: true, opacity: 0.85, depthWrite: false }));
    const glow = makeGlow('#ff8a3c', r * 3, 1);
    ball.position.copy(p); glow.position.copy(p); scene.add(ball, glow);
    flashes.push({ objs: [ball, glow], t: 0, dur: 0.5, fade: k => { ball.scale.setScalar(0.3 + r * 0.7 * Math.sqrt(k)); ball.material.opacity = 0.85 * (1 - k); ball.material.color.setHSL(0.08 - k * 0.06, 1, 0.65 - k * 0.3); glow.material.opacity = 1 - k; } });
    playNear(p, 'boom', 25);
  }
  function updateDarts(dt) {
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i]; f.t += dt; const k = Math.min(1, f.t / f.dur);
      f.fade(k);
      if (k >= 1) { for (const o of f.objs) { scene.remove(o); o.traverse(m => { if (m.geometry && m.geometry !== blastGeo) m.geometry.dispose(); if (m.material) m.material.dispose(); }); } flashes.splice(i, 1); }
    }
    for (let i = darts.length - 1; i >= 0; i--) {
      const d = darts[i];
      if (d.t < d.dur) {
        d.t = Math.min(d.dur, d.t + dt);
        d.g.position.lerpVectors(d.from, d.to, d.t / d.dur);
        if (d.t >= d.dur && d.rocket) { blast(d.to, WEAPONS.rocket.splash); scene.remove(d.g); d.g.children[2].material.dispose(); darts.splice(i, 1); continue; }
        if (d.t >= d.dur && !d.stuck) { d.vy = 1.2; d.vx = (Math.random() - 0.5) * 1.5; d.vz = (Math.random() - 0.5) * 1.5; } // bounced off someone
        continue;
      }
      if (!d.stuck && d.g.position.y > 0.03) { // falls to the floor
        d.vy -= 9.8 * dt;
        d.g.position.x += d.vx * dt; d.g.position.y = Math.max(0.03, d.g.position.y + d.vy * dt); d.g.position.z += d.vz * dt;
        d.g.rotation.x += dt * 8;
      }
      d.life -= dt;
      if (d.life <= 0) { scene.remove(d.g); darts.splice(i, 1); }
    }
  }

  /* ---------- firing (you and bots share it) ---------- */
  const tmpO = new THREE.Vector3(), tmpD = new THREE.Vector3();
  // fire from o along d, as shooter `from`; returns what was hit
  function fire(o, d, from, spread, range = 30) {
    d = d.clone();
    d.x += (Math.random() - 0.5) * 2 * spread; d.y += (Math.random() - 0.5) * 2 * spread; d.z += (Math.random() - 0.5) * 2 * spread;
    d.normalize();
    const w = worldHit(o, d, range);
    let best = w ? w.dist : range, target = null, head = false;
    for (const f of fighters()) {
      if (f.id === from || !f.alive) continue;
      const tb = bodyHit(o, d, f.x, f.base, f.z, f.neck - f.base), th = ballHit(o, d, f.head, HEAD_R);
      if (tb !== null && tb < best) { best = tb; target = f.id; head = false; }
      if (th !== null && th < best) { best = th; target = f.id; head = true; }
    }
    const h = o.clone().addScaledVector(d, best);
    return { h, d, target, head, stuck: !target && !!w };
  }
  const r2 = v => Math.round(v * 100) / 100;
  function sendDart(o, res, from, w) {
    const room = ctx.room();
    if (room) room.emit('dart', { o: [r2(o.x), r2(o.y), r2(o.z)], h: [r2(res.h.x), r2(res.h.y), r2(res.h.z)], t: res.target, s: from, k: res.stuck ? 1 : 0, w, hs: res.head ? 1 : 0 }).catch(() => {});
  }
  // a rocket bursts at p: everyone close enough, and not behind a wall, takes some damage
  // (the shooter works it out when the rocket lands and tells the others on `boom`)
  function splash(p, from) {
    const W_ = WEAPONS.rocket, hits = [];
    for (const f of fighters()) {
      if (!f.alive) continue;
      const top = f.base + f.height, dy = Math.max(f.base, Math.min(top, p.y)) - p.y;
      const dist = Math.hypot(f.x - p.x, f.z - p.z, dy);
      if (dist > W_.splash || !canSee(p, f.x, f.base, f.z, f.height)) continue;
      let dmg = Math.max(1, Math.round(W_.splashDmg * (1 - dist / W_.splash)));
      if (f.id === from) {
        dmg = Math.ceil(dmg / 2); // your own rocket hurts you less, and throws you up
        if (f.self && me.jv >= 0) me.jv = Math.max(me.jv, 6 * (1 - dist / W_.splash) + 1);
      }
      hits.push([f.id, dmg]);
    }
    if (!hits.length) return;
    const room = ctx.room();
    if (room) room.emit('boom', { s: from, x: hits }).catch(() => {});
    for (const [id, dmg] of hits) {
      if (from === ctx.myKey() && id !== from) hitMarker(false);
      damage(id, from, dmg, false);
    }
  }

  // your weapons: which one is out, what's left in each, reloading, switching, aiming
  let slot = 0, last = 0, heavy = null, triggerDown = false, nextShot = 0, reloadUntil = 0, reloadSeq = 0, switchUntil = 0, aiming = false, zoom = 1, chargeAt = 0;
  const ammo = {};
  const fillAmmo = () => { for (const k of SLOTS) ammo[k] = WEAPONS[k].heavy ? 0 : WEAPONS[k].mag; };
  fillAmmo();
  const W = () => WEAPONS[SLOTS[slot]];
  const has = i => i < BASIC || SLOTS[i] === heavy;
  function trigger(down) {
    triggerDown = down;
    if (down) shoot();
    else if (chargeAt) { chargeAt = 0; sfx.uncharge(); renderBar(); } // let go too soon: no shot
  }
  function shoot(charged) {
    if (!me.entered || !alive() || ctx.blocked()) return;
    const t = now(), w = W(), k = SLOTS[slot];
    if (t < nextShot || t < reloadUntil || t < switchUntil) return;
    if (ammo[k] <= 0) { reload(); return; }
    if (w.charge && !charged) { if (!chargeAt) { chargeAt = t; sfx.charge(w.charge); renderBar(); } return; } // fires once charged, in update()
    chargeAt = 0;
    nextShot = t + w.cooldown; ammo[k]--;
    camera.getWorldPosition(tmpO); camera.getWorldDirection(tmpD);
    const aimed = (zoom - 1) / (w.zoom - 1); // 0 from the hip, 1 fully aimed
    const res = fire(tmpO, tmpD, ctx.myKey(), w.spread + (w.aimSpread - w.spread) * Math.max(0, Math.min(1, aimed)), w.range);
    const muzzle = new THREE.Vector3(0, 0.02, w.muzzle).applyMatrix4(gun.matrixWorld);
    if (w.scope && aimed > 0.8) muzzle.copy(tmpO).addScaledVector(tmpD, 0.3).y -= 0.08; // through the scope: the gun is out of sight
    spawnDart(muzzle, res.h, res.stuck, k);
    if (k === 'rocket') sfx.whoosh(); else if (k === 'railgun') sfx.zap(); else if (k === 'sniper') sfx.crack(); else sfx.dart(w.auto ? 0.7 : 1);
    kick = w.kick;
    if (w.climb) { me.pitch += w.climb; me.yaw += (Math.random() - 0.5) * w.climb; } // a little climb on a long burst
    if (k === 'rocket') {
      // the rocket flies a while: hurt whoever is near where it lands, once it gets there
      sendDart(muzzle, { ...res, target: null }, ctx.myKey(), k);
      const p = res.h.clone().addScaledVector(res.d, -0.15), from = ctx.myKey();
      setTimeout(() => splash(p, from), muzzle.distanceTo(res.h) / ROCKET_SPEED * 1000);
    } else {
      sendDart(muzzle, res, ctx.myKey(), k);
      if (res.target) {
        hitMarker(res.head);
        if (res.head) { const a = [...avatars.values()].find(v => v.who === res.target); if (a) ctx.react(a, 'shock', 0.6); }
        damage(res.target, ctx.myKey(), w.damage * (res.head ? 2 : 1), res.head); // the head counts double
      }
    }
    if (ammo[k] === 0) {
      if (w.heavy) setTimeout(() => { if (heavy === k && ammo[k] === 0) dropHeavy(); }, 600); // empty: thrown away
      else reload();
    }
    renderBar();
  }
  function dropHeavy() {
    const was = SLOTS[slot] === heavy;
    heavy = null; chargeAt = 0;
    if (was) select(last < BASIC ? last : 0);
    renderBar(); pushMine();
  }
  function reload() {
    const k = SLOTS[slot], w = W();
    if (w.heavy || reloadUntil > now() || ammo[k] === w.mag || !alive()) return;
    reloadUntil = now() + w.reload; sfx.reload();
    const seq = ++reloadSeq;
    setTimeout(() => { if (seq === reloadSeq) { ammo[k] = w.mag; renderBar(); } }, w.reload * 1000);
    renderBar();
  }
  // take out another weapon (a switch cancels a reload)
  function select(i) {
    if (!SLOTS[i] || !has(i)) return false;
    if (i !== slot && me.entered && alive()) {
      if (slot < BASIC) last = slot;
      slot = i; reloadSeq++; reloadUntil = 0; switchUntil = now() + 0.35; triggerDown = false; chargeAt = 0;
      sfx.reload(); renderBar(); pushMine(); // the others see the new blaster in your hands
    }
    return true;
  }
  // the next weapon you have, either way (the mouse wheel, the phone's switch button)
  function cycle(dir) {
    for (let n = 1; n <= SLOTS.length; n++) { const i = (slot + dir * n + SLOTS.length * n) % SLOTS.length; if (has(i)) { select(i); return; } }
  }
  function aim(on) { aiming = on && me.entered && alive(); }
  let markTimer = null;
  function hitMarker(head) {
    if (head) sfx.ding(); else sfx.pock();
    const c = $('#cross'); c.classList.add('hit'); c.classList.toggle('head', !!head);
    clearTimeout(markTimer); markTimer = setTimeout(() => c.classList.remove('hit', 'head'), head ? 260 : 140);
  }

  /* ---------- health, knock-outs, scores ---------- */
  let hp = MAX_HP, armor = 0, kills = 0, deaths = 0, downUntil = 0, shieldUntil = 0, downBy = '';
  const alive = () => hp > 0;
  function pushMine() { const room = ctx.room(); if (room) room.presence({ fp: [hp, kills, deaths, now() < shieldUntil ? 1 : 0, slot] }).catch(() => {}); }
  // a dart landed on `target`, fired by `from`: only the target's owner applies it
  function damage(target, from, dmg, head) {
    if (target === ctx.myKey()) hurtMe(from, dmg, head);
    else { const b = bots.get(target); if (b) hurtBot(b, from, dmg, head); }
  }
  // armor takes the damage first
  function soak(who, dmg) {
    const a = Math.min(who.armor || 0, dmg);
    who.armor = (who.armor || 0) - a;
    return dmg - a;
  }
  function hurtMe(from, dmg, head) {
    if (!alive() || now() < shieldUntil) return;
    const mine = { armor }; dmg = soak(mine, dmg); armor = mine.armor;
    hp = Math.max(0, hp - dmg); sfx.bonk();
    hurtEl.classList.add('on'); setTimeout(() => hurtEl.classList.remove('on'), 60);
    if (hp <= 0) {
      deaths++; downUntil = now() + RESPAWN; chargeAt = 0;
      downBy = from === ctx.myKey() ? 'ta propre roquette' : nameOf(from) + (head ? ', en pleine tête' : '');
      if (heavy) { heavy = null; if (slot >= BASIC) slot = last; } // a picked-up weapon is lost
      knockedOut(ctx.myKey(), from, head);
    }
    pushMine(); renderBar();
  }
  function knockedOut(victim, by, head) {
    if (by !== victim) { // knocking yourself out scores nothing
      if (by === ctx.myKey()) kills++;
      else { const b = bots.get(by); if (b) b.kills++; }
    }
    const room = ctx.room();
    if (room) room.emit('ko', { v: victim, k: by, h: head ? 1 : 0 }).catch(() => {});
    announce(victim, by, head);
  }
  function announce(victim, by, head) {
    const me_ = ctx.myKey();
    const v = victim === me_ ? 'toi' : nameOf(victim), k = by === me_ ? 'Tu' : nameOf(by);
    const text = victim === by ? (by === me_ ? 'Tu t\'es éliminé tout seul 🙃' : `${k} s'est éliminé tout seul 🙃`)
      : (by === me_ ? `Tu as éliminé ${v} 🎯` : victim === me_ ? `${k} t'a éliminé` : `${k} a éliminé ${v}`) + (head ? ' 💥 dans la tête !' : '');
    const line = el('div', null, text);
    feed.append(line);
    setTimeout(() => { line.style.opacity = '0'; setTimeout(() => line.remove(), 700); }, 3000);
    while (feed.children.length > 4) feed.firstChild.remove();
    renderBoard();
  }
  function nameOf(id) {
    if (id === ctx.myKey()) return me.nick;
    const b = bots.get(id) || remoteBots.get(id); if (b) return b.nick;
    for (const a of avatars.values()) if (a.who === id) return a.nick;
    return 'Quelqu\'un';
  }
  function respawnSpot() {
    let best = SPAWNS[0], bd = -1;
    const others = fighters().filter(f => !f.self);
    for (const s of SPAWNS) {
      const d = others.length ? Math.min(...others.map(f => Math.hypot(f.x - s[0], f.z - s[2]) + Math.abs(f.base - s[1]))) : Math.random();
      if (d > bd) { bd = d; best = s; }
    }
    return best;
  }
  function respawnMe() {
    const [x, y, z] = respawnSpot();
    me.x = x; me.z = z; me.jy = y; me.jv = 0; me.yaw = Math.atan2(x, z); me.pitch = -0.05;
    hp = MAX_HP; armor = 0; heavy = null; if (slot >= BASIC) slot = last; shieldUntil = now() + SHIELD; fillAmmo(); reloadUntil = 0; reloadSeq++;
    setTimeout(pushMine, SHIELD * 1000 + 50); // the shield ends even if this tab is in the background
    pushMine(); renderBar();
  }

  /* ---------- bots ---------- */
  const bots = new Map(), remoteBots = new Map();
  let botSeq = 0;
  function addBot() {
    const n = botSeq++, id = 'bot:' + ctx.myKey() + ':' + n;
    const seed = (Math.random() * 1e9) | 0;
    const [x, y, z] = respawnSpot();
    bots.set(id, {
      id, nick: '🤖 ' + BOT_NAMES[n % BOT_NAMES.length], col: BOT_COLS[n % BOT_COLS.length], seed, look: randomLook(seededRand(seed)),
      x, z, y, vy: 0, yaw: 0, crouch: false, hp: MAX_HP, kills: 0, deaths: 0, downUntil: 0, shieldUntil: now() + SHIELD,
      weapon: BOT_ARMS[n % 3], burst: 0, armor: 0,
      path: [], step: 0, repath: 0, think: 0, target: null, lastSeen: null, nextShot: now() + 1.5, strafe: 1, strafeUntil: 0,
      stuckAt: 0, stuckX: x, stuckZ: z
    });
    renderBoard();
  }
  function removeBot() {
    const last = [...bots.keys()].pop(); if (!last) return;
    bots.delete(last); renderBoard();
  }
  function hurtBot(b, from, dmg, head) {
    if (b.hp <= 0 || now() < b.shieldUntil) return;
    b.hp = Math.max(0, b.hp - soak(b, dmg));
    const a = avatars.get('f:' + b.id); if (a) ctx.react(a, 'shock', 0.8);
    if (b.hp <= 0) { b.deaths++; b.downUntil = now() + RESPAWN; knockedOut(b.id, from, head); }
    else if (!b.target) b.think = 0; // look around for whoever did that
  }
  function canSee(o, x, base, z, height) {
    const d = new THREE.Vector3(x - o.x, base + height * 0.6 - o.y, z - o.z), dist = d.length();
    d.normalize();
    const w = worldHit(o, d, dist);
    return !w || w.dist > dist - 0.3;
  }
  // walk somewhere: a friend's last known spot, or anywhere at all
  function planWalk(b, t) {
    const to = b.lastSeen && t - b.lastSeen.t < 8 ? nearestSpot(b.lastSeen.x, b.lastSeen.y, b.lastSeen.z) : randomSpot();
    b.path = findPath(nearestSpot(b.x, b.y, b.z), to) || []; b.step = 1;
    b.repath = t + (b.path.length ? 6 + Math.random() * 4 : 1); // no way there: try elsewhere in a second
    if (b.lastSeen && to && Math.hypot(to.x - b.x, to.z - b.z) < 1) b.lastSeen = null;
  }
  const botO = new THREE.Vector3();
  function updateBot(b, dt) {
    const t = now();
    if (b.hp <= 0) {
      if (t > b.downUntil) {
        const [x, y, z] = respawnSpot();
        Object.assign(b, { x, y, z, vy: 0, hp: MAX_HP, armor: 0, shieldUntil: t + SHIELD, target: null, lastSeen: null, path: [], repath: 0, nextShot: t + 1 });
      }
      return;
    }
    botO.set(b.x, b.y + (b.crouch ? 1.0 : EYE), b.z);
    // pick a target now and then: the nearest one in sight
    if (t > b.think) {
      b.think = t + 0.4 + Math.random() * 0.3;
      let best = null, bd = 16;
      for (const f of fighters()) {
        if (f.id === b.id || !f.alive) continue;
        const d = Math.hypot(f.x - b.x, f.z - b.z) + Math.abs(f.base - b.y);
        if (d < bd && canSee(botO, f.x, f.base, f.z, f.height)) { bd = d; best = f.id; }
      }
      if (best !== b.target) b.spotted = t; // a moment to react before the first shot
      if (!best && b.target) b.repath = 0; // lost them: go and look where they were
      b.target = best;
    }
    const f = b.target && fighters().find(q => q.id === b.target && q.alive);
    let mx = 0, mz = 0, face = null, wantCrouch = false;
    if (f) {
      b.lastSeen = { x: f.x, y: f.base, z: f.z, t };
      const dx = f.x - b.x, dz = f.z - b.z, d = Math.hypot(dx, dz) || 1;
      face = Math.atan2(-dx, -dz);
      b.pitch = Math.atan2(f.base + f.height * 0.6 - botO.y, d); // arms follow the aim
      if (t > b.strafeUntil) { b.strafe = Math.random() < 0.5 ? -1 : 1; b.strafeUntil = t + 0.8 + Math.random() * 1.4; }
      const fwd = Math.abs(f.base - b.y) > 1 ? 0 : d > 7 ? 1 : d < 3 ? -1 : 0;
      mx = dx / d * fwd + (-dz / d) * b.strafe * 0.8; mz = dz / d * fwd + (dx / d) * b.strafe * 0.8;
      // shoot when roughly facing them
      let dy = face - b.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      if (Math.abs(dy) < 0.25 && t > b.nextShot && t > b.spotted + 0.7) {
        const g = BOT_GUNS[b.weapon];
        // pistol bots take their time; the others fire short bursts, then pause
        if (--b.burst > 0) b.nextShot = t + g.gap;
        else { b.nextShot = t + g.pause + Math.random() * 0.8; b.burst = g.burst; }
        const dir = new THREE.Vector3(f.x - b.x, f.base + f.height * 0.6 - botO.y, f.z - b.z).normalize();
        const o = botO.clone().addScaledVector(dir, 0.4);
        const res = fire(o, dir, b.id, g.spread + d * g.drift, WEAPONS[b.weapon].range);
        spawnDart(o, res.h, res.stuck);
        playNear(o, 'dart');
        sendDart(o, res, b.id, b.weapon);
        if (res.target) damage(res.target, b.id, WEAPONS[b.weapon].damage * (res.head ? 2 : 1), res.head);
      }
      if (Math.random() < dt * 0.25 && b.vy === 0 && ceilingAt(b.x, b.z, b.y) > b.y + 3) b.vy = 3.6; // the odd hop
    } else {
      // follow the path, a standing spot at a time
      b.pitch = 0;
      if (t > b.repath || (b.path.length && b.step >= b.path.length)) planWalk(b, t);
      const p = b.path && b.path[b.step];
      if (p) {
        const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz);
        if (d < 0.3) b.step++;
        else { mx = dx / d; mz = dz / d; face = Math.atan2(-dx, -dz); }
        wantCrouch = p.crouch;
      }
    }
    if (face !== null) { let dy = face - b.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); b.yaw += dy * Math.min(1, dt * 6); }
    b.crouch = wantCrouch || ceilingAt(b.x, b.z, b.y) < b.y + TALL;
    const sp = (b.crouch ? 1.8 : 3.2) * dt, ox = b.x, oz = b.z;
    b.x += mx * sp; b.z += mz * sp;
    b.height = b.crouch ? LOW : TALL;
    slide(b, ox, oz);
    fall(b, dt);
    // stuck against something: think again
    if (t > b.stuckAt) {
      if ((mx || mz) && Math.hypot(b.x - b.stuckX, b.z - b.stuckZ) < 0.15) b.repath = 0;
      b.stuckAt = t + 1; b.stuckX = b.x; b.stuckZ = b.z;
    }
  }
  function playNear(o, kind, far = 12) {
    const d = o.distanceTo(camera.position);
    if (d < far) sfx[kind](Math.max(0.15, 1 - d / far));
  }
  let botSend = 0;
  function streamBots() {
    const room = ctx.room(); if (!room || !bots.size) return;
    const t = now(); if (t - botSend < 0.1) return; botSend = t;
    room.emit('bots', [...bots.values()].map(b => [b.id, b.nick, b.col, b.seed, r2(b.x), r2(b.z), r2(b.yaw), r2(b.y), b.hp, b.kills, b.deaths, t < b.shieldUntil ? 1 : 0, b.crouch ? 1 : 0, SLOTS.indexOf(b.weapon), r2(b.pitch || 0)])).catch(() => {});
  }

  /* ---------- things to pick up on the floor ---------- */
  // each one turns on a pad; walk over it to take it. Whoever takes it tells the others on
  // `pick`, and everyone counts down to its return on their own clock
  const padGeo = new THREE.CylinderGeometry(0.55, 0.6, 0.06, 24);
  const pickups = (ctx.pickups || []).map(([kind, x, y, z], i) => {
    const g = new THREE.Group(), item = new THREE.Group();
    g.position.set(x, y, z);
    const pad = new THREE.Mesh(padGeo, toon(PAD_COL[kind])); pad.position.y = 0.03; g.add(pad);
    const glow = makeGlow(PAD_COL[kind], 1.6, 0.55); glow.position.y = 0.5; g.add(glow);
    if (kind === 'health') {
      item.add(new THREE.Mesh(roundedBox(0.36, 0.36, 0.36), toon('#fbf3e4')));
      for (const [w, h] of [[0.38, 0.1], [0.1, 0.38]]) { const c = new THREE.Mesh(roundedBox(w, h, 0.38), red); item.add(c); }
    } else if (kind === 'armor') {
      item.add(new THREE.Mesh(roundedBox(0.4, 0.46, 0.1), blue));
      const s = new THREE.Mesh(roundedBox(0.1, 0.36, 0.12), yellow); item.add(s);
      const s2 = new THREE.Mesh(roundedBox(0.3, 0.1, 0.12), yellow); s2.position.y = 0.05; item.add(s2);
    } else { const m = model(kind, item); m.scale.setScalar(0.9); m.position.z = 0.15; }
    item.position.y = 0.6; g.add(item); scene.add(g);
    return { i, kind, x, y, z, g, item, glow, back: 0 };
  });
  function takePickup(p, t) {
    p.back = t + PICKUPS[p.kind].every;
    const room = ctx.room();
    if (room) room.emit('pick', { i: p.i, k: p.kind }).catch(() => {});
  }
  // what you'd get from it right now (nothing if you're full)
  function wantsPickup(kind) {
    if (kind === 'health') return hp < MAX_HP;
    if (kind === 'armor') return armor < MAX_ARMOR;
    return heavy !== kind || ammo[kind] < WEAPONS[kind].mag;
  }
  function grab(p) {
    const k = p.kind;
    if (k === 'health') hp = Math.min(MAX_HP, hp + 4);
    else if (k === 'armor') armor = MAX_ARMOR;
    else {
      if (heavy && heavy !== k) ammo[heavy] = 0;
      heavy = k; ammo[k] = WEAPONS[k].mag;
      select(SLOTS.indexOf(k)); // in your hands straight away
    }
    sfx.pickup();
    toast(k === 'health' ? 'Soin : +2 cœurs ❤️' : k === 'armor' ? 'Armure : 🛡️🛡️' : `${WEAPONS[k].name} ! (${key5()})`);
    pushMine(); renderBar();
  }
  const key5 = () => coarse ? '🔁 pour changer' : 'touche ' + ctx.keyLabel('weapon5');
  function updatePickups(dt) {
    const t = now();
    for (const p of pickups) {
      const up = t >= p.back;
      p.item.visible = up; p.glow.material.opacity = up ? 0.55 : 0.12;
      if (!up) continue;
      p.item.rotation.y += dt * 1.8;
      p.item.position.y = 0.6 + Math.sin(t * 2.4 + p.i) * 0.08;
      const near = (x, y, z) => Math.hypot(x - p.x, z - p.z) < 0.8 && Math.abs(y - p.y) < 0.9;
      if (me.entered && alive() && near(me.x, me.jy, me.z) && wantsPickup(p.kind)) { takePickup(p, t); grab(p); continue; }
      // your bots take health and armor when they walk over them
      if (p.kind !== 'health' && p.kind !== 'armor') continue;
      for (const b of bots.values()) {
        if (b.hp <= 0 || !near(b.x, b.y, b.z)) continue;
        if (p.kind === 'health' && b.hp < MAX_HP) { b.hp = Math.min(MAX_HP, b.hp + 4); takePickup(p, t); break; }
        if (p.kind === 'armor' && b.armor < MAX_ARMOR) { b.armor = MAX_ARMOR; takePickup(p, t); break; }
      }
    }
  }

  /* ---------- network ---------- */
  function onDart(m) {
    if (m.isMe) return;
    const d = m.data || {}, shooter = typeof d.s === 'string' ? d.s : null;
    if (!Array.isArray(d.o) || !Array.isArray(d.h) || d.o.length !== 3 || d.h.length !== 3 || !d.o.concat(d.h).every(Number.isFinite)) return;
    const o = new THREE.Vector3(...d.o), h = new THREE.Vector3(...d.h);
    if (o.distanceTo(h) > RANGE + 1) return;
    if (!Object.hasOwn(WEAPONS, d.w)) d.w = 'pistol';
    spawnDart(o, h, d.k === 1, d.w);
    playNear(o, SHOT_SFX[d.w] || 'dart', d.w === 'railgun' || d.w === 'sniper' ? 30 : 12);
    if (typeof d.t === 'string' && shooter) damage(d.t, shooter, WEAPONS[d.w].damage * (d.hs === 1 ? 2 : 1), d.hs === 1);
  }
  function onKo(m) {
    if (m.isMe) return;
    const d = m.data || {};
    if (typeof d.v !== 'string' || typeof d.k !== 'string') return;
    if (d.v === d.k) { /* knocked themselves out: nobody scores */ }
    else if (d.k === ctx.myKey()) { kills++; pushMine(); hitMarker(d.h === 1); }
    else { const b = bots.get(d.k); if (b) b.kills++; }
    announce(d.v, d.k, d.h === 1);
  }
  function onBots(m) {
    if (m.isMe || !Array.isArray(m.data)) return;
    const owner = m.by;
    for (const r of m.data.slice(0, 12)) {
      if (!Array.isArray(r) || typeof r[0] !== 'string' || !r[0].startsWith('bot:' + owner + ':')) continue;
      remoteBots.set(r[0], { id: r[0], nick: String(r[1]).slice(0, 20), col: /^#[0-9a-f]{6}$/i.test(r[2]) ? r[2] : '#f4b63f', seed: r[3] | 0, x: +r[4] || 0, z: +r[5] || 0, yaw: +r[6] || 0, y: +r[7] || 0, hp: r[8] | 0, kills: r[9] | 0, deaths: r[10] | 0, shield: r[11] === 1, crouch: r[12] === 1, weapon: BOT_GUNS[SLOTS[r[13]]] ? SLOTS[r[13]] : 'pistol', pitch: Math.max(-1.2, Math.min(1.2, +r[14] || 0)), seen: now(), owner });
    }
  }
  function onBoom(m) {
    if (m.isMe) return;
    const d = m.data || {};
    if (typeof d.s !== 'string' || !Array.isArray(d.x)) return;
    for (const h of d.x.slice(0, 24)) {
      if (!Array.isArray(h) || typeof h[0] !== 'string') continue;
      damage(h[0], d.s, Math.max(1, Math.min(WEAPONS.rocket.splashDmg, h[1] | 0)), false);
    }
  }
  function onPick(m) {
    if (m.isMe) return;
    const d = m.data || {}, p = pickups[d.i | 0];
    if (!p || p.kind !== d.k) return;
    if (now() >= p.back) playNear(p.g.position, 'pickup', 8);
    p.back = now() + PICKUPS[p.kind].every;
  }
  const room0 = ctx.room();
  if (room0) for (const [topic, fn] of [['dart', onDart], ['ko', onKo], ['bots', onBots], ['boom', onBoom], ['pick', onPick]]) room0.on(topic, fn, () => {});

  /* ---------- HUD ---------- */
  function renderBar() {
    bar.hidden = !me.entered;
    // three hearts, each one two hits of the rifle or one of the pistol
    let hearts = '';
    for (let i = 0; i < MAX_HP / 2; i++) hearts += hp >= i * 2 + 2 ? '❤️' : hp === i * 2 + 1 ? '💔' : '🤍';
    hpEl.textContent = hearts + '🛡️'.repeat(Math.ceil(armor / 2));
    const reloading = now() < reloadUntil, w = W(), k = SLOTS[slot];
    ammoEl.textContent = `${w.name} · ` + (reloading ? 'recharge…' : chargeAt ? 'charge…' : w.heavy ? `${ammo[k]} restant${ammo[k] > 1 ? 's' : ''}` : `${ammo[k]}/${w.mag}`);
    ammoEl.classList.toggle('heavy', !!w.heavy);
    ammoEl.classList.toggle('low', !reloading && ammo[k] <= w.mag / 4);
  }
  let boardSig = '';
  function renderBoard() {
    board.hidden = !me.entered;
    if (!me.entered) return;
    const rows = [{ id: ctx.myKey(), nick: me.nick, col: me.col, k: kills, d: deaths, down: !alive(), me: true }];
    for (const p of ctx.peers()) {
      if (p.sameTab || p.kind !== 'viewer' || !p.presence || !p.presence.n) continue;
      const fp = Array.isArray(p.presence.fp) ? p.presence.fp : [MAX_HP, 0, 0];
      rows.push({ id: ctx.peerKey(p), nick: ctx.cleanNick(p.presence.n), col: ctx.cleanCol(p.presence.c), k: fp[1] | 0, d: fp[2] | 0, down: (fp[0] | 0) <= 0 });
    }
    for (const b of bots.values()) rows.push({ id: b.id, nick: b.nick, col: b.col, k: b.kills, d: b.deaths, down: b.hp <= 0 });
    for (const b of remoteBots.values()) rows.push({ id: b.id, nick: b.nick, col: b.col, k: b.kills, d: b.deaths, down: b.hp <= 0 });
    rows.sort((a, b) => b.k - a.k || a.d - b.d);
    const sig = JSON.stringify(rows) + bots.size;
    if (sig === boardSig) return; boardSig = sig;
    board.textContent = '';
    const h = el('h3'); h.append(el('span', null, 'Fléchettes'), el('span', null, '🎯 💥')); board.append(h);
    for (const r of rows) {
      const row = el('div', 'srow' + (r.me ? ' me' : '') + (r.down ? ' down' : ''));
      const c = el('span', 'c'); c.style.background = r.col;
      row.append(c, el('span', 'n', r.nick), el('span', 'rp', String(r.k)), el('span', 't', String(r.d)));
      board.append(row);
    }
    const bb = el('div', 'bots');
    const add = el('button', null, '+ Robot'); add.type = 'button'; add.addEventListener('click', addBot);
    bb.append(add);
    if (bots.size) { const rm = el('button', null, '− Robot'); rm.type = 'button'; rm.addEventListener('click', removeBot); bb.append(rm); }
    board.append(bb);
  }

  /* ---------- every frame ---------- */
  function syncAvatars() {
    const t = now();
    for (const [id, b] of remoteBots) if (t - b.seen > 2.5) remoteBots.delete(id);
    const all = [...bots.values(), ...remoteBots.values()];
    for (const b of all) {
      const a = syncAvatar('f:' + b.id, b.nick, b.col, b.look || randomLook(seededRand(b.seed)), b.x, b.z, b.yaw, -1);
      a.who = b.id; a.ty = b.y; a.fpWeapon = b.weapon; a.aimPitch = b.pitch || 0; a.crouchT = b.crouch ? 1 : 0; a.fpDown = b.hp <= 0; a.fpShield = b.shield !== undefined ? b.shield : t < b.shieldUntil;
    }
  }
  // what presence says about a friend's avatar
  function peerAvatar(a, pr) {
    const fp = Array.isArray(pr.fp) ? pr.fp : null;
    a.fpDown = !!fp && (fp[0] | 0) <= 0;
    a.fpShield = !!fp && fp[3] === 1;
    a.fpWeapon = fp && SLOTS[fp[4]] ? SLOTS[fp[4]] : 'pistol';
    a.aimPitch = a.pitch || 0;
  }
  let uiTick = 0;
  function update(dt) {
    const t = now();
    if (me.entered && !alive()) {
      const left = Math.ceil(downUntil - t);
      downEl.hidden = false; downEl.textContent = `Touché par ${downBy} ! Retour dans ${Math.max(1, left)}…`;
      if (t > downUntil) { downEl.hidden = true; respawnMe(); }
    } else downEl.hidden = true;
    me.frozen = me.entered && !alive();
    // lying on the floor while knocked out
    if (me.frozen) { camera.position.y = 0.35; camera.rotation.z = 0.5; }
    for (const b of bots.values()) updateBot(b, dt);
    streamBots();
    // knocked-out avatars fall over backwards, shielded ones blink
    for (const a of avatars.values()) {
      if (a.g.rotation.order !== 'YXZ') a.g.rotation.order = 'YXZ';
      a.fpFall = (a.fpFall || 0) + ((a.fpDown ? 1 : 0) - (a.fpFall || 0)) * Math.min(1, dt * 8);
      a.g.rotation.x = a.fpFall * Math.PI / 2;
      if (a.fpShield && !a.fpDown) a.g.visible = a.g.visible && Math.floor(t * 8) % 2 === 0;
      // everyone holds their blaster, aiming where they look
      if (a.who && a.seat < 0) { holdGun(a, a.fpWeapon || 'pistol'); a.armed = !a.fpDown; }
    }
    // aiming: zoom in smoothly, bring the blaster under the crosshair
    const w = W();
    if (!me.entered || !alive() || ctx.blocked()) aiming = false;
    zoom += ((aiming ? w.zoom : 1) - zoom) * Math.min(1, dt * 14);
    if (Math.abs(camera.fov - FOV / zoom) > 0.01) { camera.fov = FOV / zoom; camera.updateProjectionMatrix(); }
    const aimed = Math.max(0, Math.min(1, (zoom - 1) / (w.zoom - 1)));
    // the blaster: the one in your hands, recoil, a dip while reloading or switching
    for (const k of SLOTS) models[k].visible = k === SLOTS[slot];
    kick = Math.max(0, kick - dt * 9);
    const rl = t < reloadUntil ? Math.sin(Math.min(1, (reloadUntil - t) / w.reload) * Math.PI) : 0;
    const sw = t < switchUntil ? (switchUntil - t) / 0.35 : 0;
    const scoped = !!w.scope && aimed > 0.85; // looking through the sniper's scope
    scopeEl.classList.toggle('on', scoped && me.entered && alive());
    gun.visible = me.entered && alive() && !scoped;
    // bottom right of the view, whatever the screen shape (a phone held upright is narrow)
    const hh = -gunRest.z * Math.tan(FOV * Math.PI / 360), hw = hh * camera.aspect;
    const s = Math.min(1, camera.aspect * 1.3);
    gun.scale.setScalar(0.5 * s / zoom); // the zoom would make it look bigger: keep its apparent size
    const rx = Math.min(gunRest.x, hw * 0.6), ry = Math.max(gunRest.y, -hh * 0.75);
    gun.position.set((rx + (gunAim.x - rx) * aimed) / zoom, (ry + (gunAim.y - ry) * aimed - rl * 0.06 - sw * 0.08) / zoom, gunRest.z + kick * 0.03);
    gun.rotation.set(kick * 0.25 - rl * 0.6 - sw * 0.5, 0, rl * 0.3);
    if (chargeAt) { // the railgun shakes as it charges, then fires by itself
      const c = Math.min(1, (t - chargeAt) / w.charge);
      gun.position.x += (Math.random() - 0.5) * 0.006 * c; gun.position.y += (Math.random() - 0.5) * 0.006 * c;
      if (c >= 1) shoot(true);
    }
    if (triggerDown && w.auto) shoot();
    updateDarts(dt);
    updatePickups(dt);
    $('#cross').hidden = !me.entered || !alive() || ctx.blocked();
    fireBtn.hidden = aimBtn.hidden = swapBtn.hidden = !(coarse && me.entered && alive());
    aimBtn.setAttribute('aria-pressed', String(aiming));
    if ((uiTick += dt) > 0.25) { uiTick = 0; renderBar(); renderBoard(); }
  }
  return {
    update, syncAvatars, peerAvatar, trigger, reload, select, aim,
    cycle,
    selectHeavy() { if (heavy) select(SLOTS.indexOf(heavy)); },
    lookScale: () => 1 / zoom, // slower mouse while zoomed in
    onEnter() { respawnMe(); renderBoard(); renderBar(); }
  };
}
