"use strict";

let textBlock = document.getElementById('text');

const tileXsize = 20;
const tileYsize = 20;

// ---------- Tuning ----------
// Every timer counts fixed logic steps (60 per second); actors advance on
// every `actorEvery`-th step, as the original frame-counted loop did at 60 Hz.
const STEPS_PER_SECOND = 60;
const ANNOUNCE_STEPS   = 150;  // wave banner time before spawning starts
const CLEAR_STEPS      = 120;  // "wave clear" banner time
const COMBO_STEP       = 0.25; // multiplier gained per successful symbol
const COMBO_MAX        = 7.5;

const ENEMY_KINDS = {
  classic:  {speed: 2, tint: null,      points: 0},
  sprinter: {speed: 3, tint: '#FF5A8C', points: 10},
  brute:    {speed: 1, tint: '#4FA3FF', points: 30},
};

// One new thing per wave: symbols join the pool, enemy kinds join the mix.
const SYMBOL_UNLOCKS = [
  {wave: 1, token: gestures.swypeLR},
  {wave: 1, token: gestures.swypeTD},
  {wave: 2, token: gestures.swypeDTD},
  {wave: 3, token: gestures.swypeTDT},
  {wave: 5, token: gestures.slash},
  {wave: 6, token: gestures.backslash},
  {wave: 8, token: gestures.circle},
];
const KIND_UNLOCKS = {sprinter: 4, brute: 7};
const KIND_INTROS = {
  sprinter: ['Sprinters!', 'Faster, but only one or two symbols'],
  brute:    ['Brutes!', 'Slow, but they carry a long chain of symbols'],
};

function waveSpec(wave){
  return {
    count:      3 + wave*2,                               // Pac-Men in the wave
    spawnEvery: Math.max(30, 84 - wave*6),                // steps between spawn groups
    group:      Math.min(1 + Math.floor((wave - 1)/3), 3), // Pac-Men per spawn group
    maxTokens:  Math.min(1 + Math.floor(wave/2), 4),      // longest chain on a classic
    actorEvery: wave >= 10 ? 3 : 4,                       // from wave 10 everything moves faster
  };
}

let atlas, finger, fingerR;

let canvasM = document.getElementById('map');
let canvasA = document.getElementById('act');
let canvasT = document.getElementById('txt');
let ctxM = canvasM.getContext('2d'); //background
let ctxA = canvasA.getContext('2d'); //actors
let ctxT = canvasT.getContext('2d'); //text

let canvasArray = [canvasM, canvasA, canvasT];

let hud = document.getElementById('hud');
let scoreDisplay = document.getElementById('score');
let waveDisplay = document.getElementById('wave');
let comboDisplay = document.getElementById('combo');
let comboFill = document.getElementById('comboFill');
let banner = document.getElementById('banner');
let pauseScreen = document.getElementById('pauseScreen');
let startButton = document.getElementById('start');
let muteButton = document.getElementById('mute');
let pauseButton = document.getElementById('pause');

let store = GameKit.createStore('pacman-slasher');
GameKit.migrateKey(store, 'sound', 'sound', {parse: Number});
GameKit.migrateKey(store, 'high', 'best', {parse: Number});

let sounds = {opening: null, gesture: null, hurt: null, extralive: null, die: null};
let canSound = store.get('sound', 1) ? 1 : 0;

function pick(list){
  return list[Math.floor(Math.random()*list.length)];
}

function randomInt(min, max){
  return min + Math.floor(Math.random()*(max - min + 1));
}

