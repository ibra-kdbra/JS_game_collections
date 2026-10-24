window.onload = function() {
    init();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', releaseControls);
    document.addEventListener('visibilitychange', onLoseFocus);
}

function onLoseFocus() {
    if(document.hidden) {
        releaseControls();
        if(!isGameOver && !isBetweenRounds) isPaused = true;
        rocketSound.stop();
    }
}

function releaseControls() {
    accelerating = false;
    rotatingLeft = false;
    rotatingRight = false;
}

function init() {
    store = GameKit.createStore("moonldr");
    settings = Object.assign(settings, store.get("settings", {}));
    GameKit.initShell({slug: "moonldr"});
    controls = GameKit.createTouchControls({
        dpad: {left: "ArrowLeft", right: "ArrowRight"},
        buttons: [
            {label: "Thrust", key: "ArrowUp"},
            {label: "Pause", key: "p", small: true},
        ],
    });
    controls.hide();

    initTHREE();

    initColliders();
    terrainMaterial = new THREE.MeshBasicMaterial({color: 0xffffff});
    loadTerrain(classicTerrain);
    createBorders();
    createStars();
    initSound();
    initHud();
    initParticles();
    initMenu();

    new ResizeObserver(onWindowResize).observe(stage);
    onWindowResize();

    // Physics runs in fixed 60 Hz steps whatever the display refresh rate.
    loop = GameKit.createLoop({
        update: (dt) => {
            deltaTime = dt;
            update();
        },
        render: render,
    });
    loop.start();
}

function initTHREE() {
    scene = new THREE.Scene();

    camera = new THREE.OrthographicCamera(
        -halfWidth, 
        halfWidth, 
        halfHeight, 
        -halfHeight, 
        0.1, 
        1000 );
    scene.add(camera);
    cameraPositionReset();

    stage = document.getElementById("stage");
    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.autoClear = false;
    stage.appendChild(renderer.domElement);

    const geometry = new THREE.PlaneGeometry(landerScale, landerScale);
    const texture = new THREE.TextureLoader().load('textures/lander.png');
    const material = new THREE.MeshBasicMaterial({map: texture});
    material.transparent = true;
    lander = new THREE.Mesh(geometry, material);
    scene.add(lander);
    lander.visible = false;
}

function initColliders() {
    colliders = new THREE.Group();

    const mainGeometry = new THREE.SphereGeometry(mainScale);
    const smallGeometry = new THREE.SphereGeometry(smallScale);

    const material = new THREE.MeshBasicMaterial({color: 0xffffff});

    let mainCollider = new THREE.Mesh(mainGeometry, material);
    let leftCollider = new THREE.Mesh(smallGeometry, material);
    let rightCollider = new THREE.Mesh(smallGeometry, material);

    colliders.add(mainCollider);
    colliders.add(leftCollider);
    colliders.add(rightCollider);

    const verticalOffset = -mainScale + smallScale;
    leftCollider.position.y = verticalOffset;
    rightCollider.position.y = verticalOffset;

    const horizontalOffset = mainScale - smallScale;
    leftCollider.position.x = -horizontalOffset;
    rightCollider.position.x = horizontalOffset;

    lander.add(colliders);
    colliders.visible = false;
}

function createBorders() {
    let borders = new THREE.Group();
    scene.add(borders);

    const verticalGeometry = new THREE.PlaneGeometry(lineWidth, gameHeight + lineWidth*2);
    const horizontalGeometry = new THREE.PlaneGeometry(gameWidth + lineWidth*2, lineWidth);
    const material = new THREE.MeshBasicMaterial({color: 0xffffff});
    let leftBorder = new THREE.Mesh(verticalGeometry, material);
    let rightBorder = new THREE.Mesh(verticalGeometry, material);
    let topBorder = new THREE.Mesh(horizontalGeometry, material);
    let botBorder = new THREE.Mesh(horizontalGeometry, material);
    borders.add(leftBorder);
    borders.add(rightBorder);
    borders.add(topBorder);
    borders.add(botBorder);

    let verticalOffset = halfWidth + lineWidth/2;
    let horizontalOffset = halfHeight + lineWidth/2;
    leftBorder.position.x = -verticalOffset;
    rightBorder.position.x = verticalOffset;
    topBorder.position.y = horizontalOffset;
    botBorder.position.y = -horizontalOffset;
}

