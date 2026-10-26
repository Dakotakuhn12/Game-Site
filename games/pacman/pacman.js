/* ==========================================================================
   PAC-MAN
   --------------------------------------------------------------------------
   SECTIONS
     1. Board settings
     2. Speed settings
     3. Images
     4. Level map
     5. Game state
     6. Startup (window.onload)
     7. Image loading
     8. Map loading
     9. Game loop
    10. Drawing
    11. Movement and game rules
    12. Player input and turning
    13. Helpers
    14. Block class
   ========================================================================== */

/* ==========================================================================
   1. BOARD SETTINGS
   The map is a grid of tiles, each 32x32 pixels.
   ========================================================================== */
// board
let board; // the <canvas> element
const rowCount = 21; // number of tile rows
const columnCount = 19; // number of tile columns
const tileSize = 32; // size of one tile in pixels
const boardWidth = columnCount * tileSize; // canvas width in pixels
const boardHeight = rowCount * tileSize; // canvas height in pixels
let context; // the tool used to draw on the canvas
// Player-only solid fence around the ghost pen; ghosts and eyes can pass.
const ghostPenBarriers = [
  { x: tileSize * 8, y: tileSize * 8, width: tileSize * 3, height: 8 },
  { x: tileSize * 8, y: tileSize * 8, width: 8, height: tileSize * 2 },
  { x: tileSize * 11 - 8, y: tileSize * 8, width: 8, height: tileSize * 2 },
  { x: tileSize * 8, y: tileSize * 10 - 8, width: tileSize * 3, height: 8 },
];

/* ==========================================================================
   2. SPEED SETTINGS
   stepSize   = pixels moved per frame
   frameDelay = milliseconds between frames

   For smoother motion, use tileSize / 8 and frameDelay = 25.
   Keep stepSize a divisor of tileSize so turns line up with tiles.
   ========================================================================== */
// speed settings
const stepSize = tileSize / 8;
let ghostStepSize = stepSize;
const frameDelay = 25;

/* ==========================================================================
   3. IMAGES
   Filled in by loadImages() when the game starts.
   ========================================================================== */
// images
let blueGhostImage;
let orangeGhostImage;
let pinkGhostImage;
let redGhostImage;
let pacmanUpImage;
let pacmanDownImage;
let pacmanLeftImage;
let pacmanRightImage;
let wallImage;
let cherryImage;
let scaredGhostImage;

/* ==========================================================================
   4. LEVEL MAP
   Each character is one tile.
   ========================================================================== */
//X = wall, O = skip, P = pac man, ' ' = food
//Ghosts: b = blue, o = orange, p = pink, r = red
const tileMap = [
  "XXXXXXXXXXXXXXXXXXX",
  "X        C        X",
  "X XX XXX X XXX XX X",
  "X                 X",
  "X XX X XXXXX X XX X",
  "X    X       X    X",
  "XXXX XXXX XXXX XXXX",
  "OOOX X       X XOOO",
  "XXXX X XXrXX X XXXX",
  "O       bpo       O",
  "XXXX X XXXXX X XXXX",
  "OOOX X       X XOOO",
  "XXXX X XXXXX X XXXX",
  "X        X        X",
  "X XX XXX X XXX XX X",
  "X  X     P    X  X",
  "XX X X XXXXX X X XX",
  "X    C   X   X    X",
  "X XXXXXX X XXXXXX X",
  "X                 X",
  "XXXXXXXXXXXXXXXXXXX",
];

/* ==========================================================================
   5. GAME STATE
   Everything that changes while the game is running.
   ========================================================================== */
// Collections of game objects (a Set holds each item once)
const walls = new Set();
const foods = new Set();
const ghosts = new Set();
const cherries = new Set(); // power-ups (you can place as many "C" tiles as you want)
const powerPellets = new Set();
const particles = new Set();

let pacman; // the player

// After eating the cherry, ghosts are "scared" for a while
let ghostsScared = false;
let scaredTimer = 0; // frames left until ghosts return to normal
let ghostMode = "scatter";
let ghostModeIndex = 0;
let ghostModeFrames = 0;
let dotsEatenThisLevel = 0;
let noDotFrames = 0;
let ghostCombo = 0;
let bonusFruit = null;
let fruitThresholdsTriggered = new Set();
let intermissionTimer = 0;
let killScreen = false;
let paused = false;
let soundEnabled = true;
let playerName = "";
let highScores = readHighScores();
let highScore = 0;
let gameStarted = false;
let difficulty = "normal";
let readyTimer = 0;
let playerHitGraceFrames = 0;
let runFrame = 0;
let extraLifeAwarded = false;
let wallHue = 0;
let updateTimer = null;
let lastChompAt = 0;

const directions = ["U", "D", "L", "R"]; // up down left right
const ghostDirectionPriority = ["U", "L", "D", "R"];
// Approximate original level-one scatter/chase waves at 40 game ticks/second.
const ghostModeSchedule = [280, 800, 280, 800, 200, 800, 200, Number.MAX_SAFE_INTEGER];

// Lookup used to check if a turn is a reversal (U <-> D, L <-> R)
const opposite = { U: "D", D: "U", L: "R", R: "L" };

let score = 0;
let lives = 3;
let level = 1;
let gameOver = false;

function readHighScores() {
  try {
    // Start the leaderboard fresh after the requested reset. New scores use
    // this storage key and will persist normally from this point forward.
    const scores = JSON.parse(window.localStorage.getItem("pacmanHighScoresByNameV2") || "{}");
    return scores && typeof scores === "object" && !Array.isArray(scores) ? scores : {};
  } catch (error) {
    return {};
  }
}

function saveHighScores() {
  try {
    window.localStorage.setItem("pacmanHighScoresByNameV2", JSON.stringify(highScores));
  } catch (error) {
    // Storage can be disabled in private or embedded browser contexts.
  }
}

