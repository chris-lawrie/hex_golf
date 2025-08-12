const TILE_TYPES = {
  grass: {
    color: "#00C800",
    hitModifier: () => int(random(3, 7)), // Grass → 3 to 6 tiles
  },
  sand: {
    color: "#E6C864",
    hitModifier: () => 1, // Sand → 1 tile
  },
  green: {
    color: "#96FF96",
    hitModifier: () => int(random(1, 4)), // Putting green → 1 to 3 tiles
  },
  water: {
    color: "#4DB6FF",
    hitModifier: () => 0, // Water → ball is lost or stays in place (could reset)
  },
  rough: {
    color: "#6B8E23",
    hitModifier: () => int(random(1, 3)), // Rough → short distance
  },
  trees: {
    color: "#228B22",
    hitModifier: () => 0, // Trees → block movement
  },
};

// Utility to get a random tile type with weighted chances
function randomTileType() {
  // Weighted probabilities: mostly grass
  let roll = random();
  if (roll < 0.55) return "grass"; // 55%
  if (roll < 0.7) return "sand"; // 15%
  if (roll < 0.8) return "green"; // 10%
  if (roll < 0.88) return "rough"; // 8%
  if (roll < 0.95) return "water"; // 7%
  return "trees"; // 5%
}
