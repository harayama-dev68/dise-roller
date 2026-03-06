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

let currentX = -30;
let currentY = 30;

function rollDice() {
  const value = Math.floor(Math.random() * 6) + 1;
  const orientation = baseOrientation[value];

  const targetX = orientation.x + Math.floor(Math.random() * 2 + 3) * 360;
  const targetY = orientation.y + Math.floor(Math.random() * 2 + 3) * 360;

  dice.classList.remove('rolling');
  void dice.offsetWidth;

  dice.style.setProperty('--from-x', String(currentX));
  dice.style.setProperty('--from-y', String(currentY));
  dice.style.setProperty('--to-x', String(targetX));
  dice.style.setProperty('--to-y', String(targetY));

  dice.classList.add('rolling');

  currentX = targetX;
  currentY = targetY;
  result.textContent = `結果: ${value}`;
}

button.addEventListener('click', rollDice);
rollDice();
