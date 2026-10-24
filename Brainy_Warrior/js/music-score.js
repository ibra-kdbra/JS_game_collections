// The theme music, written as data. js/music.js plays it.
//
// Everything here is plain text so it is easy to tweak:
//   * Chords: one per bar, separated by "|". Two names in one bar split it in
//     half ("Asus4 A"). A slash names the bass note ("D/F#").
//   * Melodies: "note:length" tokens, lengths in sixteenth notes, bars
//     separated by "|" (each bar must add up to 16). "-" is a rest.
//   * Drum patterns: 16 characters per bar. "X" accent, "x" soft, "o" ghost,
//     "O" low hit, "-" nothing.
//   * Arpeggio patterns: 16 slots per bar, each the index of a chord tone
//     counted up from the bottom of the arpeggio range, or null for a rest.
//
// The calm arrangement (easy to hard levels) is in D major, the expert one in
// D Dorian. Both share the same four-note motif: A D E F#(F) E D E.

export const TEMPO = 84; // beats per minute
export const SWING = 0.14; // how late the off sixteenths land, as a share of a sixteenth
export const LOOKAHEAD = 0.4; // seconds of music scheduled ahead of the clock
export const WAKE_MS = 100; // how often the scheduler wakes up

// Loudness: the music bus gain is MUSIC_LEVEL * volume^2, with the volume
// slider at DEFAULT_VOLUME to begin with. The sound effects play at 0.5.
export const MUSIC_LEVEL = 0.8;
export const DEFAULT_VOLUME = 0.5;

// Layer levels per band: [easy, medium, hard, expert]; `trim` balances the
// layers against each other in dB. `rev` and `delay` are
// the reverb and echo sends. `pan` spreads a layer's notes left and right.
export const LAYERS = {
    pad: { levels: [0.9, 0.9, 0.85, 0.85], trim: -8, rev: 0.55, pan: 0.6 },
    arp: { levels: [0.7, 0.85, 0.95, 0.95], trim: 5.5, rev: 0.3, delay: 0.22, pan: 0.3 },
    lead: { levels: [0.8, 0.85, 0.9, 0.9], trim: 2, rev: 0.35, delay: 0.18, pan: 0.1 },
    counter: { levels: [0, 0.7, 0.85, 0.85], trim: 8, rev: 0.3, delay: 0.1, pan: 0.4 },
    bass: { levels: [0.6, 0.85, 1, 1], trim: -7, rev: 0.06 },
    perc: { levels: [0.3, 0.65, 0.9, 0.9], trim: 16, rev: 0.18, pan: 0.45 },
    drum: { levels: [0, 0.35, 0.9, 0.9], trim: -2, rev: 0.12 },
    pulse: { levels: [0, 0, 0, 0.8], trim: -5, rev: 0.15 },
    // Event layers: switched by the game, not by the band.
    tick: { levels: [0.7, 0.7, 0.7, 0.7], trim: 12, rev: 0.15, delay: 0.25, pan: 0.5, event: 'ai' },
    sparkle: { levels: [0.8, 0.8, 0.8, 0.8], trim: 10, rev: 0.5, delay: 0.3, pan: 0.6, event: 'nearEnd' },
    sea: { levels: [0.5, 0.5, 0.5, 0.45], trim: 15, rev: 0.3, pan: 0.5 },
};

// Pad brightness (low-pass cutoff in Hz) per band.
export const PAD_CUTOFF = [780, 900, 1050, 1150];

// Chance that an arpeggio note is left out, per band: calmer levels breathe more.
export const ARP_REST = [0.32, 0.16, 0.06, 0.04];

