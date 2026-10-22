/**
 * Opt-in background music. Nothing loads until the visitor presses the music
 * button, so there is no autoplay and no third-party request on page load.
 */
import { storage } from './site.js';

const SOURCE_KEY = 'gamelab.radio';
const DEFAULT_TRACKS = ['X2V0ag9mCjc', 'CPIyuGoH_24', '-tOSh9bDh00'];

/** Accepts a YouTube video or playlist URL, a bare video id or a playlist id. */
export function parseSource(input) {
  const value = input.trim();
  if (!value) return null;
  const list = value.match(/[?&]list=([\w-]+)/);
  if (list) return { type: 'playlist', id: list[1] };
  const video = value.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/);
  if (video) return { type: 'video', id: video[1] };
  if (/^[\w-]{11}$/.test(value)) return { type: 'video', id: value };
  if (/^[\w-]{13,}$/.test(value)) return { type: 'playlist', id: value };
  return null;
}

function embedUrl(source) {
  const params = new URLSearchParams({ autoplay: '1', controls: '0', rel: '0', playsinline: '1' });
  if (source.type === 'playlist') {
    params.set('list', source.id);
    return `https://www.youtube-nocookie.com/embed/videoseries?${params}`;
  }
  params.set('loop', '1');
  params.set('playlist', source.id);
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(source.id)}?${params}`;
}

export class Radio {
  constructor(panel, { spriteBase }) {
    this.panel = panel;
    this.trackIndex = Math.floor(Math.random() * DEFAULT_TRACKS.length);
    this.custom = storage.get(SOURCE_KEY, null);
    this.render(spriteBase);
  }

  render(spriteBase) {
    const icon = (id) => `<svg class="icon" aria-hidden="true"><use href="${spriteBase}#i-${id}"></use></svg>`;
    this.panel.innerHTML = `
      <div class="radio-row">
        <iframe class="radio-frame" title="Music player" allow="autoplay; encrypted-media" loading="lazy"></iframe>
        <p class="radio-status" aria-live="polite"></p>
        <button class="icon-btn" type="button" data-radio-next aria-label="Next track">${icon('skip')}</button>
      </div>
      <form class="radio-custom">
        <label class="visually-hidden" for="radio-source">YouTube video or playlist link</label>
        <input id="radio-source" name="source" type="text" inputmode="url" placeholder="Paste a YouTube video or playlist link" autocomplete="off">
        <button class="btn btn-accent" type="submit">Play link</button>
        <button class="btn btn-accent" type="button" data-radio-reset hidden>Back to the mix</button>
      </form>`;

    this.frame = this.panel.querySelector('iframe');
    this.status = this.panel.querySelector('.radio-status');
    this.nextBtn = this.panel.querySelector('[data-radio-next]');
    this.resetBtn = this.panel.querySelector('[data-radio-reset]');
    const form = this.panel.querySelector('form');
    const input = form.elements.source;

    this.nextBtn.addEventListener('click', () => {
      this.trackIndex = (this.trackIndex + 1) % DEFAULT_TRACKS.length;
      this.play({ type: 'video', id: DEFAULT_TRACKS[this.trackIndex] });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const source = parseSource(input.value);
      if (!source) {
        this.status.textContent = 'That doesn’t look like a YouTube link.';
        input.focus();
        return;
      }
      this.custom = source;
      storage.set(SOURCE_KEY, source);
      input.value = '';
      this.play(source);
    });

    this.resetBtn.addEventListener('click', () => {
      this.custom = null;
      storage.set(SOURCE_KEY, null);
      this.play({ type: 'video', id: DEFAULT_TRACKS[this.trackIndex] });
    });
  }

  start() {
    this.play(this.custom ?? { type: 'video', id: DEFAULT_TRACKS[this.trackIndex] });
  }

  play(source) {
    const isCustom = source === this.custom;
    this.frame.src = embedUrl(source);
    this.nextBtn.hidden = isCustom;
    this.resetBtn.hidden = !isCustom;
    this.status.textContent = isCustom
      ? `Playing your ${source.type === 'playlist' ? 'playlist' : 'video'}`
      : `Game Lab mix · track ${this.trackIndex + 1} of ${DEFAULT_TRACKS.length}`;
  }

  stop() {
    // Clearing the src is the only reliable way to silence a cross-origin player.
    this.frame.removeAttribute('src');
  }
}
