// The blackjack table: a robot dealer against up to five players, with fictional chips.
// Pure rules on a plain state, run by one player's browser (the host) like the main table:
// `act` applies a move, `timer`/`tick` the paced steps (the deal, the dealer's cards, the next
// round). Everything is public except the shoe and the dealer's hidden card (`view`).
// Cards as in js/cards.js: S2..S14, the ace is 14.

export const BJ_SEATS = 5, START = 1000, MIN = 10, MAX = 500;
export const BET_WAIT = 10000, TURN_WAIT = 30000; // ms: betting time once someone has bet, time to play a hand
const rk = c => +c.slice(1);
const nulls = () => Array.from({ length: BJ_SEATS }, () => null);
const zeros = () => Array.from({ length: BJ_SEATS }, () => 0);
function shoe() { // two decks
  const d = [];
  for (let n = 0; n < 2; n++) for (const s of 'SHCD') for (let r = 2; r <= 14; r++) d.push(s + r);
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
// the best total (an ace counts 11 unless that busts), and whether an ace still counts 11
export function score(cs) {
  let t = 0, aces = 0;
  for (const c of cs) { if (c === '?') continue; const r = rk(c); t += r === 14 ? 11 : r >= 10 ? 10 : r; if (r === 14) aces++; }
  while (t > 21 && aces) { t -= 10; aces--; }
  return { t, soft: aces > 0 };
}
export const isBJ = cs => cs.length === 2 && score(cs).t === 21;

export function newTable(host) {
  const S = { g: 0, e: Date.now(), v: 0, host, bank: {}, seats: nulls(), shoe: shoe(), round: 0 };
  clearRound(S);
  return S;
}
function clearRound(S) {
  S.phase = 'bet'; S.who = nulls(); S.bets = zeros(); S.hands = nulls().map(() => []); S.dbl = zeros();
  S.dealer = []; S.hole = true; S.turn = -1; S.res = null; S.at = 0;
}
const draw = S => { if (!S.shoe.length) S.shoe = shoe(); return S.shoe.pop(); };
// a new host takes over (the last one left): the round in progress is called off, bets go back
export function takeOver(S, host) {
  if (!S.res) S.who.forEach((k, i) => { if (k && S.bets[i]) S.bank[k] = (S.bank[k] || 0) + S.bets[i]; });
  S.g = (S.g | 0) + 1; S.e = Date.now(); S.v = 0; S.host = host; S.shoe = shoe();
  clearRound(S);
}
// who sits on the stools now: [{ k, nick, col } or null] × 5. A player who stands up before
// the deal gets their bet back. Returns whether anything changed.
export function sync(S, seats) {
  let changed = false;
  for (let i = 0; i < BJ_SEATS; i++) {
    const a = S.seats[i], b = seats[i] || null;
    if ((a && a.k) !== (b && b.k) || (a && b && (a.nick !== b.nick || a.col !== b.col))) {
      S.seats[i] = b; changed = true;
      if (S.phase === 'bet' && S.bets[i] && S.who[i] !== (b && b.k)) { S.bank[S.who[i]] += S.bets[i]; S.bets[i] = 0; S.who[i] = null; }
    }
    if (b && !(b.k in S.bank)) { S.bank[b.k] = START; changed = true; }
  }
  if (S.phase === 'bet' && !S.bets.some(Boolean)) S.at = 0;
  return changed;
}
const live = (S, i) => S.bets[i] > 0 && S.hands[i].length > 0;
function advance(S) {
  for (let i = S.turn + 1; i < BJ_SEATS; i++) {
    if (live(S, i) && score(S.hands[i]).t < 21) { S.turn = i; S.at = Date.now(); return; }
  }
  S.turn = -1; S.phase = 'dealer'; S.at = Date.now();
}
export function act(S, i, k, a) {
  if (!a || !Number.isInteger(i) || i < 0 || i >= BJ_SEATS) return false;
  if (a.t === 'bet') {
    const n = Math.floor(+a.n), bank = S.bank[k] || 0;
    if (S.phase !== 'bet' || !S.seats[i] || S.seats[i].k !== k || S.bets[i] || !(n >= MIN && n <= Math.min(MAX, bank))) return false;
    S.bank[k] = bank - n; S.bets[i] = n; S.who[i] = k;
    if (!S.at) S.at = Date.now(); // the first bet starts the countdown to the deal
    return true;
  }
  if (S.phase !== 'play' || S.turn !== i || S.who[i] !== k) return false;
  const h = S.hands[i];
  if (a.t === 'hit') { h.push(draw(S)); if (score(h).t >= 21) advance(S); else S.at = Date.now(); return true; }
  if (a.t === 'stand') { advance(S); return true; }
  if (a.t === 'double') {
    if (h.length !== 2 || S.dbl[i] || (S.bank[k] || 0) < S.bets[i]) return false;
    S.bank[k] -= S.bets[i]; S.bets[i] *= 2; S.dbl[i] = 1;
    h.push(draw(S)); advance(S);
    return true;
  }
  return false;
}
function deal(S) {
  const in_ = S.bets.map((b, i) => b > 0 ? i : -1).filter(i => i >= 0);
  for (let n = 0; n < 2; n++) { for (const i of in_) S.hands[i].push(draw(S)); S.dealer.push(draw(S)); }
  S.round++;
  const up = rk(S.dealer[0]);
  if ((up === 14 || up >= 10) && isBJ(S.dealer)) { S.hole = false; settle(S); return; } // the dealer peeks: blackjack, over at once
  S.phase = 'play'; S.turn = -1;
  advance(S);
}
function settle(S) {
  const d = score(S.dealer).t, dBJ = isBJ(S.dealer);
  S.res = S.bets.map((b, i) => {
    if (!b) return null;
    const h = S.hands[i], p = score(h).t, pBJ = isBJ(h) && !S.dbl[i], k = S.who[i];
    let net, label;
    if (p > 21) { net = -b; label = 'Sauté'; }
    else if (pBJ && !dBJ) { net = Math.floor(b * 1.5); label = 'Blackjack !'; }
    else if (dBJ && !pBJ) { net = -b; label = 'Perdu'; }
    else if (d > 21 || p > d) { net = b; label = 'Gagné'; }
    else if (p === d) { net = 0; label = 'Égalité'; }
    else { net = -b; label = 'Perdu'; }
    S.bank[k] = (S.bank[k] || 0) + b + net;
    return { net, label };
  });
  S.phase = 'done'; S.turn = -1; S.at = Date.now();
}
// how long until the next paced step, in ms (0: nothing to wait for)
export function timer(S, now) {
  if (S.phase === 'bet') {
    if (!S.bets.some(Boolean)) return 0;
    const all = S.seats.every((s, i) => !s || S.bets[i] || (S.bank[s.k] || 0) < MIN);
    return all ? 700 : Math.max(1, S.at + BET_WAIT - now);
  }
  if (S.phase === 'play') return Math.max(1, S.at + TURN_WAIT - now);
  if (S.phase === 'dealer') return S.hole ? 700 : 900;
  if (S.phase === 'done') return Math.max(1, S.at + 6000 - now);
  return 0;
}
export function tick(S) {
  if (S.phase === 'bet') { if (!S.bets.some(Boolean)) return false; deal(S); return true; }
  if (S.phase === 'play') { advance(S); return true; } // too slow: stands
  if (S.phase === 'dealer') {
    if (S.hole) { S.hole = false; return true; }
    const anyone = S.bets.some((b, i) => b && score(S.hands[i]).t <= 21 && !(isBJ(S.hands[i]) && !S.dbl[i]));
    if (anyone && score(S.dealer).t < 17) { S.dealer.push(draw(S)); return true; } // the dealer draws to 17
    settle(S); return true;
  }
  if (S.phase === 'done') {
    clearRound(S);
    if (S.shoe.length < 40) S.shoe = shoe();
    S.gift = [];
    for (const s of S.seats) if (s && (S.bank[s.k] || 0) < MIN) { S.bank[s.k] = START; S.gift.push(s.k); } // broke: the house lends a new pile
    return true;
  }
  return false;
}
// the public copy: no shoe, the dealer's second card face down until it turns
export function view(S) {
  const v = JSON.parse(JSON.stringify(S));
  delete v.shoe;
  if (S.hole && v.dealer.length > 1) v.dealer[1] = '?';
  return v;
}
// newer table first: a takeover (g), then the table started first (e), then the latest move (v)
export function newer(d, B) {
  if (!B) return true;
  if (d.g !== B.g) return d.g > B.g;
  if (d.e !== B.e) return d.e < B.e;
  return d.v > B.v;
}