function renderLeaderboard() {
  const list = document.getElementById("leaderboard-list");
  if (!list) return;
  const leaders = Object.entries(highScores)
    .map(([name, value]) => ({ name, score: Number(value) || 0 }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 5);
  list.replaceChildren(...(leaders.length
    ? leaders.map(({ name, score: points }) => {
      const item = document.createElement("li");
      const player = document.createElement("span");
      player.className = "leaderboard-name";
      player.textContent = name;
      const score = document.createElement("strong");
      score.className = "leaderboard-score";
      score.textContent = String(points);
      item.append(player, score);
      return item;
    })
    : [Object.assign(document.createElement("li"), { className: "leaderboard-empty", textContent: "No scores yet — be the first!" })]));
}

/* ==========================================================================
   6. STARTUP
   Runs once when the page has finished loading.
   ========================================================================== */
window.onload = function () {
  // Set up the canvas
  board = document.getElementById("board");
  board.height = boardHeight;
  board.width = boardWidth;
  context = board.getContext("2d"); // used for drawing on the board

  loadImages(); // load all picture files
  loadMap(); // build walls, food, ghosts, pacman from tileMap

  pacman.direction = "R";
  pacman.updateVelocity();
  for (const ghost of ghosts) {
    ghost.direction = "U";
    ghost.updateVelocity();
  }

  document.getElementById("start-form").addEventListener("submit", startGame);
  document.getElementById("player-name").focus();
  draw();
  update(); // attract-mode demo behind the name-entry screen

  // Listen for key PRESSES (keydown). This was keyup before, which made
  // controls feel delayed because nothing happened until you let go.
  document.addEventListener("keydown", movePacman);
  document.getElementById("pause-button").addEventListener("click", togglePause);
  document.getElementById("sound-button").addEventListener("click", toggleSound);
  renderLeaderboard();
  document.querySelectorAll(".touch-controls [data-direction]").forEach((button) => {
    const requestDirection = (event) => {
      event.preventDefault();
      if (gameStarted && !paused && !gameOver) pacman.nextDirection = button.dataset.direction;
    };
    button.addEventListener("pointerdown", requestDirection);
    button.addEventListener("click", requestDirection);
  });
};

function startGame(event) {
  event.preventDefault();
  const field = document.getElementById("player-name");
  playerName = field.value.trim().replace(/\s+/g, " ").slice(0, 16);
  if (!playerName) {
    field.focus();
    return;
  }
  const key = playerName.toLocaleLowerCase();
  difficulty = document.getElementById("difficulty").value;
  ghostStepSize = stepSize;
  highScore = Math.max(0, Number(highScores[key]) || 0);
  document.getElementById("start-screen").hidden = true;
  gameStarted = true;
  readyTimer = 70;
  if (updateTimer) clearTimeout(updateTimer);
  loadMap();
  resetPositions();
  resetGhostMode();
  ensureAudio();
  renderLeaderboard();
  updateHud();
  update();
}

/* ==========================================================================
   7. IMAGE LOADING
   ========================================================================== */

// Loads one image and reports in the console (F12) if the file can't be found
function loadImage(src) {
  const img = new Image();
  img.onerror = () => console.error("FAILED TO LOAD IMAGE:", src);
  img.src = src;
  return img;
}

// True only if the image actually loaded
function imageReady(img) {
  return img && img.complete && img.naturalWidth > 0;
}

// Loads every image the game uses.
// Paths are relative to the HTML file, so the "images" folder must sit
// next to pacman.html.
function loadImages() {
  wallImage = loadImage("./images/wall.png");
  blueGhostImage = loadImage("./images/blueGhost.png");
  orangeGhostImage = loadImage("./images/orangeGhost.png");
  pinkGhostImage = loadImage("./images/pinkGhost.png");
  redGhostImage = loadImage("./images/redGhost.png");
  pacmanUpImage = loadImage("./images/pacmanUp.png");
  pacmanDownImage = loadImage("./images/pacmanDown.png");
  pacmanLeftImage = loadImage("./images/pacmanLeft.png");
  pacmanRightImage = loadImage("./images/pacmanRight.png");
  cherryImage = loadImage("./images/cherry.png");
  scaredGhostImage = loadImage("./images/scaredGhost.png");
}

/* ==========================================================================
   8. MAP LOADING
   Reads tileMap and creates a Block for every wall, ghost, food, etc.
   Also used to restart a level or the whole game.
   ========================================================================== */
function loadMap() {
  // Clear anything left over from the previous level/game
  walls.clear();
  foods.clear();
  ghosts.clear();
  cherries.clear();
  powerPellets.clear();
  ghostsScared = false;
  scaredTimer = 0;
  dotsEatenThisLevel = 0;
  noDotFrames = 0;
  ghostCombo = 0;
  bonusFruit = null;
  fruitThresholdsTriggered.clear();
  intermissionTimer = 0;
  killScreen = level === 256;

  // Rotate through five maze layouts so each new level changes the routes.
  const layout = (level - 1) % 5;
  let map = layout === 1
    ? tileMap.map((row) => row.split("").reverse().join(""))
    : [...tileMap];
  const carvePatterns = {
    2: [[3, 2], [9, 2], [15, 2], [2, 4], [16, 4], [3, 14], [15, 14], [4, 16], [14, 16]],
    3: [[5, 2], [13, 2], [2, 4], [16, 4], [3, 6], [15, 6], [3, 14], [15, 14], [4, 16], [14, 16]],
    4: [[3, 2], [15, 2], [2, 4], [16, 4], [2, 14], [16, 14], [5, 16], [13, 16], [2, 18], [16, 18]],
  };
  if (carvePatterns[layout]) {
    const carved = map.map((row) => row.split(""));
    for (const [col, row] of carvePatterns[layout]) {
      if (carved[row][col] === "X") carved[row][col] = " ";
    }
    map = carved.map((row) => row.join(""));
  }
  map = removeMapDeadEnds(map);
  wallHue = layout * 65;
  const pelletTiles = new Set(["1,3", "17,3", "1,17", "17,17"]);

  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < columnCount; c++) {
      const row = map[r];
      const tileMapChar = row[c];

      // Pixel position of this tile
      const x = c * tileSize;
      const y = r * tileSize;

      if (tileMapChar == "X") {
        // block wall
        const wall = new Block(wallImage, x, y, tileSize, tileSize);
        walls.add(wall);
      } else if (tileMapChar == "b") {
        // blue ghost
        const ghost = new Block(blueGhostImage, x, y, tileSize, tileSize);
        ghosts.add(ghost);
      } else if (tileMapChar == "o") {
        // orange ghost
        const ghost = new Block(orangeGhostImage, x, y, tileSize, tileSize);
        ghosts.add(ghost);
      } else if (tileMapChar == "p") {
        // pink ghost
        const ghost = new Block(pinkGhostImage, x, y, tileSize, tileSize);
        ghosts.add(ghost);
      } else if (tileMapChar == "r") {
        // red ghost
        const ghost = new Block(redGhostImage, x, y, tileSize, tileSize);
        ghosts.add(ghost);
      } else if (tileMapChar == "P") {
        // pacman
        pacman = new Block(pacmanRightImage, x, y, tileSize, tileSize);
      } else if (tileMapChar == " ") {
        // Keep the ghost-house interior clear of regular and power pellets.
        if (c >= 8 && c <= 10 && r >= 8 && r <= 9) continue;
        if (pelletTiles.has(`${c},${r}`)) {
          powerPellets.add(new Block(null, x + 10, y + 10, 12, 12));
          continue;
        }
        // empty is food (a small 4x4 dot centered in the tile)
        const food = new Block(null, x + 14, y + 14, 4, 4);
        foods.add(food);
      } else if (tileMapChar == "C") {
        // cherry (power-up): every "C" in the map gets its own cherry
        const cherryBlock = new Block(cherryImage, x, y, tileSize, tileSize);
        cherries.add(cherryBlock);
      }
    }
  }
  updateCruiseElroy();

}

