export class VideoPlayerComponent {
  constructor() {
    this.html = `
      <div id="music-slider" class="absolute top-4 left-0  sm:fixed sm:top-4 sm:left-4 flex items-center space-x-4 transition-all duration-300">
        <!-- Video Circle -->
        <div id="video-circle" class="relative w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-full border-2 border-purple-400 shadow-lg overflow-hidden cursor-pointer transition-all duration-300">
          <img id="music-thumbnail" class="absolute inset-0 w-full h-full object-cover transition-opacity duration-300" alt="Video Thumbnail">
          <iframe id="youtube-player" class="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-300 pointer-events-none" allow="autoplay; encrypted-media"></iframe>
        </div>
      
        <!-- Controls -->
        <div class="flex items-center space-x-2">
          <button id="mute-circle" class="w-12 h-12 rounded-full border-2 border-purple-400 bg-black bg-opacity-70 text-white text-lg shadow-lg flex items-center justify-center">
            <i id="mute-icon" class="fas fa-volume-up"></i>
          </button>
          <button id="change-btn" class="w-12 h-12 rounded-full border-2 border-purple-400 bg-black bg-opacity-70 text-white text-lg shadow-lg flex items-center justify-center">
            <i class="fas fa-sync-alt"></i>
          </button>
          <button id="settings-btn" class="w-12 h-12 rounded-full border-2 border-purple-400 bg-black bg-opacity-70 text-white text-lg shadow-lg flex items-center justify-center">
            <i class="fas fa-cog"></i>
          </button>
        </div>
      </div>

      <!-- Playlist Modal -->
      <div id="playlist-modal" class="hidden fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div class="bg-gray-900 p-8 rounded-lg shadow-xl w-11/12 max-w-md">
          <h2 class="text-2xl font-bold mb-4 text-purple-400">Load Music</h2>
          <p class="text-gray-400 mb-6">Enter a YouTube Video URL or Playlist ID.</p>
          <input type="text" id="media-input" placeholder="Enter URL or ID" class="w-full bg-gray-800 text-white border-2 border-purple-400 rounded-full px-4 py-2 mb-4">
          <div class="flex justify-end space-x-4">
            <button id="close-modal-btn" class="btn rounded-full py-2 px-6 border-2 border-gray-600">Cancel</button>
            <button id="load-media-btn" class="btn rounded-full py-2 px-6 border-2 border-purple-400 bg-purple-600">Load</button>
          </div>
        </div>
      </div>
    `;
  }

  render(targetElement) {
    const container = document.querySelector(targetElement);
    if (container) {
      container.insertAdjacentHTML('beforeend', this.html);
    } else {
      console.error(`Target element ${targetElement} not found`);
    }
  }
}
