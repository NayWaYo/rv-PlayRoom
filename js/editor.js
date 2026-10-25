// Character editor: a live 3D preview you can spin, and tabs of options.
import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { buildAvatar, animateAvatar, react, disposeAvatar, cleanLook, randomLook, OPTIONS, CLOTH, SKIN, HAIR, EXPRESSIONS } from './avatar.js';

const TABS = [
  { label: 'Tête', rows: [['Peau', 's', SKIN], ['Coiffure', 'h', OPTIONS.h], ['Couleur des cheveux', 'hc', HAIR]] },
  { label: 'Visage', rows: [['Yeux', 'e', OPTIONS.e], ['Bouche', 'm', OPTIONS.m], ['Sourcils', 'br', OPTIONS.br], ['Détails', 'x', OPTIONS.x], ['Essayer une expression', 'try', EXPRESSIONS]] },
  { label: 'Tenue', rows: [['Haut', 't', OPTIONS.t], ['Couleur du haut', 'tc', CLOTH], ['Bas', 'b', OPTIONS.b], ['Couleur du bas', 'bc', CLOTH], ['Chaussures', 'sh', CLOTH]] },
  { label: 'Accessoires', rows: [['Chapeau', 'hat', OPTIONS.hat], ['Couleur du chapeau', 'hac', CLOTH], ['Accessoire', 'acc', OPTIONS.acc], ['Couleur de l\'accessoire', 'ac', CLOTH]] }
];

export function createEditor({ root, canvas, onChange, onClose }) {
  const tabsEl = root.querySelector('.ed-tabs'), optsEl = root.querySelector('.ed-opts');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const outlines = new OutlineEffect(renderer, { defaultThickness: 0.006, defaultColor: [0.015, 0.008, 0.025] });
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffe8d6, 0x3b2a52, 1.6));
  const key = new THREE.DirectionalLight(0xffe0b8, 2.6); key.position.set(-1.5, 3, -3); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fb4ff, 1.2); rim.position.set(2, 2, 2); scene.add(rim);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.55, 40), new THREE.MeshBasicMaterial({ color: '#3b2c4a' }));
  disc.rotation.x = -Math.PI / 2; disc.userData.outlineParameters = { visible: false }; scene.add(disc);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0, 1.05, -4.1); camera.lookAt(0, 0.82, 0);

  let look = null, avatar = null, tab = 0, spin = 0, drag = null, running = false, last = 0;
  function rebuild() {
    if (avatar) { scene.remove(avatar.g); disposeAvatar(avatar); }
    avatar = buildAvatar(look);
    scene.add(avatar.g);
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
  }
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!drag) spin += dt * 0.35;
    avatar.g.rotation.y = Math.sin(spin) * 0.6;
    animateAvatar(avatar, dt, now / 1000, false);
    outlines.render(scene, camera);
    requestAnimationFrame(frame);
  }
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (drag) { spin += (e.clientX - drag.x) * 0.01; drag.x = e.clientX; } });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('pointercancel', () => { drag = null; });
  addEventListener('resize', () => { if (running) resize(); });

  function set(k, v) {
    look = cleanLook(Object.assign({}, look, { [k]: v }));
    rebuild(); render(); onChange(look);
  }
  function render() {
    tabsEl.textContent = '';
    TABS.forEach((t, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = t.label; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(i === tab));
      b.onclick = () => { tab = i; render(); };
      tabsEl.append(b);
    });
    optsEl.textContent = '';
    for (const [label, k, list] of TABS[tab].rows) {
      const row = document.createElement('div'); row.className = 'ed-row';
      const h = document.createElement('span'); h.className = 'ed-label'; h.textContent = label; row.append(h);
      const wrap = document.createElement('div'); wrap.className = typeof list[0] === 'string' && list[0][0] === '#' ? 'ed-swatches' : 'ed-chips';
      list.forEach((item, i) => {
        const b = document.createElement('button'); b.type = 'button';
        if (k === 'try') {
          b.className = 'ed-chip'; b.textContent = item.icon + ' ' + item.label;
          b.onclick = () => react(avatar, item.id, 2.5);
        } else if (typeof item === 'string' && item[0] === '#') {
          b.className = 'sw'; b.style.background = item; b.setAttribute('aria-label', label + ' ' + (i + 1));
          b.setAttribute('aria-pressed', String(look[k] === i)); b.onclick = () => set(k, i);
        } else {
          b.className = 'ed-chip'; b.textContent = item;
          b.setAttribute('aria-pressed', String(look[k] === i)); b.onclick = () => set(k, i);
        }
        wrap.append(b);
      });
      row.append(wrap); optsEl.append(row);
    }
  }
  root.querySelector('#edRandom').onclick = () => { look = cleanLook(randomLook()); rebuild(); render(); onChange(look); react(avatar, 'happy', 1.5); };
  root.querySelector('#edDone').onclick = () => close();
  root.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  function open(l) {
    look = cleanLook(l);
    root.hidden = false;
    rebuild(); render(); resize();
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    root.querySelector('#edDone').focus();
  }
  function close() {
    if (root.hidden) return;
    root.hidden = true; running = false;
    onClose(look);
  }
  return { open, close, isOpen: () => !root.hidden };
}