// Open one wall beside every single-exit corridor so each playable route
// reconnects to another route. Keep the outside border and ghost house intact.
function removeMapDeadEnds(sourceMap) {
  const cells = sourceMap.map((row) => row.split(""));
  const directions = [[0, -1], [-1, 0], [0, 1], [1, 0]];
  const isHouse = (col, row) => col >= 7 && col <= 11 && row >= 7 && row <= 10;
  const isOpen = (col, row) => {
    if (row < 0 || row >= rowCount) return false;
    const wrappedCol = (col + columnCount) % columnCount;
    return cells[row][wrappedCol] !== "X";
  };

  // Each pass opens a wall next to a one-exit tile. Repeating lets that new
  // connection eliminate dead ends farther along the same corridor.
  for (let pass = 0; pass < rowCount * columnCount; pass++) {
    let openedWall = false;
    for (let row = 1; row < rowCount - 1 && !openedWall; row++) {
      for (let col = 1; col < columnCount - 1 && !openedWall; col++) {
        if (cells[row][col] === "X" || isHouse(col, row)) continue;
        const exits = directions.filter(([dx, dy]) => isOpen(col + dx, row + dy)).length;
        if (exits !== 1) continue;

        let bestWall = null;
        let bestConnections = -1;
        for (const [dx, dy] of directions) {
          const wallCol = col + dx;
          const wallRow = row + dy;
          if (wallRow <= 0 || wallRow >= rowCount - 1 || wallCol <= 0 || wallCol >= columnCount - 1) continue;
          if (cells[wallRow][wallCol] !== "X" || isHouse(wallCol, wallRow)) continue;
          const connections = directions.filter(([nextX, nextY]) => isOpen(wallCol + nextX, wallRow + nextY)).length;
          if (connections > bestConnections) {
            bestWall = [wallCol, wallRow];
            bestConnections = connections;
          }
        }
        if (bestWall) {
          const [wallCol, wallRow] = bestWall;
          cells[wallRow][wallCol] = " ";
          openedWall = true;
        }
      }
    }
    if (!openedWall) break;
  }
  return cells.map((row) => row.join(""));
}

/* ==========================================================================
   9. GAME LOOP
   Runs over and over: move everything, then draw everything.
   ========================================================================== */
function update() {
  updateTimer = null;
  if (killScreen) {
    draw();
    updateTimer = setTimeout(update, frameDelay);
    return;
  }
  if (!gameStarted) {
    moveAttractDemo();
    draw();
    updateTimer = setTimeout(update, frameDelay);
    return;
  }
  try {
    if (paused || gameOver) {
      draw();
    } else if (intermissionTimer > 0) {
      intermissionTimer--;
      draw();
    } else if (readyTimer > 0) {
      readyTimer--;
      draw();
    } else {
      move();
      draw();
    }
  } catch (error) {
    // Keep input and later frames alive if an optional visual/audio feature
    // fails in a particular browser.
    console.error("Pac-Man frame error:", error);
  }
  if (!paused && !gameOver) {
    updateTimer = setTimeout(update, frameDelay);
  }
}

// Silent attract-mode movement runs behind the player-name screen without
// changing score, dots, lives, or the maze state.
function moveAttractDemo() {
  const advance = (block) => {
    block.x += block.velocityX;
    block.y += block.velocityY;
    if (block.x < 0) block.x = boardWidth - block.width;
    else if (block.x + block.width > boardWidth) block.x = 0;
    const blocked = [...walls].some((wall) => collision(block, wall)) ||
      (!block.isGhost && ghostPenBarriers.some((barrier) => collision(block, barrier)));
    if (blocked) {
      block.x -= block.velocityX;
      block.y -= block.velocityY;
      block.direction = opposite[block.direction];
      block.updateVelocity();
    }
  };
  advance(pacman);
  for (const ghost of ghosts) advance(ghost);
}

/* ==========================================================================
   10. DRAWING
   ========================================================================== */

// Draws Pac-Man from his image if it loaded, otherwise as a yellow circle
// with an animated mouth facing the direction he's moving
function drawPacman() {
  const mouthOpen = Math.floor(Date.now() / 100) % 2 === 0;
  if (imageReady(pacman.image) && mouthOpen) {
    context.drawImage(
      pacman.image,
      pacman.x,
      pacman.y,
      pacman.width,
      pacman.height,
    );
    return;
  }

  // Draw a closed-mouth frame between the open sprite frames.
  const cx = pacman.x + pacman.width / 2; // circle center X
  const cy = pacman.y + pacman.height / 2; // circle center Y
  const r = pacman.width / 2 - 2; // radius

  if (!mouthOpen) {
    context.fillStyle = "#ffe600";
    context.beginPath();
    context.arc(cx, cy, r, 0, 2 * Math.PI);
    context.fill();
    const eye = {
      R: [cx + 5, cy - 6],
      L: [cx - 5, cy - 6],
      U: [cx + 5, cy - 5],
      D: [cx + 5, cy + 1],
    }[pacman.direction];
    context.fillStyle = "#111";
    context.beginPath();
    context.arc(eye[0], eye[1], 2, 0, 2 * Math.PI);
    context.fill();
    return;
  }

  // ----- Fallback open-mouth shape -----

  // Angle the mouth points, based on direction
  const angles = { R: 0, D: Math.PI / 2, L: Math.PI, U: -Math.PI / 2 };
  const a = angles[pacman.direction];

  // Mouth alternates between narrow and wide every 120ms
  const mouth =
    Math.floor(Date.now() / 120) % 2 ? 0.05 * Math.PI : 0.25 * Math.PI;

  context.fillStyle = "yellow";
  context.beginPath();
  context.moveTo(cx, cy);
  context.arc(cx, cy, r, a + mouth, a - mouth + 2 * Math.PI);
  context.closePath();
  context.fill();
}

