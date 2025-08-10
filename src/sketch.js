// === SETTINGS ===
let hexSize = 40;
let rows = 4;
let cols = 6;
let ball_size = 2;
let pixelSize = 4;

let grid = [];
let playerPos;
let goalPos;
let moveCount = 0;
let swingCount = 0;
let hoveredHex = null;
let tileColors = {};

// === CARD SYSTEM ===
let deck = [];
let discardPile = [];
let hand = [];
let clubs = [
  { name: "Driver", min: 4, max: 6, color: "#FFD700" },
  { name: "Iron", min: 2, max: 4, color: "#C0C0C0" },
  { name: "Wedge", min: 1, max: 2, color: "#8B4513" },
  { name: "Putter", min: 1, max: 1, color: "#228B22" },
];
let selectedCardIndex = null;

function setup() {
  createCanvas(800, 600);
  noSmooth(); // for crisp pixel art

  tileColors = {
    grass: color("#00C800"),
    sand: color("#E6C864"),
    green: color("#96FF96"),
  };

  noiseSeed(floor(random(10000)));
  createHexGrid();
  enforceTileMinimums();
  pickStartAndGoal();
  initDeck();
  drawCards(3);
}

function draw() {
  background(0);
  hoveredHex = pixelToHex(mouseX - width / 2, mouseY - height / 2);
  drawGrid();
  drawPlayer();
  drawGoal();
  drawUI();
}

// === GRID GENERATION ===
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
}

function enforceTileMinimums() {
  function countType(type) {
    return grid.filter((c) => c.type === type).length;
  }
  function forceTileType(tileType) {
    let candidates = grid.filter((c) => c.type !== tileType);
    if (candidates.length) random(candidates).type = tileType;
  }
  while (countType("sand") < 10) forceTileType("sand");
  while (countType("green") < 4) forceTileType("green");
  if (countType("grass") === 0) forceTileType("grass");
}

function pickStartAndGoal() {
  let greens = grid.filter((c) => c.type === "green");
  if (!greens.length) {
    let forcedTile = random(grid);
    forcedTile.type = "green";
    greens = [forcedTile];
  }

  let tries = 0;
  let valid = false;
  while (!valid && tries < 500) {
    let s = random(grid);
    let g = random(greens);
    if (hexDistance(s, g) > 3) {
      playerPos = { q: s.q, r: s.r };
      goalPos = { q: g.q, r: g.r };
      valid = true;
    }
    tries++;
  }
  if (!valid) {
    playerPos = { q: grid[0].q, r: grid[0].r };
    goalPos = { q: greens[0].q, r: greens[0].r };
  }
  expandPuttingGreen(grid.find((c) => c.q === goalPos.q && c.r === goalPos.r));
}

function expandPuttingGreen(goal) {
  let greenSet = new Set();
  let toCheck = [goal];
  let count = 0;

  while (toCheck.length && count < 4) {
    let current = toCheck.shift();
    let key = `${current.q},${current.r}`;
    if (greenSet.has(key)) continue;
    greenSet.add(key);
    current.type = "green";
    count++;
    for (let n of getNeighbors(current)) {
      if (
        ["green", "grass"].includes(n.type) &&
        !greenSet.has(`${n.q},${n.r}`)
      ) {
        toCheck.push(n);
      }
    }
  }
}

function getNeighbors(tile) {
  let dirs = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ];
  return dirs
    .map((d) => grid.find((c) => c.q === tile.q + d.q && c.r === tile.r + d.r))
    .filter(Boolean);
}

// === DRAWING ===
function drawGrid() {
  for (let cell of grid) {
    let pos = hexToPixel(cell.q, cell.r);
    let fillCol = tileColors[cell.type];

    // Highlight hovered hex
    if (hoveredHex && hoveredHex.q === cell.q && hoveredHex.r === cell.r) {
      fillCol = color(255, 255, 0);
    }

    drawHexPixel(pos.x, pos.y, fillCol);

    //   // Eligible move dots
    //   if (selectedCardIndex != null) {
    //     let card = hand[selectedCardIndex];
    //     let distHex = hexDistance(playerPos, cell);
    //     if (distHex >= card.min && distHex <= card.max) {
    //       fill(0, 0, 250);
    //       noStroke();
    //       ellipse(pos.x, pos.y, 6, 6);
    //     }
    //   }
    // }

    // Draw eligible move dot (small pixel square)
    if (isEligibleMove(cell)) {
      fill(0);
      let pxSize = hexSize / 6;
      rect(pos.x, pos.y, pxSize * 0.8, pxSize * 0.8);
    }
  }
}

function isStraightLine(dq, dr) {
  return dq === 0 || dr === 0 || dq + dr === 0;
}

function isEligibleMove(cell) {
  if (!playerPos || moveCount === 0) return false;
  if (cell.q === playerPos.q && cell.r === playerPos.r) return false;
  let dist = hexDistance(playerPos, cell);
  if (!isStraightLine(cell.q - playerPos.q, cell.r - playerPos.r)) return false;
  return dist === moveCount;
}

