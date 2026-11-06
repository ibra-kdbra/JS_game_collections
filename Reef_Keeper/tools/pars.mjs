/**
 * Writes src/pars.js: each level's target time, the median time of the bot
 * (tools/bot.mjs) over a few seeds. Three stars for clearing within 1.25 times
 * the par, two within 1.75 times.
 *
 *   node Reef_Keeper/tools/pars.mjs
 */
import { writeFileSync } from 'node:fs';
import { LEVELS, HARD_LEVELS } from '../src/config.js';
import { playLevel } from './bot.mjs';

const pars = {};
for (const def of [...LEVELS, ...HARD_LEVELS]) {
  const times = [1, 2, 3].map((s) => playLevel(def, s)).filter((r) => r.outcome === 'clear').map((r) => r.minutes).sort((a, b) => a - b);
  if (!times.length) throw new Error(`${def.id}: the bot never cleared it`);
  pars[def.id] = Math.round(times[Math.floor(times.length / 2)] * 10) / 10;
}
const body = Object.entries(pars).map(([k, v]) => `  '${k}': ${v},`).join('\n');
writeFileSync(new URL('../src/pars.js', import.meta.url), `// Target times in minutes, from tools/pars.mjs (the bot's median). Regenerate after balance changes.\nexport const PARS = {\n${body}\n};\n`);
console.log(`wrote ${Object.keys(pars).length} pars`);