function loadTerrain(points) {
    if(terrainMeshGroup) {
        terrainMeshGroup.children.forEach((mesh) => mesh.geometry.dispose());
        scene.remove(terrainMeshGroup);
    }
    terrainMeshGroup = new THREE.Group();
    scene.add(terrainMeshGroup);
    lineSegments = [];
    heightDifferences = [];

    let i;
    for(i=0; i<points.length-1; i++) {
        placeTerrainSegment(points[i], points[i+1]);
        heightDifferences.push(Math.abs(points[i][1]-points[i+1][1]));
    }
    hideStarsBelowTerrain();
}

function placeTerrainSegment(leftPoint, rightPoint) {
    let leftVector = new THREE.Vector2(leftPoint[0] - halfWidth, leftPoint[1] - halfHeight);
    let rightVector = new THREE.Vector2(rightPoint[0] - halfWidth, rightPoint[1] - halfHeight);

    lineSegments.push([leftVector.clone(), rightVector.clone()]);

    let center = leftVector.add(rightVector).divideScalar(2);
    let distance = leftVector.distanceTo(rightVector);

    const geometry = new THREE.PlaneGeometry(distance*2 + lineWidth/2, lineWidth);
    let terrainMesh = new THREE.Mesh(geometry, terrainMaterial);
    terrainMesh.position.x = center.x;
    terrainMesh.position.y = center.y;

    let direction = rightVector.sub(leftVector);
    let angle = direction.angle();

    terrainMesh.rotation.z = angle;

    terrainMeshGroup.add(terrainMesh);
}

function createStars() {
    let stars = new THREE.Group();
    scene.add(stars);

    const geometry = new THREE.PlaneGeometry(landerScale/10, landerScale/5);
    const material = new THREE.MeshBasicMaterial({color: 0xffffff});
    let i;
    for(i = 0; i < numOfStars; i++) {
        let mesh = new THREE.Mesh(geometry, material);
        stars.add(mesh);
        starMeshes.push(mesh);

        mesh.position.x = (Math.random() - 0.5) * gameWidth;
        mesh.position.y = (Math.random() - 0.5) * gameHeight;
        mesh.position.z = -5;
    }
    hideStarsBelowTerrain();
}

function hideStarsBelowTerrain() {
    starMeshes.forEach((mesh) => {
        mesh.visible = true;
        for(let j = 0; j < lineSegments.length; j++) {
            let leftVector = lineSegments[j][0];
            let rightVector = lineSegments[j][1];

            if(mesh.position.x > leftVector.x && mesh.position.x < rightVector.x) {
                if(mesh.position.y < Math.max(leftVector.y, rightVector.y)) {
                    mesh.visible = false;
                }
                break;
            }
        }
    });
}

// Keep the world undistorted at any aspect ratio. Big screens show the whole
// 800x450 world, letterboxed; small ones show its full height at a readable
// size and follow the lander sideways.
function onWindowResize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if(!w || !h) return;
    renderer.setSize(w, h);

    const wholeWorldScale = Math.min(w / gameWidth, h / gameHeight);
    viewScale = wholeWorldScale >= minWholeWorldScale ? wholeWorldScale : h / gameHeight;
    viewHalfWidth = w / viewScale / 2;
    followCamera = viewHalfWidth < halfWidth;

    camera.left = -viewHalfWidth;
    camera.right = viewHalfWidth;
    camera.top = h / viewScale / 2;
    camera.bottom = -h / viewScale / 2;
    camera.updateProjectionMatrix();
    if(!isZoomed) cameraPositionReset();

    resizeHud();
}

function render() {
    let trajectory;
    if (isDebugOn) {
        trajectory = generateTrajectoryMesh(calculateTrajectory());
        scene.add(trajectory);
    }

    renderer.clear();
    renderer.render(scene, camera);
    renderHud();

    if (isDebugOn) {
        scene.remove(trajectory);
        trajectory.children.forEach((mesh) => mesh.geometry.dispose());
    }
}

function calculateTrajectory() {
    let x0 = lander.position.x;
    let y0 = lander.position.y;
    let tAx = 0;
    let tAy = -gravity;
    let tVx = velocityX;
    let tVy = velocityY;
    const dt = 1.0/60;

    let res = [[x0,y0]];

    while (y0 > -halfHeight) {
        tAx = -tVx * horizontalDragCoef;

        tVx += tAx * dt;
        tVy += tAy * dt;

        const x1 = x0 + tVx*dt;
        const y1 = y0 + tVy*dt;

        res.push([x1,y1]);

        x0 = x1;
        y0 = y1;
    }

    return res;
}

