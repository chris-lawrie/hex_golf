let hexSize = 40;
let rows = 4;
let cols = 5;
let grid = [];
let playerPos;
let goalPos;
let moveCount = 0;

function setup() {
  createCanvas(800, 600);
  createHexGrid();

  // Start & Goal
  playerPos = { q: 0, r: 0 }; // axial coords
  goalPos = { q: 3, r: -2 }; // example

  // Random first move
  rollMove();
}

function draw() {
  background(220);
  drawGrid();
  drawPlayer();
  drawGoal();

  // UI
  fill(0);
  textSize(18);
  textAlign(LEFT, TOP);
  text("Move: " + moveCount, 10, 10);
  text("Click a hex in a straight line to move", 10, 30);
}

function createHexGrid() {
  grid = [];
  for (let q = -cols; q <= cols; q++) {
    for (let r = -rows; r <= rows; r++) {
      if (Math.abs(q + r) <= cols) {
        grid.push({ q, r });
      }
    }
  }
}

function drawGrid() {
  stroke(150);
  for (let cell of grid) {
    let pos = hexToPixel(cell.q, cell.r);
    drawHex(pos.x, pos.y);
  }
}

function drawHex(x, y) {
  beginShape();
  fill(0, 255, 0);
  for (let i = 0; i < 6; i++) {
    let angle = (PI / 3) * i + PI / 6;
    let vx = x + cos(angle) * hexSize;
    let vy = y + sin(angle) * hexSize;
    vertex(vx, vy);
  }
  endShape(CLOSE);
}

function hexToPixel(q, r) {
  let x = hexSize * (sqrt(3) * q + (sqrt(3) / 2) * r);
  let y = hexSize * ((3 / 2) * r);
  return { x: width / 2 + x, y: height / 2 + y };
}

function drawPlayer() {
  let pos = hexToPixel(playerPos.q, playerPos.r);
  fill(0, 100, 255);
  ellipse(pos.x, pos.y, hexSize * 0.8);
}

function drawGoal() {
  let pos = hexToPixel(goalPos.q, goalPos.r);
  fill(255, 0, 0);
  ellipse(pos.x, pos.y, hexSize * 0.8);
}

function mousePressed() {
  let clicked = pixelToHex(mouseX - width / 2, mouseY - height / 2);
  if (clicked) {
    let dq = clicked.q - playerPos.q;
    let dr = clicked.r - playerPos.r;
    let dist = hexDistance(playerPos, clicked);

    // Check if straight line & correct distance
    if (dist === moveCount && isStraightLine(dq, dr)) {
      playerPos = clicked;
      if (playerPos.q === goalPos.q && playerPos.r === goalPos.r) {
        alert("You Win!");
        noLoop();
      } else {
        rollMove();
      }
    }
  }
}

function pixelToHex(px, py) {
  let q = ((sqrt(3) / 3) * px - (1 / 3) * py) / hexSize;
  let r = ((2 / 3) * py) / hexSize;
  return hexRound(q, r);
}

function hexRound(q, r) {
  let s = -q - r;
  let rq = round(q);
  let rr = round(r);
  let rs = round(s);

  let qDiff = abs(rq - q);
  let rDiff = abs(rr - r);
  let sDiff = abs(rs - s);

  if (qDiff > rDiff && qDiff > sDiff) {
    rq = -rr - rs;
  } else if (rDiff > sDiff) {
    rr = -rq - rs;
  }
  return { q: rq, r: rr };
}

function hexDistance(a, b) {
  return (abs(a.q - b.q) + abs(a.q + a.r - b.q - b.r) + abs(a.r - b.r)) / 2;
}

function isStraightLine(dq, dr) {
  // straight line if moving along one of 3 axes
  return dq === 0 || dr === 0 || dq + dr === 0;
}

function rollMove() {
  moveCount = int(random(1, 4)); // 1 to 3 hexes
}
