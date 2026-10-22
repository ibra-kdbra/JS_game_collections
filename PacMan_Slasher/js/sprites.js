"use strict";

const act = {
  idle:    1,
  move:    2,
  die:     3,
  damaged: 4,
};

const bonusType = {
  cherry: 0,
  apple:  1,
}

// Pixel glyphs (10x10) for symbols that are not in the sprite atlas.
const GLYPHS = {
  [gestures.slash]: [
    '........##', '.......##.', '......##..', '.....##...', '....##....',
    '...##.....', '..##......', '.##.......', '##........', '#.........'],
  [gestures.backslash]: [
    '##........', '.##.......', '..##......', '...##.....', '....##....',
    '.....##...', '......##..', '.......##.', '........##', '.........#'],
  [gestures.circle]: [
    '..######..', '.##....##.', '##......##', '##......##', '##......##',
    '##......##', '##......##', '##......##', '.##....##.', '..######..'],
};

let glyphCache = {};
let tintCache  = {};

function glyphImage(token){
  if (!glyphCache[token]){
    let c = document.createElement('canvas');
    c.width = 10; c.height = 10;
    let g = c.getContext('2d');
    g.fillStyle = gestureColors[token];
    GLYPHS[token].forEach((row, y) => {
      for (let x = 0; x < row.length; x++){
        if (row[x] == '#'){ g.fillRect(x, y, 1, 1); }
      }
    });
    glyphCache[token] = c;
  }
  return glyphCache[token];
}

