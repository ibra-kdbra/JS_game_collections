// Brainy Warrior search solver, compiled to WebAssembly (see build.sh).
//
// Freestanding C++: no standard library, no allocator, no exceptions. All
// memory is static, so the module is a few kilobytes and needs no runtime.
// The rules mirror js/rules.js exactly; tools/verify-levels.mjs replays every
// solution found here through the JavaScript rules to prove they agree.
//
// Algorithms (the same five as the terminal C++ version, made correct):
//   0 BFS     breadth-first; fewest moves.
//   1 DFS     depth-first; finds *a* solution, usually a long one.
//   2 UCS     uniform-cost; cost = tiles travelled (+1 per magic), so it finds
//             the shortest *distance*, not the fewest moves.
//   3 Greedy  best-first on the heuristic only ("hill climbing" with a
//             priority queue, as in the terminal version); fast, not optimal.
//   4 A*      f = moves + h with an admissible, consistent heuristic; fewest
//             moves while expanding far fewer states than BFS.
//
// A* heuristic: every move defeats at most one enemy, so `enemies left` is a
// lower bound; if no enemy shares the warrior's row or column the next move
// cannot defeat anything, so one more move is needed. h never overestimates
// and drops by at most 1 per move (consistent).

typedef unsigned int u32;
typedef int i32;
typedef unsigned long long u64;
typedef unsigned char u8;

#define EXPORT(name) extern "C" __attribute__((export_name(#name)))

enum { SEA = 0, LAND = 1, WALL = 2 };
enum { A_UP = 0, A_DOWN, A_LEFT, A_RIGHT, A_MAGIC };
enum { BFS = 0, DFS, UCS, GREEDY, ASTAR };

static const int MAX_CELLS = 32 * 32;
static const int MAX_ENEMIES = 30;
static const int MAX_SPOTS = 12;
static const int MAX_NODES = 1 << 18;
static const int HASH_SIZE = 1 << 19; // power of two, > 2 * MAX_NODES
static const int MAX_TRACE = 1 << 16;

// ---- level -------------------------------------------------------------
static i32 W, H;
static u8 cells[MAX_CELLS];
static signed char enemyAt[MAX_CELLS];
static i32 nEnemies;
static i32 ex[MAX_ENEMIES], ez[MAX_ENEMIES];
static i32 nSpots;
static i32 sx[MAX_SPOTS], sz[MAX_SPOTS];

// Shared buffer: level input, path output.
static i32 io[4096];
// Stats: [0]=expanded, [1]=generated, [2]=path cost (UCS distance or moves).
static i32 stats[4];
// Positions of expanded states, in expansion order (z * W + x), for the
// "watch the AI think" view.
static unsigned short trace[MAX_TRACE];
static i32 traceLen;

EXPORT(bw_io) i32 *bw_io() { return io; }
EXPORT(bw_stats) i32 *bw_stats() { return stats; }
EXPORT(bw_trace) unsigned short *bw_trace() { return trace; }
EXPORT(bw_trace_len) i32 bw_trace_len() { return traceLen; }

// io layout: W, H, cells[W*H], nEnemies, (x, z)*, nSpots, (x, z)*
EXPORT(bw_load) i32 bw_load() {
    i32 p = 0;
    W = io[p++];
    H = io[p++];
    if (W <= 0 || H <= 0 || W * H > MAX_CELLS) return -1;
    for (i32 i = 0; i < W * H; i++) {
        cells[i] = (u8)io[p++];
        enemyAt[i] = -1;
    }
    nEnemies = io[p++];
    if (nEnemies < 0 || nEnemies > MAX_ENEMIES) return -2;
    for (i32 i = 0; i < nEnemies; i++) {
        ex[i] = io[p++];
        ez[i] = io[p++];
        enemyAt[ez[i] * W + ex[i]] = (signed char)i;
    }
    nSpots = io[p++];
    if (nSpots < 0 || nSpots > MAX_SPOTS) return -3;
    for (i32 i = 0; i < nSpots; i++) {
        sx[i] = io[p++];
        sz[i] = io[p++];
    }
    return 0;
}

// ---- state -------------------------------------------------------------
// key = alive (32 bits) | wiz (8 bits) << 32 | x (8) << 40 | z (8) << 48
struct State {
    i32 x, z, wiz;
    u32 alive;
};

static inline u64 pack(const State &s) {
    return (u64)s.alive | ((u64)(u32)s.wiz << 32) | ((u64)(u32)s.x << 40) | ((u64)(u32)s.z << 48);
}
static inline State unpack(u64 k) {
    State s;
    s.alive = (u32)k;
    s.wiz = (i32)((k >> 32) & 0xff);
    s.x = (i32)((k >> 40) & 0xff);
    s.z = (i32)((k >> 48) & 0xff);
    return s;
}

static inline i32 tileAt(i32 x, i32 z) {
    if (x < 0 || z < 0 || x >= W || z >= H) return SEA;
    return cells[z * W + x];
}

