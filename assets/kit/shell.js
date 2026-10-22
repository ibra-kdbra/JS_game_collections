/**
 * The thin frame every game shares: a way back to the hub and a fullscreen
 * toggle, kept small and out of the play area.
 *
 *   <script type="module">
 *     import { initShell } from '../assets/kit/shell.js';
 *     initShell({ slug: 'tetris' });
 *   </script>
 */

const KIT_CSS = new URL('./kit.css', import.meta.url).href;
const HUB = new URL('../../index.html', import.meta.url).href;

export function ensureKitStyles() {
  if (document.querySelector(`link[href="${KIT_CSS}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = KIT_CSS;
  document.head.append(link);
}

const ICONS = {
  back: '<path d="M20 12H5M11 6l-6 6 6 6"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  shrink: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
};

const svg = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

/**
 * @param {object} [options]
 * @param {string} [options.slug]         Registry slug; marks the game as played for the hub.
 * @param {boolean} [options.fullscreen=true]
 * @param {'top-left'|'top-right'|'bottom-left'} [options.position='top-left']
 * @param {Element} [options.fullscreenTarget=document.documentElement]
 */
export function initShell({ slug, fullscreen = true, position = 'top-left', fullscreenTarget = document.documentElement } = {}) {
  ensureKitStyles();
  if (document.querySelector('.gk-shell')) return;

  const bar = document.createElement('nav');
  bar.className = `gk-shell gk-shell--${position}`;
  bar.setAttribute('aria-label', 'Game Lab');

  const back = document.createElement('a');
  back.className = 'gk-shell-btn';
  back.href = HUB;
  back.setAttribute('aria-label', 'Back to Game Lab');
  back.innerHTML = `${svg('back')}<span>Game Lab</span>`;
  bar.append(back);

  if (fullscreen && document.fullscreenEnabled) {
    const fs = document.createElement('button');
    fs.type = 'button';
    fs.className = 'gk-shell-btn gk-shell-btn--icon';
    const render = () => {
      const on = !!document.fullscreenElement;
      fs.innerHTML = svg(on ? 'shrink' : 'expand');
      fs.setAttribute('aria-label', on ? 'Exit fullscreen' : 'Fullscreen');
    };
    fs.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else fullscreenTarget.requestFullscreen?.().catch(() => {});
      fs.blur(); // Keep Space/Enter going to the game, not this button.
    });
    document.addEventListener('fullscreenchange', render);
    render();
    bar.append(fs);
  }

  document.body.append(bar);

  if (slug) {
    try {
      const key = 'gamelab.recent';
      const recent = JSON.parse(localStorage.getItem(key) ?? '[]').filter((s) => s !== slug);
      localStorage.setItem(key, JSON.stringify([slug, ...recent].slice(0, 4)));
    } catch {}
  }

  return bar;
}
