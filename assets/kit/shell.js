/**
 * Per-game setup every game shares. It adds nothing to the page: games open
 * in their own tab from the hub and use the whole window.
 *
 *   <script type="module">
 *     import { initShell } from '../assets/kit/shell.js';
 *     initShell({ slug: 'tetris' });
 *   </script>
 */

const KIT_CSS = new URL('./kit.css', import.meta.url).href;
const RECENT_KEY = 'gamelab.recent';
const RECENT_MAX = 4;

export function ensureKitStyles() {
  if (document.querySelector(`link[href="${KIT_CSS}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = KIT_CSS;
  document.head.append(link);
}

/**
 * Loads the kit styles (used by the touch controls) and records the game as
 * recently played so the hub can show it under "Continue playing".
 *
 * @param {object} [options]
 * @param {string} [options.slug]  Registry slug from assets/js/data.js.
 */
export function initShell({ slug } = {}) {
  ensureKitStyles();
  if (!slug) return;
  try {
    const recent = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    const rest = Array.isArray(recent) ? recent.filter((s) => s !== slug) : [];
    localStorage.setItem(RECENT_KEY, JSON.stringify([slug, ...rest].slice(0, RECENT_MAX)));
  } catch {
    // Storage blocked (private mode, sandbox): nothing to remember.
  }
}
