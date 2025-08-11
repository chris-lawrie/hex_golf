// --- CONFIG ---
let hexSize = 30;
let rows = 4;
let cols = 6;
let pixelSize = 5;
let ball_size = 2;

// Grid / game state
let grid = [];
let playerPos = null;
let goalPos = null;
let swingCount = 0;
let hoveredHex = null;

// Colors
let tileColors = {};

// --- CARDS ---
let deck_clubs = [];
let deck_mods = [];
let discard_clubs = [];
let discard_mods = [];
let hand_clubs = [];
let hand_mods = [];

let selectedClubIndex = null; // index into hand_clubs
let selectedModIndices = []; // indices into hand_mods
let selectedMoveCount = 0; // computed preview move count
let eligibleTargets = []; // array of {q,r}

// club / modifier definitions (templates)
const CLUB_TEMPLATES = [
  { name: "Driver", min: 4, max: 6, color: "#FFD700" },
  { name: "Iron", min: 2, max: 4, color: "#C0C0C0" },
  { name: "Wedge", min: 1, max: 2, color: "#8B4513" },
  { name: "Putter", min: 1, max: 1, color: "#228B22" },
];

const MOD_TEMPLATES = [
  { name: "Wind", kind: "post", color: "#87CEEB" }, // moves after landing
  { name: "Tailwind", kind: "pre", color: "#00BFFF" }, // increases distance (random)
  { name: "Headwind", kind: "pre", color: "#1E90FF" }, // reduces distance (random)
  { name: "Precision", kind: "pre", color: "#98FB98" }, // sets min=1
  { name: "Mega", kind: "pre", color: "#FF4500" }, // +2 max
  { name: "Chip", kind: "post", color: "#FFDAB9" }, // chip-in if near
  { name: "Fireball", kind: "pre", color: "#FF6347" }, // ignore sand penalty
  { name: "Portal", kind: "post", color: "#DA70D6" }, // teleport to random green
];

// axial directions for hex grid (q,r)
const HEX_DIRS = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

// --- p5.js setup ---
function setup() {
  createCanvas(900, 700);
  noSmooth();
  rectMode(CENTER);
  textFont("monospace");

  tileColors = {
    grass: color("#00C800"),
    sand: color("#E6C864"),
    green: color("#96FF96"),
  };

  noiseSeed(floor(random(10000)));
  createHexGrid();
  enforceTileMinimums();
  pickStartAndGoal();
  initDecks();
  drawToHand(3, hand_clubs, deck_clubs, discard_clubs);
  drawToHand(3, hand_mods, deck_mods, discard_mods);
  recomputeSelection();
}

function draw() {
  background(20);
  hoveredHex = pixelToHex(mouseX - width / 2, mouseY - height / 2);
  drawGrid();
  drawPlayer();
  drawGoal();
  drawUI();
}

// ------------------ GRID GENERATION ------------------
function createHexGrid() {
  grid = [];
  for (let q = -cols; q <= cols; q++) {
    for (let r = -rows; r <= rows; r++) {
      if (Math.abs(q + r) <= cols) {
        let n = noise(q * 0.3, r * 0.3);
        let type = n < 0.6 ? "grass" : n < 0.8 ? "sand" : "green";
        grid.push({ q, r, type });
      }
    }
  }
}

function enforceTileMinimums() {
  function count(t) {
    return grid.filter((c) => c.type === t).length;
  }
  function force(t) {
    let cand = grid.filter((c) => c.type !== t);
    if (cand.length) random(cand).type = t;
  }
  while (count("sand") < 10) force("sand");
  while (count("green") < 4) force("green");
  if (count("grass") === 0) force("grass");
}

function pickStartAndGoal() {
  let greens = grid.filter((c) => c.type === "green");
  if (!greens.length) {
    random(grid).type = "green";
    greens = grid.filter((c) => c.type === "green");
  }

  let tries = 0,
    ok = false;
  while (!ok && tries < 500) {
    let s = random(grid);
    let g = random(greens);
    if (hexDistance(s, g) > 3) {
      playerPos = { q: s.q, r: s.r };
      goalPos = { q: g.q, r: g.r };
      ok = true;
    }
    tries++;
  }
  if (!ok) {
    playerPos = { q: grid[0].q, r: grid[0].r };
    goalPos = { q: greens[0].q, r: greens[0].r };
  }
  // expand green cluster around goal
  let tile = getCell(goalPos.q, goalPos.r);
  if (tile) expandPuttingGreen(tile);
}