// Draws any block from its image, or a colored fallback (circle if `round`
// is true, square if not) when the image is missing. This also stops one
// bad image file from crashing the whole game loop.
function drawBlock(block, fallbackColor, round) {
  if (imageReady(block.image)) {
    context.drawImage(block.image, block.x, block.y, block.width, block.height);
    return;
  }
  context.fillStyle = fallbackColor;
  if (round) {
    context.beginPath();
    context.arc(
      block.x + block.width / 2,
      block.y + block.height / 2,
      block.width / 2 - 2,
      0,
      2 * Math.PI,
    );
    context.fill();
  } else {
    context.fillRect(block.x, block.y, block.width, block.height);
  }
}

// Eaten ghosts travel home as just their eyes, like the arcade game.
function drawGhostEyes(ghost) {
  const cy = ghost.y + ghost.height / 2;
  const pupilOffset = {
    U: [0, -2], D: [0, 2], L: [-2, 0], R: [2, 0],
  }[ghost.direction] || [0, 0];
  for (const eyeX of [ghost.x + 11, ghost.x + 21]) {
    context.fillStyle = "white";
    context.beginPath();
    context.ellipse(eyeX, cy, 5, 7, 0, 0, 2 * Math.PI);
    context.fill();
    context.fillStyle = "#1424b8";
    context.beginPath();
    context.arc(eyeX + pupilOffset[0], cy + pupilOffset[1], 2.6, 0, 2 * Math.PI);
    context.fill();
  }
}

// Redraws the whole screen every frame
function draw() {
  context.clearRect(0, 0, board.width, board.height); // wipe the canvas
  drawPacman();
  for (let ghost of ghosts.values()) {
    if (ghost.returning) drawGhostEyes(ghost);
    else drawBlock(ghost, ghostsScared ? "royalblue" : "red", true);
  }
  context.save();
  context.filter = `hue-rotate(${wallHue}deg)`;
  for (let wall of walls.values()) {
    drawBlock(wall, "navy", false);
  }
  context.restore();

  drawGhostPen();
  for (const particle of particles) {
    context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;

  // Food dots (plain white squares, no image)
  context.fillStyle = "white";
  for (let food of foods.values()) {
    context.fillRect(food.x, food.y, food.width, food.height);
  }
  // Draw every cherry still on the board
  for (let c of cherries.values()) {
    drawBlock(c, "crimson", true);
  }
  if (bonusFruit) {
    drawBlock(bonusFruit, "crimson", true);
    context.fillStyle = "white";
    context.font = "bold 11px sans-serif";
    context.textAlign = "center";
    context.fillText(String(bonusFruit.points), bonusFruit.x + 16, bonusFruit.y - 3);
  }
  for (let pellet of powerPellets.values()) {
    context.fillStyle = "#fff7a8";
    context.shadowColor = "#fff7a8";
    context.shadowBlur = 12;
    context.beginPath();
    context.arc(pellet.x + pellet.width / 2, pellet.y + pellet.height / 2, pellet.width / 2, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
  }

  if (killScreen) drawKillScreenGlitch();

  updateHud();
}

function drawKillScreenGlitch() {
  const colors = ["#ff315a", "#fff", "#15d9ff", "#ffe600", "#131313"];
  for (let i = 0; i < 110; i++) {
    context.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    context.globalAlpha = Math.random() * 0.8 + 0.2;
    context.fillRect(Math.random() * boardWidth, Math.random() * boardHeight, Math.random() * 70 + 5, Math.random() * 18 + 2);
  }
  context.globalAlpha = 1;
}

// Highlight the ghost house built into the walls around the starting ghosts.
// The gap in the top edge is the house entrance and exit.
function drawGhostPen() {
  const left = tileSize * 8;
  const top = tileSize * 8;
  const right = tileSize * 11;
  const bottom = tileSize * 10;
  context.save();
  context.strokeStyle = "#9bbcff";
  context.lineWidth = 2;
  context.shadowColor = "#7098ff";
  context.shadowBlur = 8;
  context.beginPath();
  context.moveTo(left, top);
  context.lineTo(tileSize * 9, top);
  context.moveTo(tileSize * 10, top);
  context.lineTo(right, top);
  context.moveTo(left, top);
  context.lineTo(left, bottom);
  context.lineTo(right, bottom);
  context.lineTo(right, top);
  context.stroke();
  // Short bars make the central doorway visible while leaving it passable.
  context.beginPath();
  context.moveTo(tileSize * 9, top);
  context.lineTo(tileSize * 9, top + 7);
  context.moveTo(tileSize * 10, top);
  context.lineTo(tileSize * 10, top + 7);
  context.stroke();
  context.restore();
}

// Keep the status panel and end screen in sync with the game state.
function updateHud() {
  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };
  setText("score", String(score));
  setText("high-score", playerName ? `${playerName}: ${highScore}` : "0");
  setText("lives", "♥ " + String(lives));
  setText("level", String(level));
  setText("final-score", String(score));
  setText("final-level", String(level));
  const ready = document.getElementById("ready-overlay");
  if (ready) {
    ready.hidden = !gameStarted || readyTimer <= 0 || paused || gameOver;
    ready.textContent = readyTimer > 0 ? `LEVEL ${level} — READY!` : "";
  }
  const intermission = document.getElementById("intermission-overlay");
  if (intermission) {
    intermission.hidden = intermissionTimer <= 0 || killScreen;
    const caption = document.getElementById("intermission-caption");
    if (caption) caption.textContent = `LEVEL ${Math.max(1, level - 1)} COMPLETE`;
  }
  const killOverlay = document.getElementById("kill-screen");
  if (killOverlay) killOverlay.hidden = !killScreen;
  const overlay = document.getElementById("game-over");
  if (!overlay) return;
  overlay.hidden = !gameOver && !paused;
  const kicker = overlay.querySelector(".game-over-kicker");
  if (kicker) kicker.textContent = gameOver ? "GAME OVER" : "PAUSED";
  const hint = overlay.querySelector(".restart-hint");
  if (hint) hint.textContent = gameOver ? "Press any key to play again" : "Press P or Play to continue";
  setText("pause-button", paused ? "Play" : "Pause");
}

function ensureAudio() {
  if (soundEnabled && !paused && !gameOver) window.PacmanAudio?.startMusic?.();
}

function playSound(name) {
  if (!soundEnabled) return;
  if (name === "chomp") {
    const now = Date.now();
    if (now - lastChompAt < 90) return;
    lastChompAt = now;
  }
  window.PacmanAudio?.play?.(name);
}

function addScore(points) {
  score += points;
  if (playerName) {
    const key = playerName.toLocaleLowerCase();
    highScore = Math.max(Number(highScores[key]) || 0, score);
    if (highScore > (Number(highScores[key]) || 0)) {
      highScores[key] = highScore;
      saveHighScores();
      renderLeaderboard();
    }
  }
  // The classic game awards one bonus life at 10,000 points.
  if (!extraLifeAwarded && score >= 10000) {
    lives += 1;
    extraLifeAwarded = true;
    playSound("extraLife");
  }
}

function burst(x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    particles.add({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, color, life: 24, maxLife: 24, size: 1 + Math.random() * 2 });
  }
}

