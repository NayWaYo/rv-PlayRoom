// Private messages over a public room: every browser makes an ECDH key pair and
// shows its public half in presence. The host seals each player's hand with the
// key it shares with that player (AES-GCM), so a hand travels in the broadcast
// state but only its owner can open it.
let pair = null, pub = null;
const shared = new Map();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export async function initKeys() {
  if (!globalThis.crypto || !crypto.subtle) return null;
  pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']);
  const j = await crypto.subtle.exportKey('jwk', pair.publicKey);
  pub = j.x + '.' + j.y;
  return pub;
}
export const myPublicKey = () => pub;

function sharedKey(pk) {
  if (!shared.has(pk)) {
    const [x, y] = String(pk).split('.');
    shared.set(pk, crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x, y, ext: true }, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
      .then(k => crypto.subtle.deriveKey({ name: 'ECDH', public: k }, pair.privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])));
  }
  return shared.get(pk);
}
// -> [iv, ciphertext] in base64, readable only with the other side's private key
export async function seal(pk, obj) {
  if (!pair || typeof pk !== 'string') return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await sharedKey(pk), new TextEncoder().encode(JSON.stringify(obj)));
  return [b64(iv), b64(ct)];
}
export async function open(pk, box) {
  if (!pair || typeof pk !== 'string' || !Array.isArray(box) || typeof box[0] !== 'string' || typeof box[1] !== 'string') return null;
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box[0]) }, await sharedKey(pk), unb64(box[1]));
    return JSON.parse(new TextDecoder().decode(pt));
  } catch (e) { return null; }
}
