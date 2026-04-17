import * as THREE from 'three';
import { Level, LEVELS } from './level.js';
import { Player } from './player.js';
import { Solver } from './solver.js';

let scene, camera, renderer;
let clock = new THREE.Clock();
let level, player, currentLevelIdx = 0;
let moveCount = 0;

// UI Elements
const uiMoveCount = document.getElementById('move-count');
const uiEnemyCount = document.getElementById('enemy-count');
const wonOverlay = document.getElementById('won-overlay');
const btnRestart = document.getElementById('btn-restart');
const btnSolve = document.getElementById('btn-solve');
const btnNext = document.getElementById('btn-next');

let isAutoSolving = false;
let solveQueue = [];

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); 

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(2, 12, 10);
    camera.lookAt(2, 0, 2);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('game-container').appendChild(renderer.domElement);

    loadLevel(currentLevelIdx);

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', onKeyDown);
    btnRestart.addEventListener('click', restartLevel);
    btnNext.addEventListener('click', nextLevel);
    btnSolve.addEventListener('click', onSolveClick);

    animate();
}

function loadLevel(idx) {
    if(idx >= LEVELS.length) {
        idx = 0;
    }
    currentLevelIdx = idx;
    scene.clear();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    level = new Level(scene, currentLevelIdx);
    player = new Player(scene, level, handlePlayerState);
    
    const mapW = LEVELS[currentLevelIdx][0].length;
    const mapH = LEVELS[currentLevelIdx].length;
    camera.position.set(mapW/2, 16, mapH/2 + 10);
    camera.lookAt(mapW/2, 0, mapH/2);

    moveCount = 0;
    isAutoSolving = false;
    solveQueue = [];
    updateUI();
    wonOverlay.classList.add('hidden');
}

function restartLevel() {
    loadLevel(currentLevelIdx);
}

function nextLevel() {
    loadLevel(currentLevelIdx + 1);
}

function handlePlayerState(state) {
    if (state === 'MOVED') {
        moveCount++;
        updateUI();
    } else if (state === 'ENEMY_DEFEATED') {
        updateUI();
    } else if (state === 'WON') {
        wonOverlay.classList.remove('hidden');
        isAutoSolving = false;
    } else if (state === 'DIED') {
        setTimeout(restartLevel, 300);
    }
}

function updateUI() {
    uiMoveCount.innerText = moveCount;
    uiEnemyCount.innerText = level.getEnemyCount();
}

function onKeyDown(e) {
    if (isAutoSolving || !wonOverlay.classList.contains('hidden')) return;
    
    let dx = 0, dz = 0;
    if (e.key === 'ArrowUp' || e.key === 'w') dz = -1;
    if (e.key === 'ArrowDown' || e.key === 's') dz = 1;
    if (e.key === 'ArrowLeft' || e.key === 'a') dx = -1;
    if (e.key === 'ArrowRight' || e.key === 'd') dx = 1;

    if (dx !== 0 || dz !== 0) {
        player.slide(dx, dz);
    }
}

function onSolveClick() {
    if (isAutoSolving || !wonOverlay.classList.contains('hidden')) return;

    const solver = new Solver(level.grid);
    const path = solver.solve(player.x, player.z, level.enemies);
    if (path && path.length > 0) {
        solveQueue = path;
        isAutoSolving = true;
    } else {
        alert("No solution found from this position! Try restarting.");
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1); // Cap dt to prevent physics jumps
    
    if (player) {
        player.update(dt);
        
        if (isAutoSolving && !player.isMoving && solveQueue.length > 0) {
            const nextMove = solveQueue.shift();
            player.slide(nextMove.dx, nextMove.dz);
        }
    }

    renderer.render(scene, camera);
}

init();
