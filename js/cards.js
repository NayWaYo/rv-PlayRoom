// The Salon Chill's other card games: five-card draw poker, Texas Hold'em and the Président.
// Pure rules on a plain state object, run by the host like PY (the Payoo, in index.html):
// `act` applies a move, `timer`/`tick` the paced steps (end of a betting round, of a trick),
// `waiting` says who must move now, `bot` picks a move for a robot or an absent player.
// Every state has `hands`, `passSel` and `recv`: the host hides them (and `deck`) from the
// public view and seals each player's own for them, as for the Payoo.
// Cards: a suit letter and a rank, S2..S14 (11 valet, 12 dame, 13 roi, 14 as).

export const su = c => c[0];
export const rk = c => +c.slice(1);
const SUITS = 'SHCD';
const FULL = [];
for (const s of SUITS) for (let r = 2; r <= 14; r++) FULL.push(s + r);
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const deck52 = () => shuffle(FULL.slice());
const epoch = () => Date.now().toString(36).padStart(10, '0') + Math.random().toString(36).slice(2, 6);
const zeros = n => Array.from({ length: n }, () => 0);
const nulls = n => Array.from({ length: n }, () => null);
const owns = (hand, cs) => Array.isArray(cs) && new Set(cs).size === cs.length && cs.every(c => typeof c === 'string' && hand.includes(c));

/* ---------------- poker hands ---------------- */
// a 5-card hand as one number: category, then the ranks that break ties, in base 16
function eval5(cs) {
  const r = cs.map(rk).sort((a, b) => b - a);
  const flush = cs.length === 5 && cs.every(c => c[0] === cs[0][0]);
  const cnt = {};
  for (const x of r) cnt[x] = (cnt[x] || 0) + 1;
  const g = Object.keys(cnt).map(Number).sort((a, b) => cnt[b] - cnt[a] || b - a);
  let straight = 0;
  if (g.length === 5) { if (r[0] - r[4] === 4) straight = r[0]; else if (r[0] === 14 && r[1] === 5) straight = 5; }
  const c0 = cnt[g[0]], c1 = cnt[g[1]] || 0; // fewer than 5 cards (a hand before the flop) still names its pair
  const cat = straight && flush ? 8 : c0 === 4 ? 7 : c0 === 3 && c1 >= 2 ? 6 : flush ? 5 : straight ? 4
    : c0 === 3 ? 3 : c0 === 2 && c1 === 2 ? 2 : c0 === 2 ? 1 : 0;
  const tb = straight ? [straight] : g;
  let s = cat;
  for (let k = 0; k < 5; k++) s = s * 16 + (tb[k] || 0);
  return s;
}
// the best 5 of 5 to 7 cards
export function bestOf(cs) {
  const n = cs.length;
  if (n <= 5) return eval5(cs);
  let best = -1;
  if (n === 6) for (let a = 0; a < 6; a++) { const s = eval5(cs.filter((_, k) => k !== a)); if (s > best) best = s; }
  else for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) { const s = eval5(cs.filter((_, k) => k !== a && k !== b)); if (s > best) best = s; }
  return best;
}
const RN = { 11: 'Valet', 12: 'Dame', 13: 'Roi', 14: 'As' };
const one = x => RN[x] || String(x);
const many = x => ({ 11: 'Valets', 12: 'Dames', 13: 'Rois', 14: 'As' })[x] || String(x);
const deMany = x => x === 14 ? 'd\'As' : 'de ' + many(x);
export const CATS = ['Hauteur', 'Paire', 'Double paire', 'Brelan', 'Quinte', 'Couleur', 'Full', 'Carré', 'Quinte flush'];
export function handName(s) {
  const t = [];
  for (let k = 0; k < 5; k++) { t.unshift(s % 16); s = Math.floor(s / 16); }
  const cat = s;
  switch (cat) {
    case 0: return 'Hauteur ' + one(t[0]);
    case 1: return 'Paire ' + deMany(t[0]);
    case 2: return `Double paire, ${many(t[0])} et ${many(t[1])}`;
    case 3: return 'Brelan ' + deMany(t[0]);
    case 4: return 'Quinte, hauteur ' + one(t[0]);
    case 5: return 'Couleur, hauteur ' + one(t[0]);
    case 6: return `Full aux ${many(t[0])} par les ${many(t[1])}`;
    case 7: return 'Carré ' + deMany(t[0]);
    default: return t[0] === 14 ? 'Quinte flush royale' : 'Quinte flush, hauteur ' + one(t[0]);
  }
}
// chance to win against `opp` unknown hands, by dealing the unknown cards at random many times
function equity(hand, board, opp, holeN, boardN, iters) {
  const known = new Set([...hand, ...board]);
  const rest = FULL.filter(c => !known.has(c));
  const need = opp * holeN + (boardN - board.length);
  let won = 0;
  for (let it = 0; it < iters; it++) {
    for (let k = 0; k < need; k++) { const j = k + Math.floor(Math.random() * (rest.length - k)); [rest[k], rest[j]] = [rest[j], rest[k]]; }
    const b = board.concat(rest.slice(opp * holeN, need));
    const mine = bestOf(hand.concat(b));
    let top = 0, ties = 0;
    for (let o = 0; o < opp; o++) {
      const s = bestOf(rest.slice(o * holeN, o * holeN + holeN).concat(b));
      if (s > top) { top = s; ties = 0; }
      if (s === top) ties++;
    }
    if (mine > top) won++;
    else if (mine === top) won += 1 / (ties + 1);
  }
  return won / iters;
}

