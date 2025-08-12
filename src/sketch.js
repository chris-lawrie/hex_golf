// // === sketch.js ===
// let grid = [];
// let playerPos,
//   goalPos,
//   hoveredHex = null;

// // Hands and decks
// let hand_clubs = [],
//   hand_modifiers = [];
// let deck_clubs = [],
//   deck_modifiers = [],
//   discard_clubs = [],
//   discard_modifiers = [];

// function setup() {
//   createCanvas(800, 600);
//   initTiles();
//   createHexGrid();
//   enforceTileMinimums();
//   pickStartAndGoal();
//   initClubDeck();
//   initModifierDeck();
//   drawClubs(3);
//   drawModifiers(3);
// }

// function draw() {
//   background(0);
//   hoveredHex = pixelToHex(mouseX - width / 2, mouseY - height / 2);
//   drawGrid();
//   drawPlayer();
//   drawGoal();
//   drawUI();
// }

// function mousePressed() {
//   if (handleClubSelection(mouseX, mouseY)) return;
//   if (handleModifierSelection(mouseX, mouseY)) return;
//   handleMovementClick(mouseX, mouseY);
// }
