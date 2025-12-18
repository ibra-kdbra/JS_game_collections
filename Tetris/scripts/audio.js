// Audio System Enhancement for Tetris
// Adds spectacular sounds without breaking existing game

class AudioManager {
  constructor() {
    this.isMuted = localStorage.getItem('tetris-muted') === 'true';
    this.musicPlaying = false;
    this.audioContext = null;

    this.initWebAudio();
    this.loadSounds();
    this.musicLoop = null;
    this.currentNote = 0;
    this.isPlaying = false;
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
    
    // Full Korobeiniki (Tetris Theme) Melody
    // Frequencies: E5=659, B4=494, C5=523, D5=587, A4=440, G#4=415, E4=330
    this.musicNotes = [
      {f: 659, d: 0.4}, {f: 494, d: 0.2}, {f: 523, d: 0.2}, {f: 587, d: 0.4}, // E B C D
      {f: 523, d: 0.2}, {f: 494, d: 0.2}, {f: 440, d: 0.4}, {f: 440, d: 0.2}, // C B A A
      {f: 523, d: 0.2}, {f: 659, d: 0.4}, {f: 587, d: 0.2}, {f: 523, d: 0.2}, // C E D C
      {f: 494, d: 0.6}, {f: 523, d: 0.2}, {f: 587, d: 0.4}, {f: 659, d: 0.4}, // B C D E
      {f: 523, d: 0.4}, {f: 440, d: 0.4}, {f: 440, d: 0.4}, {f: 0, d: 0.4},   // C A A (rest)
      
      {f: 587, d: 0.4}, {f: 587, d: 0.2}, {f: 698, d: 0.2}, {f: 880, d: 0.4}, // D D F A
      {f: 784, d: 0.2}, {f: 698, d: 0.2}, {f: 659, d: 0.6}, {f: 523, d: 0.2}, // G F E C
      {f: 659, d: 0.4}, {f: 587, d: 0.2}, {f: 523, d: 0.2}, {f: 494, d: 0.4}, // E D C B
      {f: 494, d: 0.2}, {f: 523, d: 0.2}, {f: 587, d: 0.4}, {f: 659, d: 0.4}, // B C D E
      {f: 523, d: 0.4}, {f: 440, d: 0.4}, {f: 440, d: 0.4}, {f: 0, d: 0.4}    // C A A (rest)
    ];
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

  startMusic() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentNote = 0;
    this.playNextMusicNote();
  }

  stopMusic() {
    this.isPlaying = false;
    if (this.musicLoop) {
      clearTimeout(this.musicLoop);
      this.musicLoop = null;
    }
  }

  playNextMusicNote() {
    if (!this.isPlaying) return;

    // Check settings
    if (typeof settings !== 'undefined') {
      if (settings.Sound === 0) {
        // Just wait for next check if muted, to keep sync
        this.musicLoop = setTimeout(() => this.playNextMusicNote(), 500);
        return;
      }
    }

    const note = this.musicNotes[this.currentNote];
    
    // Play note if frequency > 0 (0 is rest)
    if (note.f > 0) {
      this.createOscillator(note.f, note.d * 0.9, 'triangle', 0.15); // Lower volume for music
    }

    this.currentNote = (this.currentNote + 1) % this.musicNotes.length;
    
    // Schedule next note
    // tempo adjustment: multiply duration by constant (e.g., 1000 for ms, scale for speed)
    const tempo = 450; 
    this.musicLoop = setTimeout(() => {
      this.playNextMusicNote();
    }, note.d * tempo);
  }

  playSound(soundId) {
    // Check global game settings if available
    if (typeof settings !== 'undefined') {
      if (settings.Sound === 0) return; // Sound Off
    } else if (this.isMuted) return;

    const soundDef = this.soundDefinitions[soundId];
    if (!soundDef) return;

    // Apply volume from settings
    let volume = 1.0;
    if (typeof settings !== 'undefined' && typeof settings.Volume !== 'undefined') {
      volume = settings.Volume / 100;
    }

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

  createOscillator(frequency, duration, type = 'sine', maxVolOverride = 0.3) {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    oscillator.type = type;

    // Use dynamic volume
    let volume = 1.0;
    if (typeof settings !== 'undefined' && typeof settings.Volume !== 'undefined') {
      volume = settings.Volume / 100;
    }
    
    // Scale base volume by global volume
    const baseVol = maxVolOverride * volume;

    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(baseVol, this.audioContext.currentTime + 0.02); // Slower attack
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);

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
}

// Create global audio manager
const audioManager = new AudioManager();