function updateParticles() {
  for (const particle of [...particles]) {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vx *= 0.96;
    particle.vy *= 0.96;
    particle.life--;
    if (particle.life <= 0) particles.delete(particle);
  }
}

function flashBoard(className) {
  const wrap = document.querySelector(".board-wrap");
  if (!wrap) return;
  wrap.classList.remove("flash-life", "flash-level");
  void wrap.offsetWidth;
  wrap.classList.add(className);
  window.setTimeout(() => wrap.classList.remove(className), 1400);
}

function togglePause() {
  if (!gameStarted || gameOver) return;
  paused = !paused;
  if (paused && updateTimer) {
    clearTimeout(updateTimer);
    updateTimer = null;
  }
  if (paused) window.PacmanAudio?.pauseMusic?.();
  if (!paused) ensureAudio();
  draw();
  if (!paused) update();
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  document.getElementById("sound-button").textContent = soundEnabled ? "Sound: On" : "Sound: Off";
  document.getElementById("sound-button").setAttribute("aria-pressed", String(soundEnabled));
  window.PacmanAudio?.setEnabled?.(soundEnabled);
  if (soundEnabled) ensureAudio();
}

/* ==========================================================================
   11. MOVEMENT AND GAME RULES
   Called once per frame. Moves Pac-Man and the ghosts, then checks
   collisions, food, the cherry, level completion, and the scared timer.
   ========================================================================== */
function move() {
  ensureAudio();
  noDotFrames++;
  if (noDotFrames >= 160) {
    forceGhostRelease();
    noDotFrames = 0;
  }
  // ----- Pac-Man -----
  tryTurn(); // NEW: apply the player's queued turn as soon as it's possible
  pacman.moveAccumulator = (pacman.moveAccumulator || 0) + pacmanSpeedRatio();
  const movePacmanStep = pacman.moveAccumulator >= 1;
  if (movePacmanStep) {
    pacman.moveAccumulator -= 1;
    pacman.x += pacman.velocityX;
    pacman.y += pacman.velocityY;

  // Wrap horizontally through the side tunnels. The map's open edge tiles
  // let Pac-Man leave one side and re-enter at the matching position.
  if (pacman.x < 0) {
    pacman.x = boardWidth - pacman.width;
  } else if (pacman.x + pacman.width > boardWidth) {
    pacman.x = 0;
  }

  // check wall collisions: if that step put Pac-Man inside a wall, undo it
  for (let wall of walls.values()) {
    if (collision(pacman, wall)) {
      pacman.x -= pacman.velocityX;
      pacman.y -= pacman.velocityY;
      break;
    }
  }
  for (const barrier of ghostPenBarriers) {
    if (collision(pacman, barrier)) {
      pacman.x -= pacman.velocityX;
      pacman.y -= pacman.velocityY;
      break;
    }
  }
  }

  // ----- Ghosts -----
  advanceGhostMode();
  for (let ghost of ghosts.values()) {
    if (ghost.returning && ghost.inPen) {
      if (ghost.returnDelay > 0) {
        ghost.returnDelay--;
        continue;
      }
      ghost.returning = false;
      ghost.inPen = false;
      ghost.leavingPen = true;
      ghost.waitingForDots = false;
      ghost.image = ghost.scaredImmune ? ghost.normalImage : (ghostsScared ? scaredGhostImage : ghost.normalImage);
      ghost.direction = "U";
      ghost.updateVelocity();
    }

    if (!ghost.returning && ghost.waitingForDots) {
      if (dotsEatenThisLevel >= ghost.requiredDots) {
        ghost.waitingForDots = false;
        ghost.leavingPen = true;
      } else {
        continue;
      }
    }

    if (!ghost.returning && ghost.penDelay > 0) {
      ghost.penDelay--;
      continue;
    }

    ghost.moveAccumulator = (ghost.moveAccumulator || 0) + ghostSpeedRatio(ghost);
    if (ghost.moveAccumulator < 1) continue;
    ghost.moveAccumulator -= 1;

    // Ghost touching Pac-Man
    if (collision(ghost, pacman) && !ghost.returning && playerHitGraceFrames === 0) {
      if (ghostsScared && !ghost.scaredImmune) {
        // Eaten ghosts travel back to the pen as eyes before rejoining.
        addScore([200, 400, 800, 1600][Math.min(ghostCombo, 3)]);
        ghostCombo++;
        ghost.returning = true;
        ghost.inPen = false;
        ghost.returnDelay = 0;
        ghost.scaredImmune = true;
        playSound("ghost");
        burst(ghost.x + 16, ghost.y + 16, "#fff7a8", 20);
      } else {
        // Ghost catches Pac-Man: lose a life
        lives -= 1;
        playSound("death");
        flashBoard("flash-life");

        if (lives == 0) {
          gameOver = true;
          window.PacmanAudio?.pauseMusic?.();
          return;
        }

        resetPositions();
        playerHitGraceFrames = 70;
      }
    }

    const houseY = tileSize * 9;
    const houseCenterX = tileSize * 9;
    if (
      ghost.returning &&
      !ghost.inPen &&
      ghost.x === houseCenterX &&
      ghost.y === tileSize * 9
    ) {
      ghost.inPen = true;
      ghost.returnDelay = [...ghosts].filter((other) => other !== ghost && other.inPen).length * 12;
      continue;
    }
    const aligned = ghost.x % tileSize === 0 && ghost.y % tileSize === 0;
    if (aligned && ghost.reversePending && !ghost.returning && !ghost.leavingPen) {
      ghost.direction = opposite[ghost.direction];
      ghost.updateVelocity();
      ghost.reversePending = false;
    } else if (aligned && ghost.returning && !ghost.inPen) {
      chooseReturnDirection(ghost);
    } else if (aligned && ghost.leavingPen) {
      if (ghost.y === houseY && ghost.x !== houseCenterX) {
        ghost.direction = ghost.x < houseCenterX ? "R" : "L";
        ghost.updateVelocity();
      } else if (ghost.x === houseCenterX && ghost.y <= houseY && ghost.y >= tileSize * 8) {
        ghost.direction = "U";
        ghost.updateVelocity();
      }
    } else if (aligned && !ghost.returning) {
      chooseGhostDirection(ghost);
    }

    // Move the ghost
    ghost.x += ghost.velocityX;
    ghost.y += ghost.velocityY;

    if (ghost.x < 0) ghost.x = boardWidth - ghost.width;
    else if (ghost.x + ghost.width > boardWidth) ghost.x = 0;

    const hitWall = [...walls].some((wall) => collision(ghost, wall));
    if (hitWall) {
      ghost.x -= ghost.velocityX;
      ghost.y -= ghost.velocityY;
      ghost.direction = opposite[ghost.direction];
      ghost.updateVelocity();
    }

    if (ghost.returning && !ghost.inPen && ghost.x === tileSize * 9 && ghost.y === tileSize * 9) {
      ghost.inPen = true;
      ghost.returnDelay = [...ghosts].filter((other) => other !== ghost && other.inPen).length * 12;
    }
    if (ghost.leavingPen && ghost.x === houseCenterX && ghost.y < tileSize * 8) ghost.leavingPen = false;
  }

  // ----- Eating food -----
  let foodEaten = null;
  for (let food of foods.values()) {
    if (collision(pacman, food)) {
      foodEaten = food;
      addScore(10);
      playSound("chomp");
      burst(food.x + 2, food.y + 2, "#fff7a8", 5);
      break; // only one dot per frame
    }
  }
  foods.delete(foodEaten);
  if (foodEaten) countDotEaten();

  let pelletEaten = null;
  for (let pellet of powerPellets.values()) {
    if (collision(pacman, pellet)) {
      pelletEaten = pellet;
      break;
    }
  }
  if (pelletEaten) {
    powerPellets.delete(pelletEaten);
    addScore(50);
    countDotEaten();
    ghostCombo = 0;
    const newlyScared = !ghostsScared;
    ghostsScared = true;
    scaredTimer = Math.max(100, Math.round((difficulty === "easy" ? 420 : difficulty === "hard" ? 210 : 300) - level * 10));
    for (let ghost of ghosts.values()) {
      ghost.scaredImmune = false;
      if (!ghost.returning) {
        ghost.image = scaredGhostImage;
        if (newlyScared && !ghost.inPen && !ghost.leavingPen) ghost.reversePending = true;
      }
    }
    playSound("power");
    burst(pacman.x + 16, pacman.y + 16, "#fff7a8", 16);
  }

  if (playerHitGraceFrames > 0) playerHitGraceFrames--;
  updateParticles();

  // ----- Eating the cherry -----
  // Ghosts turn scared ONLY when the cherry is eaten. Before, they were
  // set to scared every frame, so they were always scared.
  // Check each cherry; only the one Pac-Man touches is removed.
  let cherryEaten = null;
  for (let c of cherries.values()) {
    if (collision(pacman, c)) {
      cherryEaten = c;
      break;
    }
  }
  if (cherryEaten) {
    cherries.delete(cherryEaten);
    addScore(100);
    playSound("fruit");
  }

  if (bonusFruit) {
    if (collision(pacman, bonusFruit)) {
      addScore(bonusFruit.points);
      playSound("fruit");
      burst(bonusFruit.x + 16, bonusFruit.y + 16, "#ff365d", 18);
      bonusFruit = null;
    } else if (--bonusFruit.frames <= 0) {
      bonusFruit = null;
    }
  }

  // ----- Next level -----
  // When all food is eaten, rebuild the map and reset positions
  if (foods.size == 0 && powerPellets.size == 0) {
    const clearedLevel = level;
    level += 1;
    loadMap();
    resetPositions();
    readyTimer = 70;
    intermissionTimer = [2, 5, 9, 13, 17].includes(clearedLevel) ? 240 : 0;
    flashBoard("flash-level");
    playSound("level");
  }

  // ----- Scared timer -----
  if (ghostsScared) {
    scaredTimer--;

    if (scaredTimer <= 0) {
      ghostsScared = false;
      // Put each ghost back to its own color
      for (let ghost of ghosts.values()) {
        ghost.scaredImmune = false;
        if (!ghost.returning) ghost.image = ghost.normalImage;
      }
    }
  }
}

