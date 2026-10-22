// The HUD is a 2D canvas drawn as a texture on a full-screen quad, rendered
// over the world with its own scene and camera. It is created once; resizing
// only resizes the canvas and swaps the texture.
function initHud() {
    cameraHud = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
    sceneHud = new THREE.Scene();
    hudCanvas = document.createElement('canvas');
    hudContext = hudCanvas.getContext('2d');

    hudMaterial = new THREE.MeshBasicMaterial();
    hudMaterial.transparent = true;

    const hudPlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), hudMaterial);
    sceneHud.add(hudPlane);
    resizeHud();
}

function resizeHud() {
    const pixelRatio = renderer.getPixelRatio();
    hudWidth = stage.clientWidth;
    hudHeight = stage.clientHeight;
    hudCanvas.width = Math.round(hudWidth * pixelRatio);
    hudCanvas.height = Math.round(hudHeight * pixelRatio);
    hudContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    if(hudTexture) hudTexture.dispose();
    hudTexture = new THREE.Texture(hudCanvas);
    hudTexture.minFilter = THREE.LinearFilter;
    hudMaterial.map = hudTexture;
    hudMaterial.needsUpdate = true;
}

function renderHud() {
    hudContext.clearRect(0, 0, hudWidth, hudHeight);

    if(!isGameOver) {
        fillLeftInfoPanel();
        fillRightInfoPanel();
        fillMainPanel();
        drawMultipliers();
    }

    hudTexture.needsUpdate = true;
    renderer.render(sceneHud, cameraHud);
}

function isCompactHud() {
    return hudWidth < compactHudWidth;
}

function infoFont() {
    return "Normal " + (isCompactHud() ? infoPanelCompactFontSize : infoPanelFontSize) + "px 'Courier New', monospace";
}

// Info lines start below the Game Lab buttons in the top-left corner.
function infoLineY(line) {
    const step = Math.max(hudHeight * infoPanelRelativeOffsetYStep, (isCompactHud() ? infoPanelCompactFontSize : infoPanelFontSize) * 1.3);
    return Math.max(hudHeight * infoPanelRelativeOffsetY, hudShellClearance) + line * step;
}

function formatClock(seconds) {
    const whole = Math.floor(seconds);
    return Math.floor(whole / 60) + ":" + String(whole % 60).padStart(2, "0");
}

function fillLeftInfoPanel() {
    hudContext.textAlign = 'left';
    hudContext.fillStyle = infoPanelTextColor;
    hudContext.font = infoFont();
    const x = hudWidth * infoPanelRelativeOffsetX;
    const pad = isCompactHud() ? 6 : 7;
    hudContext.fillText("SCORE".padEnd(pad, " ") + currentScore.toString().padStart(4, "0"), x, infoLineY(0));
    hudContext.fillText("TIME".padEnd(pad, " ") + formatClock(currentTime), x, infoLineY(1));
    hudContext.fillText("FUEL".padEnd(pad, " ") + currentFuel.toFixed(0).padStart(4, "0"), x, infoLineY(2));
    if(isAlerted) {
        hudContext.fillText(hasFuel ? "LOW ON FUEL" : "OUT OF FUEL", x, infoLineY(3));
    }
}

function fillRightInfoPanel() {
    hudContext.textAlign = 'right';
    hudContext.fillStyle = infoPanelTextColor;
    hudContext.font = infoFont();
    const x = hudWidth * (1 - infoPanelRelativeOffsetX);
    const compact = isCompactHud();
    const labels = compact
        ? ["ALT", "H SPD", "V SPD", "ANGLE"]
        : ["ALTITUDE", "HORIZONTAL SPEED", "VERTICAL SPEED", "ROTATION ANGLE"];
    const pad = compact ? 6 : 18;
    hudContext.fillText(labels[0].padEnd(compact ? pad : 20, " ") + altitude.toFixed(0).padStart(4, "0"), x, infoLineY(0));
    hudContext.fillText(labels[1].padEnd(pad, " ") + velocityX.toFixed(1).padStart(6, " "), x, infoLineY(1));
    hudContext.fillText(labels[2].padEnd(pad, " ") + (-velocityY).toFixed(1).padStart(6, " "), x, infoLineY(2));
    hudContext.fillText(labels[3].padEnd(pad, " ") + (-lander.rotation.z * (180/Math.PI)).toFixed(1).padStart(6, " "), x, infoLineY(3));
}

function fillMainPanel() {
    hudContext.textAlign = 'center';
    const fontSize = Math.min(statsPanelFontSize, hudWidth / 22);
    hudContext.font = "Normal " + fontSize + "px 'Courier New', monospace";
    hudContext.fillStyle = statsPanelTextColor;
    const x = hudWidth * statsPanelRelativeOffsetX;
    const lineY = (line) => hudHeight * statsPanelRelativeOffsetY + line * Math.max(hudHeight * statsPanelRelativeOffsetYStep, fontSize * 1.3);

    if(isPaused && !isBetweenRounds) {
        hudContext.fillText("PAUSED", x, lineY(0));
        hudContext.fillText(controls && !controls.el.hidden ? "TAP PAUSE TO CONTINUE" : "PRESS P TO CONTINUE", x, lineY(1));
        return;
    }
    if(!isBetweenRounds) return;

    let landingText, scoreText, fuelText;
    let gameOverText = "";
    if(hasLanded) {
        landingText = "SUCCESSFULLY LANDED";
        fuelText = fuelChange.toFixed(0) + " FUEL UNITS GAINED";
        scoreText = scoreChange + " POINTS GAINED";
    }
    else {
        landingText = "LANDER DESTROYED";
        fuelText = fuelChange.toFixed(0) + " FUEL UNITS LOST";
        scoreText = crashInfo;
        if(!hasFuel) {
            fuelText = "OUT OF FUEL";
            gameOverText = "GAME OVER";
        }
    }

    hudContext.fillText(landingText, x, lineY(0));
    hudContext.fillText(scoreText, x, lineY(1));
    hudContext.fillText(fuelText, x, lineY(2));
    hudContext.fillText(gameOverText, x, lineY(3));
}

function drawMultipliers() {
    hudContext.textAlign = 'center';
    hudContext.fillStyle = multiplierFontColor;

    let fontSize = multiplierFontSize * Math.min(1.2, Math.max(0.85, viewScale));
    if(isZoomed) fontSize *= zoom;
    hudContext.font = "Normal " + fontSize + "px 'Courier New', monospace";
    for(let i = 0; i < scoreMultipliers.length; i++) {
        let mul = scoreMultipliers[i];
        if(mul < 2) continue;

        let leftVector = lineSegments[i][0];
        let rightVector = lineSegments[i][1];
        let hudPoint = worldToHudCoord((leftVector.x + rightVector.x) / 2, leftVector.y);
        // Labels sit under their pad, or above it when the pad is at the bottom edge.
        let labelY = hudPoint[1] + fontSize;
        if(labelY > hudHeight - 2) labelY = hudPoint[1] - fontSize * 0.4;
        hudContext.fillText("X" + mul, hudPoint[0], labelY);
    }
}

const hudProjection = new THREE.Vector3();

// World position to HUD pixels, through the world camera (handles zoom and follow).
function worldToHudCoord(wx, wy) {
    hudProjection.set(wx, wy, 0).project(camera);
    return [(hudProjection.x + 1) / 2 * hudWidth, (1 - hudProjection.y) / 2 * hudHeight];
}
