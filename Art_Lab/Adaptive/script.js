///////////////////////////
//    Canvas drawing     //
///////////////////////////

let nbPoints = 2000; // amount of points
let points = []; // list of all points

let speed = 0.5; // the speed represents how fast the points will move each frame 
let size = 1; // the size represents how big the points will be (better to keep at low values)
let positionScale = 200; // the scale represents how much the noise will be zoomed
let rotationScale = 1; // how much a point can change it's direction at total (1 = 2PI)
let opacity = 20; // how visible is the point (0 = invisible, 255 = opaque)
let fadeSpeed = 0; // how fast the points will fade out (0 = no fade, 255 = instant fade)
let borderRule = "randomTeleport"; // determines what happens when a point goes off-screen (randomTeleport, linkedTeleport, none)

let mainWidth, mainHeight; // size of the canvas
let currentColor; // color of the points
let currentColor2; // 2nd color of the points (if needed)

function setup() {

    // get size of div
    if (window.innerWidth > 3000) {
        mainWidth = document.getElementById("main").clientWidth;
        mainHeight = window.innerHeight - 400; // test
    } else {
        mainWidth = document.getElementById("main").clientWidth;
        mainHeight = document.getElementById("setterCanvaHeight").clientHeight + 25; // + 25 is a manual offset to make canvas slightly bigger than the sidebar
    }

    // initialize canvas
    createCanvas(mainWidth, mainHeight); // set canva size
    background(0); // set background color in A
    currentColor = color(0,255,210, opacity); // set base color in RGBA
    currentColor2 = null; // set secondary color in RGBA
    stroke(currentColor); // set color in RGBA
    strokeWeight(size); // set size of points

    // create all points
    for (let i = 0; i < nbPoints; i++) {
        points.push(createVector(random(mainWidth), random(mainHeight))); // add a new point with random position
    }
}

function draw() {
    // add fade effect if fade is not 0
    if (fadeSpeed > 0) {
        background(0, fadeSpeed);
    }

    for (vector of points) {
        // if there are 2 colors, change color at the middle of the list
        if (points[Math.floor(points.length/2)] == vector && currentColor2 != null) stroke(currentColor2)

        // set the direction of the point with semi-random noise
        let direction = 2 * rotationScale * Math.PI * noise(vector.x / positionScale, vector.y / positionScale);

        // apply the movement
        vector.x += Math.cos(direction) * speed;
        vector.y += Math.sin(direction) * speed;

        // check if the point is off-screen and apply border rule
        switch (borderRule) {
            case "randomTeleport": // teleport to random position
                if (vector.x < 0 || vector.x > mainWidth || vector.y < 0 || vector.y > mainHeight) {
                    vector.x = random(mainWidth);
                    vector.y = random(mainHeight);
                }
                break;
            case "linkedTeleport": // teleport to opposite side (bottom = top, left = right)
                if (vector.x < 0) vector.x = mainWidth;
                if (vector.x > mainWidth) vector.x = 0;
                if (vector.y < 0) vector.y = mainHeight;
                if (vector.y > mainHeight) vector.y = 0;
                break;
            case "none": // let the point go off-screen
            default:
                break;
        }

        // draw the point
        point(vector.x, vector.y)
    }
    stroke(currentColor); // reset color
}

function windowResized() {
    if (mainWidth != document.getElementById("main").clientWidth) { // check that it is not only the height that changed (we don't care in this case)
        // get new div size
        if (window.innerWidth > 1920) {
            mainWidth = document.getElementById("main").clientWidth;
            mainHeight = innerHeight - 250; // make the canva take most screen space
        } else {
            mainWidth = document.getElementById("main").clientWidth;
            mainHeight = document.getElementById("setterCanvaHeight").clientHeight + 25; // + 25 is a manual offset to make canvas slightly bigger than the sidebar
        }
        
        // resize canvas to correct size
        resizeCanvas(mainWidth, mainHeight);

        reset();
    }
}

function reset() {
    //refresh values
    stroke(currentColor);
    strokeWeight(size);
    background(0);

    // replace all points to random positions
    for (vector of points) {
        vector.x = random(mainWidth);
        vector.y = random(mainHeight);
    }
}

///////////////////////////
//  Setters Values HTML  //
///////////////////////////

function inputNbParticle(event) {
    // check if enter is pressed
    if (event.keyCode === 13) {

        points = []; // destroy all points
        nbPoints = document.getElementById("nbPoints").value; // get new amount of points

        // create points at random positions
        for (let i = 0; i < nbPoints; i++) {
            points.push(createVector(random(mainWidth), random(mainHeight)));
        }

        reset();
    }
}

function inputSpeed(event) {
    if (event.keyCode === 13) { // check if enter is pressed
        speed = document.getElementById("speed").value; // change speed
        reset();
    }
}

function inputSize(event) {
    if (event.keyCode === 13) { // check if enter is pressed
        size = document.getElementById("size").value; // change size
        strokeWeight(size); // apply size to stroke
        reset();
    }
}

function inputPositionScale(event) {
    if (event.keyCode === 13) { // check if enter is pressed
        positionScale = document.getElementById("positionScale").value; // change positionScale
        reset();
    }
}