static const i32 DX[4] = {0, 0, -1, 1};
static const i32 DZ[4] = {-1, 1, 0, 0};

// Apply an action. Returns false if it is not possible or the warrior falls
// into the sea. `dist` receives the tiles travelled.
static bool step(const State &s, i32 a, State &out, i32 &dist) {
    out = s;
    dist = 0;
    if (a == A_MAGIC) {
        if (nSpots < 2) return false;
        for (i32 k = 1; k < nSpots; k++) {
            i32 w = (s.wiz + k) % nSpots;
            if (sx[w] == s.x && sz[w] == s.z) continue;
            i32 e = enemyAt[sz[w] * W + sx[w]];
            if (e >= 0 && (s.alive >> e) & 1u) continue;
            out.wiz = w;
            dist = 1;
            return true;
        }
        return false;
    }
    i32 x = s.x, z = s.z;
    const bool hasWiz = nSpots > 0;
    for (;;) {
        i32 nx = x + DX[a], nz = z + DZ[a];
        i32 t = tileAt(nx, nz);
        if (t == WALL || (hasWiz && sx[s.wiz] == nx && sz[s.wiz] == nz)) {
            if (dist == 0) return false;
            out.x = x;
            out.z = z;
            return true;
        }
        dist++;
        if (t == SEA) return false;
        i32 e = enemyAt[nz * W + nx];
        if (e >= 0 && (s.alive >> e) & 1u) {
            out.x = nx;
            out.z = nz;
            out.alive = s.alive & ~(1u << e);
            return true;
        }
        x = nx;
        z = nz;
    }
}

static inline i32 popcount(u32 v) {
    i32 n = 0;
    while (v) {
        v &= v - 1;
        n++;
    }
    return n;
}

static i32 hAdmissible(const State &s) {
    if (!s.alive) return 0;
    i32 n = popcount(s.alive);
    for (i32 e = 0; e < nEnemies; e++) {
        if (((s.alive >> e) & 1u) && (ex[e] == s.x || ez[e] == s.z)) return n;
    }
    return n + 1;
}

static i32 hGreedy(const State &s) {
    if (!s.alive) return 0;
    i32 best = 1 << 20;
    for (i32 e = 0; e < nEnemies; e++) {
        if (!((s.alive >> e) & 1u)) continue;
        i32 dx = ex[e] - s.x, dz = ez[e] - s.z;
        i32 d = (dx < 0 ? -dx : dx) + (dz < 0 ? -dz : dz);
        if (d < best) best = d;
    }
    return popcount(s.alive) * 16 + best;
}

// ---- node store + hash -------------------------------------------------
static u64 nodeKey[MAX_NODES];
static i32 nodeParent[MAX_NODES];
static i32 nodeG[MAX_NODES];
static u8 nodeAction[MAX_NODES];
static u8 nodeClosed[MAX_NODES];
static i32 nNodes;
static i32 table[HASH_SIZE]; // node index + 1, 0 = empty

static inline u32 hash(u64 k) {
    k ^= k >> 33;
    k *= 0xff51afd7ed558ccdULL;
    k ^= k >> 33;
    k *= 0xc4ceb9fe1a85ec53ULL;
    k ^= k >> 33;
    return (u32)k;
}

static void resetStore() {
    for (i32 i = 0; i < HASH_SIZE; i++) table[i] = 0;
    nNodes = 0;
    traceLen = 0;
}

// Index of the node with key k, or -1. `slot` receives where to insert.
static i32 find(u64 k, u32 &slot) {
    u32 h = hash(k) & (HASH_SIZE - 1);
    while (table[h]) {
        i32 n = table[h] - 1;
        if (nodeKey[n] == k) {
            slot = h;
            return n;
        }
        h = (h + 1) & (HASH_SIZE - 1);
    }
    slot = h;
    return -1;
}

static i32 addNode(u64 k, u32 slot, i32 parent, i32 action, i32 g) {
    if (nNodes >= MAX_NODES) return -1;
    i32 n = nNodes++;
    nodeKey[n] = k;
    nodeParent[n] = parent;
    nodeAction[n] = (u8)action;
    nodeG[n] = g;
    nodeClosed[n] = 0;
    table[slot] = n + 1;
    return n;
}

// ---- binary heap / queue -------------------------------------------------
// Entries are (priority, tiebreak, node). Lower priority first; on ties the
// smaller tiebreak wins.
static const i32 MAX_HEAP = 1 << 19;
static i32 heapP[MAX_HEAP], heapT[MAX_HEAP], heapN[MAX_HEAP];
static i32 heapLen;

