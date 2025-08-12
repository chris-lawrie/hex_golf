// grid.js
let grid = [];

function createHexGrid(cols, rows, hexSize) {
  grid = [];
  for (let q = -cols; q <= cols; q++) {
    for (let r = -rows; r <= rows; r++) {
      if (Math.abs(q + r) <= cols) {
        // Assign tile type using weighted probabilities from TILE_TYPES
        let type = randomTileType();
        grid.push({ q, r, type });
      }
    }
  }
  enforceTileMinimums();
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
  if (countType("water") === 0) forceTileType("water");
  if (countType("rough") === 0) forceTileType("rough");
  if (countType("trees") === 0) forceTileType("trees");
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

// function hexToPixel(q, r, hexSize) {
//   let x = hexSize * (sqrt(3) * q + (sqrt(3) / 2) * r);
//   let y = hexSize * ((3 / 2) * r);
//   return { x: width / 2 + x, y: height / 2 + y };
// }

function pixelToHex(px, py, hexSize) {
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