export const PATTERNS = {
    arp: {
        flow: [0, null, 2, null, 1, null, 3, null, 2, null, 1, null, 4, null, 3, null],
        lilt: [0, null, null, 2, null, null, 1, null, 3, null, null, 1, null, null, 2, null],
        sparse: [0, null, null, null, null, null, 2, null, null, null, 1, null, null, null, null, null],
        ripple: [0, null, 1, 2, null, 1, 3, null, 2, null, 1, null, 4, 3, null, 1],
        rise: [0, null, 1, null, 2, null, 3, null, 4, null, 3, null, 2, null, 1, null],
    },
    // [step, which note, length in sixteenths]. r root, 5 fifth, o octave, 3 third.
    bass: {
        held: [[0, 'r', 16]],
        calm: [[0, 'r', 11], [12, '5', 4]],
        lilt: [[0, 'r', 6], [6, 'r', 3], [10, '5', 6]],
        walk: [[0, 'r', 6], [6, '5', 4], [10, 'o', 2], [12, '5', 4]],
        drive: [[0, 'r', 3], [4, 'r', 2], [6, '5', 2], [8, 'r', 3], [12, 'o', 2], [14, '5', 2]],
    },
    shaker: {
        soft: 'x---x---x---x---',
        lilt: 'x-X-x-X-x-X-x-X-',
        busy: 'x-Xxx-X-x-Xxx-Xx',
    },
    wood: {
        none: '----------------',
        back: '----x-------x---',
        clave: '---x--x---x---x-',
    },
    drum: {
        none: '----------------',
        island: 'O-----o---O-----',
        roll: 'O-----o---O---o-',
        half: 'O-------o-------',
    },
    // The expert pulse: a low drum plus a muted low pluck on every eighth.
    pulse: {
        none: '----------------',
        beat: 'O---o---O---o-o-',
        heart: 'O--o----O--o----',
    },
};

const MOTIF_A =
    'A4:2 D5:2 E5:4 F#5:2 E5:2 D5:2 E5:2 | B4:8 A4:4 -:4 | -:16 | -:8 E5:2 C#5:2 A4:4 | ' +
    'A4:2 D5:2 E5:4 A5:4 F#5:2 E5:2 | F#5:6 D5:10 | -:8 G5:2 F#5:2 E5:4 | E5:8 -:8';

const COUNTER_A =
    '-:8 F#4:4 A4:4 | D5:8 -:4 F#4:4 | G4:4 B4:4 D5:4 F#5:4 | E5:6 -:10 | ' +
    '-:8 F#4:4 A4:4 | B4:8 A4:4 F#4:4 | G4:4 B4:4 E5:4 -:4 | -:8 C#5:8';

const MELODY_B =
    'B4:6 D5:2 F#5:8 | E5:6 C#5:2 A4:8 | C#5:4 E5:4 A5:8 | F#5:12 -:4 | ' +
    'G5:6 F#5:2 D5:8 | E5:4 G5:4 B4:8 | D5:8 E5:8 | C#5:12 -:4';

const ECHO_C = '-:16 | -:16 | -:16 | -:16 | -:8 A5:2 D6:2 E6:4 | F#6:8 -:8 | -:16 | -:16';

const MELODY_D =
    'B4:2 E5:2 F#5:4 G5:2 F#5:2 E5:2 F#5:2 | C#5:8 A4:4 -:4 | D5:2 G5:2 A5:4 B5:2 A5:2 G5:2 A5:2 | E5:8 C#5:4 -:4 | ' +
    'G5:6 F#5:2 E5:4 D5:4 | C#5:6 E5:2 A5:8 | B5:4 A5:4 G5:4 F#5:4 | E5:12 -:4';

const MOTIF_X =
    'A4:2 D5:2 E5:4 F5:2 E5:2 D5:2 E5:2 | B4:8 G4:4 -:4 | -:16 | -:8 D5:2 B4:2 G4:4 | ' +
    'A4:2 D5:2 E5:4 A5:4 F5:2 E5:2 | G5:6 E5:10 | -:8 A5:2 G5:2 F5:4 | E5:8 -:4 C#5:4';

const COUNTER_X =
    '-:8 F4:4 A4:4 | E5:8 -:4 G4:4 | F4:4 A4:4 C5:4 E5:4 | D5:6 -:10 | ' +
    '-:8 F4:4 A4:4 | B4:8 G4:4 E4:4 | F4:4 A4:4 C5:4 -:4 | -:8 C#5:8';

const MELODY_X2 =
    'D5:6 F5:2 A5:8 | G5:6 E5:2 C5:8 | F5:4 E5:4 D5:8 | A4:12 -:4 | ' +
    'D5:6 F5:2 Bb5:8 | A5:4 G5:4 E5:8 | C5:8 E5:8 | C#5:12 -:4';

const ECHO_X = '-:16 | -:16 | -:16 | -:16 | -:8 A5:2 D6:2 E6:4 | F6:8 -:8 | -:16 | -:16';