/* ==========================================================================
   12. PLAYER INPUT AND TURNING
   Pressing a key doesn't turn Pac-Man immediately. It queues the wanted
   direction in nextDirection. Every frame, tryTurn() checks whether that
   turn is possible and applies it the first moment it is. This is why you
   can press a key slightly before an intersection and it still works.
   ========================================================================== */

// Runs whenever a key is pressed. Only records the direction the player
// WANTS; tryTurn() applies it.
function movePacman(e) {
  // After game over, any key restarts the game
  if (gameOver) {
    loadMap();
    resetPositions();
    lives = 3;
    score = 0;
    level = 1;
    readyTimer = 70;
    playerHitGraceFrames = 70;
    extraLifeAwarded = false;
    paused = false;
    gameOver = false;
    ensureAudio();
    update(); // restart game loop
  }

  if (e.code === "KeyP" || e.code === "Escape") {
    togglePause();
    return;
  }
  if (paused) return;
  ensureAudio();

  // Queue the requested direction (arrow keys or WASD)
  if (e.code == "ArrowUp" || e.code == "KeyW") pacman.nextDirection = "U";
  else if (e.code == "ArrowDown" || e.code == "KeyS")
    pacman.nextDirection = "D";
  else if (e.code == "ArrowLeft" || e.code == "KeyA")
    pacman.nextDirection = "L";
  else if (e.code == "ArrowRight" || e.code == "KeyD")
    pacman.nextDirection = "R";

  if (e.code.startsWith("Arrow")) e.preventDefault(); // stop page scrolling
}

// Returns how far to move in X and Y each frame for a given direction
function velocityFor(direction) {
  if (direction == "U") return { x: 0, y: -stepSize };
  if (direction == "D") return { x: 0, y: stepSize };
  if (direction == "L") return { x: -stepSize, y: 0 };
  return { x: stepSize, y: 0 }; // "R"
}

// Would moving one step this way hit a wall? Only tests; doesn't move.
function canMove(block, direction) {
  const v = velocityFor(direction);
  const test = {
    x: block.x + v.x,
    y: block.y + v.y,
    width: block.width,
    height: block.height,
  };
  if (test.x < 0 || test.x + test.width > boardWidth ||
      test.y < 0 || test.y + test.height > boardHeight) return false;
  for (let wall of walls.values()) {
    if (collision(test, wall)) return false;
  }
  if (ghostPenBarriers.some((barrier) => collision(test, barrier))) return false;
  return true;
}