let engine = (function (){
  const tolerance = 20;

  let map = {width: 0, height: 0, offsetX: 0, offsetY: 0, scale: 0, orient: 1, data: []};
  let path = [];
  let mouseIsDown = false, isActive = false, paused = false, needForceDraw = false;
  let currTick = 0, hintTick = 0, requestID = 0;
  let stepper = GameKit.createStepper(STEPS_PER_SECOND);

  let maxEnemy = 0, enemyOffset = Math.floor(Math.random()*4);

  let score = 0, multipler = 1;
  let highScore = Number(store.get('best', 0)) || 0;

  // 'demo' is the first-run tutorial, 'waves' the real game
  let mode = 'waves';
  let wave = 0, spec = waveSpec(1), wavePhase = 'announce', phaseTimer = 0, toSpawn = 0, spawnTimer = 0;

  let player = {}, enemies = [], enemyPositions = [];

  let realWidth  = canvasM.scrollWidth;
  let realHeight = canvasM.scrollHeight;

  let bonusTick = 0, bonus = null;

  function setSound(on){
    canSound = on ? 1 : 0;
    store.set('sound', canSound);
    Howler.mute(!canSound);
    muteButton.setAttribute('aria-pressed', String(!canSound));
    muteButton.setAttribute('aria-label', canSound ? 'Mute' : 'Unmute');
    muteButton.classList.toggle('is-off', !canSound);
  }

  function updateHud(){
    scoreDisplay.textContent = score;
    waveDisplay.textContent = mode == 'demo' ? 'Practice' : 'Wave ' + wave;
    comboDisplay.textContent = 'x' + multipler.toFixed(2).replace(/\.?0+$/, '');
    comboFill.style.width = ((multipler - 1)/(COMBO_MAX - 1)*100) + '%';
    hud.classList.toggle('is-hot', multipler >= 3);
  }

  function generateMap(){
    let i,j,k,s,r,l;
    map.data = [[],[]];
    for (i=0; i<map.height; i++){
      map.data[0].push(new Int8Array(map.width));
      map.data[1].push(new Int8Array(map.width));
      for (j=0; j<map.width; j++){
        map.data[0][i][j] = 0;
        map.data[1][i][j] = 0;
      }
    }

    for (i = 1; i < Math.ceil(map.height/2) - 1; i++){
      for (j = 1; j < Math.ceil(map.width/2) - 1; j++){
        if (map.data[0][i-1][j] == 0 && map.data[0][i][j-1] == 0 && map.data[0][i-1][j+1] == 0 && map.data[0][i-1][j-1] == 0){
          k = 1; map.data[0][i][j] = 1; l = 0;
        }
        else if ((k > 4) || map.data[0][i][j-1] > 5 || map.data[0][i-1][j] > 4 || (map.data[0][i-1][j] > 0 && map.data[0][i][j-1] > 0)){
          k = 0; l = 0;
        }
        else if (map.data[0][i-1][j+1] > 0 && map.data[0][i-1][j] == 0){
          k = 0; l = 0;
        }
        else if (map.data[0][i-1][j] > 0 && map.data[0][i][j-1] == 0 && map.data[0][i][j+1] == 0){
          if (Math.random() > map.data[0][i-1][j]*0.25){
            k = 1; map.data[0][i][j] = map.data[0][i-1][j] + 1; l = 1;
          }
          else {k = 0; l = 0;}
        }
        else {
          if (Math.random() > 0.8 || k == 1){
            k++; map.data[0][i][j] = map.data[0][i][j-1] + 1;
          }
          else {k = 0; l = 0;}
        }
      }
    }
    for (i = Math.ceil(map.height/2) - 2; i <= Math.ceil(map.height/2); i++){
      for (j = Math.ceil(map.width/2) - 2; j <= Math.ceil(map.width/2); j++){
        map.data[0][i][j] = 0;
      }
    }


    for (i = Math.floor(map.height/2); i >= 0; i--){
      for (j = Math.floor(map.width/2); j >= 0; j--){
        map.data[0][map.height - i - 1][j] = map.data[0][i][j];
        map.data[0][i][map.width - j - 1]  = map.data[0][i][j];
        map.data[0][map.height - i - 1][map.width - j - 1] = map.data[0][i][j];
      }
    }

    //mark tiles
    i = map.height - 1;
    for (j = map.width - 2; j>=0; j--){
      if (map.data[0][i][j] && map.data[0][i][j+1]){
        map.data[1][i][j] += 2; map.data[1][i][j+1] += 8;
      }
    }
    for (i = map.height - 2; i>=0; i--){
      j = map.width - 1;
      if (map.data[0][i][j] && map.data[0][i+1][j]){
        map.data[1][i][j] += 4; map.data[1][i+1][j] += 1;
      }
      for (j = map.width - 2; j>=0; j--){
        if (map.data[0][i][j]){
          if (map.data[0][i][j+1]){
            map.data[1][i][j] += 2; map.data[1][i][j+1] += 8;
          }
          if (map.data[0][i+1][j]){
            map.data[1][i][j] += 4; map.data[1][i+1][j] += 1;
          }
        }
      }
    }
  }

  function drawMap(){
    let i, j, x = 0, y = 0, xs = tileXsize*map.scale, ys = tileYsize*map.scale;
    ctxM.clearRect(0, 0, realWidth, realHeight);
    
    if (!map.orient){
      ctxM.translate(realWidth/2,realHeight/2);
      ctxM.rotate(Math.PI/2);
      ctxM.translate(-realHeight/2,-realWidth/2);
    }
    for (i=0; i<map.height; i++){ 
      for (j=0; j<map.width; j++){
        if (map.orient){
          ctxM.drawImage(atlas, ~~(map.data[1][i][j]&7)*tileXsize, ~~((map.data[1][i][j]>>3)+5)*tileYsize, tileXsize, tileYsize, map.offsetX+x, map.offsetY+y, xs, ys);
        }
        else{
          ctxM.drawImage(atlas, ~~(map.data[1][j][i]&7)*tileXsize, ~~((map.data[1][j][i]>>3)+5)*tileYsize, tileXsize, tileYsize, map.offsetY+y, map.offsetX+x, xs, ys); 
        }
        x += tileXsize*map.scale;
      }
      x = 0; y += tileYsize*map.scale;
    }
    if (!map.orient){ ctxM.setTransform(1,0,0,1,0,0); }
  }

  function updateCanvasSize(force = false){
    if (isActive || force === true ){
      realWidth  = canvasM.scrollWidth;
      realHeight = canvasM.scrollHeight;
      let pixelRatio = window.devicePixelRatio;
      let i;

      for (i=0; i<canvasArray.length; i++){
        canvasArray[i].width  = realWidth;
        canvasArray[i].height = realHeight;
      }

      map.scale = pixelRatio + Math.floor(realWidth/1000);
      if (map.scale < 2){ map.scale = 2;}

      if ((realWidth - map.width*tileXsize*map.scale) < 0 || (realHeight - map.height*tileYsize*map.scale) < 0){
        while (map.scale > 1 && ((realWidth  - map.width*tileXsize*map.scale) < 0 || (realHeight - map.height*tileYsize*map.scale) < 0)){
          map.scale--;
        }
      }
      else{
        while ((realWidth - map.width*tileXsize*(map.scale+1)) > realWidth*0.15 && (realHeight - map.height*tileYsize*(map.scale+1)) > realHeight*0.15){
          map.scale++;
        }
      }

      map.offsetX = Math.ceil((realWidth  - map.width*tileXsize*map.scale)/2);
      map.offsetY = Math.ceil((realHeight - map.height*tileYsize*map.scale)/2);

      needForceDraw = true;
    }
    else{
      ctxA.clearRect(0, 0, realWidth, realHeight);
    }
  }

  function rotate(){
    realWidth  = canvasM.scrollWidth;
    realHeight = canvasM.scrollHeight;
    if (isActive){
      let i;
      i = map.width; map.width = map.height; map.height = i;
      map.orient ^= 1;
      i = player.x; player.newX = player.y; player.newY = i;
      for (i = enemies.length - 1; i >= 0; i--) {
        enemies[i].rotate();
      }

      enemyPositions = [[Math.ceil((map.width - 0.5)*tileXsize), Math.ceil((map.height/2 - 0.5)*tileYsize)],
                      [0, Math.ceil((map.height/2 - 0.5)*tileYsize)],
                      [Math.ceil((map.width/2 - 0.5)*tileXsize), Math.ceil((map.height - 0.5)*tileYsize)],
                      [Math.ceil((map.width/2 - 0.5)*tileXsize), 0]];
    }
  }

  function damagePlayer(){
    let res = 0;
    player.health--;
    multipler = 1;
    updateHud();
    if (player.health == 0){
      stopGame(); res = 1;
    }
    else{
      player.changeAction(act.damaged);
      sounds.hurt.play();
    }
    return res;
  }

  function drawMousePath(){
    let i;
    if (path.length > 1){
      let color = gestureColors[cogniteGesture(simplifyPath(path, tolerance))];
      ctxT.clearRect(0, 0, realWidth, realHeight);
      ctxT.beginPath();
      ctxT.strokeStyle = color;
      ctxT.lineCap  = "round";
      ctxT.lineJoin = "round";
      ctxT.lineWidth = 4*map.scale;
      ctxT.moveTo(path[0].x, path[0].y);
      for (i = 1; i < path.length; i++){
        ctxT.lineTo(path[i].x, path[i].y);
      }
      ctxT.stroke();
      ctxT.closePath();
    }
  }

  function drawHint(s){
    let x, y;
    if (path.length == 0){
      ctxT.clearRect(0, 0, realWidth, realHeight);
    }
    if (enemies.length && enemies[0].action == act.idle){
      ctxT.beginPath();
      ctxT.strokeStyle = 'white';
      ctxT.lineCap  = "round";
      ctxT.lineJoin = "round";
      ctxT.lineWidth = 4*map.scale;
      if (enemies[0].tokens[0] == gestures.swypeLR){
        x = map.offsetX + (player.x - tileXsize)*map.scale;
        y = map.offsetY + (player.y - tileYsize)*map.scale;
        ctxT.moveTo(x, y);
        x += s*1.5*map.scale;
      }
      else if (enemies[0].tokens[0] == gestures.swypeTD){
        x = map.offsetX + (player.x + tileXsize*2)*map.scale;
        y = map.offsetY + (player.y - tileYsize*2.5)*map.scale;
        ctxT.moveTo(x, y);
        y += s*map.scale;
      }
      ctxT.lineTo(x, y);
      ctxT.stroke();
      ctxT.closePath();
      ctxT.drawImage(finger, x - 4, y);

      x = map.offsetX + (enemies[0].x - tileXsize/8)*map.scale;
      y = map.offsetY + (enemies[0].y - tileYsize*2)*map.scale;
      ctxT.drawImage(fingerR, x, y + Math.abs(20 - s));
    }
  }

  // ---------- Waves ----------

  function showBanner(title, lines, draw){
    banner.textContent = '';
    let h = document.createElement('p');
    h.className = 'big';
    h.textContent = title;
    banner.append(h);
    if (draw){
      let c = document.createElement('canvas');
      c.width = 72; c.height = 72;
      c.className = 'banner-icon';
      let g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      draw(g);
      banner.append(c);
    }
    for (let line of lines){
      let p = document.createElement('p');
      p.textContent = line;
      banner.append(p);
    }
    banner.classList.remove('hidden');
    banner.getBoundingClientRect(); // restart the fade-in
    banner.classList.add('is-showing');
  }

  function hideBanner(){
    banner.classList.remove('is-showing');
  }

  function unlockedSymbols(n){
    return SYMBOL_UNLOCKS.filter(u => u.wave <= n).map(u => u.token);
  }

  function beginWave(n){
    wave = n;
    spec = waveSpec(n);
    toSpawn = spec.count;
    spawnTimer = 0;
    wavePhase = 'announce';
    phaseTimer = ANNOUNCE_STEPS;
    updateHud();

    let fresh = SYMBOL_UNLOCKS.filter(u => u.wave == n && n > 1);
    let kind = Object.keys(KIND_UNLOCKS).find(k => KIND_UNLOCKS[k] == n);
    if (fresh.length){
      showBanner('Wave ' + n, ['New symbol: draw it anywhere'],
        g => drawSymbol(g, fresh[0].token, (72 - symbolWidth(fresh[0].token)*4)/2, 10, 4));
    }
    else if (kind){
      showBanner('Wave ' + n, KIND_INTROS[kind],
        g => g.drawImage(tintedAtlas(ENEMY_KINDS[kind].tint), 0, tileYsize*2, tileXsize, tileYsize, 6, 6, 60, 60));
    }
    else if (n == 1){
      showBanner('Wave 1', ['Draw the symbol above a Pac-Man', 'anywhere to slash it']);
    }
    else if (spec.actorEvery < waveSpec(n - 1).actorEvery){
      showBanner('Wave ' + n, ['Everything moves faster now']);
    }
    else{
      showBanner('Wave ' + n, [spec.count + ' Pac-Men incoming']);
    }
  }

  function finishWave(){
    let lines = [];
    let reward = 50*wave;
    if (player.health < 3){
      player.health++;
      sounds.extralive.play();
      lines.push('+1 life');
    }
    else{
      reward *= 2;
    }
    score += reward;
    lines.unshift('+' + reward + ' points');
    updateHud();
    wavePhase = 'clear';
    phaseTimer = CLEAR_STEPS;
    showBanner('Wave ' + wave + ' clear!', lines);
  }

  function pickKind(){
    let pool = [['classic', 6]];
    if (wave >= KIND_UNLOCKS.sprinter){ pool.push(['sprinter', Math.min(wave - KIND_UNLOCKS.sprinter + 1, 4)]); }
    if (wave >= KIND_UNLOCKS.brute){ pool.push(['brute', Math.min(wave - KIND_UNLOCKS.brute + 1, 3)]); }
    let r = Math.random()*pool.reduce((sum, p) => sum + p[1], 0);
    for (let [kind, weight] of pool){
      r -= weight;
      if (r < 0){ return kind; }
    }
    return 'classic';
  }

  function makeTokens(kind){
    let symbols = unlockedSymbols(wave);
    let fresh = SYMBOL_UNLOCKS.filter(u => u.wave == wave && wave > 1).map(u => u.token);
    let count;
    if (kind == 'sprinter'){ count = randomInt(1, Math.min(2, spec.maxTokens)); }
    else if (kind == 'brute'){ count = randomInt(Math.max(3, spec.maxTokens), spec.maxTokens + 2); }
    else{ count = randomInt(1, spec.maxTokens); }
    let tokens = [];
    for (let i = 0; i < count; i++){
      // A freshly unlocked symbol shows up often during its first wave.
      tokens.push(fresh.length && Math.random() < 0.45 ? pick(fresh) : pick(symbols));
    }
    return tokens;
  }

  function spawnEnemy(){
    let kind = pickKind();
    let p = enemyPositions[enemyOffset];
    enemies.push(new Pacman(p[0], p[1], enemyOffset, player.x, player.y, makeTokens(kind), act.move, ENEMY_KINDS[kind]));
    enemyOffset = (enemyOffset + 1) % 4;
  }

  function stepWave(){
    if (wavePhase == 'announce'){
      if (--phaseTimer <= 0){
        wavePhase = 'fight';
        hideBanner();
      }
    }
    else if (wavePhase == 'fight'){
      if (toSpawn > 0 && --spawnTimer <= 0){
        for (let g = 0; g < spec.group && toSpawn > 0 && enemies.length < maxEnemy; g++){
          spawnEnemy();
          toSpawn--;
        }
        spawnTimer = spec.spawnEvery;
      }
      if (toSpawn == 0 && enemies.length == 0){
        finishWave();
      }
    }
    else if (wavePhase == 'clear'){
      if (--phaseTimer <= 0){
        hideBanner();
        beginWave(wave + 1);
      }
    }
  }

  function stepBonus(){
    let i, j, n;
    bonusTick--;
    if (bonusTick == 0){
      bonusTick = Math.floor(12+Math.random()*(7+wave*2))*STEPS_PER_SECOND;
      do{
        i = Math.floor(Math.random()*(map.height/2-1));
        j = Math.floor(Math.random()*(map.width/2-1));
      } while(map.data[0][i][j] != 0);
      n = Math.floor(Math.random()*4);
      if (n > 1){ i = map.height - i - 1;}
      if (n & 1){ j = map.width  - j - 1;}
      bonus = new Bonus(j*tileXsize, i*tileYsize, Math.floor(Math.random()*2), [gestures.swypeTLRD], 60);
    }
  }

  // ---------- Loop ----------

  function stepActors(){
    let i, j, n, dmin;
    player.clear(); player.tick(); dmin = 100000; n = -1;
    for (i = enemies.length - 1; i >= 0; i--) { enemies[i].clear(); enemies[i].tick();}
    if (!isActive){ return; }
    if (bonus != null) {bonus.clear(); bonus.tick();}
    for (i = enemies.length - 1; i >= 0; i--) {
      if (enemies[i].active){
        enemies[i].draw();
      }
      else{
        enemies.splice(i, 1);
      }
    }
    if (bonus != null) {
      if (bonus.liveTime){
        bonus.draw();
      }
      else{
        bonus = null;
      }
    }
    for (i = enemies.length - 1; i >= 0; i--) {
      if (enemies[i].active && enemies[i].action != act.die){
        j = getDistance(enemies[i], player);
        if (j<dmin){ dmin = j; n = i;}
      }
    }
    if (n >= 0){player.lookAtEnemy(enemies[n]);}
    player.draw();
  }

  function step(){
    if (!isActive){ return; }
    currTick++;
    if (mode == 'demo'){
      if (currTick % 2 == 0){ hintTick = (hintTick + 1) % 40; }
    }
    else{
      stepWave();
      stepBonus();
    }
    if (isActive && currTick >= spec.actorEvery){
      currTick = 0;
      stepActors();
      if (mode == 'demo' && enemies.length == 0){
        mode = 'waves';
        beginWave(1);
      }
    }
  }

  function frame(now){
    if (!isActive){ return; }
    requestID = requestAnimationFrame(frame);
    if (needForceDraw){
      drawMap();
      needForceDraw = false;
    }
    if (paused){ return; }
    stepper.advance(now, step);
    if (!isActive){ return; }
    drawMousePath();
    if (mode == 'demo'){ drawHint(hintTick); }
  }

  function setPaused(value){
    if (!isActive || paused == value){ return; }
    paused = value;
    mouseIsDown = false;
    path = [];
    ctxT.clearRect(0, 0, realWidth, realHeight);
    stepper.reset();
    pauseScreen.classList.toggle('hidden', !paused);
    pauseButton.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
    if (paused){
      pauseScreen.querySelector('button').focus();
    }
  }

  function startGame(){
    score = 0; multipler = 1;
    isActive = true; paused = false; currTick = 0; hintTick = 0;
    bonus = null; bonusTick = Math.floor(7+Math.random()*7)*STEPS_PER_SECOND;
    stepper.reset();
    if (highScore == 0){
      mode = 'demo';
      spec = waveSpec(1);
      wave = 0;
      enemies.push(new Pacman(enemyPositions[2][0]>>1, enemyPositions[1][1], 1, player.x, player.y, [gestures.swypeLR], act.idle));
      enemies.push(new Pacman((enemyPositions[0][0]>>2)*3, enemyPositions[0][1], 0, player.x, player.y, [gestures.swypeTD], act.idle));
      updateHud();
    }
    else{
      mode = 'waves';
      beginWave(1);
    }
    requestID = requestAnimationFrame(frame);
  }

  function stopGame(){
    let text;
    sounds.die.play();
    isActive = false;
    paused = false;
    cancelAnimationFrame(requestID);
    let reached = mode == 'demo' ? 'Practice' : 'Wave ' + wave;
    GameKit.recordBest('pacman-slasher', score, {label: score + ' pts, ' + reached.toLowerCase()});
    if (score > highScore){
      store.set('best', score);
      highScore = score;
      text = "<p class='big'>New record!</p><p>High score : "+score+"</p><p>Reached : "+reached+"</p><p>Try again ;)</p>";
    }
    else{
      if (score > highScore/2){
        text = "<p class='big'>Not bad!</p>";
      }
      else{
        text = "<p class='big'>Cheer up!</p>";
      }
      text += "<p>Your score : "+score+"</p><p>Reached : "+reached+"</p><p>High score : "+highScore+"</p><p>Try again ;)</p>";
    }
    textBlock.innerHTML = text;
    ctxM.clearRect(0, 0, realWidth, realHeight);
    ctxA.clearRect(0, 0, realWidth, realHeight);
    ctxT.clearRect(0, 0, realWidth, realHeight);
    banner.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    textBlock.classList.remove('hidden');
    startButton.classList.remove('hidden');
    hud.classList.add('hidden');
    pauseButton.classList.add('hidden');
    startButton.focus();
  }

  function init(){
    realWidth  = canvasM.scrollWidth;
    realHeight = canvasM.scrollHeight;
    let pixelRatio = window.devicePixelRatio;

    map.orient = 1;
    map.scale = pixelRatio + Math.floor(realWidth/1000);
    if (pixelRatio == 3 && realWidth > realHeight){ map.scale--; }
    if (map.scale < 2){ map.scale = 2;}

    map.width  = Math.floor(realWidth*0.75/(tileXsize*map.scale));
    map.height = Math.floor(realHeight*0.75/(tileYsize*map.scale));
    maxEnemy = Math.max(Math.min(Math.floor((map.width + map.height)/6), 6), 4);
    if (map.width < 12){map.width += 2;}
    if (map.height < 12){map.height += 2;}

    updateCanvasSize(true);
    generateMap();

    enemyPositions = [[Math.ceil((map.width - 0.5)*tileXsize), Math.ceil((map.height/2 - 0.5)*tileYsize)],
                      [0, Math.ceil((map.height/2 - 0.5)*tileYsize)],
                      [Math.ceil((map.width/2 - 0.5)*tileXsize), Math.ceil((map.height - 0.5)*tileYsize)],
                      [Math.ceil((map.width/2 - 0.5)*tileXsize), 0]];

    player = new Ghost(Math.ceil((map.width/2 - 0.5)*tileXsize), Math.ceil((map.height/2 - 0.5)*tileYsize));
    enemies = [];
  }

  function applyGesture(g) {
    let i, r, b = 0, result = 0;
    if (isActive){
      if (g){
        for (i = enemies.length - 1; i >= 0; i--) {
          if (enemies[i].active && enemies[i].action != act.die){
            r = enemies[i].checkGesture(g);
            if (r == 1){
              result += 10;
            }
            else if (r == 2){
              result += 20 + enemies[i].kind.points;
            }
          }
        }
        if (bonus != null){b = bonus.checkGesture(g);}
        if (result == 0 && b == 0){
          multipler = 1;
        }
        else{
          sounds.gesture.play();
          if (multipler < COMBO_MAX){
            multipler += COMBO_STEP;
          }
        }
        if (b == 2){
          if (bonus.type == bonusType.cherry){
            for (i = enemies.length - 1; i >= 0; i--) {
              if (enemies[i].active && enemies[i].action != act.die){
                enemies[i].changeAction(act.die);
                result += 50;
              }
            }
          }
          else if (bonus.type == bonusType.apple){
            for (i = enemies.length - 1; i >= 0; i--) {
              if (enemies[i].active && enemies[i].action != act.die){
                enemies[i].changeAction(act.idle);
              }
            }
          }
        }

        score += Math.floor(result*multipler);
      }
      else{
        multipler = 1;
      }
      updateHud();
    }
  }

  function gestureStart(evt){
    if (isActive && !paused){
      mouseIsDown = true;
      path = [Point(evt)];
      evt.preventDefault();
      return false;
    }
    return true;
  }

  function gestureMove(evt){
    if (mouseIsDown){
      path.push(Point(evt));
      evt.preventDefault();
      return false;
    }
    return true;
  }

  function gestureEnd(evt){
    let gesture;
    if (mouseIsDown){
      mouseIsDown = false;

      path = simplifyPath(path, tolerance);

      gesture = cogniteGesture(path);
      if (gesture == gestures.click){
        gesture = gestures.unknown;
      }
      path = [];
      ctxT.clearRect(0, 0, realWidth, realHeight);


      applyGesture(gesture);
      return false;
    }
    return true;
  }

  let _engine = {
    onresize:       updateCanvasSize,
    onrotate:       rotate,
    startGame:      startGame,
    stopGame:       stopGame,
    init:           init,
    setSound:       setSound,
    setPaused:      setPaused,
    isPaused:       () => paused,
    isActive:       () => isActive,

    gestureStart:   gestureStart,
    gestureMove:    gestureMove,
    gestureEnd:     gestureEnd,

    damagePlayer:   damagePlayer,

    map:            map,
  };

  return _engine;
}());

