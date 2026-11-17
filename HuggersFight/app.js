'use strict';

const clampCamera = !debug;
const lowGraphicsSettings = glOverlay = !window['chrome']; // only chromium uses high settings
const defaultCameraScale = 4 * 16;
// Zoom out on small screens so a phone still shows about 12 tiles across its short side.
// Steps of 8 canvas pixels keep the 8px pixel art crisp. The canvas has up to 2 pixels
// per CSS pixel (pixelRatio), so the limits are in CSS pixels times that.
const snap8 = (v) => max(8, (v / 8 | 0) * 8);
const fitCameraScale = () => clamp(snap8(min(mainCanvas.width, mainCanvas.height) / 12),
    snap8(defaultCameraScale * pixelRatio), snap8(32 * pixelRatio));
const maxPlayers = 4;

const team_none = 0;
const team_player = 1;
const team_enemy = 2;

let updateWindowSize, renderWindowSize, gameplayWindowSize;

// Text is sized for a ~1000x700 screen (CSS pixels) and scales down on smaller ones.
const uiScale = () => min(1, min(mainCanvas.width / 1000, mainCanvas.height / 700) / pixelRatio);
// Screen-space sizes: CSS pixels to canvas pixels.
const px = (cssPx) => cssPx * pixelRatio;
const uiFont = (size, minPx = 0) => px(max(minPx, size * uiScale())) + "px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
// On touch screens the on-screen controls cover the bottom, so the HUD moves to the top.
// HUD text: black with a light outline, so it reads over dark caves as well as bright skies.
function hudText(text, x, y) {
    mainContext.lineJoin = 'round';
    mainContext.lineWidth = px(3);
    mainContext.strokeStyle = 'rgba(255, 255, 255, .55)';
    mainContext.strokeText(text, x, y);
    mainContext.fillText(text, x, y);
}
const hudOnTop = () => document.documentElement.classList.contains('gk-has-touch');

// In portrait the touch controls cover the bottom of the view: aim the camera below the
// player so they sit in the middle of what is left between the HUD and the controls.
// Returns the offset in world units.
function touchCameraOffset() {
    if (!hudOnTop() || innerWidth > innerHeight) return 0;
    const controls = document.querySelector('.gk-touch');
    if (!controls || controls.hidden) return 0;
    const top = controls.getBoundingClientRect().top;
    const offset = innerHeight / 2 - (110 + top) / 2;
    return max(0, offset) * pixelRatio / cameraScale;
}

