let points = [], nbPoints = 10000, opacity = 20, speed = 1, positionScale = 300, noiseScale = 1;

function setup() {
    createCanvas(document.getElementById("name").clientWidth, document.getElementById("name").clientHeight);
    background(0);
    stroke(0,255,200,opacity);
    for (let i = 0; i < nbPoints; i++) points.push(createVector(random(innerWidth), random(innerHeight)));
}

function draw() {
    for (vector of points) {
        let direction = 2 * noiseScale * Math.PI * noise(vector.x / positionScale, vector.y / positionScale);
        vector.x += Math.cos(direction) * speed, vector.y += Math.sin(direction) * speed;
        if (vector.x < 0 || vector.x > innerWidth || vector.y < 0 || vector.y > innerHeight) vector = createVector(random(innerWidth), random(innerHeight));
        point(vector.x, vector.y)
    }
}