function expandPuttingGreen(goal) {
  let seen = new Set();
  let queue = [goal];
  let count = 0;
  while (queue.length && count < 4) {
    let cur = queue.shift();
    let key = `${cur.q},${cur.r}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cur.type = "green";
    count++;
    for (let n of getNeighbors(cur))
      if (!seen.has(`${n.q},${n.r}`)) queue.push(n);
  }
}

function getNeighbors(tile) {
  return HEX_DIRS.map((d) => getCell(tile.q + d.q, tile.r + d.r)).filter(
    Boolean
  );
}

function getCell(q, r) {
  return grid.find((c) => c.q === q && c.r === r) || null;
}

// ------------------ DECK / HAND ------------------
function initDecks() {
  deck_clubs = [];
  deck_mods = [];
  for (let i = 0; i < 3; i++)
    deck_clubs.push(...CLUB_TEMPLATES.map((c) => ({ ...c }))); // clones
  for (let i = 0; i < 3; i++)
    deck_mods.push(...MOD_TEMPLATES.map((m) => ({ ...m })));
  shuffle(deck_clubs, true);
  shuffle(deck_mods, true);
  discard_clubs = [];
  discard_mods = [];
  hand_clubs = [];
  hand_mods = [];
}

function drawToHand(n, hand, deck, discard) {
  for (let i = 0; i < n; i++) {
    if (deck.length === 0) {
      deck.push(...discard);
      discard.length = 0;
      shuffle(deck, true);
    }
    if (deck.length) hand.push(deck.pop());
  }
}

// ------------------ SELECTION / PREVIEW ------------------
function recomputeSelection() {
  eligibleTargets = [];
  selectedMoveCount = 0;
  if (selectedClubIndex == null) return;
  let club = hand_clubs[selectedClubIndex];
  if (!club) return;

  // base range
  let min = club.min;
  let max = club.max;

  // tile effect at current location
  let curCell = getCell(playerPos.q, playerPos.r);
  let ignoreSand = false;
  if (curCell && curCell.type === "green") min = 1; // precision on green

  // apply pre modifiers
  let deltaMin = 0,
    deltaMax = 0;
  for (let mi of selectedModIndices) {
    let mod = hand_mods[mi];
    if (!mod) continue;
    if (mod.name === "Tailwind") {
      let add = random([1, 2]);
      deltaMax += add;
      deltaMin += 0; // random add to max
    } else if (mod.name === "Headwind") {
      let sub = random([1, 2]);
      deltaMax -= sub;
      deltaMin -= sub;
    } else if (mod.name === "Mega") {
      deltaMax += 2;
    } else if (mod.name === "Precision") {
      min = 1;
    } else if (mod.name === "Fireball") {
      ignoreSand = true;
    }
  }

  // sand penalty unless Fireball present
  if (curCell && curCell.type === "sand" && !ignoreSand) {
    deltaMax -= 1;
  }

  let finalMin = Math.max(1, Math.round(min + deltaMin));
  let finalMax = Math.max(finalMin, Math.round(max + deltaMax));

  // pick a random move count now (so player sees exact preview)
  selectedMoveCount = Math.floor(random(finalMin, finalMax + 1));

  // compute eligible targets along 6 directions
  for (let d of HEX_DIRS) {
    let q = playerPos.q + d.q * selectedMoveCount;
    let r = playerPos.r + d.r * selectedMoveCount;
    let cell = getCell(q, r);
    if (cell) eligibleTargets.push({ q, r });
  }
}

// ------------------ DRAWING ------------------
function drawGrid() {
  for (let cell of grid) {
    let pos = hexToPixel(cell.q, cell.r);
    let col = tileColors[cell.type];
    if (hoveredHex && hoveredHex.q === cell.q && hoveredHex.r === cell.r)
      col = color(255, 255, 0);

    drawHexPixel(pos.x, pos.y, col);

    // draw eligible dots
    if (eligibleTargets.find((t) => t.q === cell.q && t.r === cell.r)) {
      fill(200, 0, 0);
      noStroke();
      // pixel-art dot
      rect(pos.x, pos.y, pixelSize * 1.4, pixelSize * 1.4);
    }
  }
}

function drawHexPixel(cx, cy, col) {
  // draw pixel blocks inside polygon; fill with overlapping rects to avoid gaps
  let verts = [];
  for (let i = 0; i < 6; i++) {
    let a = (PI / 3) * i + PI / 6;
    verts.push([cx + cos(a) * hexSize, cy + sin(a) * hexSize]);
  }
  fill(col);
  noStroke();
  // slightly overlap pixels (+1) to prevent background seams
  for (let x = cx - hexSize; x <= cx + hexSize; x += pixelSize - 0.6) {
    for (let y = cy - hexSize; y <= cy + hexSize; y += pixelSize - 0.6) {
      if (pointInPolygon(x, y, verts))
        rect(x, y, pixelSize + 0.8, pixelSize + 0.8);
    }
  }
}

function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    let xi = poly[i][0],
      yi = poly[i][1];
    let xj = poly[j][0],
      yj = poly[j][1];
    let intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function drawPlayer() {
  if (!playerPos) return;
  let pos = hexToPixel(playerPos.q, playerPos.r);
  fill(255);
  for (let dx = -ball_size; dx <= ball_size; dx++) {
    for (let dy = -ball_size; dy <= ball_size; dy++) {
      if (dist(0, 0, dx, dy) <= ball_size)
        rect(
          pos.x + dx * pixelSize,
          pos.y + dy * pixelSize,
          pixelSize,
          pixelSize
        );
    }
  }
}

function drawGoal() {
  if (!goalPos) return;
  let pos = hexToPixel(goalPos.q, goalPos.r);
  fill(50);
  for (let dx = -ball_size; dx <= ball_size; dx++) {
    for (let dy = -ball_size; dy <= ball_size; dy++) {
      if (dist(0, 0, dx, dy) <= ball_size)
        rect(
          pos.x + dx * pixelSize,
          pos.y + dy * pixelSize,
          pixelSize,
          pixelSize
        );
    }
  }
  // flag pole
  stroke(0);
  strokeWeight(2);
  line(pos.x, pos.y, pos.x, pos.y - 22);
  noStroke();
  fill("#FF0000");
  triangle(pos.x, pos.y - 22, pos.x + 10, pos.y - 17, pos.x, pos.y - 13);
}

// ------------------ UI & INTERACTION ------------------
function drawUI() {
  // top text: tile info & selected move
  fill(255);
  textAlign(CENTER, TOP);
  let tile = getCell(playerPos.q, playerPos.r);
  let info = tile
    ? `${tile.type.toUpperCase()} (${
        tile.type === "sand"
          ? "max-1"
          : tile.type === "green"
          ? "precision"
          : "normal"
      })`
    : "";
  text(info, width / 2, 8);

  // swings & selected move
  textAlign(LEFT, TOP);
  text(`Swings: ${swingCount}`, 10, 10);
  if (selectedClubIndex != null) {
    let c = hand_clubs[selectedClubIndex];
    text(
      `Selected: ${c.name}  → Strike Distance: ${selectedMoveCount}`,
      10,
      height - 100
    );
  } else {
    text("Select a club", 10, height - 100);
  }
  text("Select modifier(s)", width - 150, height - 100);

  // draw club hand (left)
  let startX = 10;
  for (let i = 0; i < hand_clubs.length; i++) {
    let cx = startX + i * 70 + 30; // center x
    let cy = height - 45;
    let card = hand_clubs[i];
    fill(card.color);
    rect(cx, cy, 60, 70);
    fill(0);
    textAlign(CENTER, CENTER);
    text(card.name, cx, cy - 5);
    text(`${card.min}-${card.max}`, cx, cy + 18);
    if (selectedClubIndex === i) {
      noFill();
      stroke(255, 0, 0);
      strokeWeight(3);
      rect(cx, cy, 66, 76);
      noStroke();
    }
  }

  // draw modifier hand (right)
  let modsCount = hand_mods.length;
  let rightStartX = width - modsCount * 70 - 10;
  for (let i = 0; i < modsCount; i++) {
    let cx = rightStartX + i * 70 + 30;
    let cy = height - 45;
    let card = hand_mods[i];
    fill(card.color);
    rect(cx, cy, 60, 70);
    fill(0);
    textAlign(CENTER, CENTER);
    text(card.name, cx, cy - 5);
    if (selectedModIndices.includes(i)) {
      noFill();
      stroke(255, 0, 0);
      strokeWeight(3);
      rect(cx, cy, 66, 76);
      noStroke();
    }
  }
}

function mousePressed() {
  // check club clicks (left)
  let startX = 10;
  for (let i = 0; i < hand_clubs.length; i++) {
    let cx = startX + i * 70 + 30;
    let cy = height - 45;
    if (
      mouseX > cx - 30 &&
      mouseX < cx + 30 &&
      mouseY > cy - 35 &&
      mouseY < cy + 35
    ) {
      // select/deselect club
      if (selectedClubIndex === i) selectedClubIndex = null;
      else selectedClubIndex = i;
      recomputeSelection();
      return;
    }
  }

  // check modifier clicks (right)
  let modsCount = hand_mods.length;
  let rightStartX = width - modsCount * 70 - 10;
  for (let i = 0; i < modsCount; i++) {
    let cx = rightStartX + i * 70 + 30;
    let cy = height - 45;
    if (
      mouseX > cx - 30 &&
      mouseX < cx + 30 &&
      mouseY > cy - 35 &&
      mouseY < cy + 35
    ) {
      let idx = selectedModIndices.indexOf(i);
      if (idx >= 0) selectedModIndices.splice(idx, 1);
      else selectedModIndices.push(i);
      recomputeSelection();
      return;
    }
  }

  // attempt to play shot if club selected
  if (selectedClubIndex != null && selectedMoveCount > 0) {
    let clicked = pixelToHex(mouseX - width / 2, mouseY - height / 2);
    if (!clicked) return;
    // is clicked tile an eligible target?
    if (!eligibleTargets.find((t) => t.q === clicked.q && t.r === clicked.r))
      return;

    // perform base move
    playerPos = { q: clicked.q, r: clicked.r };

    // compute direction unit vector for later use
    let dir = { q: clicked.q - playerPos.q, r: clicked.r - playerPos.r }; // note: this is 0 after assignment, so compute before changing playerPos — fix below
    // correct approach: we need dir from prevPos → clicked
    // We'll compute prevPos and dir properly
  }
}

// Because we assigned playerPos above early, we need to restructure performShot logic.
// To keep code tidy, separate shot execution into performShot(target)
function performShot(target) {
  // target is {q,r}
  let prev = { q: playerPos.q, r: playerPos.r };
  let dir = { q: target.q - prev.q, r: target.r - prev.r };
  // normalize dir to unit step (divide by selectedMoveCount)
  let unit = {
    q: Math.round(dir.q / selectedMoveCount),
    r: Math.round(dir.r / selectedMoveCount),
  };

  // move to target
  playerPos = { q: target.q, r: target.r };

  // apply POST modifiers (Wind, Portal, Chip)
  // iterate selectedModIndices -> get mod from hand_mods
  for (let mi of selectedModIndices) {
    let mod = hand_mods[mi];
    if (!mod) continue;
    if (mod.name === "Wind") {
      // move 1-2 steps in random dir, step-by-step (clamped to grid)
      let steps = Math.floor(random(1, 3));
      let d = random(HEX_DIRS);
      for (let s = 0; s < steps; s++) {
        let nxt = getCell(playerPos.q + d.q, playerPos.r + d.r);
        if (nxt) playerPos = { q: nxt.q, r: nxt.r };
        else break;
      }
    } else if (mod.name === "Portal") {
      // teleport to random green tile
      let greens = grid.filter((c) => c.type === "green");
      if (greens.length) {
        let g = random(greens);
        playerPos = { q: g.q, r: g.r };
      }
    } else if (mod.name === "Chip") {
      if (hexDistance(playerPos, goalPos) <= 2) {
        playerPos = { q: goalPos.q, r: goalPos.r };
      }
    }
  }

  // discard used cards and draw replacements
  // discard club
  let clubCard = hand_clubs[selectedClubIndex];
  if (clubCard) discard_clubs.push(clubCard);
  // discard modifiers (map indices to cards)
  let modsToDiscard = [];
  for (let mi of selectedModIndices) modsToDiscard.push(hand_mods[mi]);
  for (let m of modsToDiscard) if (m) discard_mods.push(m);

  // remove from hands (remove larger indices first to avoid reindexing issues)
  // remove modifiers by their indices sorted descending
  selectedModIndices.sort((a, b) => b - a);
  for (let mi of selectedModIndices) hand_mods.splice(mi, 1);
  // remove club
  hand_clubs.splice(selectedClubIndex, 1);

  // reset selection
  selectedClubIndex = null;
  selectedModIndices = [];
  selectedMoveCount = 0;
  eligibleTargets = [];

  // draw replacements
  drawToHand(1, hand_clubs, deck_clubs, discard_clubs);
  drawToHand(modsToDiscard.length || 1, hand_mods, deck_mods, discard_mods);

  swingCount++;

  // check win
  if (playerPos.q === goalPos.q && playerPos.r === goalPos.r) {
    setTimeout(() => alert(`You win in ${swingCount} swings!`), 50);
    noLoop();
  }
}

// We'll intercept mousePressed again to use performShot correctly — fix above
function mouseReleased() {
  // this handles clicking on eligible tile after club selection
  // compute click position as tile
}

// To avoid confusion with mousePressed earlier, override it fully here
function mouseClicked() {
  // card selection first
  // club selection (left)
  let startX = 10;
  for (let i = 0; i < hand_clubs.length; i++) {
    let cx = startX + i * 70 + 30;
    let cy = height - 45;
    if (
      mouseX > cx - 30 &&
      mouseX < cx + 30 &&
      mouseY > cy - 35 &&
      mouseY < cy + 35
    ) {
      if (selectedClubIndex === i) selectedClubIndex = null;
      else selectedClubIndex = i;
      recomputeSelection();
      return;
    }
  }
  // modifier selection (right)
  let modsCount = hand_mods.length;
  let rightStartX = width - modsCount * 70 - 10;
  for (let i = 0; i < modsCount; i++) {
    let cx = rightStartX + i * 70 + 30;
    let cy = height - 45;
    if (
      mouseX > cx - 30 &&
      mouseX < cx + 30 &&
      mouseY > cy - 35 &&
      mouseY < cy + 35
    ) {
      let idx = selectedModIndices.indexOf(i);
      if (idx >= 0) selectedModIndices.splice(idx, 1);
      else selectedModIndices.push(i);
      recomputeSelection();
      return;
    }
  }

  // clicking on a hex tile to perform shot
  if (selectedClubIndex != null && selectedMoveCount > 0) {
    let tile = pixelToHex(mouseX - width / 2, mouseY - height / 2);
    if (!tile) return;
    let match = eligibleTargets.find((t) => t.q === tile.q && t.r === tile.r);
    if (match) {
      // perform shot using PRE-calculated target
      performShot(match);
    }
  }
}

// ------------------ MISC: DRAWING HELPERS & HEX UTILS ------------------
function hexToPixel(q, r) {
  let x = hexSize * (sqrt(3) * q + (sqrt(3) / 2) * r);
  let y = hexSize * ((3 / 2) * r);
  return { x: width / 2 + x, y: height / 2 + y };
}

function pixelToHex(px, py) {
  let q = ((sqrt(3) / 3) * px - (1 / 3) * py) / hexSize;
  let r = ((2 / 3) * py) / hexSize;
  return hexRound(q, r);
}

function hexRound(q, r) {
  let s = -q - r;
  let rq = Math.round(q),
    rr = Math.round(r),
    rs = Math.round(s);
  let qDiff = Math.abs(rq - q),
    rDiff = Math.abs(rr - r),
    sDiff = Math.abs(rs - s);
  if (qDiff > rDiff && qDiff > sDiff) rq = -rr - rs;
  else if (rDiff > sDiff) rr = -rq - rs;
  return { q: rq, r: rr };
}

function hexDistance(a, b) {
  return (
    (Math.abs(a.q - b.q) +
      Math.abs(a.q + a.r - b.q - b.r) +
      Math.abs(a.r - b.r)) /
    2
  );
}
