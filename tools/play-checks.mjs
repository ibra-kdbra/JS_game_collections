#!/usr/bin/env node
/**
 * Runs the browser gameplay checks, each in its own process, a few at a time, and prints
 * each one's output when it finishes. Exits non-zero if any check fails.
 *
 * Usage: node tools/play-checks.mjs [--only 2048,Tetris,...]
 *
 * Environment:
 *   PLAYWRIGHT_MODULE   path to the playwright package (as for tools/smoke.mjs)
 *   CHROMIUM_PATH       Chromium executable to use instead of Playwright's own download
 *   PLAY_CONCURRENCY    checks run at the same time (default 2; several checks play in
 *                       real time, so a busy machine can make them miss their timings)
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECKS = [
  ['2048', '2048/tools/verify-play.mjs'],
  ['Hangman', 'Hangman/tools/verify-play.mjs'],
  ['HuggersFight', 'HuggersFight/tools/verify-play.mjs'],
  ['InterLaced', 'InterLaced/tools/verify-play.mjs'],
  ['MoonLDR', 'MoonLDR/tools/verify-play.mjs'],
  ['PacMan', 'PacMan/tools/verify-play.mjs'],
  ['PacMan_Slasher', 'PacMan_Slasher/tools/verify-play.mjs'],
  ['Tetris', 'Tetris/tools/verify-play.mjs'],
  ['Wahdatio', 'Wahdatio/tools/verify-play.mjs'],
];
const TIMEOUT_MS = 3 * 60 * 1000;

const args = process.argv.slice(2);
const onlyArg = args.includes('--only') ? args[args.indexOf('--only') + 1] : '';
const only = onlyArg ? onlyArg.split(',').map((s) => s.trim().toLowerCase()) : null;
const todo = CHECKS.filter(([name]) => !only || only.includes(name.toLowerCase()));
if (!todo.length) {
  console.error(`No check matches --only ${onlyArg}. Checks: ${CHECKS.map(([n]) => n).join(', ')}`);
  process.exit(1);
}
const concurrency = Math.max(1, Number(process.env.PLAY_CONCURRENCY || 2));

function runOne([name, file]) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [path.join(root, file)], { cwd: root, env: process.env });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    const timer = setTimeout(() => {
      out += `\n  FAIL timed out after ${TIMEOUT_MS / 1000}s\n`;
      child.kill('SIGKILL');
    }, TIMEOUT_MS);
    child.on('close', (code) => {
      clearTimeout(timer);
      const secs = (Date.now() - started) / 1000;
      console.log(`\n== ${name} (node ${file}) ${code === 0 ? 'passed' : 'FAILED'} in ${secs.toFixed(1)}s`);
      console.log(out.trimEnd());
      resolve({ name, ok: code === 0, secs });
    });
  });
}

const queue = todo.slice();
const results = [];
await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
  while (queue.length) results.push(await runOne(queue.shift()));
}));

console.log('\nSummary');
for (const r of results.sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.name.padEnd(15)} ${r.secs.toFixed(1)}s`);
}
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `${failed.length} of ${results.length} gameplay checks failed` : `All ${results.length} gameplay checks passed`);
process.exit(failed.length ? 1 : 0);
