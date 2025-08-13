// === Golf Hex — Full Working Sketch ===
// Pixel-art hex golf with club + modifier cards (stackable)

// --- CONFIG ---
let hexSize = 31;
let rows = 5;
let cols = 7;
let pixelSize = 2; // Reduced pixel size for higher density
let ball_size = 4; // Increased ball size to maintain proportions

// Grid / game state
let grid = [];
let playerPos = null;
let goalPos = null;
let swingCount = 0;
let hoveredHex = null;

// Responsive sizing
let baseHexSize = 31;
let minHexSize = 25;
let maxHexSize = 40;

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

// Add new state variables at the top with other state variables
let selectedDirection = null; // Index into HEX_DIRS (0-5) or null
let targetPos = null; // The target position based on direction and distance

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

// Add DOM element references
let swingsCountElement;
let tileInfoElement;
let shotPreviewElement;
let clubsContainer;
let modifiersContainer;
let swingButton;

// --- p5.js setup ---
function setup() {
  createCanvas(windowWidth, windowHeight);
  noSmooth();
  rectMode(CENTER);
  textFont("monospace");

  // Get DOM elements
  swingsCountElement = document.getElementById("swings-count");
  tileInfoElement = document.getElementById("tile-info");
  shotPreviewElement = document.getElementById("shot-preview");
  clubsContainer = document.getElementById("clubs-container");
  modifiersContainer = document.getElementById("modifiers-container");
  swingButton = document.getElementById("swing-button");

  // Calculate responsive hex size based on window dimensions
  hexSize = constrain(min(windowWidth, windowHeight) / 25, minHexSize, maxHexSize);

  tileColors = {
    grass: color("#00C800"),
    sand: color("#E6C864"),
    green: color("#96FF96"),
    tree: color("#006400"),
    water: color("#4169E1"),
  };

  noiseSeed(floor(random(10000)));
  createHexGrid();
  enforceTileMinimums();
  pickStartAndGoal();

  initDecks();
  drawToHand(3, hand_clubs, deck_clubs, discard_clubs);
  drawToHand(3, hand_mods, deck_mods, discard_mods);

  updateUI();
  recomputeSelection();

  // Add swing button click handler
  swingButton.addEventListener("click", () => {
    if (selectedDirection !== null && targetPos) {
      executeSwing();
    }
  });
}

// Add window resize handler
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  hexSize = constrain(min(windowWidth, windowHeight) / 25, minHexSize, maxHexSize);
  recomputeSelection();
}

function draw() {
  background(20);
  translate(width / 2, height / 2);
  hoveredHex = pixelToHex(mouseX - width / 2, mouseY - height / 2);
  drawGrid();
  drawPlayer();
  drawGoal();
  translate(-width / 2, -height / 2); // Reset translation for UI
  updateUI(); // Call updateUI here to draw the UI elements
}