let map = engine.map;

window.addEventListener("orientationchange", engine.onrotate);
window.addEventListener("resize", engine.onresize);

document.addEventListener("visibilitychange", () => {
  if (document.hidden){
    engine.setPaused(true);
  }
  else{
    engine.onresize();
  }
}, false);

canvasT.addEventListener('mousedown',  engine.gestureStart);
canvasT.addEventListener('mousemove',  engine.gestureMove);
canvasT.addEventListener('mouseup',    engine.gestureEnd);
canvasT.addEventListener('mouseout',   engine.gestureEnd);

canvasT.addEventListener('touchstart', engine.gestureStart);
canvasT.addEventListener('touchmove',  engine.gestureMove);
canvasT.addEventListener('touchend',   engine.gestureEnd);

muteButton.addEventListener('click', () => {
  engine.setSound(!canSound);
  muteButton.blur();
});

pauseButton.addEventListener('click', () => {
  engine.setPaused(!engine.isPaused());
  pauseButton.blur();
});

pauseScreen.querySelector('button').addEventListener('click', () => engine.setPaused(false));

document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey){ return; }
  if (e.key == 'm' || e.key == 'M'){
    engine.setSound(!canSound);
  }
  else if (engine.isActive() && (e.key == 'p' || e.key == 'P' || e.key == 'Escape')){
    e.preventDefault();
    engine.setPaused(!engine.isPaused());
  }
});

