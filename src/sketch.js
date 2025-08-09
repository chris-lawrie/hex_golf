let hexSize = 40;
let rows = 4;
let cols = 5;
let grid = [];
let playerPos;
let goalPos;
let moveCount = 0;
let swingCount = 0;
let hoveredHex = null;

let tileTypes = ["grass", "sand", "green"];
let tileColors = {};

function setup() {
  createCanvas(800, 600);

  // Define colours for tile types
  tileColors = {
    grass: color("#00C800"),
    sand: color("#E6C864"),
    green: color("#96FF96"),
  };

  noiseSeed(floor(random(10000)));
  createHexGrid();
  pickStartAndGoal();
  rollMove();
}

function draw() {
  background(220);

  hoveredHex = pixelToHex(mouseX - width / 2, mouseY - height / 2);

  drawGrid();
  drawPlayer();
  drawGoal();

  // UI
  fill(0);
  textSize(18);
  textAlign(LEFT, TOP);
  text("Hit Distance: " + moveCount, 10, 10);
  text("Swings Taken: " + swingCount, 10, 30);
}

function createHexGrid() {
  grid = [];
  for (let q = -cols; q <= cols; q++) {
    for (let r = -rows; r <= rows; r++) {
      if (Math.abs(q + r) <= cols) {
        let nx = q * 0.3;
        let ny = r * 0.3;
        let n = noise(nx, ny);

        let type;
        if (n < 0.6) type = "grass";
        else if (n < 0.8) type = "sand";
        else type = "green";

        grid.push({ q, r, type });
      }
    }
  }

  // Count current tiles of each type
  let grassTiles = grid.filter((c) => c.type === "grass");
  let sandTiles = grid.filter((c) => c.type === "sand");
  let greenTiles = grid.filter((c) => c.type === "green");

  // Helper to set tile type on a random tile not already that type
  function forceTileType(tileType) {
    let candidates = grid.filter((c) => c.type !== tileType);
    if (candidates.length === 0) return;
    let tile = random(candidates);
    tile.type = tileType;
  }

  while (sandTiles.length < 10) {
    forceTileType("sand");
    sandTiles = grid.filter((c) => c.type === "sand");
  }

  while (greenTiles.length < 4) {
    forceTileType("green");
    greenTiles = grid.filter((c) => c.type === "green");
  }

  // Grass is the default, so no minimum needed; still ensure at least 1 grass tile
  if (grassTiles.length === 0) {
    forceTileType("grass");
  }
}

function drawGrid() {
  stroke(150);
  for (let cell of grid) {
    let pos = hexToPixel(cell.q, cell.r);
    let isHover = dist(mouseX, mouseY, pos.x, pos.y) < hexSize * 0.8;

    let fillCol = tileColors[cell.type];
    if (isHover) {
      fillCol = lerpColor(color(fillCol), color(255), 0.3);
    }
    fill(fillCol);
    drawHex(pos.x, pos.y);
  }
}

function drawHex(x, y) {
  beginShape();
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
  noStroke();

  // Base golf ball color (light blue)
  fill(240, 240, 240);
  ellipse(pos.x, pos.y, hexSize * 0.8);
}

function drawGoal() {
  let pos = hexToPixel(goalPos.q, goalPos.r);
  noStroke();
  fill(255, 0, 0);
  ellipse(pos.x, pos.y, hexSize * 0.8);
}

function mousePressed() {
  let clicked = pixelToHex(mouseX - width / 2, mouseY - height / 2);
  if (clicked) {
    let dq = clicked.q - playerPos.q;
    let dr = clicked.r - playerPos.r;
    let dist = hexDistance(playerPos, clicked);

    if (dist === moveCount && isStraightLine(dq, dr)) {
      swingCount++;
      playerPos = { q: clicked.q, r: clicked.r };
      if (playerPos.q === goalPos.q && playerPos.r === goalPos.r) {
        alert("You Win in " + swingCount + " swings!");
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
  let rounded = hexRound(q, r);

  for (let cell of grid) {
    if (cell.q === rounded.q && cell.r === rounded.r) {
      return { q: rounded.q, r: rounded.r };
    }
  }
  return null;
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
  return dq === 0 || dr === 0 || dq + dr === 0;
}

function rollMove() {
  // Find the tile type the player is standing on
  let currentTile = grid.find(
    (c) => c.q === playerPos.q && c.r === playerPos.r
  );
  if (!currentTile) {
    moveCount = 1; // default fallback
    return;
  }

  if (currentTile.type === "sand") {
    moveCount = 1; // Sand → 1 tile
  } else if (currentTile.type === "grass") {
    moveCount = int(random(3, 7)); // Grass → 3 to 6 tiles
  } else if (currentTile.type === "green") {
    moveCount = int(random(1, 4)); // Putting green → 1 to 3 tiles
  }
}

function pickStartAndGoal() {
  // Ensure there is at least one putting green tile
  let greens = grid.filter((c) => c.type === "green");
  if (greens.length === 0) {
    // Force one random tile to be green
    let forcedTile = random(grid);
    forcedTile.type = "green";
    greens = [forcedTile];
  }

  let tries = 0;
  let valid = false;
  while (!valid && tries < 500) {
    let s = random(grid); // Start anywhere
    let g = random(greens); // Goal on putting green
    if (s && g && hexDistance(s, g) > 3) {
      // Ensure some distance between them
      playerPos = { q: s.q, r: s.r };
      goalPos = { q: g.q, r: g.r };
      valid = true;
    }
    tries++;
  }

  // If we failed to find a valid pair after 500 tries, just pick the first options
  if (!valid) {
    playerPos = { q: grid[0].q, r: grid[0].r };
    let g = greens[0];
    goalPos = { q: g.q, r: g.r };
  }

  // Expand the putting green to be larger (4 hexes)
  let goalTile = grid.find((c) => c.q === goalPos.q && c.r === goalPos.r);
  if (goalTile) expandPuttingGreen(goalTile);
}

function expandPuttingGreen(goal) {
  let greenSet = new Set();
  let toCheck = [goal];
  let count = 0;

  while (toCheck.length > 0 && count < 4) {
    let current = toCheck.shift();
    let key = `${current.q},${current.r}`;
    if (greenSet.has(key)) continue;
    greenSet.add(key);

    // Make this tile green
    current.type = "green";
    count++;

    // Add neighbors that are grass or green for expansion
    for (let n of getNeighbors(current)) {
      if (
        (n.type === "green" || n.type === "grass") &&
        !greenSet.has(`${n.q},${n.r}`)
      ) {
        toCheck.push(n);
      }
    }
  }
}

function getNeighbors(tile) {
  let directions = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ];
  return directions
    .map((d) => grid.find((c) => c.q === tile.q + d.q && c.r === tile.r + d.r))
    .filter(Boolean);
}
