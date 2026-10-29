// The roulette table: European wheel (one zero), a dealer who spins it, up to five players
// with fictional chips. Pure rules on a plain state, run by one player's browser (the host)
// like the blackjack table: `act` applies a bet, `timer`/`tick` the paced steps (bets close,
// the ball lands, the next round). The host draws the number when bets close; everyone
// then sees the same spin.

export const RT_SEATS = 5, START = 1000, CHIPS = [10, 50, 100], MAX_TOTAL = 1000;
export const BET_WAIT = 20000, SPIN_MS = 6500, SHOW_MS = 6000; // ms
// the pockets in wheel order
export const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const colorOf = n => n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black';
// what each bet pays for one chip: a straight number 35, a dozen 2, the even chances 1
export const PAYS = { n: 35, doz: 2, red: 1, black: 1, even: 1, odd: 1, low: 1, high: 1 };
export function wins(b, n) {
  switch (b.t) {
    case 'n': return b.v === n;
    case 'doz': return n > 0 && Math.ceil(n / 12) === b.v;
    case 'red': return colorOf(n) === 'red';
    case 'black': return colorOf(n) === 'black';
    case 'even': return n > 0 && n % 2 === 0;
    case 'odd': return n % 2 === 1;
    case 'low': return n >= 1 && n <= 18;
    case 'high': return n >= 19;
  }
  return false;
}
const nulls = () => Array.from({ length: RT_SEATS }, () => null);
export const staked = (S, i) => S.bets[i].reduce((a, b) => a + b.n, 0);

export function newTable(host) {
  const S = { g: 0, e: Date.now(), v: 0, host, bank: {}, seats: nulls(), hist: [], spins: 0 };
  clearRound(S);
  return S;
}
function clearRound(S) {
  S.phase = 'bet'; S.bets = nulls().map(() => []); S.who = nulls(); S.ready = nulls().map(() => false);
  S.res = null; S.net = null; S.at = 0;
}
function refund(S) {
  S.who.forEach((k, i) => { if (k) S.bank[k] = (S.bank[k] || 0) + staked(S, i); });
}
// a new host takes over (the last one left): bets not yet paid go back
export function takeOver(S, host) {
  if (S.phase !== 'done') refund(S);
  S.g = (S.g | 0) + 1; S.e = Date.now(); S.v = 0; S.host = host;
  clearRound(S);
}
// who sits at the table now; a player who stands up while bets are open gets them back
export function sync(S, seats) {
  let changed = false;
  for (let i = 0; i < RT_SEATS; i++) {
    const a = S.seats[i], b = seats[i] || null;
    if ((a && a.k) !== (b && b.k) || (a && b && (a.nick !== b.nick || a.col !== b.col))) {
      S.seats[i] = b; changed = true;
      if (S.phase === 'bet' && S.who[i] && S.who[i] !== (b && b.k)) { S.bank[S.who[i]] += staked(S, i); S.bets[i] = []; S.who[i] = null; S.ready[i] = false; }
    }
    if (b && !(b.k in S.bank)) { S.bank[b.k] = START; changed = true; }
  }
  if (S.phase === 'bet' && !S.who.some(Boolean)) S.at = 0;
  return changed;
}
export function act(S, i, k, a) {
  if (!a || !Number.isInteger(i) || i < 0 || i >= RT_SEATS || S.phase !== 'bet' || !S.seats[i] || S.seats[i].k !== k) return false;
  if (a.t === 'bet') {
    const t = a.b, n = Math.floor(+a.n), bank = S.bank[k] || 0;
    if (!(t in PAYS) || !CHIPS.includes(n) || bank < n || staked(S, i) + n > MAX_TOTAL) return false;
    let v = null;
    if (t === 'n') { v = Math.floor(+a.v); if (!(v >= 0 && v <= 36)) return false; }
    if (t === 'doz') { v = Math.floor(+a.v); if (!(v >= 1 && v <= 3)) return false; }
    S.bank[k] = bank - n;
    const same = S.bets[i].find(b => b.t === t && b.v === v);
    if (same) same.n += n; else S.bets[i].push({ t, v, n });
    S.who[i] = k; S.ready[i] = false;
    if (!S.at) S.at = Date.now(); // the first bet starts the countdown
    return true;
  }
  if (a.t === 'clear') {
    if (S.who[i] !== k) return false;
    S.bank[k] += staked(S, i); S.bets[i] = []; S.who[i] = null; S.ready[i] = false;
    if (!S.who.some(Boolean)) S.at = 0;
    return true;
  }
  if (a.t === 'ready') {
    if (S.who[i] !== k || S.ready[i]) return false;
    S.ready[i] = true;
    return true;
  }
  return false;
}
export function timer(S, now) {
  if (S.phase === 'bet') {
    if (!S.who.some(Boolean)) return 0;
    if (S.seats.every((s, i) => !s || (S.who[i] && S.ready[i]))) return 400; // everyone seated has bet and is ready
    return Math.max(1, S.at + BET_WAIT - now);
  }
  if (S.phase === 'spin') return Math.max(1, S.at + SPIN_MS - now);
  if (S.phase === 'done') return Math.max(1, S.at + SHOW_MS - now);
  return 0;
}
export function tick(S) {
  if (S.phase === 'bet') { // « Rien ne va plus » : the host draws the number
    if (!S.who.some(Boolean)) return false;
    S.res = Math.floor(Math.random() * 37); S.phase = 'spin'; S.at = Date.now(); S.spins++;
    return true;
  }
  if (S.phase === 'spin') {
    const n = S.res;
    S.net = S.bets.map((bs, i) => {
      if (!S.who[i]) return null;
      let net = 0;
      for (const b of bs) { if (wins(b, n)) { S.bank[S.who[i]] += b.n * (PAYS[b.t] + 1); net += b.n * PAYS[b.t]; } else net -= b.n; }
      return net;
    });
    S.hist = [n, ...S.hist].slice(0, 12);
    S.phase = 'done'; S.at = Date.now();
    return true;
  }
  if (S.phase === 'done') {
    clearRound(S);
    S.gift = [];
    for (const s of S.seats) if (s && (S.bank[s.k] || 0) < CHIPS[0]) { S.bank[s.k] = START; S.gift.push(s.k); } // broke: the house lends a new pile
    return true;
  }
  return false;
}
export const view = S => JSON.parse(JSON.stringify(S));
// newer table first: a takeover (g), then the table opened first (e), then the latest move (v)
export function newer(d, R) {
  if (!R) return true;
  if (d.g !== R.g) return d.g > R.g;
  if (d.e !== R.e) return d.e < R.e;
  return d.v > R.v;
}