GameKit.initShell({ slug: 'pacman-slasher' });

let soundSpec = (name) => ({src: ['./audio/' + name + '.mp3', './audio/' + name + '.ogg'], volume: 0.25});

preloader.onupdate = x => {textBlock.textContent = x+' %';};
preloader.start(['./img/sprites.png', './img/finger.png'], {
  opening:   soundSpec('opening_song'),
  gesture:   soundSpec('eating_short'),
  hurt:      soundSpec('eatpill'),
  extralive: soundSpec('extra_lives'),
  die:       soundSpec('die'),
}).then(loaded => {
  atlas  = loaded.images[0];
  finger = loaded.images[1];
  sounds = loaded.sounds;

  fingerR = document.createElement('canvas');
  fingerR.width = finger.width; fingerR.height = finger.height;
  let ctxF = fingerR.getContext('2d');
  ctxF.translate(fingerR.width/2,fingerR.height/2);
  ctxF.rotate(Math.PI);
  ctxF.translate(-fingerR.width/2,-fingerR.height/2);
  ctxF.drawImage(finger, 0, 0);
  ctxF.setTransform(1,0,0,1,0,0);

  engine.setSound(canSound);
  muteButton.classList.remove('hidden');

  sounds.opening.play();

  textBlock.innerHTML = "<p class='big'>PacMan Slasher</p><p>Draw the symbol above a Pac-Man anywhere on screen to slash it.</p><p>Each wave brings a new symbol or a new kind of Pac-Man.</p>";

  startButton.classList.remove('hidden');
  startButton.focus();
  startButton.onclick = () => {
    sounds.opening.stop();
    startButton.classList.add('hidden');
    textBlock.classList.add('hidden');
    hud.classList.remove('hidden');
    pauseButton.classList.remove('hidden');
    document.getElementById('credits').classList.add('hidden');
    engine.init();
    engine.startGame();
  };
});
