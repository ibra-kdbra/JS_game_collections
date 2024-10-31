(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var poly = function poly(x, y, sides, r) {
  var points = [];
  for (var i = 0; i < sides; i++) {
    var X = x + Math.cos(Math.PI * 2 / sides * i) * r;
    var Y = y + Math.sin(Math.PI * 2 / sides * i) * r;
    points.push([X, Y]);
  }
  return points;
};

var setCanvasSize = function setCanvasSize(id, w, h) {
  var c = document.getElementById(id);
  c.setAttribute('width', w);
  c.setAttribute('height', h);
};

var fill = function fill(ctx) {
  var r = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  var g = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
  var b = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
  var a = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 255;

  ctx.fillStyle = 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')';
};

var noFill = function noFill(ctx) {
  fill(ctx, 0, 0, 0, 0);
};

var background = function background(ctx) {
  var r = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  var g = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
  var b = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
  var a = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 255;
  var w = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : 500;
  var h = arguments.length > 6 && arguments[6] !== undefined ? arguments[6] : 500;

  fill(ctx, r, g, b, a);
  ctx.fillRect(0, 0, w, h);
};

var stroke = function stroke(ctx) {
  var r = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  var g = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
  var b = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
  var a = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 255;

  ctx.strokeStyle = 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')';
};

var noStroke = function noStroke(ctx) {
  stroke(ctx, 0, 0, 0, 0);
};

var strokeWeight = function strokeWeight(ctx, weight) {
  ctx.lineWidth = weight;
};

var line = function line(ctx, v, v2) {
  ctx.beginPath();
  ctx.moveTo.apply(ctx, _toConsumableArray(v));
  ctx.lineTo.apply(ctx, _toConsumableArray(v2));
  ctx.stroke();
  ctx.closePath();
};

var ellipse = function ellipse(ctx, v, rx) {
  var ry = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : rx;
  var oa = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 0;
  var sa = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : 0;
  var ea = arguments.length > 6 && arguments[6] !== undefined ? arguments[6] : Math.PI * 2;

  ctx.beginPath();
  ctx.ellipse.apply(ctx, _toConsumableArray(v).concat([rx, ry, oa, sa, ea, false]));
  ctx.stroke();
  ctx.fill();
  ctx.closePath();
};

var arc = function arc(ctx, v, r) {
  var sa = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
  var ea = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : Math.PI * 2;

  ctx.beginPath();
  ctx.arc.apply(ctx, _toConsumableArray(v).concat([r, sa, ea, false]));
  ctx.stroke();
  ctx.fill();
  ctx.closePath();
};

var drawPoly = function drawPoly(ctx, ps) {
  ctx.beginPath();
  ctx.moveTo.apply(ctx, _toConsumableArray(ps[0]));
  for (var i = 1; i < ps.length; i++) {
    ctx.lineTo.apply(ctx, _toConsumableArray(ps[i]));
  }
  ctx.lineTo.apply(ctx, _toConsumableArray(ps[0]));
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
};

var rect = function rect(ctx, pos, w, h) {
  ctx.beginPath();
  ctx.fillRect.apply(ctx, _toConsumableArray(pos).concat([w, h]));
  ctx.rect.apply(ctx, _toConsumableArray(pos).concat([w, h]));
  ctx.closePath();
  ctx.stroke();
};

/* start window exports */
/**
 * Polutes the global scope with unnamespaced functions
 */
var polute = function polute() {
  window.setCanvasSize = setCanvasSize;
  window.background = background;
  window.stroke = stroke;
  window.poly = poly;
  window.rect = rect;
  window.fill = fill;
  window.noFill = noFill;
  window.noStroke = noStroke;
  window.strokeWeight = strokeWeight;
  window.line = line;
  window.ellipse = ellipse;
  window.arc = arc;
  window.drawPoly = drawPoly;
};

/**
 * Exposed API
 */
window.microcan = {
  polute: polute,
  setCanvasSize: setCanvasSize,
  background: background,
  stroke: stroke,
  poly: poly,
  fill: fill,
  noFill: noFill,
  noStroke: noStroke,
  strokeWeight: strokeWeight,
  line: line,
  ellipse: ellipse,
  arc: arc,
  drawPoly: drawPoly,
  rect: rect
};
/* end window exports */
},{}]},{},[1])