/* ---------------- poker: five-card draw and Texas Hold'em ---------------- */
// fictional chips only. `total` is each player's stack; `bet` what they put in this betting
// round, `put` in the whole hand (for side pots); `cur` the bet to match, `minR` the smallest raise
export const START = 1000;
const PCFG = {
  poker: { ante: 10, sb: 0, bb: 20, cards: 5, maxDraw: 3 },
  holdem: { ante: 0, sb: 10, bb: 20, cards: 2 }
};
function pokerRules(kind) {
  const C = PCFG[kind], HOLD = kind === 'holdem';
  const N = S => S.players.length;
  const canAct = (S, i) => !S.fold[i] && S.total[i] > 0;
  const live = S => S.players.map((_, i) => i).filter(i => !S.fold[i]);
  const pot = S => S.put.reduce((a, b) => a + b, 0);
  const sortHand = h => h.sort((a, b) => rk(a) - rk(b) || SUITS.indexOf(su(a)) - SUITS.indexOf(su(b)));
  const nextWith = (S, from, ok) => { for (let k = 1; k <= N(S); k++) { const j = (from + k + N(S)) % N(S); if (ok(j)) return j; } return -1; };
  function post(S, i, amt) {
    const a = Math.max(0, Math.min(amt, S.total[i]));
    S.total[i] -= a; S.bet[i] += a; S.put[i] += a;
  }
  // who bets next after `from`, or -1 when this betting round is over
  function nextActor(S, from) {
    const able = S.players.filter((_, i) => canAct(S, i)).length;
    return nextWith(S, from, j => canAct(S, j) && !(S.acted[j] && S.bet[j] >= S.cur) && !(able === 1 && S.bet[j] >= S.cur));
  }
  function openRound(S, from) {
    S.bet = zeros(N(S)); S.cur = 0; S.minR = C.bb; S.raises = 0; S.last = null;
    S.acted = S.players.map(() => false);
    S.turn = nextActor(S, from);
    S.done = S.turn < 0 ? { street: true } : null;
  }
  function newGame(players, rounds, host) {
    const S = { game: kind, epoch: epoch(), v: 0, host, players, rounds, round: 1, total: players.map(() => START), hist: [], dealer: -1 };
    startHand(S);
    return S;
  }
  function startHand(S) {
    const n = N(S);
    S.out = S.players.map((_, i) => S.total[i] <= 0); // no chips left: sits out
    S.fold = S.out.slice();
    S.dealer = nextWith(S, S.dealer, j => !S.out[j]);
    const d = deck52();
    S.hands = S.players.map((_, i) => S.out[i] ? [] : sortHand(d.splice(0, C.cards)));
    S.deck = d;
    S.board = []; S.shown = nulls(n); S.res = null; S.street = 0; S.last = null;
    S.passSel = nulls(n); S.recv = nulls(n); S.drew = nulls(n);
    S.put = zeros(n);
    if (C.ante) S.players.forEach((_, i) => { if (!S.out[i]) { const a = Math.min(C.ante, S.total[i]); S.total[i] -= a; S.put[i] += a; } });
    openRound(S, S.dealer);
    if (C.sb) {
      const inHand = S.players.map((_, i) => i).filter(i => !S.out[i]);
      const sb = inHand.length === 2 ? S.dealer : nextWith(S, S.dealer, j => !S.out[j]); // heads-up: the dealer posts the small blind
      const bb = nextWith(S, sb, j => !S.out[j]);
      post(S, sb, C.sb); post(S, bb, C.bb);
      S.blinds = [sb, bb];
      S.cur = Math.max(...S.bet);
      S.turn = nextActor(S, bb);
      S.done = S.turn < 0 ? { street: true } : null;
    }
    S.phase = 'play';
  }
  function act(S, i, a) {
    if (a.t === 'next') return next(S);
    if (a.t === 'pass') return setDraw(S, i, a.c);
    if (a.t !== 'bet' || S.phase !== 'play' || S.done || S.turn !== i) return false;
    const toCall = S.cur - S.bet[i];
    let what;
    if (a.a === 'fold') { S.fold[i] = true; S.hands[i] = []; what = 'fold'; }
    else if (a.a === 'call') { post(S, i, toCall); what = toCall > 0 ? 'call' : 'check'; }
    else if (a.a === 'raise') {
      const max = S.bet[i] + S.total[i];
      let to = Math.floor(+a.n);
      if (!Number.isFinite(to)) return false;
      to = Math.min(to, max);
      if (to <= S.cur || (to < S.cur + S.minR && to < max)) return false;
      what = S.cur ? 'raise' : 'bet';
      if (to - S.cur >= S.minR) { S.minR = to - S.cur; S.acted = S.acted.map(() => false); } // a full raise: everyone speaks again
      post(S, i, to - S.bet[i]);
      S.cur = to; S.raises++;
    } else return false;
    if (S.total[i] === 0 && what !== 'fold' && what !== 'check') what = 'allin';
    S.acted[i] = true;
    S.last = { i, a: what, n: S.bet[i] };
    if (live(S).length === 1) { S.turn = -1; S.done = { fold: true }; return true; }
    S.turn = nextActor(S, i);
    if (S.turn < 0) S.done = { street: true };
    return true;
  }
  // five-card draw: everyone still in picks up to three cards to change, at the same time
  function setDraw(S, i, cs) {
    if (HOLD || S.phase !== 'draw' || S.passSel[i] || !owns(S.hands[i], cs) || cs.length > C.maxDraw) return false;
    S.passSel[i] = cs.slice();
    if (S.passSel.every(Boolean)) {
      S.players.forEach((_, j) => {
        const out = S.passSel[j];
        if (S.fold[j]) return;
        const fresh = S.deck.splice(0, out.length);
        S.hands[j] = sortHand(S.hands[j].filter(c => !out.includes(c)).concat(fresh));
        S.recv[j] = fresh; S.drew[j] = out.length;
      });
      S.phase = 'play'; S.street = 1;
      openRound(S, S.dealer);
    }
    return true;
  }
  function timer(S) {
    if (S.phase === 'play' && S.done) return S.done.fold ? 900 : 1200;
    if (S.phase === 'roundEnd') return 7000;
    return 0;
  }
  function tick(S) {
    if (S.phase === 'roundEnd') return next(S);
    if (S.phase !== 'play' || !S.done) return false;
    if (S.done.fold) return award(S);
    const last = HOLD ? S.street === 3 : S.street === 1;
    if (last) return award(S);
    if (HOLD) {
      S.street++;
      S.board.push(...S.deck.splice(0, S.street === 1 ? 3 : 1));
      openRound(S, S.dealer);
    } else {
      S.phase = 'draw';
      S.passSel = S.players.map((_, j) => S.fold[j] ? [] : null);
      S.turn = -1; S.done = null;
    }
    return true;
  }
  // the pots go to the best hands, side pot by side pot when someone was all-in for less
  function award(S) {
    const n = N(S), L = live(S), won = zeros(n), score = {};
    if (L.length === 1) won[L[0]] = pot(S);
    else {
      for (const i of L) { score[i] = bestOf(S.hands[i].concat(S.board)); S.shown[i] = S.hands[i].slice(); }
      const levels = [...new Set(L.map(i => S.put[i]))].sort((a, b) => a - b);
      let prev = 0;
      levels.forEach((lv, k) => {
        let amount = S.put.reduce((a, p) => a + Math.max(0, Math.min(p, lv) - prev), 0);
        if (k === levels.length - 1) amount += S.put.reduce((a, p) => a + Math.max(0, p - lv), 0); // folded money above every live stake
        const elig = L.filter(i => S.put[i] >= lv);
        const top = Math.max(...elig.map(i => score[i]));
        const ws = elig.filter(i => score[i] === top);
        const share = Math.floor(amount / ws.length);
        ws.forEach(i => { won[i] += share; });
        won[nextWith(S, S.dealer, j => ws.includes(j))] += amount - share * ws.length; // odd chips: first winner after the dealer
        prev = lv;
      });
    }
    won.forEach((w, i) => { S.total[i] += w; });
    S.res = { won, fold: L.length === 1, names: S.players.map((_, i) => score[i] != null ? handName(score[i]) : null), best: Math.max(...won) };
    S.hist.push(won.map((w, i) => w - S.put[i]));
    S.bet = zeros(n); S.cur = 0; S.turn = -1; S.done = null;
    const left = S.total.filter(t => t > 0).length;
    S.phase = S.round >= S.rounds || left <= 1 ? 'gameEnd' : 'roundEnd';
    return true;
  }
  function next(S) {
    if (S.phase !== 'roundEnd') return false;
    S.round++;
    startHand(S);
    return true;
  }
  function waiting(S) {
    if (S.phase === 'draw') return S.players.map((_, i) => i).filter(i => !S.passSel[i]);
    if (S.phase === 'play' && !S.done && S.turn >= 0) return [S.turn];
    return [];
  }
  // what to change at the draw: keep made hands, draw to four of a flush or a straight, else keep pairs or the two best cards
  function botDiscard(h) {
    const s = eval5(h), cat = Math.floor(s / 16 ** 5);
    const byRank = {};
    h.forEach(c => { (byRank[rk(c)] = byRank[rk(c)] || []).push(c); });
    if (cat >= 4 && cat !== 7) return [];
    if (cat === 7 || cat === 3 || cat === 2 || cat === 1) return h.filter(c => byRank[rk(c)].length === 1).slice(0, 3);
    for (const st of SUITS) { const f = h.filter(c => su(c) === st); if (f.length === 4) return h.filter(c => su(c) !== st); }
    const rs = h.map(rk).sort((a, b) => a - b);
    for (const drop of [0, 4]) {
      const keep = rs.filter((_, k) => k !== drop);
      if (new Set(keep).size === 4 && keep[3] - keep[0] === 3) return [h.find(c => rk(c) === rs[drop])];
    }
    return h.slice().sort((a, b) => rk(a) - rk(b)).slice(0, 3);
  }
  function botBet(S, i) {
    const opp = live(S).length - 1;
    const eq = equity(S.hands[i], S.board, Math.min(4, opp), HOLD ? 2 : 5, HOLD ? 5 : 0, 160);
    const toCall = S.cur - S.bet[i], p = pot(S), max = S.bet[i] + S.total[i];
    const odds = toCall / (p + toCall);
    const strong = Math.min(0.8, Math.max(0.38, 1.6 / (opp + 1)));
    const r = Math.random();
    const call = { t: 'bet', a: 'call' };
    const raise = mult => {
      if (max <= S.cur) return call;
      const by = Math.max(S.minR, Math.round(p * mult / C.bb) * C.bb);
      return { t: 'bet', a: 'raise', n: Math.min(max, S.cur + by) };
    };
    if (eq > 0.85 && r < 0.25 && S.raises < 4) return { t: 'bet', a: 'raise', n: max };
    if (eq > strong && S.raises < 3 && r < 0.7) return raise(0.5 + r * 0.5);
    if (toCall === 0) return r < 0.08 && S.raises < 2 ? raise(0.5) : call;
    if (eq + 0.04 >= odds || (toCall <= C.bb && eq > 0.2)) return call;
    return r < 0.03 ? call : { t: 'bet', a: 'fold' };
  }
  function bot(S, i, away) {
    if (S.phase === 'draw' && !S.passSel[i]) return { t: 'pass', c: away ? [] : botDiscard(S.hands[i]) };
    if (S.phase === 'play' && !S.done && S.turn === i) return away ? { t: 'bet', a: S.cur > S.bet[i] ? 'fold' : 'call' } : botBet(S, i);
    return null;
  }
  // the cards everyone has seen, so a new host can deal the others again
  const known = S => [...(S.board || []), ...(S.shown || []).flat().filter(Boolean)];
  const handOf = S => S.hands.map((h, i) => S.fold[i] ? null : bestOf(h.concat(S.board)));
  return { kind, C, START, newGame, act, timer, tick, waiting, bot, known, pot, handOf, sortHand, canAct, nextActor, full: () => FULL.slice() };
}

