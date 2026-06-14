const fract = (n) => ((n % 1) + 1) % 1;

const subV = (v1, v2) => ({ x: v1.x - v2.x, y: v1.y - v2.y });
const addV = (v1, v2) => ({ x: v1.x + v2.x, y: v1.y + v2.y });
const mulVS = (v, s) => ({ x: v.x * s, y: v.y * s });
const divVS = (v, s) => mulVS(v, 1 / s);
const lenV = (v) => Math.sqrt(v.x * v.x + v.y * v.y);
const distV = (v1, v2) => lenV(subV(v1, v2));
const normalizeV = (v) => divVS(v, lenV(v) || 1);
const perpLeftV = (v) => ({ x: -v.y, y: v.x });
const perpRightV = (v) => ({ x: v.y, y: -v.x });
const angleV = (v) => {
    let angle = Math.atan2(v.y, v.x);
    if (angle < 0) angle += 2 * Math.PI;
    return angle;
};
const copyIntoV = (target, source) => {
    target.x = source.x;
    target.y = source.y;
};
const copyV = (source) => ({ x: source.x, y: source.y });
const fractV = (v) => ({ x: fract(v.x), y: fract(v.y) });
const floorV = (v) => ({ x: ~~v.x, y: ~~v.y });