function drawHexPixel(cx, cy, col) {
  let verts = [];
  for (let i = 0; i < 6; i++) {
    let angle = (PI / 3) * i + PI / 6;
    verts.push([cx + cos(angle) * hexSize, cy + sin(angle) * hexSize]);
  }
  fill(col);
  noStroke();
  for (let x = cx - hexSize; x <= cx + hexSize; x += pixelSize) {
    for (let y = cy - hexSize; y <= cy + hexSize; y += pixelSize) {
      if (pointInPolygon(x, y, verts)) rect(x, y, pixelSize, pixelSize);
    }
  }
}

function pointInPolygon(px, py, verts) {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    let xi = verts[i][0],
      yi = verts[i][1];
    let xj = verts[j][0],
      yj = verts[j][1];
    let intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function drawPlayer() {
  let pos = hexToPixel(playerPos.q, playerPos.r);
  fill(255);
  for (let x = -ball_size; x <= ball_size; x++) {
    for (let y = -ball_size; y <= ball_size; y++) {
      if (dist(0, 0, x, y) <= ball_size) {
        rect(
          pos.x + x * pixelSize,
          pos.y + y * pixelSize,
          pixelSize,
          pixelSize
        );
      }
    }
  }
}

function drawGoal() {
  let pos = hexToPixel(goalPos.q, goalPos.r);
  fill(0);
  for (let x = -ball_size; x <= ball_size; x++) {
    for (let y = -ball_size; y <= ball_size; y++) {
      if (dist(0, 0, x, y) <= ball_size) {
        rect(
          pos.x + x * pixelSize,
          pos.y + y * pixelSize,
          pixelSize,
          pixelSize
        );
      }
    }
  }
}

// === UI ===
function drawUI() {
  fill(255);
  textAlign(LEFT, TOP);
  text(`Swings: ${swingCount}`, 10, 10);
  text(`Select a club`, 10, 30);
  if (selectedCardIndex != null) {
    let card = hand[selectedCardIndex];
    text(`Swing Distance: ${card.min}-${card.max}`, 10, 50);
  }

  let cardX = 10;
  for (let i = 0; i < hand.length; i++) {
    let card = hand[i];
    fill(card.color);
    rect(cardX, height - 80, 60, 70);
    fill(0);
    textAlign(CENTER, CENTER);
    text(card.name, cardX + 30, height - 65);
    text(`${card.min}-${card.max}`, cardX + 30, height - 45);
    if (selectedCardIndex === i) {
      noFill();
      stroke(255, 0, 0);
      strokeWeight(3);
      rect(cardX - 2, height - 82, 64, 74);
      noStroke();
    }
    cardX += 70;
  }
}

// === INTERACTION ===
function mousePressed() {
  // Card selection
  let cardX = 10;
  for (let i = 0; i < hand.length; i++) {
    if (
      mouseX > cardX &&
      mouseX < cardX + 60 &&
      mouseY > height - 80 &&
      mouseY < height - 10
    ) {
      selectedCardIndex = i;
      return;
    }
    cardX += 70;
  }
  // Movement if card selected
  if (selectedCardIndex != null) {
    let clicked = pixelToHex(mouseX - width / 2, mouseY - height / 2);
    if (!clicked) return;
    let card = hand[selectedCardIndex];
    let distHex = hexDistance(playerPos, clicked);
    if (distHex >= card.min && distHex <= card.max) {
      playerPos = { q: clicked.q, r: clicked.r };
      swingCount++;
      discardPile.push(card);
      hand.splice(selectedCardIndex, 1);
      selectedCardIndex = null;
      drawCards(1);
      if (playerPos.q === goalPos.q && playerPos.r === goalPos.r)
        alert("You win!");
    }
  }
}

// === CARDS ===
function initDeck() {
  deck = [];
  for (let i = 0; i < 4; i++) deck.push(...clubs);
  shuffle(deck, true);
}

function drawCards(n) {
  for (let i = 0; i < n; i++) {
    if (deck.length === 0) {
      deck = shuffle(discardPile, true);
      discardPile = [];
    }
    if (deck.length) hand.push(deck.pop());
  }
}

// === HEX UTILS ===
function hexToPixel(q, r) {
  let x = hexSize * (sqrt(3) * q + (sqrt(3) / 2) * r);
  let y = hexSize * ((3 / 2) * r);
  return { x: width / 2 + x, y: height / 2 + y };
}

function pixelToHex(px, py) {
  let q = ((sqrt(3) / 3) * px - (1 / 3) * py) / hexSize;
  let r = ((2 / 3) * py) / hexSize;
  let rounded = hexRound(q, r);
  for (let cell of grid)
    if (cell.q === rounded.q && cell.r === rounded.r)
      return { q: rounded.q, r: rounded.r };
  return null;
}

function hexRound(q, r) {
  let s = -q - r;
  let rq = round(q),
    rr = round(r),
    rs = round(s);
  let qDiff = abs(rq - q),
    rDiff = abs(rr - r),
    sDiff = abs(rs - s);
  if (qDiff > rDiff && qDiff > sDiff) rq = -rr - rs;
  else if (rDiff > sDiff) rr = -rq - rs;
  return { q: rq, r: rr };
}

function hexDistance(a, b) {
  return (abs(a.q - b.q) + abs(a.q + a.r - b.q - b.r) + abs(a.r - b.r)) / 2;
}