/* ---------------- the Président ---------------- */
// 3 is the lowest card, then 4 … roi, as, and 2 the highest. Play 1 to 4 cards of one rank,
// as many as the last play and at least as high, or pass until the trick is over. Nobody may
// go out on a 2: a player left with nothing but 2s is stuck (`stuck`) and ends last.
const pv = c => rk(c) === 2 ? 15 : rk(c);
export const presValue = pv;
const TITLES = n => ({ 0: 'Président', [n - 1]: 'Trou', ...(n >= 4 ? { 1: 'Vice-président', [n - 2]: 'Vice-trou' } : {}) });
export const titleAt = (n, pos) => TITLES(n)[pos] || 'Neutre';
function presRules() {
  const N = S => S.players.length;
  const sortHand = h => h.sort((a, b) => pv(a) - pv(b) || SUITS.indexOf(su(a)) - SUITS.indexOf(su(b)));
  function newGame(players, rounds, host) {
    const S = { game: 'president', epoch: epoch(), v: 0, host, players, rounds, round: 1, total: zeros(players.length), hist: [], order: null, dealer: 0 };
    startRound(S);
    return S;
  }
  function give(S, from, to, k) {
    const cs = S.hands[from].slice(-k); // the best ones (hands are sorted)
    S.hands[from] = S.hands[from].slice(0, -k);
    S.hands[to] = sortHand(S.hands[to].concat(cs));
    S.recv[to] = cs;
  }
  function startRound(S) {
    const n = N(S), d = deck52();
    S.hands = S.players.map(() => []);
    d.forEach((c, k) => S.hands[(S.dealer + 1 + k) % n].push(c));
    S.hands.forEach(sortHand);
    S.passSel = nulls(n); S.recv = nulls(n); S.need = zeros(n); S.giveTo = S.players.map(() => -1);
    S.trick = []; S.passed = S.players.map(() => false); S.done = null; S.fin = []; S.stuck = []; S.played = []; S.last = null;
    const o = S.order;
    if (o) { // last round's Trou gives their best cards to the Président, who gives back the ones they want
      const pairs = [[o[0], o[n - 1], 2]];
      if (n >= 4) pairs.push([o[1], o[n - 2], 1]);
      for (const [hi, lo, k] of pairs) { give(S, lo, hi, k); S.need[hi] = k; S.giveTo[hi] = lo; }
    }
    S.passSel = S.need.map(k => k ? null : []);
    S.turn = o ? o[n - 1] : (S.dealer + 1) % n; // the Trou opens
    S.phase = S.need.some(Boolean) ? 'swap' : 'play';
  }
  function setSwap(S, i, cs) {
    if (S.phase !== 'swap' || S.passSel[i] || !S.need[i] || !owns(S.hands[i], cs) || cs.length !== S.need[i]) return false;
    S.passSel[i] = cs.slice();
    const to = S.giveTo[i];
    S.hands[i] = S.hands[i].filter(c => !cs.includes(c));
    S.hands[to] = sortHand(S.hands[to].concat(cs));
    S.recv[to] = cs.slice();
    if (S.passSel.every(Boolean)) S.phase = 'play';
    return true;
  }
  // still in the round: cards left, and not only 2s
  const inPlay = (S, j) => S.hands[j].length > 0 && !(S.stuck || []).includes(j);
  const holders = S => S.players.filter((_, j) => inPlay(S, j)).length;
  function legal(S, hand, cs) {
    if (!Array.isArray(cs) || !cs.length || cs.length > 4 || !owns(hand, cs) || !cs.every(c => rk(c) === rk(cs[0]))) return false;
    if (pv(cs[0]) === 15 && cs.length === hand.length) return false; // no going out on a 2
    if (!S.trick.length) return true;
    const top = S.trick[S.trick.length - 1][1];
    return cs.length === top.length && pv(cs[0]) >= pv(top[0]);
  }
  // the next player who may still answer, or the trick goes to the last one who played
  function advance(S, from) {
    const owner = S.trick[S.trick.length - 1][0];
    for (let k = 1; k <= N(S); k++) {
      const j = (from + k) % N(S);
      if (j === owner) { S.done = { w: owner }; S.turn = -1; return; }
      if (inPlay(S, j) && !S.passed[j]) { S.turn = j; return; }
    }
    S.done = { w: owner }; S.turn = -1;
  }
  function act(S, i, a) {
    if (a.t === 'next') return next(S);
    if (a.t === 'pass') return setSwap(S, i, a.c);
    if (a.t !== 'play' || S.phase !== 'play' || S.done || S.turn !== i || !Array.isArray(a.c)) return false;
    if (!a.c.length) { // pass
      if (!S.trick.length) return false;
      S.passed[i] = true;
      S.last = { i, pass: true };
      advance(S, i);
      return true;
    }
    if (!legal(S, S.hands[i], a.c)) return false;
    const cs = a.c.slice().sort((x, y) => SUITS.indexOf(su(x)) - SUITS.indexOf(su(y)));
    S.hands[i] = S.hands[i].filter(c => !cs.includes(c));
    S.trick.push([i, cs]);
    S.played.push(...cs);
    S.last = { i, c: cs };
    if (!S.hands[i].length) S.fin.push(i);
    else if (S.hands[i].every(c => pv(c) === 15)) S.stuck.push(i); // only 2s left: can't go out any more
    if (holders(S) <= 1) { S.done = { w: i, end: true }; S.turn = -1; }
    else if (pv(cs[0]) === 15) { S.done = { w: i, two: true }; S.turn = -1; } // a 2 closes the trick
    else advance(S, i);
    return true;
  }
  function timer(S) { return S.phase === 'play' && S.done ? (S.done.end ? 1600 : 1300) : 0; }
  function tick(S) {
    if (S.phase !== 'play' || !S.done) return false;
    const n = N(S), w = S.done.w;
    S.trick = []; S.passed = S.players.map(() => false); S.done = null;
    if (holders(S) <= 1) {
      // the last one still playing, then those stuck with 2s: the first one stuck ends Trou
      S.players.forEach((_, j) => { if (inPlay(S, j)) S.fin.push(j); });
      S.stuck.slice().reverse().forEach(j => { if (!S.fin.includes(j)) S.fin.push(j); });
      S.players.forEach((_, j) => { if (!S.fin.includes(j)) S.fin.push(j); });
      const pts = zeros(n);
      S.fin.forEach((j, pos) => { pts[j] = n - 1 - pos; S.total[j] += n - 1 - pos; });
      S.hist.push(pts);
      S.order = S.fin.slice();
      S.dealer = (S.dealer + 1) % n;
      S.turn = -1;
      S.phase = S.round >= S.rounds ? 'gameEnd' : 'roundEnd';
      return true;
    }
    S.turn = inPlay(S, w) ? w : (() => { for (let k = 1; k <= n; k++) { const j = (w + k) % n; if (inPlay(S, j)) return j; } return -1; })();
    return true;
  }
  function next(S) {
    if (S.phase !== 'roundEnd') return false;
    S.round++;
    startRound(S);
    return true;
  }
  function waiting(S) {
    if (S.phase === 'swap') return S.players.map((_, i) => i).filter(i => !S.passSel[i]);
    if (S.phase === 'play' && !S.done && S.turn >= 0) return [S.turn];
    return [];
  }
  function bot(S, i) {
    const hand = S.hands[i];
    if (S.phase === 'swap') return S.passSel[i] ? null : { t: 'pass', c: hand.slice(0, S.need[i]) }; // give back the smallest
    if (S.phase !== 'play' || S.done || S.turn !== i) return null;
    const groups = {};
    hand.forEach(c => { (groups[pv(c)] = groups[pv(c)] || []).push(c); });
    const keys = Object.keys(groups).map(Number).sort((a, b) => a - b);
    const plain = keys.filter(x => x !== 15);
    // playing these would leave nothing but 2s, and no way out
    const strands = cs => { const rest = hand.filter(c => !cs.includes(c)); return rest.length > 0 && rest.every(c => pv(c) === 15); };
    if (!S.trick.length) { // lead the smallest rank, all of it; keep the 2s for later, but play them before the last other rank
      if (groups[15] && plain.length <= 1) return { t: 'play', c: groups[15] };
      return { t: 'play', c: groups[plain[0] ?? keys[0]] };
    }
    const top = S.trick[S.trick.length - 1][1], need = top.length;
    const cands = keys.filter(k => k >= pv(top[0]) && groups[k].length >= need && legal(S, hand, groups[k].slice(0, need)));
    if (!cands.length) return { t: 'play', c: [] };
    const exact = cands.find(k => groups[k].length === need);
    let pick = exact != null && exact - cands[0] <= 3 ? exact : cands[0];
    if (strands(groups[pick].slice(0, need))) { // a 2 first if possible, or wait
      if (!cands.includes(15)) return { t: 'play', c: [] };
      pick = 15;
    } else if (pick === 15 && hand.length > 4 && Math.random() < 0.7) return { t: 'play', c: [] };
    return { t: 'play', c: groups[pick].slice(0, need) };
  }
  const known = S => [...(S.played || [])];
  return { kind: 'president', newGame, act, timer, tick, waiting, bot, known, legal, sortHand, full: () => FULL.slice() };
}

export const GAMES = { poker: pokerRules('poker'), holdem: pokerRules('holdem'), president: presRules() };
