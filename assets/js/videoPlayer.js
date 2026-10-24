export class VideoPlayerComponent {
  constructor() {
    this.html = `
      <div id="music-slider" class="music-player-container">
        <!-- Video Circle -->
        <button type="button" id="video-circle" class="music-circle" aria-label="Background music" aria-pressed="false">
          <img id="music-thumbnail" class="music-thumbnail" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E" alt="">
        </button>
        <!-- Youtube Iframe -->
        <iframe id="youtube-player" class="music-iframe" title="Background music player" tabindex="-1" aria-hidden="true"></iframe>
      
        <!-- Controls -->
        <div class="music-controls">
          <button type="button" id="mute-circle" class="music-btn" title="Mute/Unmute" aria-label="Mute or unmute music" aria-pressed="false">
            <i id="mute-icon" class="fas fa-volume-up" aria-hidden="true"></i>
          </button>
          <button type="button" id="change-btn" class="music-btn" title="Change Track" aria-label="Change track">
            <i class="fas fa-sync-alt" aria-hidden="true"></i>
          </button>
          <button type="button" id="settings-btn" class="music-btn" title="Settings" aria-label="Choose music">
            <i class="fas fa-cog" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      <!-- Ask before any music plays -->
      <div id="music-prompt" class="music-prompt" role="dialog" aria-labelledby="music-prompt-title" hidden>
        <i class="fas fa-volume-up music-prompt-icon" aria-hidden="true"></i>
        <div class="music-prompt-text">
          <strong id="music-prompt-title">Play background music?</strong>
          <span>Starts from the top. Pause it any time from the record.</span>
        </div>
        <div class="music-prompt-actions">
          <button type="button" id="music-prompt-later" class="btn-modal">No thanks</button>
          <button type="button" id="music-prompt-play" class="btn-modal primary">Play</button>
        </div>
      </div>

      <!-- Playlist Modal -->
      <div id="playlist-modal" class="playlist-modal hidden" role="dialog" aria-modal="true" aria-labelledby="playlist-title">
        <div class="playlist-content">
          <h2 class="playlist-title" id="playlist-title">Load Media</h2>
          <label class="playlist-desc" for="media-input">Enter a YouTube Video URL or Playlist ID</label>
          <input type="text" id="media-input" placeholder="YouTube URL or ID" class="playlist-input" autocomplete="off">
          <div class="playlist-presets" aria-label="Quick picks">
            <button type="button" class="btn-preset" data-preset="gaming-mix">Gaming mix</button>
            <button type="button" class="btn-preset" data-preset="https://www.youtube.com/watch?v=DP3rDP02lE0">Donkey Kong theme</button>
          </div>
          <div class="playlist-actions">
            <button type="button" id="close-modal-btn" class="btn-modal">Cancel</button>
            <button type="button" id="load-media-btn" class="btn-modal primary">Load</button>
          </div>
        </div>
      </div>
    `;
  }

  render(targetElement) {
    const container = document.querySelector(targetElement);
    if (container) {
      container.insertAdjacentHTML('afterbegin', this.html);
    } else {
      console.error(`Target element ${targetElement} not found`);
    }
  }
}
