'use strict';

// Useful Functions and classes

function rectanlge(x, y, w, h) {
  this.x = x;
  this.y = y;
  this.w = w;
  this.h = h;
}

function ranColor() {
  let l = '0123456789ABCDEF';
  let c = '#';
  for (let i = 0; i < 6; i++) {
    c += l[Math.floor(Math.random() * 16)];
  }
  return c;
}

function speak(t) {
  if (!window.speechSynthesis || musicOff) return;
  const s = new SpeechSynthesisUtterance(t);
  const voice = speechSynthesis.getVoices().find((v) => v.name == "Google UK English Female");
  if (voice) s.voice = voice;
  speechSynthesis.speak(s);
}

function rndNo(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function cloneRectanlge(rec) {
  return new rectanlge(rec.x, rec.y, rec.w, rec.h);
}

function rectColiding(rec1, rec2) {
  return (rec1.x < rec2.x + rec2.w &&
    rec1.x + rec1.w > rec2.x &&
    rec1.y < rec2.y + rec2.h &&
    rec1.y + rec1.h > rec2.y)
}

function drawImg(ctx, img, sx, sy, w, h, x, y, alpha, scale, angle=0){
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if(angle > 0){
    ctx.translate(24,24);
    ctx.rotate(angle*Math.PI/180);
    ctx.translate(-24,-24);
  }
  ctx.drawImage(img, sx, sy, w, h, w/2, h/2, w * scale, h * scale);
  ctx.restore();
}

function partDir(p) {
  var angle = rndNo(0, 360) * Math.PI / 180;
  var value = rndNo(50, 180);
  var radius = [-1, 1][rndNo(0, 1)] * value;
  return {
    x: p.x + radius * Math.cos(angle),
    y: p.y + radius * Math.sin(angle)
  }
}

function lerp (start, end, amt){
  return (1-amt)*start+amt*end
}
