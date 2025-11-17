// Audio System Enhancement for Tetris
// Adds spectacular sounds without breaking existing game

class AudioManager {
  constructor() {
    this.isMuted = localStorage.getItem('tetris-muted') === 'true';
    this.musicPlaying = false;
    this.audioContext = null;

    this.initWebAudio();
    this.loadSounds();
  }

  initWebAudio() {
    try {
      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      if (window.AudioContext) {
        this.audioContext = new AudioContext();
      }
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  }

  loadSounds() {
    this.soundDefinitions = {
      'rotate': this.createTone(440, 0.1),  // A note
      'move': this.createTone(330, 0.05),   // E note
      'place': this.createTone(220, 0.2),   // A note lower
      'harddrop': this.createTone(440, 0.3), // A note longer
      'hold': this.createTone(660, 0.1),
      'line-single': this.createSequence([261, 294, 330]), // C-E-G
      'line-double': this.createSequence([330, 392, 523]), // E-G-C
      'line-triple': this.createSequence([440, 523, 659, 784]), // A-C-E-G
      'line-tetris': this.createTetrisTheme(),
      'level-up': this.createSequence([523, 659, 784, 1047]),
      'voice-single': this.createTone(800, 0.5),
      'voice-double': this.createTone(900, 0.6),
      'voice-triple': this.createTone(1000, 0.7),
      'voice-tetris': this.createTone(1200, 0.8)
    };
  }

  createTone(frequency, duration, type = 'sine') {
    return { frequency, duration, type };
  }

  createSequence(frequencies, duration = 0.15) {
    return { frequencies, duration, type: 'sequence' };
  }

  createTetrisTheme() {
    return this.createSequence([659, 622, 659, 622, 659, 494, 587, 523], 0.2);
  }

  playSound(soundId) {
    if (this.isMuted) return;

    const soundDef = this.soundDefinitions[soundId];
    if (!soundDef) return;

    try {
      if (this.audioContext) {
        if (soundDef.type === 'sequence') {
          soundDef.frequencies.forEach((freq, index) => {
            setTimeout(() => {
              this.createOscillator(freq, soundDef.duration);
            }, index * soundDef.duration * 1000);
          });
        } else {
          this.createOscillator(soundDef.frequency, soundDef.duration, soundDef.type);
        }
      } else {
        this.fallbackBeep(soundId);
      }
    } catch (e) {
      console.warn('Audio failed:', e);
    }
  }

  createOscillator(frequency, duration, type = 'sine') {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  fallbackBeep(soundId) {
    // Simple beep for basic browsers
    const freq = this.getBeepFrequency(soundId);
    console.log('🔊', soundId, freq + 'Hz');
  }

  getBeepFrequency(soundId) {
    const freqMap = {
      'rotate': 440, 'move': 330, 'place': 220, 'harddrop': 660,
      'hold': 550, 'line-single': 440, 'line-double': 523,
      'line-triple': 659, 'line-tetris': 784, 'level-up': 880
    };
    return freqMap[soundId] || 440;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('tetris-muted', this.isMuted);

    // Update UI if exists
    const soundBtn = document.querySelector('.sound-toggle, #sound-toggle');
    if (soundBtn) {
      soundBtn.textContent = this.isMuted ? '🔇' : '🔊';
    }
  }
}

// Create global audio manager
const audioManager = new AudioManager();

// Add sound button if it doesn't exist
document.addEventListener('DOMContentLoaded', () => {
  let soundBtn = document.querySelector('.sound-toggle');

  if (!soundBtn) {
    // Add sound toggle to existing menu
    const menu = document.querySelector('#content nav ul') || document.querySelector('nav ul');
    if (menu) {
      const li = document.createElement('li');
      const btn = document.createElement('a');
      btn.href = '#';
      btn.className = 'sound-toggle';
      btn.onclick = (e) => { e.preventDefault(); audioManager.toggleMute(); };
      btn.textContent = audioManager.isMuted ? '🔇' : '🔊';
      li.appendChild(btn);
      menu.appendChild(li);
    }
  }
});
