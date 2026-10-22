'use strict';

const clampCamera = !debug;
const lowGraphicsSettings = glOverlay = !window['chrome']; // only chromium uses high settings
const defaultCameraScale = 4 * 16;
// Zoom out on small screens so a phone still shows about 12 tiles across its short side.
// Steps of 8 keep the 8px pixel art crisp.
const fitCameraScale = () => clamp((min(mainCanvas.width, mainCanvas.height) / 12 / 8 | 0) * 8, defaultCameraScale, 32);
const maxPlayers = 4;

const team_none = 0;
const team_player = 1;
const team_enemy = 2;

let updateWindowSize, renderWindowSize, gameplayWindowSize;

// Text is sized for a ~1000x700 screen and scales down on smaller ones.
const uiScale = () => min(1, min(mainCanvas.width / 1000, mainCanvas.height / 700));
const uiFont = (px, minPx = 0) => max(minPx, px * uiScale()) + "px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
// On touch screens the on-screen controls cover the bottom, so the HUD moves to the top.
const hudOnTop = () => document.documentElement.classList.contains('gk-has-touch');

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

        gameplayWindowSize = vec2(mainCanvas.width, mainCanvas.height).scale(1 / defaultCameraScale);
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
        if (players.length == 1) {
            const player = players[0];
            if (!player.isDead())
                cameraPos = cameraPos.lerp(player.pos, clamp(player.getAliveTime() / 2));
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
                cameraPos = cameraPos.lerp(posTotal.scale(1 / playerCount), .2);
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
            cameraPos.y = max(cameraPos.y, h);
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
        // check if any enemies left, and draw them on the radar
        const hudY = hudOnTop() ? 84 : mainCanvas.height - 40;
        const radarY = hudOnTop() ? 104 : mainCanvas.height - 20;
        let enemiesCount = 0;
        for (const o of engineCollideObjects) {
            if (o.isCharacter && o.team == team_enemy) {
                ++enemiesCount;
                const pos = vec2(mainCanvas.width / 2 + (o.pos.x - cameraPos.x) * 30, radarY);
                drawRectScreenSpace(pos, o.size.scale(20), o.color.scale(1, .6));
            }
        }

        if (!enemiesCount && !levelEndTimer.isSet())
            levelEndTimer.set();

        mainContext.fillStyle = new Color(0, 0, 0).rgba();
        mainContext.font = uiFont(48, 18);
        const gap = uiScale() < .6 ? '   ' : '      ';
        mainContext.fillText('Level ' + level + gap + 'Lives ' + playerLives + gap + 'Enemies ' + enemiesCount, mainCanvas.width / 2, hudY);

        if (players.length && playerLives <= 0 && players.every(player => player.isDead())) {
            mainContext.font = uiFont(120, 40);
            mainContext.fillText('Game Over', mainCanvas.width / 2, mainCanvas.height / 2);
            mainContext.font = uiFont(40, 18);
            players.every(player => player.deadTimer.get() > 3) && mainContext.fillText(hudOnTop() ? 'Tap Shoot to play again' : 'Press Z or Space to play again',
                mainCanvas.width / 2, mainCanvas.height / 2 + max(30, 60 * uiScale()));
        }

        // fade in level transition
        const fade = levelEndTimer.isSet() ? percent(levelEndTimer.get(), 3, 1) : percent(levelTimer.get(), .5, 2);
        drawRect(cameraPos, vec2(1e3), new Color(0, 0, 0, fade))
    });