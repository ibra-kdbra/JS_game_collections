function initSound() {
    crashSound = new sound("audio/crash.mp3");
    rocketSound = new sound("audio/rocket.mp3");
    lowFuelSound = new sound("audio/alarm.mp3");
    commSound = new sound("audio/morse.mp3");

    rocketSound.loop();
}

class sound{
    constructor(src) {
        this.sound = document.createElement("audio");
        this.sound.src = src;
        this.sound.setAttribute("preload", "auto");
        this.sound.setAttribute("controls", "none");
        this.sound.style.display = "none";
        document.body.appendChild(this.sound);
    }

    play() {
        // Browsers reject playback before the first user gesture; the game starts on one.
        this.sound.play().catch(() => {});
    }

    stop() {
        this.sound.pause();
    }

    loop() {
        this.sound.addEventListener('timeupdate', function(){
            var buffer = 0.42;
            if(this.currentTime > this.duration - buffer){
                this.currentTime = 0;
                // Releasing Thrust right here pauses it again: not an error.
                this.play().catch(() => {});
            }
        });
    }
}

function fuelAlertCheck() {
    if(!isAlerted && currentFuel < fuelAlertThreshold) {
        isAlerted = true;
        alertTimer = 0;
    }
    else if(isAlerted && currentFuel > fuelAlertThreshold) {
        isAlerted = false;
    }
}

// Called every game step: the low fuel alarm repeats while fuel is low and
// mission control chatters now and then. Both stop while paused or between games.
function updateAmbientSounds(dt) {
    if(isAlerted) {
        alertTimer -= dt;
        if(alertTimer <= 0) {
            lowFuelSound.play();
            alertTimer = alertInterval;
        }
    }

    commsTimer -= dt;
    if(commsTimer <= 0) {
        commSound.play();
        resetCommsTimer();
    }
}

function resetCommsTimer() {
    commsTimer = Math.random() * (commsIntervalMax - commsIntervalMin) + commsIntervalMin;
}
