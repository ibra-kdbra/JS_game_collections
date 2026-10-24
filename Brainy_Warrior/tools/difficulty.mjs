// Difficulty measures for a Brainy Warrior level, from the full state graph.
// Used by verify-levels.mjs (the difficulty table and ramp checks) and by
// generate-levels.mjs (to keep only hard, clean puzzles). Node only.
//
// Everything is computed from the rules in js/rules.js:
//   opt       optimal number of moves (magic counts as a move)
//   reach     reachable live states from the start
//   dead      share of those states from which the level can't be won any more
//   startTrap share of the moves available at the start that lose (fall into
//             the sea, or reach a position that can't be won)
//   pathTrap  share of the safe-looking moves (the ones that don't fall into
//             the sea) that lead to a position that can't be won, averaged
//             along an optimal solution: hidden dead ends
//   pathOpt   share of those safe-looking moves along an optimal solution that
//             are optimal (fewer = each step is a narrower choice)
//   solutions number of distinct optimal move sequences (fewer = harder)
//   magic     fewest magic moves any winning line needs (0 = wizard optional)
//   enemies   enemy count
//   bot       success rate of a human-like bot: it never slides into the sea
//             when it can see it, prefers moves that defeat an enemy (3 in 4), avoids
//             repeating a position, and plays one attempt with a move budget of
//             twice par plus four. The game's stuck detection ends the attempt.
//   score     the weighted difficulty score (see SCORE below), about 0-100
import { ACTIONS, apply, initialState, isWon, stateKey } from '../js/rules.js';

/** Small deterministic RNG (mulberry32). */
export function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * The reachable state graph. Node 0 is the start. For every node: its state,
 * and for every action an edge { a, to } where `to` is a node id, -1 for a
 * fall, or the action is missing when the move is impossible.
 */
export function stateGraph(level, limit = 300000) {
    const start = initialState(level);
    const ids = new Map([[stateKey(start), 0]]);
    const nodes = [{ s: start, edges: [], won: isWon(start) }];
    for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n.won) continue;
        for (const a of ACTIONS) {
            const r = apply(level, n.s, a);
            if (!r) continue;
            if (r.state.dead) {
                n.edges.push({ a, to: -1, defeat: false });
                continue;
            }
            const k = stateKey(r.state);
            let id = ids.get(k);
            if (id === undefined) {
                if (nodes.length >= limit) return null;
                id = nodes.length;
                ids.set(k, id);
                nodes.push({ s: r.state, edges: [], won: isWon(r.state) });
            }
            n.edges.push({ a, to: id, defeat: r.event === 'defeat' });
        }
    }
    return nodes;
}

/** Moves-to-win for every node (Infinity when it can't be won). */
function distanceToWin(nodes) {
    const preds = nodes.map(() => []);
    nodes.forEach((n, i) => n.edges.forEach((e) => e.to >= 0 && preds[e.to].push(i)));
    const dist = new Float64Array(nodes.length).fill(Infinity);
    let q = [];
    nodes.forEach((n, i) => {
        if (n.won) {
            dist[i] = 0;
            q.push(i);
        }
    });
    for (let d = 1; q.length; d++) {
        const next = [];
        for (const i of q) {
            for (const p of preds[i]) {
                if (dist[p] !== Infinity) continue;
                dist[p] = d;
                next.push(p);
            }
        }
        q = next;
    }
    return dist;
}

/** Fewest magic moves needed to win from every node (0-1 BFS on the reverse graph). */
function magicToWin(nodes) {
    const preds = nodes.map(() => []);
    nodes.forEach((n, i) => n.edges.forEach((e) => e.to >= 0 && preds[e.to].push({ from: i, w: e.a === 'magic' ? 1 : 0 })));
    const best = new Float64Array(nodes.length).fill(Infinity);
    const dq = [];
    nodes.forEach((n, i) => {
        if (n.won) {
            best[i] = 0;
            dq.push(i);
        }
    });
    // Simple deque via two arrays (front stack + back queue).
    const front = [];
    let head = 0;
    while (front.length || head < dq.length) {
        const i = front.length ? front.pop() : dq[head++];
        for (const { from, w } of preds[i]) {
            const c = best[i] + w;
            if (c < best[from]) {
                best[from] = c;
                if (w) dq.push(from);
                else front.push(from);
            }
        }
    }
    return best;
}

function bot(level, nodes, dist, opt, runs, seed) {
    const rand = rng(seed);
    const budget = opt * 2 + 4;
    let wins = 0;
    for (let r = 0; r < runs; r++) {
        let cur = 0;
        const seen = new Set([0]);
        for (let step = 0; step < budget; step++) {
            const moves = nodes[cur].edges.filter((e) => e.to >= 0);
            if (!moves.length) break;
            const fresh = moves.filter((e) => !seen.has(e.to));
            const pool = fresh.length ? fresh : moves;
            const hits = pool.filter((e) => e.defeat);
            const pick = hits.length && rand() < 0.75 ? hits : pool;
            const e = pick[Math.floor(rand() * pick.length)];
            cur = e.to;
            seen.add(cur);
            if (nodes[cur].won) {
                wins++;
                break;
            }
            if (dist[cur] === Infinity) break; // "No way to win from here."
        }
    }
    return wins / runs;
}

