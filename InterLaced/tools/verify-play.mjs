/**
 * InterLaced gameplay check (browser):
 *   node InterLaced/tools/verify-play.mjs
 *
 * Plays the start of the story the way a player does, from a fresh save:
 * 1. Presses Enter through the boot sequence, types 1 (Story) at the menu, and presses Enter
 *    through the briefing until story mesh 1 (mesh://[::1]/practice/0) opens.
 * 2. Picks the Crash tool and clicks nodes to crash them (it chooses the nodes that cut off
 *    the most packets, using the tool's use count), then waits for the network health to
 *    fall below the threshold: the mesh must go OFFLINE (not FAILED).
 * 3. Clicks Disconnect: back at the terminal, the stage is saved as cleared.
 * The live Mesh object is read through a wrapper around the global Mesh constructor,
 * installed from the page; the game file is not changed. Exits non-zero on any failure.
 */
import { startCheck, waitFor } from '../../tools/play/harness.mjs';

const check = await startCheck('InterLaced: story mesh 1 taken offline');
await check.run(async () => {
  const page = await check.open('InterLaced/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  // Keep a reference to every mesh the game creates.
  await page.evaluate(() => {
    const RealMesh = window.Mesh;
    window.Mesh = function (config, callback) {
      const mesh = new RealMesh(config, callback);
      window.__mesh = mesh;
      return mesh;
    };
  });

  // 1. Terminal: Enter through the boot, "1" at the menu, Enter through the briefing.
  const started = Date.now();
  let typed = false;
  let opened = false;
  while (Date.now() - started < 60000) {
    const st = await page.evaluate(() => ({
      mesh: !document.getElementById('screen').classList.contains('hide') && !!window.__mesh,
      menu: !!document.getElementById('input') && /interlaced#\s*$/.test(document.getElementById('terminal').innerText.trimEnd() + ' '),
    }));
    if (st.mesh) {
      opened = true;
      break;
    }
    if (st.menu && !typed) {
      await page.keyboard.type('1');
      await page.keyboard.press('Enter');
      typed = true;
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(300);
  }
  const meshId = opened ? await page.evaluate(() => document.getElementById('mesh-id').textContent) : '';
  check.ok(typed, 'the menu takes the Story command');
  check.ok(opened && meshId === '[::1]/practice/0', `story mesh 1 opens (${meshId || 'nothing'}, ${((Date.now() - started) / 1000).toFixed(0)}s of terminal)`);
  if (!opened) return;

  // Wait for the router to connect (health shown, objective printed).
  await waitFor(page, () => window.__mesh.connected, null, { timeout: 15000 });

  // 2. Choose the nodes to crash: the set of `uses` nodes that strands the most packets.
  const plan = await page.evaluate(() => {
    const mesh = window.__mesh;
    const uses = mesh.tools.crash.uses;
    const nodes = mesh.nodes;
    const stranded = (down) => {
      let n = 0;
      for (const p of mesh.packets) {
        if (down.has(p.destination) || down.has(p.origin)) {
          n++;
          continue;
        }
        // Breadth-first search from the packet's node avoiding crashed nodes.
        const seen = new Set([p.origin]);
        const queue = [p.origin];
        let found = false;
        while (queue.length && !found) {
          const cur = queue.shift();
          for (const id in cur.connections) {
            const next = cur.connections[id].node;
            if (down.has(next) || seen.has(next)) continue;
            if (next === p.destination) found = true;
            seen.add(next);
            queue.push(next);
          }
        }
        if (!found) n++;
      }
      return n;
    };
    let best = null;
    const pick = (start, chosen) => {
      if (chosen.length === Math.min(uses, nodes.length)) {
        const score = stranded(new Set(chosen.map((i) => nodes[i])));
        if (!best || score > best.score) best = { score, chosen: chosen.slice() };
        return;
      }
      for (let i = start; i < nodes.length; i++) pick(i + 1, [...chosen, i]);
    };
    if (nodes.length <= 16) pick(0, []);
    return { uses, nodes: nodes.length, packets: mesh.packets.length, chosen: best ? best.chosen : [], score: best ? best.score : 0 };
  });
  check.ok(plan.uses > 0 && plan.chosen.length === plan.uses, `the Crash tool has ${plan.uses} uses; crashing nodes ${plan.chosen.join(', ')} of ${plan.nodes} strands ${plan.score} of ${plan.packets} packets`);

  await page.click('[data-tool="crash"]');
  for (const i of plan.chosen) {
    const el = await page.evaluateHandle((k) => window.__mesh.nodes[k].element, i);
    await el.click({ force: true });
    await page.waitForTimeout(150);
  }
  const crashed = await page.evaluate((list) => list.filter((k) => !window.__mesh.nodes[k].online).length, plan.chosen);
  const usesLeft = await page.evaluate(() => document.getElementById('crash-use').textContent);
  check.ok(crashed === plan.chosen.length && usesLeft === '0', `clicking the nodes with Crash selected takes them down (${crashed} down, ${usesLeft} uses left)`);

  // The health falls as stranded packets are dropped; under the threshold the mesh crashes.
  const result = await waitFor(page, () => {
    const banner = document.getElementById('offline-banner');
    return !document.getElementById('offline').classList.contains('hide') ? banner.textContent : '';
  }, null, { timeout: 60000, interval: 250 });
  const health = await page.evaluate(() => document.getElementById('health').textContent);
  check.ok(result === 'OFFLINE', `the mesh goes offline (banner: ${result || 'none after 60s'}, health ${health})`);
  if (result !== 'OFFLINE') return;

  // 3. Disconnect: back to the terminal with the stage saved as cleared.
  await page.click('#continue');
  const saved = await waitFor(page, () => {
    const raw = localStorage.getItem('interlaced.cleared');
    return document.getElementById('screen').classList.contains('hide') && raw && JSON.parse(raw).includes(0);
  }, null, { timeout: 10000 });
  check.ok(saved, 'Disconnect returns to the terminal and saves story mesh 1 as cleared');
  check.noErrors(page);
});