// ------------------ GRID GENERATION ------------------
function createHexGrid() {
  grid = [];
  for (let q = -cols; q <= cols; q++) {
    for (let r = -rows; r <= rows; r++) {
      if (Math.abs(q + r) <= cols) {
        let n = noise(q * 0.3, r * 0.3);
        let n2 = noise((q + 100) * 0.4, (r + 100) * 0.4); // Second noise for more variety

        // Use both noise values to determine tile type
        let type;
        if (n < 0.3) {
          type = "grass";
        } else if (n < 0.7) {
          // Use second noise to differentiate between tree and grass
          type = n2 < 0.5 ? "grass" : "tree";
        } else if (n < 0.75) {
          // Use second noise to differentiate between water and sand
          type = n2 < 0.5 ? "sand" : "water";
        } else {
          type = "green";
        }

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
  while (count("sand") < 8) force("sand");
  while (count("green") < 4) force("green");
  while (count("tree") < 6) force("tree");
  while (count("water") < 4) force("water");
  if (count("grass") < 10) force("grass");
}

function pickStartAndGoal() {
  // First pick a goal position on a suitable tile
  let tries = 0;
  let goalTile = null;

  // Find a suitable goal position that has enough space around it for the green
  while (!goalTile && tries < 500) {
    let candidate = random(grid);
    let neighbors = getNeighborsWithinDistance(candidate, 2);
    if (neighbors.length >= 4) {
      // Ensure we have enough space for the green
      goalTile = candidate;
    }
    tries++;
  }

  if (!goalTile) {
    goalTile = grid[0]; // Fallback if we couldn't find a good spot
  }

  // Set the goal position
  goalPos = { q: goalTile.q, r: goalTile.r };

  // Create the putting green around the goal
  expandPuttingGreen(goalTile);

  // Now pick a start position on grass, away from the goal
  tries = 0;
  let startTile = null;
  while (!startTile && tries < 500) {
    let candidate = random(grid);
    if (candidate.type === "grass" && hexDistance(candidate, goalTile) > 3) {
      startTile = candidate;
    }
    tries++;
  }

  if (!startTile) {
    // If we couldn't find a good grass tile, force the nearest non-green tile to be grass
    let nonGreenTiles = grid
      .filter((t) => t.type !== "green")
      .sort((a, b) => hexDistance(a, goalTile) - hexDistance(b, goalTile));
    if (nonGreenTiles.length) {
      startTile = nonGreenTiles[0];
      startTile.type = "grass";
    } else {
      startTile = grid[0]; // Absolute fallback
      startTile.type = "grass";
    }
  }

  playerPos = { q: startTile.q, r: startTile.r };
}

function expandPuttingGreen(goal) {
  // Clear any existing green tiles that aren't part of this green
  grid.forEach((tile) => {
    if (tile.type === "green" && hexDistance(tile, goal) > 2) {
      tile.type = "grass";
    }
  });

  // Create the putting green cluster
  let seen = new Set();
  let queue = [goal];
  let greenTiles = [];

  // First, collect all potential green tiles within distance 2
  let potentialGreen = getNeighborsWithinDistance(goal, 2);
  potentialGreen.push(goal);

  // Randomly select 4-8 tiles from the potential tiles to become green
  let numGreenTiles = floor(random(4, 9));
  shuffle(potentialGreen, true);

  // Always include the goal tile and its immediate neighbors first
  let immediateNeighbors = getNeighbors(goal);
  let greenSet = new Set();

  // Add goal tile
  goal.type = "green";
  greenSet.add(`${goal.q},${goal.r}`);

  // Add some immediate neighbors
  for (let neighbor of immediateNeighbors) {
    if (greenSet.size >= numGreenTiles) break;
    neighbor.type = "green";
    greenSet.add(`${neighbor.q},${neighbor.r}`);
  }

  // Fill remaining slots with other nearby tiles
  for (let tile of potentialGreen) {
    if (greenSet.size >= numGreenTiles) break;
    if (!greenSet.has(`${tile.q},${tile.r}`)) {
      tile.type = "green";
      greenSet.add(`${tile.q},${tile.r}`);
    }
  }
}

function getNeighbors(tile) {
  return HEX_DIRS.map((d) => getCell(tile.q + d.q, tile.r + d.r)).filter(Boolean);
}

function getCell(q, r) {
  return grid.find((c) => c.q === q && c.r === r) || null;
}

// Helper function to get neighbors within a certain distance
function getNeighborsWithinDistance(tile, distance) {
  let neighbors = new Set();
  let seen = new Set(`${tile.q},${tile.r}`);
  let queue = [{ tile: tile, dist: 0 }];

  while (queue.length > 0) {
    let current = queue.shift();
    if (current.dist < distance) {
      let currentNeighbors = getNeighbors(current.tile);
      for (let neighbor of currentNeighbors) {
        let key = `${neighbor.q},${neighbor.r}`;
        if (!seen.has(key)) {
          seen.add(key);
          neighbors.add(neighbor);
          queue.push({ tile: neighbor, dist: current.dist + 1 });
        }
      }
    }
  }

  return Array.from(neighbors);
}

// Add shuffle function if not already present
function shuffle(array, inPlace = false) {
  let arr = inPlace ? array : [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    let j = floor(random(i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ------------------ DECK / HAND ------------------
function initDecks() {
  deck_clubs = [];
  deck_mods = [];
  // fill decks with copies
  for (let i = 0; i < 3; i++) deck_clubs.push(...CLUB_TEMPLATES.map((c) => ({ ...c }))); // clones
  for (let i = 0; i < 3; i++) deck_mods.push(...MOD_TEMPLATES.map((m) => ({ ...m })));
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
  if (selectedClubIndex === null) {
    selectedMoveCount = 0;
    return;
  }
  let club = hand_clubs[selectedClubIndex];
  if (!club) return;

  // base range
  let min = club.min;
  let max = club.max;

  // tile effect at current location
  let curCell = getCell(playerPos.q, playerPos.r);
  let ignoreSand = false;
  let ignoreWater = false;
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
      ignoreWater = true; // Fireball also helps with water hazards
    }
  }

  // sand penalty unless Fireball present
  if (curCell && curCell.type === "sand" && !ignoreSand) {
    deltaMax -= 1;
  }

  // water penalty unless Fireball present
  if (curCell && curCell.type === "water" && !ignoreWater) {
    deltaMax -= 2;
    deltaMin = max(1, deltaMin - 1);
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
    // Check if target is valid (not a tree)
    if (cell && cell.type !== "tree") {
      eligibleTargets.push({ q, r });
    }
  }
}

// ------------------ DRAWING ------------------
function drawGrid() {
  // Draw base tiles
  for (let cell of grid) {
    let pos = hexToPixel(cell.q, cell.r);
    let col = tileColors[cell.type];

    // Draw base tile
    if (hoveredHex && hoveredHex.q === cell.q && hoveredHex.r === cell.r) {
      let hoverCol = color(red(col), green(col), blue(col));
      hoverCol.setAlpha(alpha(col));
      hoverCol.setRed(red(col) + (255 - red(col)) * 0.55);
      hoverCol.setGreen(green(col) + (255 - green(col)) * 0.55);
      hoverCol.setBlue(blue(col) + (255 - blue(col)) * 0.55);
      drawHexPixel(pos.x, pos.y, hoverCol);
    } else {
      drawHexPixel(pos.x, pos.y, col);
    }
  }

  // Draw direction arrows and range previews
  let startPos = hexToPixel(playerPos.q, playerPos.r);

  // Always draw direction arrows (one tile length)
  for (let i = 0; i < HEX_DIRS.length; i++) {
    let dir = HEX_DIRS[i];
    let targetQ = playerPos.q + dir.q;
    let targetR = playerPos.r + dir.r;
    let endPos = hexToPixel(targetQ, targetR);

    // Calculate if this direction is being hovered or selected
    let isSelected = selectedDirection === i;
    let isHovered = false;

    if (hoveredHex) {
      let mousePos = hexToPixel(hoveredHex.q, hoveredHex.r);
      let angleToMouse = atan2(mousePos.y - startPos.y, mousePos.x - startPos.x);
      let angleToDir = atan2(endPos.y - startPos.y, endPos.x - startPos.x);
      let angleDiff = abs(((angleToMouse - angleToDir + PI) % (2 * PI)) - PI);
      isHovered = angleDiff < PI / 6; // 30 degree tolerance
    }

    // Draw direction arrow
    if (isSelected) {
      stroke(255, 0, 0);
      strokeWeight(3);
    } else if (isHovered) {
      stroke(255, 0, 0, 150);
      strokeWeight(2);
    } else {
      stroke(255, 255, 255, 50);
      strokeWeight(1);
    }

    // Draw arrow line
    line(startPos.x, startPos.y, endPos.x, endPos.y);

    // Draw arrow head
    let angle = atan2(endPos.y - startPos.y, endPos.x - startPos.x);
    let arrowSize = 10;
    let arrowAngle = PI / 6;

    let tipX = endPos.x - arrowSize * cos(angle);
    let tipY = endPos.y - arrowSize * sin(angle);

    line(endPos.x, endPos.y, tipX - arrowSize * cos(angle - arrowAngle), tipY - arrowSize * sin(angle - arrowAngle));
    line(endPos.x, endPos.y, tipX - arrowSize * cos(angle + arrowAngle), tipY - arrowSize * sin(angle + arrowAngle));
  }

  // Draw range preview if club is selected
  if (selectedClubIndex !== null) {
    let club = hand_clubs[selectedClubIndex];
    let min = club.min;
    let max = club.max;

    // Apply modifiers to range
    let deltaMin = 0,
      deltaMax = 0;
    let ignoreSand = false,
      ignoreWater = false;

    for (let mi of selectedModIndices) {
      let mod = hand_mods[mi];
      if (!mod) continue;
      if (mod.name === "Tailwind") {
        deltaMax += random([1, 2]);
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
        ignoreWater = true;
      }
    }

    let curCell = getCell(playerPos.q, playerPos.r);
    if (curCell && curCell.type === "green") min = 1;
    if (curCell && curCell.type === "sand" && !ignoreSand) deltaMax -= 1;
    if (curCell && curCell.type === "water" && !ignoreWater) {
      deltaMax -= 2;
      deltaMin = max(1, deltaMin - 1);
    }

    let finalMin = Math.max(1, Math.round(min + deltaMin));
    let finalMax = Math.max(finalMin, Math.round(max + deltaMax));

    // If direction is selected, show range preview in that direction
    if (selectedDirection !== null) {
      let dir = HEX_DIRS[selectedDirection];
      noStroke();

      // Draw all possible landing spots
      for (let dist = finalMin; dist <= finalMax; dist++) {
        let targetQ = playerPos.q + dir.q * dist;
        let targetR = playerPos.r + dir.r * dist;
        let targetCell = getCell(targetQ, targetR);

        if (targetCell && targetCell.type !== "tree") {
          let pos = hexToPixel(targetQ, targetR);
          fill(255, 0, 0, 50);
          let dotSize = pixelSize * 2;
          circle(pos.x, pos.y, dotSize * 2);
        }
      }
    } else {
      // Show general range preview for all directions
      noStroke();
      for (let dir of HEX_DIRS) {
        for (let dist = finalMin; dist <= finalMax; dist++) {
          let targetQ = playerPos.q + dir.q * dist;
          let targetR = playerPos.r + dir.r * dist;
          let targetCell = getCell(targetQ, targetR);

          if (targetCell && targetCell.type !== "tree") {
            let pos = hexToPixel(targetQ, targetR);
            fill(255, 255, 255, 15);
            let dotSize = pixelSize * 2;
            circle(pos.x, pos.y, dotSize * 2);
          }
        }
      }
    }
  }
}

// Helper function to draw dashed lines
function drawDashedLine(x1, y1, x2, y2, dashLength) {
  let dx = x2 - x1;
  let dy = y2 - y1;
  let distance = sqrt(dx * dx + dy * dy);
  let dashCount = floor(distance / dashLength);
  let dashX = dx / dashCount;
  let dashY = dy / dashCount;

  for (let i = 0; i < dashCount; i += 2) {
    let startX = x1 + dashX * i;
    let startY = y1 + dashY * i;
    let endX = startX + dashX;
    let endY = startY + dashY;
    line(startX, startY, endX, endY);
  }
}

function drawHexPixel(cx, cy, col) {
  // draw pixel blocks inside polygon; fill with overlapping rects to avoid gaps
  let verts = [];
  for (let i = 0; i < 6; i++) {
    let a = (PI / 3) * i + PI / 6;
    verts.push([cx + cos(a) * hexSize, cy + sin(a) * hexSize]);
  }

  // Create lighter version of the tile color for the stroke
  let lightCol = color(red(col), green(col), blue(col));
  lightCol.setAlpha(alpha(col)); // Preserve original alpha
  lightCol.setRed(red(col) + (255 - red(col)) * 0.25);
  lightCol.setGreen(green(col) + (255 - green(col)) * 0.25);
  lightCol.setBlue(blue(col) + (255 - blue(col)) * 0.25);

  // Draw the tile fill
  fill(col);
  noStroke();
  // Use smaller pixel size for higher density, with minimal overlap to prevent seams
  for (let x = cx - hexSize + 1; x <= cx + hexSize - 1; x += pixelSize - 0.2) {
    for (let y = cy - hexSize + 1; y <= cy + hexSize - 1; y += pixelSize - 0.2) {
      if (pointInPolygon(x, y, verts)) rect(x, y, pixelSize + 0.4, pixelSize + 0.4);
    }
  }

  // Draw the lighter stroke
  stroke(lightCol);
  strokeWeight(1);
  noFill();
  beginShape();
  for (let i = 0; i < 6; i++) {
    let a = (PI / 3) * i + PI / 6;
    vertex(cx + cos(a) * hexSize, cy + sin(a) * hexSize);
  }
  endShape(CLOSE);
}

function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    let xi = poly[i][0],
      yi = poly[i][1];
    let xj = poly[j][0],
      yj = poly[j][1];
    let intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function drawPlayer() {
  if (!playerPos) return;
  let pos = hexToPixel(playerPos.q, playerPos.r);
  fill(255);
  noStroke();
  for (let dx = -ball_size; dx <= ball_size; dx++) {
    for (let dy = -ball_size; dy <= ball_size; dy++) {
      if (dist(0, 0, dx, dy) <= ball_size) {
        rect(pos.x + dx * pixelSize, pos.y + dy * pixelSize, pixelSize + 0.4, pixelSize + 0.4);
      }
    }
  }
}

function drawGoal() {
  if (!goalPos) return;
  let pos = hexToPixel(goalPos.q, goalPos.r);
  fill(50);
  noStroke();
  for (let dx = -ball_size; dx <= ball_size; dx++) {
    for (let dy = -ball_size; dy <= ball_size; dy++) {
      if (dist(0, 0, dx, dy) <= ball_size) {
        rect(pos.x + dx * pixelSize, pos.y + dy * pixelSize, pixelSize + 0.4, pixelSize + 0.4);
      }
    }
  }
  // flag pole
  stroke(0);
  strokeWeight(2);
  line(pos.x, pos.y, pos.x, pos.y - 30);
  noStroke();
  fill("#FF0000");
  triangle(pos.x, pos.y - 30, pos.x + 15, pos.y - 22, pos.x, pos.y - 15);
}

// ------------------ UI & INTERACTION ------------------
function updateUI() {
  // Update swings count
  swingsCountElement.textContent = swingCount;

  // Update tile info
  let tile = getCell(playerPos.q, playerPos.r);
  let info = tile
    ? `${tile.type.toUpperCase()} (${
        tile.type === "sand"
          ? "max-1"
          : tile.type === "green"
          ? "precision"
          : tile.type === "water"
          ? "hazard"
          : tile.type === "tree"
          ? "blocked"
          : "normal"
      })`
    : "";
  tileInfoElement.textContent = info;

  // Update shot preview
  if (selectedClubIndex !== null) {
    let c = hand_clubs[selectedClubIndex];
    shotPreviewElement.innerHTML = `
      <span class="preview-label">Selected:</span>
      <span class="preview-value">${c.name}</span>
      <span class="preview-label">Move:</span>
      <span class="preview-value">${selectedMoveCount}</span>
    `;
    shotPreviewElement.style.display = "flex";
  } else {
    shotPreviewElement.style.display = "none";
  }

  // Update club cards
  clubsContainer.innerHTML = hand_clubs
    .map(
      (club, i) => `
    <div class="club-card ${selectedClubIndex === i ? "selected" : ""}" 
         style="background-color: ${club.color}">
      <div class="club-name">${club.name}</div>
      <div class="club-range">${club.min}-${club.max}</div>
    </div>
  `
    )
    .join("");

  // Update modifier cards
  modifiersContainer.innerHTML = hand_mods
    .map(
      (mod, i) => `
    <div class="modifier-card ${selectedModIndices.includes(i) ? "selected" : ""}"
         style="background-color: ${mod.color}">
      <div class="modifier-name">${mod.name}</div>
    </div>
  `
    )
    .join("");

  // Update swing button visibility
  swingButton.style.display = selectedDirection !== null ? "block" : "none";

  // Add click handlers for cards
  Array.from(clubsContainer.children).forEach((card, i) => {
    card.addEventListener("click", () => {
      if (selectedClubIndex === i) {
        selectedClubIndex = null;
      } else {
        selectedClubIndex = i;
      }
      recomputeSelection();
      updateUI();
    });
  });

  Array.from(modifiersContainer.children).forEach((card, i) => {
    card.addEventListener("click", () => {
      let idx = selectedModIndices.indexOf(i);
      if (idx >= 0) {
        selectedModIndices.splice(idx, 1);
      } else {
        selectedModIndices.push(i);
      }
      recomputeSelection();
      updateUI();
    });
  });
}

function mousePressed() {
  // First check if we're clicking the swing button
  if (selectedDirection !== null && isSwingButtonClicked()) {
    executeSwing();
    return;
  }

  // Handle club selection
  let startX = 10;
  for (let i = 0; i < hand_clubs.length; i++) {
    let cx = startX + i * 70 + 30;
    let cy = height - 45;
    if (mouseX > cx - 30 && mouseX < cx + 30 && mouseY > cy - 35 && mouseY < cy + 35) {
      if (selectedClubIndex === i) {
        selectedClubIndex = null;
      } else {
        selectedClubIndex = i;
      }
      recomputeSelection();
      updateUI();
      return;
    }
  }

  // Handle modifier selection
  let modsCount = hand_mods.length;
  let rightStartX = width - modsCount * 70 - 10;
  for (let i = 0; i < modsCount; i++) {
    let cx = rightStartX + i * 70 + 30;
    let cy = height - 45;
    if (mouseX > cx - 30 && mouseX < cx + 30 && mouseY > cy - 35 && mouseY < cy + 35) {
      let idx = selectedModIndices.indexOf(i);
      if (idx >= 0) {
        selectedModIndices.splice(idx, 1);
      } else {
        selectedModIndices.push(i);
      }
      recomputeSelection();
      updateUI();
      return;
    }
  }

  // Handle direction selection (now independent of club selection)
  let adjustedX = mouseX - width / 2;
  let adjustedY = mouseY - height / 2;
  let startPos = hexToPixel(playerPos.q, playerPos.r);

  // Calculate angle to mouse position
  let angleToMouse = atan2(adjustedY - startPos.y, adjustedX - startPos.x);

  // Find the closest direction
  let closestDir = 0;
  let closestAngleDiff = PI;

  for (let i = 0; i < HEX_DIRS.length; i++) {
    let dir = HEX_DIRS[i];
    let endPos = hexToPixel(playerPos.q + dir.q, playerPos.r + dir.r);

    let angleToDir = atan2(endPos.y - startPos.y, endPos.x - startPos.x);
    let angleDiff = abs(((angleToMouse - angleToDir + PI) % (2 * PI)) - PI);

    if (angleDiff < closestAngleDiff) {
      closestAngleDiff = angleDiff;
      closestDir = i;
    }
  }

  // Only select the direction if it's within a reasonable angle (30 degrees)
  if (closestAngleDiff < PI / 6) {
    if (selectedDirection === closestDir) {
      selectedDirection = null;
      targetPos = null;
    } else {
      selectedDirection = closestDir;
      // Only set targetPos if we have a club selected
      if (selectedClubIndex !== null) {
        let dir = HEX_DIRS[closestDir];
        let targetQ = playerPos.q + dir.q * selectedMoveCount;
        let targetR = playerPos.r + dir.r * selectedMoveCount;
        let targetCell = getCell(targetQ, targetR);

        if (targetCell && targetCell.type !== "tree") {
          targetPos = { q: targetQ, r: targetR };
        } else {
          targetPos = null;
        }
      }
    }
    updateUI();
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

  // Check path for trees (can't shoot through trees)
  let blocked = false;
  for (let i = 1; i < selectedMoveCount; i++) {
    let checkQ = prev.q + unit.q * i;
    let checkR = prev.r + unit.r * i;
    let cell = getCell(checkQ, checkR);
    if (cell && cell.type === "tree") {
      blocked = true;
      break;
    }
  }

  if (blocked) {
    // If blocked by tree, move to last valid position
    let lastValidPos = { q: prev.q, r: prev.r };
    for (let i = 1; i < selectedMoveCount; i++) {
      let checkQ = prev.q + unit.q * i;
      let checkR = prev.r + unit.r * i;
      let cell = getCell(checkQ, checkR);
      if (cell && cell.type === "tree") break;
      lastValidPos = { q: checkQ, r: checkR };
    }
    playerPos = lastValidPos;
  } else {
    // move to target if not blocked
    playerPos = { q: target.q, r: target.r };
  }

  // Water hazard effect: move back to previous position with penalty
  let targetCell = getCell(playerPos.q, playerPos.r);
  if (targetCell && targetCell.type === "water") {
    // Check if Fireball modifier is active
    let hasFireball = selectedModIndices.some((mi) => hand_mods[mi]?.name === "Fireball");
    if (!hasFireball) {
      playerPos = { q: prev.q, r: prev.r };
      swingCount++; // Additional penalty stroke for water
    }
  }

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
        let goalCell = getCell(goalPos.q, goalPos.r);
        if (goalCell && goalCell.type !== "tree") {
          playerPos = { q: goalPos.q, r: goalPos.r };
        }
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
  updateUI(); // Call updateUI after each shot

  // check win
  if (playerPos.q === goalPos.q && playerPos.r === goalPos.r) {
    setTimeout(() => alert(`You win in ${swingCount} swings!`), 50);
    noLoop();
  }
}

// Add new functions for swing button
function isSwingButtonClicked() {
  return mouseX > width / 2 - 50 && mouseX < width / 2 + 50 && mouseY > height - 100 && mouseY < height - 60;
}

function executeSwing() {
  if (selectedClubIndex === null || selectedDirection === null) return;

  let dir = HEX_DIRS[selectedDirection];
  let club = hand_clubs[selectedClubIndex];

  // Calculate final range with all modifiers
  let min = club.min;
  let max = club.max;
  let deltaMin = 0;
  let deltaMax = 0;
  let ignoreSand = false;
  let ignoreWater = false;

  // Apply current tile effects
  let curCell = getCell(playerPos.q, playerPos.r);
  if (curCell && curCell.type === "green") min = 1;

  // Apply modifier effects
  for (let mi of selectedModIndices) {
    let mod = hand_mods[mi];
    if (!mod) continue;
    if (mod.name === "Tailwind") {
      deltaMax += random([1, 2]);
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
      ignoreWater = true;
    }
  }

  // Apply terrain penalties
  if (curCell && curCell.type === "sand" && !ignoreSand) {
    deltaMax -= 1;
  }
  if (curCell && curCell.type === "water" && !ignoreWater) {
    deltaMax -= 2;
    deltaMin = max(1, deltaMin - 1);
  }

  let finalMin = Math.max(1, Math.round(min + deltaMin));
  let finalMax = Math.max(finalMin, Math.round(max + deltaMax));

  // Calculate actual move distance
  let moveDistance = Math.floor(random(finalMin, finalMax + 1));

  // Calculate target position
  let targetQ = playerPos.q + dir.q * moveDistance;
  let targetR = playerPos.r + dir.r * moveDistance;
  let targetCell = getCell(targetQ, targetR);

  // Store previous position for potential water hazard
  let prevPos = { ...playerPos };

  // Execute the move if target is valid
  if (targetCell && targetCell.type !== "tree") {
    playerPos = { q: targetQ, r: targetR };

    // Handle water hazard effect
    if (targetCell.type === "water" && !ignoreWater) {
      playerPos = prevPos;
      swingCount++; // Additional penalty stroke
    }

    // Apply post-shot modifiers
    for (let mi of selectedModIndices) {
      let mod = hand_mods[mi];
      if (!mod) continue;
      if (mod.name === "Wind") {
        let steps = Math.floor(random(1, 3));
        let windDir = random(HEX_DIRS);
        for (let s = 0; s < steps; s++) {
          let nxt = getCell(playerPos.q + windDir.q, playerPos.r + windDir.r);
          if (nxt && nxt.type !== "tree") {
            playerPos = { q: nxt.q, r: nxt.r };
          } else break;
        }
      } else if (mod.name === "Portal") {
        let greens = grid.filter((c) => c.type === "green");
        if (greens.length) {
          let g = random(greens);
          playerPos = { q: g.q, r: g.r };
        }
      } else if (mod.name === "Chip") {
        if (hexDistance(playerPos, goalPos) <= 2) {
          let goalCell = getCell(goalPos.q, goalPos.r);
          if (goalCell && goalCell.type !== "tree") {
            playerPos = { q: goalPos.q, r: goalPos.r };
          }
        }
      }
    }

    // Discard used cards
    let clubCard = hand_clubs[selectedClubIndex];
    if (clubCard) discard_clubs.push(clubCard);

    let modsToDiscard = [];
    for (let mi of selectedModIndices) {
      let modCard = hand_mods[mi];
      if (modCard) modsToDiscard.push(modCard);
    }
    for (let m of modsToDiscard) discard_mods.push(m);

    // Remove cards from hand (larger indices first)
    selectedModIndices.sort((a, b) => b - a);
    for (let mi of selectedModIndices) hand_mods.splice(mi, 1);
    hand_clubs.splice(selectedClubIndex, 1);

    // Draw replacement cards
    drawToHand(1, hand_clubs, deck_clubs, discard_clubs);
    drawToHand(modsToDiscard.length || 1, hand_mods, deck_mods, discard_mods);

    // Reset selection state
    selectedClubIndex = null;
    selectedDirection = null;
    selectedModIndices = [];
    targetPos = null;

    // Increment swing count and update UI
    swingCount++;
    updateUI();

    // Check for win
    if (playerPos.q === goalPos.q && playerPos.r === goalPos.r) {
      setTimeout(() => alert(`You win in ${swingCount} swings!`), 50);
      noLoop();
    }
  }
}

// Update drawUI to properly handle swing button
function drawUI() {
  // ... existing UI code ...

  // Draw swing button if we have both direction and club selected
  if (selectedDirection !== null && selectedClubIndex !== null) {
    push();
    // Draw button background
    fill(0, 200, 0);
    noStroke();
    rectMode(CENTER);
    rect(width / 2, height - 80, 100, 40, 20);

    // Draw button text
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(16);
    text("SWING!", width / 2, height - 80);
    pop();
  }

  // ... rest of existing UI code ...
}

// We'll intercept mousePressed again to use performShot correctly — fix above
// Remove mouseClicked function since we're handling everything in mousePressed

// ------------------ MOD HELPER (pre modifiers) ------------------
// Note: we handled pre modifiers inside recomputeSelection

// ------------------ MISC: DRAWING HELPERS & HEX UTILS ------------------
function hexToPixel(q, r) {
  let x = hexSize * (sqrt(3) * q + (sqrt(3) / 2) * r);
  let y = hexSize * ((3 / 2) * r);
  return { x: x, y: y }; // Remove the width/2 and height/2 offset since we're using translate
}

function pixelToHex(px, py) {
  // Input coordinates are already adjusted for center
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
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

// ------------------ End of file ------------------