// Score weights, calibrated by hand against the 29 levels of v2 so that
// one-move tutorials land near 10, typical C++ levels at 30-60 and the long
// wizard puzzles above 80. Short levels get less credit for a unique or
// narrow solution, because with one or two moves that is unavoidable.
export const SCORE = {
    opt: 4, //            per optimal move up to 12, half that beyond
    bot: 16, //           per factor-of-e drop in the bot's success rate (capped)
    pathTrap: 20, //      x share of hidden dead-end moves along the solution
    pathOpt: 10, //       x share of non-optimal safe moves along the solution
    solutions: 1.5, //    per halving of the optimal solutions below 64
    magic: 3, //          per required magic move (capped at 4)
    reach: 2, //          per doubling of the state space above 64
};

export function scoreOf(m) {
    const short = Math.min(1, m.opt / 6);
    const optTerm = SCORE.opt * Math.min(m.opt, 12) + SCORE.opt * 0.5 * Math.max(0, m.opt - 12);
    const botTerm = SCORE.bot * Math.min(4, -Math.log(Math.max(m.bot, 0.01)));
    const solTerm = SCORE.solutions * Math.max(0, 6 - Math.log2(m.solutions)) * short;
    const s =
        optTerm +
        botTerm +
        SCORE.pathTrap * m.pathTrap +
        SCORE.pathOpt * (1 - m.pathOpt) * short +
        solTerm +
        SCORE.magic * Math.min(4, m.magic) +
        SCORE.reach * Math.max(0, Math.log2(m.reach / 64));
    return Math.round(s * 10) / 10;
}

/** All measures for one level. `runs` sets the bot's sample size. */
export function measure(level, { runs = 3000, seed = 12345 } = {}) {
    const nodes = stateGraph(level);
    if (!nodes) return null;
    const dist = distanceToWin(nodes);
    const opt = dist[0];
    if (opt === Infinity) return { solvable: false, reach: nodes.length };
    const live = nodes.filter((n) => !n.won).length;
    let deadCount = 0;
    nodes.forEach((n, i) => {
        if (!n.won && dist[i] === Infinity) deadCount++;
    });
    const isBad = (e) => e.to < 0 || dist[e.to] === Infinity;

    // Distinct optimal solutions: DP over nodes by distance.
    const count = new Float64Array(nodes.length);
    const order = [...nodes.keys()].filter((i) => dist[i] !== Infinity).sort((a, b) => dist[a] - dist[b]);
    for (const i of order) {
        if (dist[i] === 0) {
            count[i] = 1;
            continue;
        }
        let c = 0;
        for (const e of nodes[i].edges) if (e.to >= 0 && dist[e.to] === dist[i] - 1) c += count[e.to];
        count[i] = c;
    }

    // Walk one optimal line (prefer slides, then the first action) and measure
    // how narrow every choice along it is.
    let cur = 0;
    let trap = 0;
    let good = 0;
    const line = [];
    while (dist[cur] > 0) {
        // Slides into open sea are easy to see, so only count the moves a
        // player could actually consider: the ones that don't fall.
        const edges = nodes[cur].edges.filter((e) => e.to >= 0);
        trap += edges.filter(isBad).length / edges.length;
        good += edges.filter((e) => dist[e.to] === dist[cur] - 1).length / edges.length;
        const e = edges.find((x) => dist[x.to] === dist[cur] - 1);
        line.push(e.a);
        cur = e.to;
    }
    const startEdges = nodes[0].edges;
    const magic = magicToWin(nodes)[0];
    const m = {
        solvable: true,
        opt,
        reach: nodes.length,
        dead: deadCount / Math.max(1, live),
        startTrap: startEdges.filter(isBad).length / Math.max(1, startEdges.length),
        pathTrap: trap / opt,
        pathOpt: good / opt,
        solutions: count[0],
        magic,
        magicMoves: line.filter((a) => a === 'magic').length,
        enemies: level.enemies.length,
        wizard: level.wizardSpots.length > 1,
        bot: bot(level, nodes, dist, opt, runs, seed),
        line,
    };
    m.score = scoreOf(m);
    return m;
}

/** Difficulty bands used by the ramp checks. */
export const BANDS = { easyMax: 20, mediumMax: 60, hardMax: 120 };
export const band = (score) =>
    score <= BANDS.easyMax ? 'easy' : score <= BANDS.mediumMax ? 'medium' : score <= BANDS.hardMax ? 'hard' : 'expert';