function generateTrajectoryMesh(trajectory) {
    const lineMeshes = new THREE.Group();

    const material = new THREE.MeshBasicMaterial({color: 0xffffff});
    const geometry = new THREE.PlaneGeometry(1, 1);

    for (let i = 0; i < trajectory.length-1; i++) {
        const point0 = trajectory[i];
        const point1 = trajectory[i+1];

        const deltaX = point1[0]-point0[0];
        const deltaY = point1[1]-point0[1];

        const middle = [(point0[0] + point1[0])/2, (point0[1] + point1[1])/2];
        const scale = Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2));
        const angle = Math.atan2(deltaY, deltaX);

        const lineMesh = new THREE.Mesh(geometry, material);

        lineMesh.scale.x = scale;
        lineMesh.scale.y = lineWidth;

        lineMesh.position.x = middle[0];
        lineMesh.position.y = middle[1];

        lineMesh.rotation.z = angle;

        lineMeshes.add(lineMesh);
    }
    
    return lineMeshes;
}

function update() {
    if(isGameOver || isBetweenRounds) {
        updateParticles();
        rocketSound.stop();
        if(isBetweenRounds) {
            betweenRoundTimer -= deltaTime;
            if(betweenRoundTimer <= 0) continueRound();
        }
        return;
    }
    if(isPaused) {
        rocketSound.stop();
        return;
    }

    updateTimer();
    handleMovement();
    checkCollision();
    checkZoom();
    updateParticles();
    updateAmbientSounds(deltaTime);
}

function updateTimer() {
    currentTime += deltaTime;
}

function handleMovement() {
    let rotationDelta = 0;
    
    if(rotatingLeft) rotationDelta += angularVelocity * deltaTime;
    if(rotatingRight) rotationDelta += -angularVelocity * deltaTime;

    lander.rotation.z += rotationDelta;

    if(lander.rotation.z > Math.PI / 2) lander.rotation.z = Math.PI / 2;
    if(lander.rotation.z < -Math.PI / 2) lander.rotation.z = -Math.PI / 2;

    velocityDeltaY = 0;
    velocityDeltaX = 0;

    velocityDeltaY += -gravity * deltaTime;

    if(accelerating && currentFuel > 0) {
        rocketSound.play();

        currentAcceleration += thrusterJerk * deltaTime;
        if(currentAcceleration > thrusterAccelerationMax) currentAcceleration = thrusterAccelerationMax;

        currentAccelerationRatio = currentAcceleration / thrusterAccelerationMax;
        let fuelBurned = currentAccelerationRatio * (fuelConsumptionRateMax - fuelConsumptionRateMin) + fuelConsumptionRateMin;
        currentFuel -= fuelBurned * deltaTime;
        fuelCheck();
        fuelAlertCheck();
    }
    else {
        rocketSound.stop();

        currentAcceleration -= thrusterJerk * deltaTime * accelerationFalloffMultiplier;
        if(currentAcceleration < 0) currentAcceleration = 0;
    }

    landerForward.x = 0;
    landerForward.y = 1;

    landerForward.rotateAround(vector2Zero, lander.rotation.z);
    landerBackDirection.x = -landerForward.x;
    landerBackDirection.y = -landerForward.y;

    velocityDeltaX += -velocityX * horizontalDragCoef * deltaTime;

    velocityDeltaX += landerForward.x * currentAcceleration * deltaTime;
    velocityDeltaY += landerForward.y * currentAcceleration * deltaTime;

    velocityY += velocityDeltaY;
    velocityX += velocityDeltaX;
    
    let positionDeltaY = velocityY * deltaTime
    lander.position.y += positionDeltaY;

    let positionDeltaX = velocityX * deltaTime;
    lander.position.x += positionDeltaX;
}

function checkCollision() {
    borderCheck();
    terrainCheck();
}

function borderCheck() {
    if(lander.position.x < -halfWidth - lineWidth || lander.position.x > halfWidth + lineWidth || lander.position.y < -halfHeight - lineWidth || lander.position.y > halfHeight + lineWidth){
        crashInfo = "OUT OF BOUNDS";
        hasLanded = false;
        crashed();
    }
}