// Sections. Fields that are arrays rotate on each pass through the arrangement,
// so the second time round a section is voiced a little differently.
export const SECTIONS = {
    intro: {
        chords: 'D | Bm7 | Gmaj7 | Asus4',
        arp: 'sparse', bass: 'held', shaker: 'soft', wood: 'none', drum: 'none', sea: true,
    },
    A: {
        chords: 'D | Bm7 | Gadd9 | Asus4 A | D | Bm7 | Em7 | A7sus4',
        lead: MOTIF_A, leadVoice: ['kalimba', 'flute'],
        arp: ['flow', 'lilt'], bass: 'calm', shaker: 'lilt', wood: 'none', drum: 'island',
    },
    B: {
        chords: 'Gmaj7 | A6 | F#m7 | Bm7 | Gmaj7 | Em7 | Asus4 | A',
        lead: MELODY_B, leadVoice: ['flute', 'kalimba'],
        arp: ['lilt', 'rise'], bass: 'lilt', shaker: 'lilt', wood: 'back', drum: 'island',
    },
    C: {
        chords: 'Bm7 | Gmaj7 | D/F# | Asus4 | Bm7 | Gmaj7 | Em7 | Asus4',
        lead: ECHO_C, leadVoice: 'bell',
        arp: ['sparse', 'lilt'], bass: 'held', shaker: 'soft', wood: 'none', drum: 'half', sea: true,
    },
    A2: {
        chords: 'D | Bm7 | Gadd9 | Asus4 A | D | Bm7 | Em7 | Asus4 A',
        lead: MOTIF_A, leadVoice: ['flute', 'kalimba'], counter: COUNTER_A,
        arp: ['flow', 'ripple'], bass: 'walk', shaker: 'busy', wood: 'back', drum: 'roll',
    },
    D: {
        chords: 'Em7 | F#m7 | Gmaj7 | A | Em7 | F#m7 | G | Asus4',
        lead: MELODY_D, leadVoice: ['kalimba', 'flute'],
        arp: ['rise', 'flow'], bass: 'lilt', shaker: 'lilt', wood: 'clave', drum: 'island',
    },
    B2: {
        chords: 'Gmaj7 | A6 | F#m7 | Bm7 | Gmaj7 | Em7 | Asus4 | A',
        lead: MELODY_B, leadVoice: ['kalimba', 'flute'], counter: COUNTER_A,
        arp: ['ripple', 'lilt'], bass: 'walk', shaker: 'busy', wood: 'back', drum: 'roll',
    },
    C2: {
        chords: 'Gmaj7 | D/F# | Em7 | Asus4 | Gmaj7 | D/F# | Em7 | A7sus4',
        lead: ECHO_C, leadVoice: 'bell',
        arp: ['lilt', 'sparse'], bass: 'calm', shaker: 'soft', wood: 'none', drum: 'none', sea: true,
    },

    X1: {
        chords: 'Dm7 | Em7 | Fmaj7 | G | Dm7 | Em7 | Fmaj7 | Asus4 A',
        lead: MOTIF_X, leadVoice: ['kalimba', 'flute'],
        arp: ['ripple', 'flow'], bass: 'drive', shaker: 'lilt', wood: 'none', drum: 'island', pulse: 'beat',
    },
    X2: {
        chords: 'Bbmaj7 | C | Dm7 | Dm7 | Bbmaj7 | C | Am7 | A',
        lead: MELODY_X2, leadVoice: ['flute', 'kalimba'],
        arp: ['rise', 'ripple'], bass: 'walk', shaker: 'busy', wood: 'clave', drum: 'roll', pulse: 'heart',
    },
    X3: {
        chords: 'Dm9 | Dm9 | Cadd9 | Cadd9 | G/B | Bbmaj7 | Dm9 | Asus4',
        lead: ECHO_X, leadVoice: 'bell',
        arp: ['lilt', 'sparse'], bass: 'held', shaker: 'soft', wood: 'none', drum: 'half', pulse: 'heart', sea: true,
    },
    X4: {
        chords: 'Dm7 | Em7 | Fmaj7 | G | Dm7 | Em7 | Fmaj7 | Asus4 A',
        lead: MOTIF_X, leadVoice: ['flute', 'kalimba'], counter: COUNTER_X,
        arp: ['flow', 'ripple'], bass: 'drive', shaker: 'busy', wood: 'back', drum: 'roll', pulse: 'beat',
    },
    X2b: {
        chords: 'Bbmaj7 | C | Dm7 | Dm7 | Bbmaj7 | C | Am7 | A',
        lead: MELODY_X2, leadVoice: ['kalimba', 'flute'], counter: COUNTER_X,
        arp: ['ripple', 'rise'], bass: 'drive', shaker: 'lilt', wood: 'back', drum: 'roll', pulse: 'beat',
    },
    X3b: {
        chords: 'Fmaj7 | C/E | Dm9 | Cadd9 | Dm9 | Bbmaj7 | C | Asus4 A',
        lead: ECHO_X, leadVoice: 'bell',
        arp: ['sparse', 'lilt'], bass: 'calm', shaker: 'soft', wood: 'none', drum: 'half', pulse: 'heart', sea: true,
    },
};