static inline bool less(i32 a, i32 b) {
    return heapP[a] < heapP[b] || (heapP[a] == heapP[b] && heapT[a] < heapT[b]);
}
static inline void swapH(i32 a, i32 b) {
    i32 t;
    t = heapP[a]; heapP[a] = heapP[b]; heapP[b] = t;
    t = heapT[a]; heapT[a] = heapT[b]; heapT[b] = t;
    t = heapN[a]; heapN[a] = heapN[b]; heapN[b] = t;
}
static bool heapPush(i32 p, i32 t, i32 n) {
    if (heapLen >= MAX_HEAP) return false;
    i32 i = heapLen++;
    heapP[i] = p;
    heapT[i] = t;
    heapN[i] = n;
    while (i > 0) {
        i32 parent = (i - 1) >> 1;
        if (!less(i, parent)) break;
        swapH(i, parent);
        i = parent;
    }
    return true;
}
static i32 heapPop() {
    i32 top = heapN[0];
    heapLen--;
    if (heapLen > 0) {
        heapP[0] = heapP[heapLen];
        heapT[0] = heapT[heapLen];
        heapN[0] = heapN[heapLen];
        i32 i = 0;
        for (;;) {
            i32 l = 2 * i + 1, r = l + 1, m = i;
            if (l < heapLen && less(l, m)) m = l;
            if (r < heapLen && less(r, m)) m = r;
            if (m == i) break;
            swapH(i, m);
            i = m;
        }
    }
    return top;
}

// Write the path ending at node n into io; returns its length.
static i32 writePath(i32 n) {
    i32 len = 0;
    for (i32 c = n; nodeParent[c] >= 0; c = nodeParent[c]) len++;
    if (len > 4000) return -3;
    i32 i = len;
    for (i32 c = n; nodeParent[c] >= 0; c = nodeParent[c]) io[--i] = nodeAction[c];
    return len;
}

static inline void traceNode(const State &s) {
    if (traceLen < MAX_TRACE) trace[traceLen++] = (unsigned short)(s.z * W + s.x);
}

// Returns the path length (actions in io[0..len)), -1 if the position cannot
// be won, -2 if the search ran out of memory.
EXPORT(bw_solve) i32 bw_solve(i32 alg, i32 x, i32 z, u32 alive, i32 wiz) {
    resetStore();
    heapLen = 0;
    stats[0] = stats[1] = stats[2] = 0;

    State start;
    start.x = x;
    start.z = z;
    start.alive = alive;
    start.wiz = wiz;
    u32 slot;
    find(pack(start), slot);
    i32 root = addNode(pack(start), slot, -1, 0, 0);
    stats[1] = 1;
    if (!alive) return 0;

    // BFS uses the heap arrays as a FIFO, DFS as a stack.
    i32 head = 0;
    i32 counter = 0;
    auto prio = [&](const State &s, i32 g) -> i32 {
        if (alg == UCS) return g;
        if (alg == GREEDY) return hGreedy(s);
        // A*: f = g + h, ties broken towards the smaller h (deeper nodes).
        i32 h = hAdmissible(s);
        return (g + h) * 64 + h;
    };
    if (alg == BFS || alg == DFS) {
        heapN[0] = root;
        heapLen = 1;
    } else {
        heapPush(prio(start, 0), 0, root);
    }

    for (;;) {
        i32 n;
        if (alg == BFS) {
            if (head >= heapLen) return -1;
            n = heapN[head++];
        } else if (alg == DFS) {
            if (heapLen == 0) return -1;
            n = heapN[--heapLen];
        } else {
            if (heapLen == 0) return -1;
            n = heapPop();
            if (nodeClosed[n]) continue; // stale duplicate
        }
        nodeClosed[n] = 1;
        State s = unpack(nodeKey[n]);
        i32 g = nodeG[n];
        stats[0]++;
        traceNode(s);

        // Cost-ordered searches test the goal when a node is expanded, which
        // is what makes UCS and A* optimal.
        if (alg >= UCS && !s.alive) {
            stats[2] = g;
            return writePath(n);
        }

        for (i32 a = 0; a < 5; a++) {
            State t;
            i32 dist;
            if (!step(s, a, t, dist)) continue;
            i32 ng = g + (alg == UCS ? dist : 1);
            u64 k = pack(t);
            i32 m = find(k, slot);
            if (m >= 0) {
                // Only the cost-ordered searches ever reopen a state.
                if (alg < UCS || alg == GREEDY || nodeClosed[m] || ng >= nodeG[m]) continue;
                nodeG[m] = ng;
                nodeParent[m] = n;
                nodeAction[m] = (u8)a;
                if (!heapPush(prio(t, ng), ++counter, m)) return -2;
                continue;
            }
            m = addNode(k, slot, n, a, ng);
            if (m < 0) return -2;
            stats[1]++;
            if (alg < UCS || alg == GREEDY) {
                // Goal test on generation: BFS stays optimal and the others
                // stop as soon as they see a win.
                if (!t.alive) {
                    stats[2] = ng;
                    return writePath(m);
                }
            }
            if (alg == BFS || alg == DFS) {
                if (heapLen >= MAX_HEAP) return -2;
                heapN[heapLen++] = m;
            } else if (!heapPush(prio(t, ng), ++counter, m)) {
                return -2;
            }
        }
    }
}
