export class VideoPlayerComponent {
  constructor() {
    this.html = `
      <div id="music-slider" class="absolute top-4 left-0  sm:fixed sm:top-4 sm:left-4 flex items-center space-x-4 transition-all duration-300">
        <!-- Video Circle -->
        <div id="video-circle" class="relative w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-full border-2 border-purple-400 shadow-lg overflow-hidden cursor-pointer transition-all duration-300">
          <img id="music-thumbnail" class="absolute inset-0 w-full h-full object-cover transition-opacity duration-300" alt="Video Thumbnail">
          <iframe id="youtube-player" class="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-300 pointer-events-none" allow="autoplay; encrypted-media"></iframe>
        </div>
      
        <!-- Mute Button (Hidden on Mobile) -->
        <button id="mute-circle" class="hidden md:flex w-12 h-12 rounded-full border-2 border-purple-400 bg-black bg-opacity-70 text-white text-lg shadow-lg items-center justify-center transition-all duration-300">
          <i id="mute-icon" class="fas fa-volume-mute"></i>
        </button>

        <div class="flex flex-col">                
      <button class="btn rounded-full p-4 border-2 border-purple-400" id="change-btn">
                <i class="fas fa-sync-alt"></i> تغيير الفيديو
      </button>
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