function terrainCheck() {
    let i,j;
    let spheres = colliders.children;
    for(i = 0; i < spheres.length; i++) {
        let worldPosition = new THREE.Vector3();
        spheres[i].getWorldPosition(worldPosition);

        for(j = 0; j < lineSegments.length; j++) {
            let leftVector = lineSegments[j][0];
            let rightVector = lineSegments[j][1];

            if(i == 0 && worldPosition.x > leftVector.x && worldPosition.x < rightVector.x){
                const k = (rightVector.y-leftVector.y)/(rightVector.x-leftVector.x);
                const terrainHeight = leftVector.y + k * (worldPosition.x - leftVector.x);
                altitude = worldPosition.y - mainScale - smallScale - terrainHeight;
                altitude = Math.max(0, altitude);
            }

            let dot = ((worldPosition.x-leftVector.x)*(rightVector.x-leftVector.x) + (worldPosition.y-leftVector.y)*(rightVector.y-leftVector.y)) / leftVector.distanceToSquared(rightVector);
            let closestX, closestY, distanceX, distanceY, distanceSquared;

            closestX = leftVector.x + (dot * (rightVector.x - leftVector.x));
            closestY = leftVector.y + (dot * (rightVector.y - leftVector.y));

            if(closestX < leftVector.x || closestX > rightVector.x || closestY > Math.max(leftVector.y, rightVector.y) || closestY < Math.min(leftVector.y, rightVector.y)) continue;

            distanceX = closestX - worldPosition.x;
            distanceY = closestY - worldPosition.y;
            distanceSquared = distanceX*distanceX + distanceY*distanceY;

            let radius=mainScale;
            if(i>0) radius=smallScale;

            let hitDistance = radius + lineWidth;        

            if(distanceSquared <= hitDistance*hitDistance) {
                hasLanded = true;
                if(Math.min(lander.position.x - leftVector.x, rightVector.x - lander.position.x) < (landerScale*0.38)) {
                    crashInfo = "TOO CLOSE TO EDGE OF TERRAIN";
                    hasLanded = false;
                }
                if(heightDifferences[j] > 0.0001 ) {
                    crashInfo = "CRASHED ON UNEVEN TERRAIN";
                    hasLanded = false;
                }
                if(Math.abs(lander.rotation.z) > difficulty.landingAngleTolerance) {
                    crashInfo = "LANDING ANGLE WAS TOO HIGH";
                    hasLanded = false;
                }
                const tolerance = difficulty.landingVelocityTolerance;
                if(velocityX*velocityX + velocityY*velocityY > tolerance*tolerance) {
                    crashInfo = "LANDING VELOCITY WAS TOO HIGH";
                    hasLanded = false;
                }
                
                if(hasLanded) {
                    landed(j);
                }
                else {
                    crashed();
                }
                return;
            }
        }
    }
}

function fuelCheck() {
    if(currentFuel < 0.0001) {
        currentFuel = 0;
        hasFuel = false;
    }
    else {
        hasFuel = true;
    }
}

function landed(segmentIndex) {
    let mul = scoreMultipliers[segmentIndex];
    scoreChange = scorePerLanding * mul;
    currentScore += scoreChange;

    fuelChange = Math.random() * (fuelGainMax - fuelGainMin) + fuelGainMin;
    fuelChange += fuelGainExtra * mul;

    let fuelCap = difficulty.startingFuel - currentFuel;
    fuelChange = Math.min(fuelChange, fuelCap);
    currentFuel += fuelChange;

    nextRound();
}

function crashed() {
    crashSound.play();
    explosionPS.emit();
    
    fuelChange = (Math.random() * (fuelPenaltyMax - fuelPenaltyMin) + fuelPenaltyMin) * difficulty.fuelPenaltyScale;
    fuelChange = Math.min(fuelChange, currentFuel);
    currentFuel -= fuelChange;

    scoreChange = 0;

    nextRound();
}

function endGame() {
    isGameOver = true;
    isPaused = true;
    lander.visible = false;
    controls.hide();
    zoomOut();

    const best = GameKit.recordBest("moonldr", currentScore, {
        mode: settings.difficulty,
        label: currentScore + " pts (" + difficulty.name + ")",
    });
    lastResult = {score: currentScore, isNew: best.isNew && currentScore > 0, time: currentTime};
    showMenu();
}

