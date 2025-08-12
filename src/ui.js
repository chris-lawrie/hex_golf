// ui.js
function drawUI(
  hand_clubs,
  hand_modifiers,
  selectedClubIndex,
  selectedModifierIndex
) {
  fill(255);
  textAlign(LEFT, TOP);
  text(`Swings: ${swingCount}`, 10, 10);

  // Clubs left side
  let cardX = 10;
  for (let i = 0; i < hand_clubs.length; i++) {
    let card = hand_clubs[i];
    fill(card.color);
    rect(cardX, height - 80, 60, 70);
    fill(0);
    textAlign(CENTER, CENTER);
    text(card.name, cardX + 30, height - 65);
    text(`${card.min}-${card.max}`, cardX + 30, height - 45);
    if (selectedClubIndex === i) {
      noFill();
      stroke(255, 0, 0);
      strokeWeight(3);
      rect(cardX - 2, height - 82, 64, 74);
      noStroke();
    }
    cardX += 70;
  }

  // Modifiers right side
  let modX = width - 70 * hand_modifiers.length - 10;
  for (let i = 0; i < hand_modifiers.length; i++) {
    let card = hand_modifiers[i];
    fill(card.color);
    rect(modX, height - 80, 60, 70);
    fill(0);
    textAlign(CENTER, CENTER);
    text(card.name, modX + 30, height - 45);
    if (selectedModifierIndex === i) {
      noFill();
      stroke(255, 0, 0);
      strokeWeight(3);
      rect(modX - 2, height - 82, 64, 74);
      noStroke();
    }
    modX += 70;
  }
}
