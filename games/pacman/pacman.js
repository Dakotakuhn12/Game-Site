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

/* ==========================================================================
   2. SPEED SETTINGS
   stepSize   = pixels moved per frame
   frameDelay = milliseconds between frames (50ms = 20 FPS)

   For smoother motion, use tileSize / 8 and frameDelay = 25.
   Keep stepSize a divisor of tileSize so turns line up with tiles.
   ========================================================================== */
// speed settings
const stepSize = tileSize / 4;
const frameDelay = 50;

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

let pacman; // the player

// After eating the cherry, ghosts are "scared" for a while
let ghostsScared = false;
let scaredTimer = 0; // frames left until ghosts return to normal

const directions = ["U", "D", "L", "R"]; // up down left right

// Lookup used to check if a turn is a reversal (U <-> D, L <-> R)
const opposite = { U: "D", D: "U", L: "R", R: "L" };

let score = 0;
let lives = 3;
let gameOver = false;

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

  // Give every ghost a random starting direction
  for (let ghost of ghosts.values()) {
    const newDirection = directions[Math.floor(Math.random() * 4)]; //0-3
    ghost.updateDirection(newDirection);
  }

  update(); // start the game loop

  // Listen for key PRESSES (keydown). This was keyup before, which made
  // controls feel delayed because nothing happened until you let go.
  document.addEventListener("keydown", movePacman);
};

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
  ghostsScared = false;
  scaredTimer = 0;

  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < columnCount; c++) {
      const row = tileMap[r];
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
}

/* ==========================================================================
   9. GAME LOOP
   Runs over and over: move everything, then draw everything.
   ========================================================================== */
function update() {
  if (gameOver) {
    draw(); // draw one last time so the "Game Over" text appears
    return; // stop looping; pressing a key restarts (see movePacman)
  }
  move();
  draw();
  setTimeout(update, frameDelay); // schedule the next frame
}

/* ==========================================================================
   10. DRAWING
   ========================================================================== */

