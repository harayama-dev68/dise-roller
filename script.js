const dice = document.getElementById('dice');
const result = document.getElementById('result');
const button = document.getElementById('rollButton');

const baseOrientation = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: 0, y: 180 },
  4: { x: 0, y: 90 },
  5: { x: -90, y: 0 },
  6: { x: 90, y: 0 },
};

let spinX = 0;
let spinY = 0;

function rollDice() {
  const value = Math.floor(Math.random() * 6) + 1;
  const orientation = baseOrientation[value];

  spinX += 720;
  spinY += 720;

  const rotateX = spinX + orientation.x;
  const rotateY = spinY + orientation.y;

  dice.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  result.textContent = `結果: ${value}`;
}

button.addEventListener('click', rollDice);
rollDice();