engineInit(

    () => // appInit 
    {
        resetGame();
        cameraScale = fitCameraScale();
        cameraPos = players[0].pos.copy(); // start on the player, the title screen shows this view
    },
    () => // appUpdate
    {
        if (!debug)
            cameraScale = fitCameraScale();
        const cameraSize = vec2(mainCanvas.width, mainCanvas.height).scale(1 / cameraScale);
        renderWindowSize = cameraSize.add(vec2(5));

        gameplayWindowSize = vec2(mainCanvas.width, mainCanvas.height).scale(1 / (defaultCameraScale * pixelRatio));
        updateWindowSize = gameplayWindowSize.add(vec2(30));

        if (debug) {
            randSeeded(randSeeded(randSeeded(randSeed = Date.now()))); // set random seed for debug mode stuf
            if (keyWasPressed(81))
                new Enemy(mousePosWorld);

            if (keyWasPressed(84))
                new Prop(mousePosWorld);

            if (keyWasPressed(69))
                explosion(mousePosWorld);

            if (keyIsDown(89)) {
                let e = new ParticleEmitter(mousePosWorld);

                // test
                e.collideTiles = 1;
                e.emitSize = 2;
                e.colorStartA = new Color(1, 1, 1, 1);
                e.colorStartB = new Color(0, 1, 1, 1);
                e.colorEndA = new Color(0, 0, 1, 0);
                e.colorEndB = new Color(0, .5, 1, 0);
                e.emitConeAngle = .1;
                e.particleTime = 1
                e.speed = .3
                e.elasticity = .1
                e.gravityScale = 1;
                e.angle = -PI;
            }

            if (mouseWheel) // mouse zoom
                cameraScale = clamp(cameraScale * (1 - mouseWheel / 10), defaultTileSize.x * 16, defaultTileSize.x / 16);

            if (keyWasPressed(77))
                players[0].pos = mousePosWorld;

            if (keyWasPressed(78))
                nextLevel();
        }

        // restart if no lives left
        let minDeadTime = 1e3;
        for (const player of players)
            minDeadTime = min(minDeadTime, player && player.isDead() ? player.deadTimer.get() : 0);

        if (minDeadTime > 3 && (keyWasPressed(90) || keyWasPressed(32) || gamepadWasPressed(0)) || keyWasPressed(82))
            resetGame();

        if (levelEndTimer.get() > 3) {
            nextLevel();
            dispatchEvent(new CustomEvent('huggers:level', { detail: level }));
        }
    },
    () => // appUpdatePost
    {
        const cameraOffset = vec2(0, touchCameraOffset());
        if (players.length == 1) {
            const player = players[0];
            if (!player.isDead())
                cameraPos = cameraPos.lerp(player.pos.subtract(cameraOffset), clamp(player.getAliveTime() / 2));
        }
        else {
            // camera follows average pos of living players
            let posTotal = vec2();
            let playerCount = 0;
            let cameraOffset = 1;
            for (const player of players) {
                if (player && !player.isDead()) {
                    ++playerCount;
                    posTotal = posTotal.add(player.pos.add(vec2(0, cameraOffset)));
                }
            }

            if (playerCount)
                cameraPos = cameraPos.lerp(posTotal.scale(1 / playerCount).subtract(cameraOffset), .2);
        }

        // spawn players if they don't exist
        for (let i = maxPlayers; i--;) {
            if (!players[i] && (gamepadWasPressed(0, i) || gamepadWasPressed(1, i))) {
                ++playerLives;
                new Player(checkpointPos, i);
            }
        }

        // clamp to bottom and sides of level
        if (clampCamera) {
            const w = mainCanvas.width / 2 / cameraScale + 1;
            const h = mainCanvas.height / 2 / cameraScale + 2;
            cameraPos.y = max(cameraPos.y, h - cameraOffset.y);
            if (w * 2 < tileCollisionSize.x)
                cameraPos.x = clamp(cameraPos.x, tileCollisionSize.x - w, w);
        }

        updateParallaxLayers();

        updateSky();
    },
    () => // appRender
    {
        const gradient = mainContext.createLinearGradient(0, 0, 0, mainCanvas.height);
        gradient.addColorStop(0, levelSkyColor.rgba());
        gradient.addColorStop(1, levelSkyHorizonColor.rgba());
        mainContext.fillStyle = gradient;
        mainContext.fillRect(0, 0, mainCanvas.width, mainCanvas.height);

        drawStars();
    },
    () => // appRenderPost
    {
        mainContext.textAlign = 'center';
        // check if any enemies left, and draw them on the radar (the HUD waits for the title screen to close)
        const showHud = document.getElementById('title').hidden;
        const hudY = hudOnTop() ? px(84) : mainCanvas.height - px(40);
        const radarY = hudOnTop() ? px(104) : mainCanvas.height - px(20);
        let enemiesCount = 0;
        for (const o of engineCollideObjects) {
            if (o.isCharacter && o.team == team_enemy) {
                ++enemiesCount;
                if (!showHud) continue;
                const pos = vec2(mainCanvas.width / 2 + (o.pos.x - cameraPos.x) * px(30), radarY);
                drawRectScreenSpace(pos, o.size.scale(px(20)), o.color.scale(1, .6));
            }
        }

        if (!enemiesCount && !levelEndTimer.isSet())
            levelEndTimer.set();

        mainContext.fillStyle = new Color(0, 0, 0).rgba();
        mainContext.font = uiFont(48, 18);
        const gap = uiScale() < .6 ? '   ' : '      ';
        showHud && hudText('Level ' + level + gap + 'Lives ' + playerLives + gap + 'Enemies ' + enemiesCount, mainCanvas.width / 2, hudY);

        if (players.length && playerLives <= 0 && players.every(player => player.isDead())) {
            mainContext.font = uiFont(120, 40);
            hudText('Game Over', mainCanvas.width / 2, mainCanvas.height / 2);
            mainContext.font = uiFont(40, 18);
            players.every(player => player.deadTimer.get() > 3) && hudText(hudOnTop() ? 'Tap Shoot to play again' : 'Press Z or Space to play again',
                mainCanvas.width / 2, mainCanvas.height / 2 + px(max(30, 60 * uiScale())));
        }

        // fade in level transition
        const fade = levelEndTimer.isSet() ? percent(levelEndTimer.get(), 3, 1) : percent(levelTimer.get(), .5, 2);
        drawRect(cameraPos, vec2(1e3), new Color(0, 0, 0, fade))
    });