// Draws Pac-Man from his image if it loaded, otherwise as a yellow circle
// with an animated mouth facing the direction he's moving
function drawPacman() {
  if (imageReady(pacman.image)) {
    context.drawImage(
      pacman.image,
      pacman.x,
      pacman.y,
      pacman.width,
      pacman.height,
    );
    return;
  }

  // ----- Fallback shape -----
  const cx = pacman.x + pacman.width / 2; // circle center X
  const cy = pacman.y + pacman.height / 2; // circle center Y
  const r = pacman.width / 2 - 2; // radius

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

// Redraws the whole screen every frame
function draw() {
  context.clearRect(0, 0, board.width, board.height); // wipe the canvas
  drawPacman();
  for (let ghost of ghosts.values()) {
    drawBlock(ghost, ghostsScared ? "royalblue" : "red", true);
  }
  for (let wall of walls.values()) {
    drawBlock(wall, "navy", false);
  }

  // Food dots (plain white squares, no image)
  context.fillStyle = "white";
  for (let food of foods.values()) {
    context.fillRect(food.x, food.y, food.width, food.height);
  }
  // Draw every cherry still on the board
  for (let c of cherries.values()) {
    drawBlock(c, "crimson", true);
  }

  // Score and lives text in the top-left corner
  context.fillStyle = "white";
  context.font = "14px sans-serif";
  if (gameOver) {
    context.fillText("Game Over: " + String(score), tileSize / 2, tileSize / 2);
  } else {
    context.fillText(
      "x" + String(lives) + " " + String(score),
      tileSize / 2,
      tileSize / 2,
    );
  }
}

/* ==========================================================================
   11. MOVEMENT AND GAME RULES
   Called once per frame. Moves Pac-Man and the ghosts, then checks
   collisions, food, the cherry, level completion, and the scared timer.
   ========================================================================== */
function move() {
  // ----- Pac-Man -----
  tryTurn(); // NEW: apply the player's queued turn as soon as it's possible

  pacman.x += pacman.velocityX;
  pacman.y += pacman.velocityY;

  // check wall collisions: if that step put Pac-Man inside a wall, undo it
  for (let wall of walls.values()) {
    if (collision(pacman, wall)) {
      pacman.x -= pacman.velocityX;
      pacman.y -= pacman.velocityY;
      break;
    }
  }

  // ----- Ghosts -----
  for (let ghost of ghosts.values()) {
    // Ghost touching Pac-Man
    if (collision(ghost, pacman)) {
      if (ghostsScared) {
        // Pac-Man eats the ghost: bonus points, ghost returns to its start
        score += 200;
        ghost.reset();
      } else {
        // Ghost catches Pac-Man: lose a life
        lives -= 1;

        if (lives == 0) {
          gameOver = true;
          return;
        }

        resetPositions();
      }
    }

    // Ghosts in the ghost-house row (row 9) are pushed upward so they
    // leave the house instead of wandering sideways inside it
    if (
      ghost.y == tileSize * 9 &&
      ghost.direction != "U" &&
      ghost.direction != "D"
    ) {
      ghost.updateDirection("U");
    }

    // Move the ghost
    ghost.x += ghost.velocityX;
    ghost.y += ghost.velocityY;

    // If it hit a wall or the screen edge, undo the step and pick a
    // new random direction
    for (let wall of walls.values()) {
      if (
        collision(ghost, wall) ||
        ghost.x <= 0 ||
        ghost.x + ghost.width >= boardWidth
      ) {
        ghost.x -= ghost.velocityX;
        ghost.y -= ghost.velocityY;
        const newDirection = directions[Math.floor(Math.random() * 4)];
        ghost.updateDirection(newDirection);
      }
    }
  }

  // ----- Eating food -----
  let foodEaten = null;
  for (let food of foods.values()) {
    if (collision(pacman, food)) {
      foodEaten = food;
      score += 10;
      break; // only one dot per frame
    }
  }
  foods.delete(foodEaten);

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
    ghostsScared = true;
    scaredTimer = 300; // 300 frames = about 15 seconds at 20 FPS
    for (let ghost of ghosts.values()) {
      ghost.image = scaredGhostImage;
    }
  }

  // ----- Next level -----
  // When all food is eaten, rebuild the map and reset positions
  if (foods.size == 0) {
    loadMap();
    resetPositions();
  }

  // ----- Scared timer -----
  if (ghostsScared) {
    scaredTimer--;

    if (scaredTimer <= 0) {
      ghostsScared = false;
      // Put each ghost back to its own color
      for (let ghost of ghosts.values()) {
        ghost.image = ghost.normalImage;
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
    gameOver = false;
    update(); // restart game loop
    return;
  }

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
  for (let wall of walls.values()) {
    if (collision(test, wall)) return false;
  }
  return true;
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
  pacman.nextDirection = null; // NEW: clear any queued turn
  pacman.velocityX = 0;
  pacman.velocityY = 0;
  for (let ghost of ghosts.values()) {
    ghost.reset();
    const newDirection = directions[Math.floor(Math.random() * 4)];
    ghost.updateDirection(newDirection);
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
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    // Remember the starting spot so reset() can send it back
    this.startX = x;
    this.startY = y;

    this.direction = "R"; // current direction
    this.nextDirection = null; // NEW: queued turn requested by the player
    this.velocityX = 0; // pixels moved per frame horizontally
    this.velocityY = 0; // pixels moved per frame vertically
  }

  // Tries to switch direction. If the new direction runs straight into a
  // wall, the change is cancelled. (Used by ghosts; Pac-Man uses tryTurn.)
  updateDirection(direction) {
    const prevDirection = this.direction;
    this.direction = direction;
    this.updateVelocity();

    // Take a trial step in the new direction
    this.x += this.velocityX;
    this.y += this.velocityY;

    // If the trial step hits a wall, undo it and restore the old direction
    for (let wall of walls.values()) {
      if (collision(this, wall)) {
        this.x -= this.velocityX;
        this.y -= this.velocityY;
        this.direction = prevDirection;
        this.updateVelocity();
        return;
      }
    }
  }

  // Sets velocityX/velocityY to match the current direction
  updateVelocity() {
    if (this.direction == "U") {
      this.velocityX = 0;
      this.velocityY = -stepSize;
    } else if (this.direction == "D") {
      this.velocityX = 0;
      this.velocityY = stepSize;
    } else if (this.direction == "L") {
      this.velocityX = -stepSize;
      this.velocityY = 0;
    } else if (this.direction == "R") {
      this.velocityX = stepSize;
      this.velocityY = 0;
    }
  }

  // Moves the block back to where it started
  reset() {
    this.x = this.startX;
    this.y = this.startY;
  }
}
