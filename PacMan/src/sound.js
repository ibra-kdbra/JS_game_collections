/* Sound handlers added by Dr James Freeman who was sad such a great reverse was a silent movie  */

var audio = new preloadAudio();

/**
 * Each sound is downloaded once with fetch, decoded, and played through Web
 * Audio. The <audio> elements this replaced were only partly preloaded by the
 * browser: on a slow phone connection most of the 15 requests were aborted
 * after the first few kilobytes and the rest was fetched when the sound first
 * played, so effects came in late. The interface below (play, startLoop,
 * stopLoop, isPlaying, isPaused) is the one the game already uses.
 */
function audioTrack(url, volume) {
    var ctx = sharedAudioContext();
    var buffer = null;   // decoded sound, once loaded
    var source = null;   // the node playing now
    var gain = null;
    var offset = 0;      // where playback resumes, in seconds
    var startedAt = 0;   // context time that matches position 0
    var playing = false;
    var looping = false;
    var pending = false; // asked to play before the sound had loaded

    if (ctx) {
        gain = ctx.createGain();
        gain.gain.value = volume || 1;
        gain.connect(ctx.destination);
        fetch(url)
            .then(function(response) { return response.arrayBuffer(); })
            .then(function(data) {
                return new Promise(function(resolve, reject) { ctx.decodeAudioData(data, resolve, reject); });
            })
            .then(function(decoded) {
                buffer = decoded;
                if (pending) {
                    pending = false;
                    start();
                }
            })
            .catch(function() {});
    }

    function position() {
        if (!playing || !buffer) return offset;
        var t = ctx.currentTime - startedAt;
        return looping ? t % buffer.duration : Math.min(t, buffer.duration);
    }
    function stopSource() {
        if (!source) return;
        source.onended = null;
        try { source.stop(); } catch (e) {}
        source = null;
    }
    function start() {
        playing = true;
        if (!buffer) {
            pending = Boolean(ctx);
            if (!ctx) playing = false;
            return;
        }
        stopSource();
        if (offset >= buffer.duration) offset = 0;
        var src = ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = looping;
        src.connect(gain);
        src.onended = function() {
            // A sound that played to its end starts from the top next time, like a media element.
            if (source !== src) return;
            source = null;
            playing = false;
            offset = 0;
        };
        src.start(0, offset);
        startedAt = ctx.currentTime - offset;
        source = src;
    }
    function pause() {
        offset = position();
        stopSource();
        playing = false;
        pending = false;
    }

    this.play = function(noResetTime) {
        // for really rapid sound repeat set noResetTime
        if (playing) {
            pause();
            if (!noResetTime) offset = 0;
        }
        start();
    };
    this.startLoop = function(noResetTime) {
        if (looping) return;
        looping = true;
        if (playing) {
            pause();
            if (!noResetTime) offset = 0;
        }
        start();
    };
    this.stopLoop = function(noResetTime) {
        // Ghost sounds are stopped every frame; do nothing when already stopped and rewound.
        if (!looping && !playing && (noResetTime || offset === 0)) return;
        pause();
        if (!noResetTime) offset = 0;
        looping = false;
    };
    this.isPlaying = function() {
        return playing;
    };
    this.isPaused = function() {
        return !playing;
    };
    this.stop = this.stopLoop;
}

/**
 * One audio context for every track, resumed by the first tap, click or key
 * press. A function declaration, so it exists when the tracks are created at
 * the top of this file.
 */
function sharedAudioContext() {
    if (sharedAudioContext.ctx !== undefined) return sharedAudioContext.ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    var ctx = AC ? new AC() : null;
    sharedAudioContext.ctx = ctx;
    if (ctx) {
        var resume = function() {
            if (ctx.state !== 'running') ctx.resume();
        };
        ['pointerdown', 'touchend', 'mousedown', 'keydown'].forEach(function(type) {
            window.addEventListener(type, resume, true);
        });
    }
    return ctx;
}


function preloadAudio() {

    this.credit            = new audioTrack('sounds/credit.mp3');
    this.coffeeBreakMusic  = new audioTrack('sounds/coffee-break-music.mp3');
    this.die               = new audioTrack('sounds/miss.mp3');
    this.ghostReturnToHome = new audioTrack('sounds/ghost-return-to-home.mp3');
    this.eatingGhost       = new audioTrack('sounds/eating-ghost.mp3');
    this.ghostTurnToBlue   = new audioTrack('sounds/ghost-turn-to-blue.mp3', 0.5);
    this.eatingFruit       = new audioTrack('sounds/eating-fruit.mp3');
    this.ghostSpurtMove1   = new audioTrack('sounds/ghost-spurt-move-1.mp3');
    this.ghostSpurtMove2   = new audioTrack('sounds/ghost-spurt-move-2.mp3');
    this.ghostSpurtMove3   = new audioTrack('sounds/ghost-spurt-move-3.mp3');
    this.ghostSpurtMove4   = new audioTrack('sounds/ghost-spurt-move-4.mp3');
    this.ghostNormalMove   = new audioTrack('sounds/ghost-normal-move.mp3');
    this.extend            = new audioTrack('sounds/extend.mp3');
    this.eating            = new audioTrack('sounds/eating.mp3', 0.5);
    this.startMusic        = new audioTrack('sounds/start-music.mp3');

    this.ghostReset = function(noResetTime) {
        for (var s in this) {
            if (s == 'silence' || s == 'ghostReset' ) return;
            if (s.match(/^ghost/)) this[s].stopLoop(noResetTime);
        }
    };

    this.silence = function(noResetTime) {
        for (var s in this) {
            if (s == 'silence' || s == 'ghostReset' ) return;
            this[s].stopLoop(noResetTime);
        }
    }
}
