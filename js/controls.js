// Controls the player can change: which key does what, mouse speed, the vertical axis.
// Kept in this browser. Keys are stored as physical codes (KeyW is the Z key on a French
// keyboard) and shown with the letter printed on the player's own keyboard.
const ACTIONS = [
  { id: 'forward', label: 'Avancer', key: 'KeyW', group: 'move' },
  { id: 'back', label: 'Reculer', key: 'KeyS', group: 'move' },
  { id: 'left', label: 'Aller à gauche', key: 'KeyA', group: 'move' },
  { id: 'right', label: 'Aller à droite', key: 'KeyD', group: 'move' },
  { id: 'run', label: 'Courir (maintenir)', key: 'ShiftLeft', group: 'move' },
  { id: 'jump', label: 'Sauter', key: 'Space', group: 'move' },
  { id: 'crouch', label: 'S\'accroupir (maintenir)', key: 'KeyC', group: 'move' },
  { id: 'weapon1', label: 'Pistolet', key: 'Digit1', group: 'fps' },
  { id: 'weapon2', label: 'Fusil d\'assaut', key: 'Digit2', group: 'fps' },
  { id: 'weapon3', label: 'Mitraillette', key: 'Digit3', group: 'fps' },
  { id: 'weapon4', label: 'Sniper', key: 'Digit4', group: 'fps' },
  { id: 'weapon5', label: 'Arme lourde ramassée', key: 'Digit5', group: 'fps' },
  { id: 'reload', label: 'Recharger', key: 'KeyR', group: 'fps', letter: 'r' },
  { id: 'scores', label: 'Tableau des scores (maintenir)', key: 'Tab', group: 'fps' },
  { id: 'use', label: 'S\'asseoir, attraper ou lancer un coussin', key: 'KeyE', group: 'room', letter: 'e' },
  { id: 'paper', label: 'Lancer une boule de papier', key: 'KeyG', group: 'room' },
  { id: 'chat', label: 'Écrire un message', key: 'KeyT', group: 'social', letter: 't' },
  { id: 'mic', label: 'Micro', key: 'KeyM', group: 'social', letter: 'm' }
];
const GROUPS = { move: 'Se déplacer', fps: 'Bataille', room: 'Salon', social: 'Parler' };
const STORE = 'playroom-controls';

const saved = (() => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } })();
const binds = {};
for (const a of ACTIONS) binds[a.id] = typeof (saved.keys || {})[a.id] === 'string' ? saved.keys[a.id] : a.key;
let sens = Number.isFinite(saved.sens) ? Math.max(0.25, Math.min(3, saved.sens)) : 1;
let invertY = saved.invertY === true;
function save() {
  try { localStorage.setItem(STORE, JSON.stringify({ keys: binds, sens, invertY })); } catch (e) {}
}

// what's printed on the keys of this keyboard (Chrome tells us; others learn as keys are pressed)
const printed = new Map();
if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
  navigator.keyboard.getLayoutMap().then(m => {
    m.forEach((v, k) => printed.set(k, v));
    // letters that mean a word (T for "tchat", M for "micro") go to the key with that letter,
    // wherever it sits on this keyboard; movement keys keep their place
    for (const a of ACTIONS) {
      if (!a.letter || (saved.keys || {})[a.id]) continue;
      for (const [code, v] of m) if (v.toLowerCase() === a.letter && !ACTIONS.some(b => b !== a && binds[b.id] === code)) { binds[a.id] = code; break; }
    }
    changed();
  }).catch(() => {});
}
const NAMES = {
  Space: 'Espace', ShiftLeft: 'Maj', ShiftRight: 'Maj droite', ControlLeft: 'Ctrl', ControlRight: 'Ctrl droite',
  AltLeft: 'Alt', AltRight: 'Alt Gr', Enter: 'Entrée', Tab: 'Tab', Backspace: 'Retour', CapsLock: 'Verr. maj',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Escape: 'Échap'
};
export function keyName(code) {
  if (!code) return '—';
  if (NAMES[code]) return NAMES[code];
  if (/^Digit\d$/.test(code)) return code.slice(5); // the number, even where it needs Shift (French keyboards)
  if (printed.has(code)) return printed.get(code).toUpperCase();
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Numpad\d$/.test(code)) return 'Pavé ' + code.slice(6);
  return code;
}
export const key = id => binds[id];
export const label = id => keyName(binds[id]);
// the action a key does here (actions of the other mode don't count)
export function actionFor(code, fps) {
  for (const a of ACTIONS) if (binds[a.id] === code && (a.group !== 'fps' || fps) && (a.group !== 'room' || !fps)) return a.id;
  return null;
}
export const mouse = () => ({ sens, invertY });