function canGhostMove(ghost, direction) {
  const velocity = velocityFor(direction);
  const next = {
    x: ghost.x + velocity.x,
    y: ghost.y + velocity.y,
    width: ghost.width,
    height: ghost.height,
  };
  return ![...walls].some((wall) => collision(next, wall));
}

function chooseGhostDirection(ghost) {
  let choices = ghostDirectionPriority.filter((direction) => canGhostMove(ghost, direction));
  const turns = choices.filter((direction) => direction !== opposite[ghost.direction]);
  if (turns.length) choices = turns;
  if (!choices.length) return;
  if (ghostsScared && !ghost.scaredImmune) {
    ghost.direction = choices[Math.floor(Math.random() * choices.length)];
    ghost.updateVelocity();
    return;
  }

  const target = ghostTargetTile(ghost);
  const scored = choices.map((direction) => {
    const step = { U: [0, -1], L: [-1, 0], D: [0, 1], R: [1, 0] }[direction];
    const col = Math.round(ghost.x / tileSize) + step[0];
    const row = Math.round(ghost.y / tileSize) + step[1];
    const dx = col - target.col;
    const dy = row - target.row;
    return { direction, distance: dx * dx + dy * dy };
  });
  const best = Math.min(...scored.map((choice) => choice.distance));
  const bestChoices = scored.filter((choice) => choice.distance === best);
  ghost.direction = bestChoices[0].direction;
  ghost.updateVelocity();
}

function ghostTargetTile(ghost) {
  const pacCol = Math.round(pacman.x / tileSize);
  const pacRow = Math.round(pacman.y / tileSize);
  const corners = {
    chaser: { col: columnCount - 2, row: 1 },
    ambush: { col: 1, row: 1 },
    flank: { col: columnCount - 2, row: rowCount - 2 },
    guard: { col: 1, row: rowCount - 2 },
  };
  if (ghostMode === "scatter" && !(ghost.personality === "chaser" && ghost.elroyStage > 0)) return corners[ghost.personality];

  const ahead = (count, upGlitch = true) => {
    let col = pacCol;
    let row = pacRow;
    if (pacman.direction === "U") {
      row -= count;
      if (upGlitch) col -= count;
    } else if (pacman.direction === "D") row += count;
    else if (pacman.direction === "L") col -= count;
    else col += count;
    return { col, row };
  };

  if (ghost.personality === "chaser") return { col: pacCol, row: pacRow };
  if (ghost.personality === "ambush") return ahead(4);
  if (ghost.personality === "flank") {
    const pivot = ahead(2);
    const red = [...ghosts].find((other) => other.personality === "chaser") || ghost;
    return {
      col: pivot.col * 2 - Math.round(red.x / tileSize),
      row: pivot.row * 2 - Math.round(red.y / tileSize),
    };
  }

  const dx = pacCol - Math.round(ghost.x / tileSize);
  const dy = pacRow - Math.round(ghost.y / tileSize);
  if (dx * dx + dy * dy < 64) return corners.guard;
  return { col: pacCol, row: pacRow };
}

function chooseReturnDirection(ghost) {
  const start = {
    col: Math.round(ghost.x / tileSize),
    row: Math.round(ghost.y / tileSize),
  };
  const target = { col: 9, row: 9 };
  const wallTiles = new Set([...walls].map((wall) => `${wall.x / tileSize},${wall.y / tileSize}`));
  const queue = [{ ...start, firstDirection: null }];
  const visited = new Set([`${start.col},${start.row}`]);

  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (current.col === target.col && current.row === target.row) {
      if (current.firstDirection) {
        ghost.direction = current.firstDirection;
        ghost.updateVelocity();
      }
      return;
    }

    for (const direction of directions) {
      const velocity = velocityFor(direction);
      let col = current.col + Math.sign(velocity.x);
      const row = current.row + Math.sign(velocity.y);
      if (col < 0) col = columnCount - 1;
      else if (col >= columnCount) col = 0;
      const key = `${col},${row}`;
      if (row < 0 || row >= rowCount || visited.has(key) || wallTiles.has(key)) continue;
      visited.add(key);
      queue.push({
        col,
        row,
        firstDirection: current.firstDirection || direction,
      });
    }
  }
}

// Called every frame: apply the queued turn as soon as it's legal
function tryTurn() {
  const want = pacman.nextDirection;
  if (!want) return; // nothing queued

  // "Aligned" means Pac-Man is exactly on a tile, not between two tiles
  const aligned = pacman.x % tileSize == 0 && pacman.y % tileSize == 0;

  // Reversing is always allowed; other turns only when lined up with a tile
  // and the new direction is free of walls
  if (
    (aligned || want == opposite[pacman.direction]) &&
    canMove(pacman, want)
  ) {
    pacman.direction = want;
    pacman.updateVelocity();
    pacman.nextDirection = null; // turn done, clear the queue

    // Swap to the matching Pac-Man picture
    if (want == "U") pacman.image = pacmanUpImage;
    else if (want == "D") pacman.image = pacmanDownImage;
    else if (want == "L") pacman.image = pacmanLeftImage;
    else pacman.image = pacmanRightImage;
  }
}

/* ==========================================================================
   13. HELPERS
   ========================================================================== */