function nextRound() {
    isBetweenRounds = true;
    lander.visible = hasLanded;
    releaseControls();

    fuelCheck();
    fuelAlertCheck();

    betweenRoundTimer = betweenRoundPause;
}

function continueRound() {
    isBetweenRounds = false;
    lander.visible = true;

    if(!hasFuel) {
        endGame();
        return;
    }

    respawn();
}

function resetGame() {
    difficulty = difficulties[settings.difficulty];
    gravity = difficulty.gravity;
    thrusterPS.gravity = gravity;
    explosionPS.gravity = gravity;

    currentFuel = difficulty.startingFuel;
    hasFuel = true;
    lander.visible = true;
    isAlerted = false;
    resetCommsTimer();

    currentScore = 0;
    currentTime = 0;
    roundNumber = 0;
    runSeed = (Math.random() * 1e9) >>> 0;

    hideMenu();
    if(GameKit.isTouchFirst()) controls.show();
    respawn();
}

function respawn() {
    velocityX = 0;
    velocityY = 0;
    currentAcceleration = 0;

    releaseControls();

    isGameOver = false;
    isPaused = false;

    // Random terrain changes every round; the run's seed makes it repeatable.
    if(settings.terrain == "random") loadTerrain(generateTerrain(runSeed + roundNumber));
    roundNumber++;

    randomSpawn();
    randomizeScoreMultipliers();
}

function randomSpawn() {
    let randomPositionX;
    let randomPositionY;

    let minX = -halfWidth + horizontalSpawnOffset;
    let maxX = halfWidth - horizontalSpawnOffset;

    if(Math.random() > 0.5) {
        minX = -halfWidth + horizontalSpawnOffset;
        maxX = -middleSpawnOffset;
    }
    else{
        minX = middleSpawnOffset;
        maxX = halfWidth - horizontalSpawnOffset;
    }

    randomPositionX = Math.random() * (maxX - minX) + minX;

    const minY = verticalMiddleSpawnOffset;
    const maxY = halfHeight - verticalTopSpawnOffset;

    randomPositionY = Math.random() * (maxY - minY) + minY;

    let randomRotation;

    randomRotation = (Math.random() - 0.5) * Math.PI; 

    let initialVelocity = Math.random() * (velocityXSpawnMax - velocityXSpawnMin) + velocityXSpawnMin;
    if(randomPositionX > 0) {
        initialVelocity = -initialVelocity;
    }

    lander.position.x = randomPositionX;
    lander.position.y = randomPositionY;
    lander.rotation.z = randomRotation;
    velocityX = initialVelocity;
}

function randomizeScoreMultipliers() {
    let i,j;
    scoreMultipliers = [];
    for(i=0; i < heightDifferences.length; i++) {
        if(heightDifferences[i] > 0.0001) {
            scoreMultipliers[i] = 0;
            continue;
        }

        let p = Math.random();
        let cumulative = 0;
        for(j = 0; j < scoreMultiplierChances.length; j++) {
            cumulative += scoreMultiplierChances[j];
            if(p < cumulative) {
                scoreMultipliers[i] = j+1;
                break;
            }
        }
    }
}

function onKeyDown(event) {
    if(isGameOver) {
        // Enter always launches; Space does too unless a menu button has focus.
        const onBody = document.activeElement == document.body;
        if(!event.repeat && (event.key == "Enter" || (event.key == " " && onBody))) {
            event.preventDefault();
            resetGame();
        }
        return;
    }

    if(event.key=="ArrowUp"){
        accelerating = true;
    }
    if(event.key=="ArrowLeft"){
        rotatingLeft = true;
    }
    if(event.key=="ArrowRight"){
        rotatingRight = true;
    }
    if(event.key.startsWith("Arrow") || event.key == " ") event.preventDefault();

    if(event.key=="p" || event.key=="P" || event.key=="Escape"){
        if(!isBetweenRounds) {
            isPaused = !isPaused;
            if(isPaused) releaseControls();
        }
    }

    if(event.key=="d" && isDebugAllowed){
        toggleDebug();
    }
}

function onKeyUp(event) {
    if(event.key=="ArrowUp"){
        accelerating = false;
    }
    if(event.key=="ArrowLeft"){
        rotatingLeft = false;
    }
    if(event.key=="ArrowRight"){
        rotatingRight = false;
    }
}

function toggleDebug() {
    isDebugOn = !isDebugOn;
    colliders.visible = isDebugOn;
}