// A copy of the atlas with every opaque pixel recoloured (for enemy kinds).
function tintedAtlas(color){
  if (!tintCache[color]){
    let c = document.createElement('canvas');
    c.width = atlas.width; c.height = atlas.height;
    let g = c.getContext('2d');
    g.drawImage(atlas, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    tintCache[color] = c;
  }
  return tintCache[color];
}

function symbolWidth(token){
  return token == gestures.swypeTD ? 8 : 13;
}

// Draw one symbol at device pixel (x, y), `scale` device pixels per map unit.
function drawSymbol(ctx, token, x, y, scale){
  if (token == gestures.swypeTLRD){
    ctx.drawImage(atlas, 0, 150, 10, 10, x, y, 13*scale, 13*scale);
  }
  else if (token == gestures.swypeTD){
    ctx.drawImage(atlas, 142, 88, 6, 10, x, y, 8*scale, 13*scale);
  }
  else if (GLYPHS[token]){
    ctx.drawImage(glyphImage(token), 0, 0, 10, 10, x, y, 13*scale, 13*scale);
  }
  else{
    ctx.drawImage(atlas, (7*tileXsize + (token>>2)*10), 78 + 10*(token&1), 10, 10, x, y, 13*scale, 13*scale);
  }
}

// The row of symbols above an enemy or bonus; remembers its footprint for clear().
function drawTokenRow(sprite){
  let i, x, y, width = 0;
  for (i = sprite.tokens.length - 1; i >= 0; i--) {
    width += symbolWidth(sprite.tokens[i]);
  }
  sprite.tokensOffsetY = width ? 10 : 0;
  sprite.tokensOffsetX = Math.ceil((width - tileXsize)/2);
  x = sprite.x - sprite.tokensOffsetX;
  y = sprite.y - sprite.tokensOffsetY;
  for (i = sprite.tokens.length - 1; i >= 0; i--) {
    drawSymbol(ctxA, sprite.tokens[i], map.offsetX + x*map.scale, map.offsetY + y*map.scale, map.scale);
    x += symbolWidth(sprite.tokens[i]);
  }
}

let stepToward = (from, to, speed) => Math.sign(to - from) * Math.min(speed, Math.abs(to - from));

class Sprite{
  constructor(x, y,width, height, orient){
    this.x = x;
    this.y = y;
    this.newX = x;
    this.newY = y;
    this.frame  = 0;
    this.width  = width;
    this.height = height;
    this.orient = orient;

    this.action = 0;
    this.active = true;

    this.currTick = 0;

    this.frameTick = 1;
  }

  clear(){
    ctxA.clearRect(map.offsetX + this.x*map.scale, map.offsetY + this.y*map.scale, this.width*map.scale, this.height*map.scale);
  }

  tick(){

  }

  changeAction(a){
    this.action = a;
    this.frame  = 0;
  }
};

class Ghost extends Sprite{
  constructor(x, y){
    super(x, y, 20, 20, 0);
    this.health = 3;
  }

  lookAtEnemy(e){
    let i = getSectionOrient(this, e);
    if (i.x > 0){this.orient = 0;}
    else if (i.x < 0){this.orient = 1;}
    else if (i.y > 0){this.orient = 2;}
    else{this.orient = 3;}
  }

  draw(){
    this.x = this.newX;
    this.y = this.newY;
    if (this.health > 0){
      if (this.action == act.damaged){
        ctxA.drawImage(atlas, (3 + this.frame)*tileXsize, tileYsize*4,  tileXsize, tileYsize,
          map.offsetX + this.x*map.scale, map.offsetY + this.y*map.scale, this.width*map.scale, this.height*map.scale);
      }
      else{
        ctxA.drawImage(atlas, (((3 - this.health)*2)+this.frame)*tileXsize, 0,  tileXsize, tileYsize,
          map.offsetX + this.x*map.scale, map.offsetY + this.y*map.scale, this.width*map.scale, this.height*map.scale);
        ctxA.drawImage(atlas, (4 + this.orient)*tileXsize, tileYsize,  tileXsize, tileYsize,
          map.offsetX + this.x*map.scale, map.offsetY + this.y*map.scale, this.width*map.scale, this.height*map.scale);
      }
    }
    else{
      ctxA.drawImage(atlas, (((this.orient%2)*2)+this.frame)*tileXsize, tileYsize,  tileXsize, tileYsize,
        map.offsetX + this.x*map.scale, map.offsetY + this.y*map.scale, this.width*map.scale, this.height*map.scale);
    }

  }

  tick(){
    this.currTick++;
    if (this.currTick >= this.frameTick){
      this.frame^=1;
      if (this.action == act.damaged && this.frame == 0){
        this.changeAction(act.idle);
      }
      this.currTick = 0;
    }
  }

  changeAction(a){
    this.action = a;
    this.frame  = 0;
    if (a == act.damaged){
      this.frameTick += 2;
    }
    else{
      this.frameTick = 1;
    }
  }
}

// kind: {speed, tint, points}; speed is map units per actor step.
class Pacman extends Sprite{
  constructor(x, y, orient, tx, ty, tokens, pact = act.move, kind = {speed: 2, tint: null, points: 0}){
    super(x, y, 20, 20, orient);
    this.tokens = tokens;
    this.tokensWidth   = 0;
    this.tokensOffsetX = 0;
    this.tokensOffsetY = 0;
    this.kind  = kind;
    this.sheet = kind.tint ? tintedAtlas(kind.tint) : atlas;

    this.targetX = tx == x ? x: tx > x ? tx - tileXsize + 5 : tx + tileXsize - 5;
    this.targetY = ty == y ? y: ty > y ? ty - tileYsize + 5 : ty + tileYsize - 5;

    this.action = pact;
  }

  checkGesture(g){
    let r = 0;
    if (this.tokens[this.tokens.length - 1] == g){
      this.tokens.pop();
      if (this.tokens.length == 0){
        r = 2; this.changeAction(act.die);
      }
      else{
        r = 1;
      }
    }
    return r;
  }

  drawTokens(){
    drawTokenRow(this);
  }

  draw(){
    if (this.active){
      this.x = this.newX;
      this.y = this.newY;
      if (this.action == act.die){
        ctxA.drawImage(this.sheet, (this.frame & 7)*tileXsize, (3 + (this.frame>>3))*tileYsize,  tileXsize, tileYsize,
          map.offsetX + this.x*map.scale, map.offsetY + this.y*map.scale, this.width*map.scale, this.height*map.scale);
      }
      else{
        ctxA.drawImage(this.sheet, ((this.orient*2)+this.frame)*tileXsize, tileYsize*2,  tileXsize, tileYsize,
          map.offsetX + this.x*map.scale, map.offsetY + this.y*map.scale, this.width*map.scale, this.height*map.scale);
        this.drawTokens();
      }
    }
  }

  clear(){
    let x, y, width, height;
    if (this.tokensOffsetX > 0){
      x = this.x - this.tokensOffsetX;
      width = this.width + this.tokensOffsetX*2;
    }
    else{
      x = this.x; width = this.width;
    }
    if (this.tokensOffsetY>0){
      y = this.y - this.tokensOffsetY;
      height = this.height + this.tokensOffsetY;
    }
    else{
      y = this.y; height = this.height;
    }

    ctxA.clearRect(map.offsetX + x*map.scale, map.offsetY + y*map.scale, width*map.scale, height*map.scale);
  }

  rotate(){
    let i;
    i = this.x; this.newX = this.y; this.newY = i;
    i = this.targetX; this.targetX = this.targetY; this.targetY = i;

    if (this.targetX < this.newX){this.orient = 0;}
    else if (this.targetX > this.newX){this.orient = 1;}
    else if (this.targetY < this.newY){this.orient = 2;}
    else{this.orient = 3;}
  }

  tick(){
    if (this.active){
      this.currTick++;
      if (this.currTick >= this.frameTick){
        if (this.action == act.die){
          if (this.frame < 10){this.frame++;}
          else{this.active = false;}
        }
        else{
          if (this.x == this.targetX && this.y == this.targetY){
            this.changeAction(act.die);
            this.tokens = [];
            if (engine.damagePlayer()){
              this.active = false;
            }
          }
          else {
            if (this.action == act.move){
              this.newX += stepToward(this.newX, this.targetX, this.kind.speed);
              this.newY += stepToward(this.newY, this.targetY, this.kind.speed);
            }

            this.frame^=1;
          }
        }
        this.currTick = 0;
      }
    }
  }
}

class Bonus extends Sprite{
  constructor(x, y, type, tokens, time){
    super(x, y, 20, 20, 0);
    this.tokens = tokens;
    this.tokensWidth   = 0;
    this.tokensOffsetX = 0;
    this.tokensOffsetY = 0;

    this.type = type;
    this.liveTime = time;

    this.action = act.idle;
  }

  checkGesture(g){
    let r = 0;
    if (this.tokens[this.tokens.length - 1] == g){
      this.tokens.pop();
      if (this.tokens.length == 0){
        r = 2; this.changeAction(act.die);
        this.liveTime = 0;
      }
      else{
        r = 1;
      }
    }
    return r;
  }

  drawTokens(){
    drawTokenRow(this);
  }

  draw(){
    if (this.active){
      this.x = this.newX;
      this.y = this.newY;

      if (this.action != act.die){
        ctxA.drawImage(atlas, (5 + this.type)*tileXsize, tileYsize*4,  tileXsize, tileYsize,
          map.offsetX + this.x*map.scale, map.offsetY + this.y*map.scale, this.width*map.scale, this.height*map.scale);
        this.drawTokens();
      }
    }
  }

  clear(){
    let x, y, width, height;
    if (this.tokensOffsetX > 0){
      x = this.x - this.tokensOffsetX;
      width = this.width + this.tokensOffsetX*2;
    }
    else{
      x = this.x; width = this.width;
    }
    if (this.tokensOffsetY>0){
      y = this.y - this.tokensOffsetY;
      height = this.height + this.tokensOffsetY;
    }
    else{
      y = this.y; height = this.height;
    }

    ctxA.clearRect(map.offsetX + x*map.scale, map.offsetY + y*map.scale, width*map.scale, height*map.scale);
  }

  rotate(){
    let i;
    i = this.x; this.newX = this.y; this.newY = i;
  }

  tick(){
    if (this.active){
      this.currTick++;
      if (this.liveTime) {this.liveTime--;}
      if (this.currTick >= this.frameTick){
        if (this.action == act.die || this.liveTime == 0){
          this.active = false; this.clear(); return;
        }
        if (this.frame < 3){
          this.newY--;
        }
        else if (this.frame < 6){
          this.newY++;
        }

        this.frame++;
        if (this.frame >= 8){this.frame = 0;}
        this.currTick = 0;
      }
    }
  }
}