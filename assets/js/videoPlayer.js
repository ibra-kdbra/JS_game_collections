export class VideoPlayerComponent {
  constructor() {
    this.html = `
      <div id="music-slider" class="music-player-container">
        <!-- Video Circle -->
        <div id="video-circle" class="music-circle">
          <img id="music-thumbnail" class="music-thumbnail" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E" alt="Video Thumbnail">
          <!-- Youtube Iframe -->
          <iframe id="youtube-player" class="music-iframe" allow="autoplay; encrypted-media"></iframe>
        </div>
      
        <!-- Controls -->
        <div class="music-controls">
          <button id="mute-circle" class="music-btn" title="Mute/Unmute">
            <i id="mute-icon" class="fas fa-volume-up"></i>
          </button>
          <button id="change-btn" class="music-btn" title="Change Track">
            <i class="fas fa-sync-alt"></i>
          </button>
          <button id="settings-btn" class="music-btn" title="Settings">
            <i class="fas fa-cog"></i>
          </button>
        </div>
      </div>

      <!-- Playlist Modal -->
      <div id="playlist-modal" class="playlist-modal hidden">
        <div class="playlist-content">
          <h2 class="playlist-title">Load Media</h2>
          <p class="playlist-desc">Enter a YouTube Video URL or Playlist ID</p>
          <input type="text" id="media-input" placeholder="YouTube URL or ID" class="playlist-input">
          <div class="playlist-actions">
            <button id="close-modal-btn" class="btn-modal">Cancel</button>
            <button id="load-media-btn" class="btn-modal primary">Load</button>
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