function cameraPositionReset() {
    let x = cameraPositionDefault.x;
    if(followCamera && lander) {
        const limit = halfWidth - viewHalfWidth;
        x = Math.max(-limit, Math.min(limit, lander.position.x));
    }
    camera.position.set(x, cameraPositionDefault.y, cameraPositionDefault.z);
}

function checkZoom() {
    if(altitude <= cameraZoomAltitude || (isZoomed && altitude <= cameraZoomOutAltitude)) {
        zoomIn();
    }
    else if(isZoomed && altitude >= cameraZoomOutAltitude) {
        zoomOut();
    }
    else if(followCamera) {
        cameraPositionReset();
    }
}

function zoomIn() {
    isZoomed = true;
    camera.position.set(lander.position.x, lander.position.y - altitude/2, cameraPositionDefault.z);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
}

function zoomOut() {
    if(!isZoomed) return;

    isZoomed = false;
    cameraPositionReset();
    camera.zoom = 1;
    camera.updateProjectionMatrix();
}

function initParticles() {
    thrusterParticleEmitPoint = new THREE.Group();
    lander.add(thrusterParticleEmitPoint);
    thrusterParticleEmitPoint.position.copy(particleEmitPointOffset);
    thrusterPS = new ParticleSystemCone(
        scene, 
        thrusterParticleEmitPoint,
        coneMaxParticles, 
        conePSPerSecondMin, 
        conePSPerSecondMax, 
        conePSLifetimeMin, 
        conePSLifetimeMax, 
        gravity, 
        conePSDragCoefMin, 
        conePSDragCoefMax, 
        landerBackDirection, 
        conePSStartingWidth, 
        conePSAngle, 
        conePSSize,
        conePSMinVelocityMagnitude,
        conePSMaxVelocityMagnitude,
        conePSStartOpacity,
        conePSEndOpacity,
        conePSStartColor,
        conePSEndColor,
        conePSStartScale,
        conePSEndScale
    );
    explosionPS = new ParticleSystemExplosion(
        scene,
        lander,
        explosionPSParticlesMax,
        explosionPSLifetimeMin,
        explosionPSLifetimeMax,
        difficulty.gravity,
        explosionPSDragCoefMin,
        explosionPSDragCoefMax,
        explosionPSSize,
        explosionPSMinVelocityMagnitude,
        explosionPSMaxVelocityMagnitude,
        explosionPSOpacityStart,
        explosionPSOpacityEnd,
        explosionPSColorStart,
        explosionPSColorEnd,
        explosionPSScaleStart,
        explosionPSScaleEnd
    );
}

function updateParticles() {
    thrusterPS.emitting = (accelerating && hasFuel && !isBetweenRounds);
    thrusterPS.initialVelocityX = velocityX;
    thrusterPS.initialVelocityY = velocityY;
    thrusterPS.direction = landerBackDirection;
    thrusterPS.update(deltaTime);

    explosionPS.initialVelocityX = velocityX;
    explosionPS.initialVelocityY = velocityY;
    explosionPS.update(deltaTime);
}

// ---------- Start screen ----------

function initMenu() {
    document.querySelectorAll("[data-opt]").forEach((button) => {
        button.addEventListener("click", () => {
            settings[button.dataset.opt] = button.dataset.value;
            store.set("settings", settings);
            renderMenu();
        });
    });
    document.getElementById("start").addEventListener("click", resetGame);
    renderMenu();
}

function renderMenu() {
    document.querySelectorAll("[data-opt]").forEach((button) => {
        button.setAttribute("aria-pressed", String(settings[button.dataset.opt] == button.dataset.value));
    });
    const best = GameKit.readBests("moonldr")[settings.difficulty];
    document.getElementById("best").textContent =
        "BEST " + difficulties[settings.difficulty].name + "  " + (best ? String(best.value).padStart(4, "0") : "----");

    const result = document.getElementById("result");
    if(lastResult) {
        result.hidden = false;
        result.textContent = "GAME OVER  ·  SCORE " + String(lastResult.score).padStart(4, "0") +
            "  ·  TIME " + formatClock(lastResult.time) + (lastResult.isNew ? "  ·  NEW BEST" : "");
    }
    else {
        result.hidden = true;
    }
}

function showMenu() {
    renderMenu();
    document.getElementById("menu").hidden = false;
}

function hideMenu() {
    document.getElementById("menu").hidden = true;
}
