const clamp = (num, min, max) => num < min ? min : num > max ? max : num;

const lineLineIntersect = (line1a, line1b, line2a, line2b) => {
    const s1_x = line1b.x - line1a.x;
    const s1_y = line1b.y - line1a.y;
    const s2_x = line2b.x - line2a.x;
    const s2_y = line2b.y - line2a.y;

    const s = (-s1_y * (line1a.x - line2a.x) + s1_x * (line1a.y - line2a.y)) / (-s2_x * s1_y + s1_x * s2_y);
    const t = (s2_x * (line1a.y - line2a.y) - s2_y * (line1a.x - line2a.x)) / (-s2_x * s1_y + s1_x * s2_y);

    return s >= 0 && s <= 1 && t >= 0 && t <= 1;
};

// borrowed from https://codereview.stackexchange.com/questions/192477/circle-line-segment-collision
const lineCircleIntersect = (lineA, lineB, circle, radius) => {
    let dist;
    const v1x = lineB.x - lineA.x;
    const v1y = lineB.y - lineA.y;
    const v2x = circle.x - lineA.x;
    const v2y = circle.y - lineA.y;
    const u = (v2x * v1x + v2y * v1y) / (v1y * v1y + v1x * v1x);

    if (u >= 0 && u <= 1) {
        dist = (lineA.x + v1x * u - circle.x) ** 2 + (lineA.y + v1y * u - circle.y) ** 2;
    } else {
        dist = u < 0 ?
            (lineA.x - circle.x) ** 2 + (lineA.y - circle.y) ** 2 :
            (lineB.x - circle.x) ** 2 + (lineB.y - circle.y) ** 2;
    }
    return dist < radius * radius;
};

const dist2 = (pt1, pt2) => Math.pow(pt1.x - pt2.x, 2) + Math.pow(pt1.y - pt2.y, 2);

const getTangents = (p1, r1, p2, r2) => {
    let d_sq = (p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y);

    if (d_sq <= (r1 - r2) * (r1 - r2)) return [];

    let d = Math.sqrt(d_sq);
    let vx = (p2.x - p1.x) / d;
    let vy = (p2.y - p1.y) / d;

    let result = [];
    let i = 0;

    for (let sign1 = +1; sign1 >= -1; sign1 -= 2) {
        let c = (r1 - sign1 * r2) / d;

        if (c * c > 1.0) continue;
        let h = Math.sqrt(Math.max(0.0, 1.0 - c * c));

        for (let sign2 = +1; sign2 >= -1; sign2 -= 2) {
            let nx = vx * c - sign2 * h * vy;
            let ny = vy * c + sign2 * h * vx;
            result[i] = [];
            const a = result[i] = new Array(2);
            a[0] = { x: p1.x + r1 * nx, y: p1.y + r1 * ny };
            a[1] = { x: p2.x + sign1 * r2 * nx, y: p2.y + sign1 * r2 * ny };
            i++;
        }
    }

    return result;
};

const sideOfLine = (p1, p2, p) => ((p2.x - p1.x) * (p.y - p1.y) - (p2.y - p1.y) * (p.x - p1.x)) > 0 ? Side.left : Side.right;
