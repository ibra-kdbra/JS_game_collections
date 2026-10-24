let scene, camera, renderer;

let hudCanvas, hudContext;

let hudWidth, hudHeight;

let stage;
let viewScale = 1;
let viewHalfWidth = halfWidth;
let followCamera = false;

let lander;
let colliders;
let terrainMeshGroup;
let terrainMaterial;
let starMeshes = [];

let deltaTime = 0;

let isZoomed = false;

let velocityX = 0;
let velocityY = 0;
let velocityDeltaY = 0;
let velocityDeltaX = 0;
let currentAcceleration = 0;
let currentAccelerationRatio = 0;
let altitude = 0;
let landerForward = new THREE.Vector2(0,1);
const vector2Zero = new THREE.Vector2(0,0);

let rotatingLeft = false;
let rotatingRight = false;
let accelerating = false;

let isPaused = true;
let isGameOver = true;
let isBetweenRounds = false;
let betweenRoundTimer = 0;
let isDebugOn = false;
const isDebugAllowed = new URLSearchParams(location.search).has("debug");
let hasLanded = false;

let settings = {difficulty: "pilot", terrain: "classic"};
let difficulty = difficulties.pilot;
let gravity = difficulty.gravity;
let runSeed = 0;
let roundNumber = 0;

let currentFuel = 1000;
let hasFuel = true;

let cubeColliders;
let heightDifferences = [];
let lineSegments = [];

let crashSound, lowFuelSound, rocketSound, commSound;
let isAlerted = false;
let alertTimer = 0;
let commsTimer = 0;

let currentScore = 0;
let currentTime = 0;

let scoreMultipliers = [];

let thrusterParticleEmitPoint;
let thrusterPS, explosionPS;
let landerBackDirection = new THREE.Vector2(0,-1);

let fuelChange, scoreChange;
let crashInfo;

let store, controls, loop;
let lastResult = null;