const listeners = [];
export function onChange(fn) { listeners.push(fn); }
function changed() { for (const fn of listeners) fn(); }

/* ---------- the settings window ---------- */
export function openControls(dialog, fps) {
  const body = dialog.querySelector('.rules-body');
  let waiting = null; // the action waiting for its new key
  function render() {
    body.textContent = '';
    const intro = document.createElement('p'); intro.className = 'muted';
    intro.textContent = 'Clique sur une touche puis appuie sur la nouvelle. Échap annule. Le clic gauche tire et le clic droit vise, ils ne changent pas.';
    body.append(intro);
    for (const g of Object.keys(GROUPS)) {
      if ((g === 'fps' && !fps) || (g === 'room' && fps)) continue;
      const h = document.createElement('h3'); h.textContent = GROUPS[g]; body.append(h);
      for (const a of ACTIONS.filter(x => x.group === g)) {
        const row = document.createElement('div'); row.className = 'ctl-row';
        const name = document.createElement('span'); name.textContent = a.label;
        const b = document.createElement('button'); b.type = 'button'; b.className = 'ctl-key' + (waiting === a.id ? ' wait' : '');
        b.textContent = waiting === a.id ? 'Appuie sur une touche…' : keyName(binds[a.id]);
        b.setAttribute('aria-label', `${a.label} : ${waiting === a.id ? 'en attente d\'une touche' : keyName(binds[a.id])}`);
        b.addEventListener('click', () => { waiting = waiting === a.id ? null : a.id; render(); if (waiting) body.querySelector('.ctl-key.wait').focus(); });
        row.append(name, b); body.append(row);
      }
    }
    const h = document.createElement('h3'); h.textContent = 'Souris'; body.append(h);
    const sr = document.createElement('label'); sr.className = 'ctl-row';
    const sl = document.createElement('span'); sl.textContent = `Sensibilité : ${Math.round(sens * 100)} %`;
    const range = document.createElement('input'); range.type = 'range'; range.min = '25'; range.max = '300'; range.step = '5'; range.value = String(Math.round(sens * 100));
    range.addEventListener('input', () => { sens = +range.value / 100; sl.textContent = `Sensibilité : ${range.value} %`; save(); });
    sr.append(sl, range); body.append(sr);
    const ir = document.createElement('label'); ir.className = 'ctl-row';
    const il = document.createElement('span'); il.textContent = 'Inverser haut et bas';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = invertY;
    cb.addEventListener('change', () => { invertY = cb.checked; save(); });
    ir.append(il, cb); body.append(ir);
    const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'btn ghost ctl-reset'; reset.textContent = 'Remettre les réglages d\'origine';
    reset.addEventListener('click', () => { for (const a of ACTIONS) binds[a.id] = a.key; sens = 1; invertY = false; waiting = null; save(); changed(); render(); });
    body.append(reset);
  }
  // the next key pressed goes to the waiting action; a key already in use swaps places
  function onKey(e) {
    if (!waiting) return;
    e.preventDefault(); e.stopPropagation();
    if (e.code !== 'Escape') {
      if (e.key && e.key.length === 1) printed.set(e.code, e.key);
      const other = ACTIONS.find(a => a.id !== waiting && binds[a.id] === e.code);
      if (other) binds[other.id] = binds[waiting];
      binds[waiting] = e.code;
      save(); changed();
    }
    waiting = null; render();
  }
  dialog.addEventListener('keydown', onKey, true);
  const onCancel = e => { if (waiting) e.preventDefault(); }; // Échap stops waiting, not the window
  dialog.addEventListener('cancel', onCancel);
  dialog.addEventListener('close', () => { dialog.removeEventListener('keydown', onKey, true); dialog.removeEventListener('cancel', onCancel); }, { once: true });
  render();
  dialog.showModal();
}
