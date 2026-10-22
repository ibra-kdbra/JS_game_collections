/**
 * Behaviour shared by the hub and the Art Lab page.
 */

const THEME_KEY = 'gamelab.theme';

export const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage blocked or full; the feature just won't persist.
    }
  },
};

function currentTheme() {
  const forced = document.documentElement.dataset.theme;
  if (forced === 'light' || forced === 'dark') return forced;
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** Wire every [data-theme-toggle] button. The saved theme is applied by an inline script in <head>. */
export function initThemeToggle(spriteBase) {
  const buttons = document.querySelectorAll('[data-theme-toggle]');
  const render = () => {
    const theme = currentTheme();
    const next = theme === 'dark' ? 'light' : 'dark';
    for (const btn of buttons) {
      btn.setAttribute('aria-label', `Switch to ${next} theme`);
      btn.querySelector('use')?.setAttribute('href', `${spriteBase}#i-${next === 'light' ? 'sun' : 'moon'}`);
    }
  };

  for (const btn of buttons) {
    btn.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {}
      render();
    });
  }

  matchMedia('(prefers-color-scheme: light)').addEventListener('change', render);
  render();
}

/** Register the root service worker. `swUrl` is relative to the current page. */
export function registerServiceWorker(swUrl) {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl).catch(() => {
      // Offline support is a bonus; the site works without it.
    });
  });
}

/** Lazily create the feedback dialog the first time a [data-feedback-open] button is used. */
export function initFeedbackButtons(pageId, base) {
  let ui;
  for (const btn of document.querySelectorAll('[data-feedback-open]')) {
    btn.addEventListener('click', async () => {
      if (!ui) {
        const [{ FeedbackUI }] = await Promise.all([
          import('./feedback/FeedbackUI.js'),
          loadStylesheet(`${base}assets/css/feedback.css`),
        ]);
        ui = new FeedbackUI(pageId, { spriteBase: `${base}assets/icons/sprite.svg` });
      }
      ui.open(btn);
    });
  }
}

function loadStylesheet(href) {
  if (document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = link.onerror = () => resolve();
    document.head.append(link);
  });
}