// The calm arrangement plays the intro once, then loops 7 sections of 8 bars
// (2 min 40 s at 84 bpm). The expert one loops 6 sections (2 min 17 s).
export const ARRANGEMENTS = {
    calm: { intro: 'intro', loop: ['A', 'B', 'C', 'A2', 'D', 'B2', 'C2'] },
    expert: { loop: ['X1', 'X2', 'X3', 'X4', 'X2b', 'X3b'] },
};

// Stingers: [seconds after the cue, voice, note(s), length in seconds, velocity].
// They play over the music, which ducks under them for `duck` seconds.
export const STINGERS = {
    win: {
        duck: 3.4, depth: 0.22,
        notes: [
            [0.0, 'kalimba', 'D5', 1.2, 0.9], [0.09, 'kalimba', 'F#5', 1.2, 0.85], [0.18, 'kalimba', 'A5', 1.2, 0.85],
            [0.27, 'kalimba', 'D6', 1.6, 0.9], [0.27, 'bass', 'D2', 1.8, 0.8],
            [0.45, 'swell', ['D4', 'A4', 'C#5', 'F#5'], 2.4, 0.6],
            [0.45, 'flute', 'E6', 0.24, 0.7], [0.7, 'flute', 'D6', 1.6, 0.8],
            [0.72, 'bell', 'A6', 2.4, 0.5], [0.9, 'bell', 'F#6', 2.4, 0.4], [1.08, 'bell', 'D7', 2.6, 0.35],
        ],
    },
    fall: {
        duck: 2.2, depth: 0.35,
        notes: [
            [0.0, 'marimba', 'A5', 0.8, 0.7], [0.17, 'marimba', 'F#5', 0.8, 0.65], [0.34, 'marimba', 'D5', 0.9, 0.6],
            [0.56, 'marimba', 'B4', 1.4, 0.65], [0.56, 'swell', ['B3', 'D4', 'F#4'], 1.8, 0.45],
        ],
    },
    stuck: {
        duck: 1.6, depth: 0.55,
        notes: [
            [0.0, 'marimba', ['G4', 'B4'], 0.9, 0.5], [0.0, 'flute', 'B4', 0.3, 0.45],
            [0.36, 'marimba', ['F#4', 'A4'], 1.2, 0.45], [0.36, 'flute', 'A4', 0.9, 0.4],
        ],
    },
};
// In the expert arrangement the fall stinger keeps to D minor; the win stays
// in D major (a bright ending after the minor-mode music).
export const EXPERT_STINGERS = {
    fall: {
        duck: 2.2, depth: 0.35,
        notes: [
            [0.0, 'marimba', 'A5', 0.8, 0.7], [0.17, 'marimba', 'F5', 0.8, 0.65], [0.34, 'marimba', 'D5', 0.9, 0.6],
            [0.56, 'marimba', 'A4', 1.4, 0.65], [0.56, 'swell', ['D4', 'F4', 'A4'], 1.8, 0.45],
        ],
    },
    stuck: {
        duck: 1.6, depth: 0.55,
        notes: [
            [0.0, 'marimba', ['G4', 'Bb4'], 0.9, 0.5], [0.0, 'flute', 'Bb4', 0.3, 0.45],
            [0.36, 'marimba', ['F4', 'A4'], 1.2, 0.45], [0.36, 'flute', 'A4', 0.9, 0.4],
        ],
    },
};
