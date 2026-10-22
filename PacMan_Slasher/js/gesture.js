"use strict";

const gestures = {unknown:   0,
                  click:     1,
                  swypeLR:   2,
                  swypeTD:   3,
                  swypeDTD:  4,
                  swypeTDT:  5,
                  swypeTLRD: 6,
                  slash:     7,
                  backslash: 8,
                  circle:    9,
};

const gestureColors = ['white', 'white', '#FF0000', '#2DE5E5', '#56A521', '#FFCC33', 'yellow', '#D24DFF', '#4D7CFF', '#FF9EC7'];

// One straight stroke: a line, or a diagonal ('/' or '\').
function straightGesture(orient){
  if (orient.x && !orient.y){
    return gestures.swypeLR;
  }
  if (!orient.x && orient.y){
    return gestures.swypeTD;
  }
  return orient.x * orient.y < 0 ? gestures.slash : gestures.backslash;
}

// A loop that ends near where it started and is big enough to be deliberate.
function isCircle(path, orientCount){
  if (orientCount < 4){
    return false;
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let p of path){
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  let size = Math.max(maxX - minX, maxY - minY);
  let gap  = getDistance(path[0], path[path.length - 1]);
  return Math.min(maxX - minX, maxY - minY) > 30 && gap < Math.pow(size * 0.35, 2);
}

function getDistance(a, b) {
  return (Math.pow(a.x-b.x, 2) + Math.pow(a.y-b.y, 2));
}

function getSectionOrient(a, b){
  let dx = a.x - b.x;
  let dy = a.y - b.y;

  let result = {x: 0, y: 0};

  let ratio = Math.abs(dx)/(Math.abs(dx)+Math.abs(dy));

  if (ratio >= 0.75){
    result.x = Math.sign(dx);
  }
  else if (ratio <= 0.2){
    result.y = Math.sign(dy);
  }
  else{
    result.x = Math.sign(dx);
    result.y = Math.sign(dy);
  }
  return result;
}

function cogniteGesture(path){
  let i, j, k, ol, result = 0;
  let orients = [];
  if (path.length == 2){
    if (getDistance(path[0], path[1]) < 100){
      result = gestures.click;
    }
    else{
      result = straightGesture(getSectionOrient(path[0], path[1]));
    }
  }
  else{
    orients.push(getSectionOrient(path[0], path[1]));
    for (i=2; i<path.length; i++){
      j = getSectionOrient(path[i-1], path[i]);
      k = orients.length - 1;
      if (j.x != orients[k].x || j.y != orients[k].y){
        orients.push(j);
      }
    }

    ol = orients.length;

    if (ol == 1){
      result = straightGesture(orients[0]);
    }
    else if (isCircle(path, ol)){
      result = gestures.circle;
    }
    else if (orients.length == 2 && Math.abs(orients[0].y + orients[1].y) == 2 && Math.abs(orients[0].x + orients[1].x) <= 1){
      result = gestures.swypeTD;
    }
    else if ((orients.length == 2 || orients.length == 3)
      && orients[0].y == -orients[orients.length-1].y 
      && Math.abs(orients.reduce((prev, curr) => prev + curr.x, 0)) >= 1){
        if (orients[0].y == -1){
          result = gestures.swypeDTD;
        }
        else{
          result = gestures.swypeTDT;
        }
    }
    else if (ol == 3 || ol == 4){
      if (Math.abs(orients[0].y + orients[ol - 1].y) == 2 
          && orients[0].x == orients[ol - 1].x 
          && orients[1].x == -orients[0].x 
          && (ol == 3 || orients[2].x == -orients[0].x)){
        result = gestures.swypeTLRD;
      }
    }
  }

  return result;
}

function Point(evt){
  if ('changedTouches' in evt){
    return {x: evt.changedTouches[0].clientX, y: evt.changedTouches[0].clientY};
  }
  else{
    return {x: evt.x, y: evt.y};
  }
}

let simplifyPath = function( points, tolerance ) {

  // helper classes 
  let Vector = function( x, y ) {
    this.x = x;
    this.y = y;
    
  };
  let Line = function( p1, p2 ) {
    this.p1 = p1;
    this.p2 = p2;
    
    // Perpendicular distance to the line through p1 and p2 (works for
    // vertical lines and for closed strokes where p1 == p2).
    this.distanceToPoint = function( point ) {
      let dx = this.p2.x - this.p1.x,
        dy = this.p2.y - this.p1.y,
        length = Math.sqrt( dx * dx + dy * dy );
      if ( length === 0 ) {
        return Math.sqrt( Math.pow( point.x - this.p1.x, 2 ) + Math.pow( point.y - this.p1.y, 2 ) );
      }
      return Math.abs( dy * point.x - dx * point.y + this.p2.x * this.p1.y - this.p2.y * this.p1.x ) / length;
    };
  };
  
  let douglasPeucker = function( points, tolerance ) {
    let i;
    if ( points.length <= 2 ) {
      return [points[0]];
    }
    let returnPoints = [],
      // make line from start to end 
      line = new Line( points[0], points[points.length - 1] ),
      // find the largest distance from intermediate poitns to this line
      maxDistance = 0,
      maxDistanceIndex = 0;
    for( i = 1; i <= points.length - 2; i++ ) {
      let distance = line.distanceToPoint( points[ i ] );
      if( distance > maxDistance ) {
        maxDistance = distance;
        maxDistanceIndex = i;
      }
    }
    // check if the max distance is greater than our tollerance allows 
    if ( maxDistance >= tolerance ) {
      // include this point in the output 
      returnPoints = returnPoints.concat( douglasPeucker( points.slice( 0, maxDistanceIndex + 1 ), tolerance ) );
      returnPoints = returnPoints.concat( douglasPeucker( points.slice( maxDistanceIndex, points.length ), tolerance ) );
    } else {
      // ditching this point
      returnPoints = [points[0]];
    }
    return returnPoints;
  };
  let arr = douglasPeucker( points, tolerance );
  // always have to push the very last point on so it doesn't get left off
  arr.push( points[points.length - 1 ] );
  return arr;
};