// Returns true if two rectangles overlap
function collision(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// Sends Pac-Man and the ghosts back to their starting spots
// (used after losing a life and when starting a new level)
function resetPositions() {
  pacman.reset();
  pacman.moveAccumulator = 0;
  pacman.nextDirection = null; // NEW: clear any queued turn
  pacman.velocityX = 0;
  pacman.velocityY = 0;
  resetGhostMode();
  for (let ghost of ghosts.values()) {
    ghost.reset();
    ghost.returning = false;
    ghost.inPen = false;
    ghost.leavingPen = true;
    ghost.reversePending = false;
    ghost.scaredImmune = false;
    ghost.moveAccumulator = 0;
    ghost.returnDelay = 0;
    ghost.image = ghostsScared ? scaredGhostImage : ghost.normalImage;
    ghost.direction = "U";
    ghost.updateVelocity();
    // Release every ghost automatically; eating dots must not postpone exits.
    const releaseOrder = { chaser: 0, ambush: 1, flank: 2, guard: 3 };
    ghost.requiredDots = 0;
    ghost.waitingForDots = false;
    ghost.leavingPen = true;
    ghost.penDelay = (releaseOrder[ghost.personality] || 0) * Math.round(500 / frameDelay);
  }
}

function ghostDotLimit(ghost) {
  if (ghost.personality === "flank") return level === 1 ? 30 : 0;
  if (ghost.personality === "guard") return level === 1 ? 60 : level === 2 ? 50 : 0;
  return 0;
}

function releaseWaitingGhosts() {
  for (const ghost of ghosts) {
    if (ghost.waitingForDots && dotsEatenThisLevel >= ghost.requiredDots) {
      ghost.waitingForDots = false;
      ghost.leavingPen = true;
    }
  }
}

function forceGhostRelease() {
  const releaseOrder = { ambush: 0, flank: 1, guard: 2 };
  const waiting = [...ghosts].filter((ghost) => ghost.waitingForDots)
    .sort((a, b) => (releaseOrder[a.personality] ?? 9) - (releaseOrder[b.personality] ?? 9));
  if (!waiting.length) return;
  waiting[0].waitingForDots = false;
  waiting[0].leavingPen = true;
}

function countDotEaten() {
  dotsEatenThisLevel++;
  noDotFrames = 0;
  releaseWaitingGhosts();
  for (const threshold of [70, 170]) {
    if (dotsEatenThisLevel >= threshold && !fruitThresholdsTriggered.has(threshold)) {
      fruitThresholdsTriggered.add(threshold);
      if (!bonusFruit) spawnBonusFruit();
    }
  }
  updateCruiseElroy();
}

function spawnBonusFruit() {
  const pointsByLevel = [0, 100, 300, 500, 700, 1000, 1000, 2000, 2000, 3000, 3000, 3000, 3000];
  const points = pointsByLevel[level] || (level >= 13 ? 5000 : 100);
  bonusFruit = new Block(cherryImage, tileSize * 9, tileSize * 11, tileSize, tileSize);
  bonusFruit.points = points;
  bonusFruit.frames = 360;
}

function updateCruiseElroy() {
  const blinky = [...ghosts].find((ghost) => ghost.personality === "chaser");
  if (!blinky) return;
  const thresholds = level === 1 ? [20, 10] : level === 2 ? [30, 15] : level <= 5 ? [40, 20] : [50, 25];
  const dotsLeft = foods.size + powerPellets.size;
  blinky.elroyStage = killScreen ? 0 : dotsLeft <= thresholds[1] ? 2 : dotsLeft <= thresholds[0] ? 1 : 0;
}

function pacmanSpeedRatio() {
  if (difficulty === "easy") return Math.min(1, level === 1 ? 0.9 : 1);
  if (difficulty === "hard") return Math.min(1, level === 1 ? 0.88 : 0.98);
  return level === 1 ? 0.8 : level <= 4 ? 0.9 : 0.95;
}

function ghostSpeedRatio(ghost) {
  let speed = level === 1 ? 0.75 : level <= 4 ? 0.85 : 0.95;
  if (ghostsScared && !ghost.scaredImmune) speed = level === 1 ? 0.5 : 0.55;
  if (ghost.personality === "chaser" && ghost.elroyStage > 0 && !ghostsScared) {
    speed = ghost.elroyStage === 2 ? 0.9 : 0.82;
  }
  if (ghost.y === tileSize * 9 && (ghost.x < tileSize * 5 || ghost.x > tileSize * 14)) speed = Math.min(speed, 0.4);
  if (ghost.returning) speed = 1;
  if (difficulty === "easy") speed *= 0.85;
  if (difficulty === "hard") speed = Math.min(1, speed * 1.1);
  return speed;
}

function resetGhostMode() {
  ghostsScared = false;
  scaredTimer = 0;
  ghostMode = "scatter";
  ghostModeIndex = 0;
  ghostModeFrames = ghostModeSchedule[0];
}

function advanceGhostMode() {
  if (ghostsScared || ghostModeIndex >= ghostModeSchedule.length - 1) return;
  ghostModeFrames--;
  if (ghostModeFrames > 0) return;
  ghostModeIndex++;
  ghostMode = ghostModeIndex % 2 === 0 ? "scatter" : "chase";
  ghostModeFrames = ghostModeSchedule[ghostModeIndex];
  for (const ghost of ghosts) {
    if (!ghost.returning && !ghost.inPen && !ghost.leavingPen) ghost.reversePending = true;
  }
}

/* ==========================================================================
   14. BLOCK CLASS
   One class for everything on the board: Pac-Man, ghosts, walls, food,
   and the cherry. Each has a picture, a position, a size, and a velocity.
   ========================================================================== */
class Block {
  constructor(image, x, y, width, height) {
    this.image = image; // picture currently shown
    this.normalImage = image; // NEW: original picture (restores ghost colors)
    this.isGhost = [blueGhostImage, orangeGhostImage, pinkGhostImage, redGhostImage].includes(image);
    this.isPacman = image === pacmanRightImage || image === pacmanUpImage || image === pacmanDownImage || image === pacmanLeftImage;
    this.personality = image === redGhostImage ? "chaser" : image === pinkGhostImage ? "ambush" : image === blueGhostImage ? "flank" : image === orangeGhostImage ? "guard" : "";
    this.moveAccumulator = 0;
    this.elroyStage = 0;
    this.waitingForDots = false;
    this.requiredDots = 0;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    // Remember the starting spot so reset() can send it back
    this.startX = x;
    this.startY = y;

    this.direction = "R"; // current direction
    this.inPen = false;
    this.leavingPen = false;
    this.reversePending = false;
    this.scaredImmune = false;
    this.nextDirection = null; // NEW: queued turn requested by the player
    this.velocityX = 0; // pixels moved per frame horizontally
    this.velocityY = 0; // pixels moved per frame vertically
  }

  // Change direction without moving, keeping ghosts aligned with the tiles.
  updateDirection(direction) {
    if (!(this.isGhost ? canGhostMove(this, direction) : canMove(this, direction))) return;
    this.direction = direction;
    this.updateVelocity();
  }

  // Sets velocityX/velocityY to match the current direction
  updateVelocity() {
    const speed = this.isGhost ? ghostStepSize : stepSize;
    if (this.direction == "U") {
      this.velocityX = 0;
      this.velocityY = -speed;
    } else if (this.direction == "D") {
      this.velocityX = 0;
      this.velocityY = speed;
    } else if (this.direction == "L") {
      this.velocityX = -speed;
      this.velocityY = 0;
    } else if (this.direction == "R") {
      this.velocityX = speed;
      this.velocityY = 0;
    }
  }

  // Moves the block back to where it started
  reset() {
    this.x = this.startX;
    this.y = this.startY;
    this.leavingPen = this.isGhost;
  }
}