function inputRotationScale(event) {
    if (event.keyCode === 13) { // check if enter is pressed
        rotationScale = document.getElementById("rotationScale").value; // change rotationScale
        reset();
    }
}

function inputOpacity(event) {
    if (event.keyCode === 13) { // check if enter is pressed
        opacity = Math.floor(document.getElementById("opacity").value); // change opacity (USE MATH.FLOOR BECAUSE STROKE DOESN'T ACCEPT FLOATS)
        currentColor.setAlpha(opacity); // set opacity in color
        if (currentColor2 != null) currentColor2.setAlpha(opacity); // set opacity in color2 (if needed)
        stroke(currentColor); // set color in RGBA
        reset();
    }
}

function inputFade(event) {
    if (event.keyCode === 13) { // check if enter is pressed
        fadeSpeed = Math.floor(document.getElementById("fadeSpeed").value); // change fadeSpeed (USE MATH.FLOOR BECAUSE STROKE DOESN'T ACCEPT FLOATS)
        reset();
    }
}

function inputBorderRule(inputBorderRule) {
    if (inputBorderRule != null) { // makes it so that it doesn't change borderRule if inputBorderRule is null
        borderRule = inputBorderRule // change borderRule
    }
    reset();
}

function inputColor(inputColor, inputColor2) {
    if (inputColor != null) { // makes it so that it doesn't change color if inputColor is null (serves for apply all inputs when called with no values in html)
        currentColor = inputColor; // change color
        currentColor2 = inputColor2; // change 2nd color
    }

    reset();
}

function applyAllInputs(newBorderRule, newColor, newColor2) {
    // inputColor needs to be called before inputOpacity and inputFadeSpeed
    inputBorderRule(newBorderRule);
    inputColor(newColor, newColor2);
    
    // calls all inputsFunctions with correct event.keycode (enter)
    inputNbParticle({keyCode: 13});
    inputSpeed({keyCode: 13});
    inputSize({keyCode: 13});
    inputPositionScale({keyCode: 13});
    inputRotationScale({keyCode: 13});
    inputOpacity({keyCode: 13});
    inputFade({keyCode: 13});

    reset();
}

///////////////////////////
//        Presets        //
///////////////////////////

function presetSandStream() {
    // modify all values in html
    document.getElementById("nbPoints").value = 2000;
    document.getElementById("speed").value = 50;
    document.getElementById("size").value = 1;
    document.getElementById("positionScale").value = 40000;
    document.getElementById("rotationScale").value = 200;
    document.getElementById("opacity").value = 100;
    document.getElementById("fadeSpeed").value = 4;

    noiseSeed(2992); // change noise seed to a certain seed to have a nice result

    applyAllInputs("randomTeleport", color(255,255,200, opacity), null);
}


function presetHighway() {
    // modify all values in html
    document.getElementById("nbPoints").value = 1000;
    document.getElementById("speed").value = 10;
    document.getElementById("size").value = 1;
    document.getElementById("positionScale").value = 5000;
    document.getElementById("rotationScale").value = 200;
    document.getElementById("opacity").value = 200;
    document.getElementById("fadeSpeed").value = 15;

    noiseSeed(5175); // change noise seed to a certain seed to have a nice result

    applyAllInputs("randomTeleport", color(130,0,255, opacity), null);
}

function presetGenerativeMap() {
    // modify all values in html
    document.getElementById("nbPoints").value = 3000;
    document.getElementById("speed").value = 0.2;
    document.getElementById("size").value = 1;
    document.getElementById("positionScale").value = 200;
    document.getElementById("rotationScale").value = 200;
    document.getElementById("opacity").value = 20;
    document.getElementById("fadeSpeed").value = 0;

    noiseSeed(8517); // change noise seed to a certain seed to have a nice result

    applyAllInputs("randomTeleport", color(115, 64, 50, opacity), null);
}

function presetGlitch() {
    // modify all values in html
    document.getElementById("nbPoints").value = 2000;
    document.getElementById("speed").value = 150;
    document.getElementById("size").value = 0.1;
    document.getElementById("positionScale").value = 200000000000;
    document.getElementById("rotationScale").value = 700000000000000000;
    document.getElementById("opacity").value = 100;
    document.getElementById("fadeSpeed").value = 0;

    noiseSeed(4610); // change noise seed to a certain seed to have a nice result

    applyAllInputs("randomTeleport", color(150, 255, 150, opacity), null);
}

function presetDuoTone() {
    // modify all values in html
    document.getElementById("nbPoints").value = 10000;
    document.getElementById("speed").value = 0.3;
    document.getElementById("size").value = 1;
    document.getElementById("positionScale").value = 500;
    document.getElementById("rotationScale").value = 0.5;
    document.getElementById("opacity").value = 7;
    document.getElementById("fadeSpeed").value = 0;

    noiseSeed(8201); // change noise seed to a certain seed to have a nice result

    applyAllInputs("linkedTeleport", color(255, 255, 100, opacity), color(255, 100, 180, opacity));
}