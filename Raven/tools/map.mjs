// Prints a level as text: node Raven/tools/map.mjs <level number>
// # wall, . floor, D door, > enter, < exit, T terminal, C camera (with its
// control letter below), r/p/l enemy (radius wake, patrol, line-of-sight wake).
import { createLevel } from "./sim.mjs";

export function mapText(index, opts = {}) {
  const { game } = createLevel(index, opts);
  const L = game.level;
  const rows = [];
  for (let v = 0; v < L.height; v++) {
    const row = [];
    for (let u = 0; u < L.width; u++) row.push(L.data[v * L.width + u] === 2 ? "." : L.data[v * L.width + u] ? "#" : " ");
    rows.push(row);
  }
  const put = (x, y, ch) => { const u = Math.floor(x / 32), v = Math.floor(y / 32); if (rows[v] && rows[v][u] !== undefined) rows[v][u] = ch; };
  const box = (b, ch) => { for (let y = b.p1.y + 16; y < b.p2.y; y += 32) for (let x = b.p1.x + 16; x < b.p2.x; x += 32) put(x, y, ch); };
  box(L.enter, ">");
  box(L.exit, "<");
  game.doors.forEach((d) => { put(d.u * 32 + 16, d.v * 32 + 16, "D"); put(d.u * 32 + 48, d.v * 32 + 16, "D"); });
  game.terminals.forEach((t) => put(t.x, t.y, t.control ? t.control[0].toUpperCase() : "T"));
  game.cameras.forEach((c) => put(c.x, c.y, c.enabled ? "c" : (c.control ? c.control[0].toLowerCase() : "c")));
  game.enemies.forEach((e) => put(e.x, e.y, e._patrol ? "p" : e.wake === "los" ? "l" : "r"));
  return `${L.name}  ${L.width}x${L.height}  enemies ${game.enemies.length}  terminals ${game.terminals.length}  cameras ${game.cameras.length}\n` +
    rows.map((r) => r.join("")).join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = +process.argv[2];
  console.log(mapText(n - 1));
}
