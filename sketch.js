// Module aliases
const Engine = Matter.Engine;
const World = Matter.World;
const Events = Matter.Events;
const Bodies = Matter.Bodies;
const Body = Matter.Body;
const Constraint = Matter.Constraint;

let engine;
let world;

// Declare variables
let gameHandler;
let table;
let teleporters;
let cueBall;
let slingShot;
let redBalls = [];
let coloredBalls = [];
const coloredBallsAttributes = [
  { name: 'Yellow', values: [240, 210, 0], position: {x: 400, y: 496}, points: 2},
  { name: 'Green', values: [40, 90, 50], position: {x: 400, y: 305}, points: 3},
  { name: 'Brown', values: [120, 60, 50], position: {x: 400, y: 400}, points: 4},
  { name: 'Blue', values: [30, 60, 90], position: {x: 700, y: 400}, points: 5},
  { name: 'Pink', values: [255, 120, 120], position: {x: 930, y: 400}, points: 6},
  { name: 'Black', values: [50, 50, 50], position: {x: 1120, y: 400}, points: 7},
];

function setup() {
  // Create a canvas and background. AngleMode DEGREES for easier calculations.
  createCanvas(1400, 800);
  angleMode(DEGREES);

  // Create an engine and run engine.
  engine = Engine.create({gravity: {x:0, y:0}});
  Engine.run(engine);

  // Create a world.
  world = engine.world;
  
  // Create game handler. Initialize UI.
  gameHandler = new GameHandler();
  gameHandler.buttonUi();

  // Create table object. Set placeBalls mode to be 'starting'.
  table = new Table(width/2, height/2, 1000, 500);
  table.setupTableBody();
  table.setupTableWalls();
  table.setupTablemarkings();
  table.setupTableCorners();
  table.setupPockets();
  table.setupTableCushions();
  table.placeBalls('starting');

  // Create teleporters
  teleporters = new Teleporters();
  teleporters.setupTeleporters();

  // Handle collisions
  let collisionHandler = new CollisionHandler();
  Events.on(engine, 'collisionStart', (event) => {
    let pairs = event.pairs;

    // Seperate into single pairs
    for (let i = 0; i < pairs.length; i++) {
      let pair = pairs[i];

      // Pocket collisions.
      if ((pair.bodyA.label === 'tablePocket' && pair.bodyB.label === 'cueBall') || (pair.bodyA.label === 'cueBall' && pair.bodyB.label === 'tablePocket')) collisionHandler.pocketedCueBall();
      if ((pair.bodyA.label === 'tablePocket' && pair.bodyB.label === 'coloredBall') || (pair.bodyA.label === 'coloredBall' && pair.bodyB.label === 'tablePocket')) collisionHandler.pocketedColoredBall(pair.bodyA, pair.bodyB);
      if ((pair.bodyA.label === 'tablePocket' && pair.bodyB.label === 'redBall') || (pair.bodyA.label === 'redBall' && pair.bodyB.label === 'tablePocket')) collisionHandler.pocketedRedBall(pair.bodyA, pair.bodyB);

      // Teleport collisions.
      if ((pair.bodyA.label === 'teleporter' && pair.bodyB.label === 'cueBall') || (pair.bodyA.label === 'cueBall' && pair.bodyB.label === 'teleporter')) collisionHandler.teleportedCueBall(pair.bodyA, pair.bodyB);
      if ((pair.bodyA.label === 'teleporter' && pair.bodyB.label === 'coloredBall') || (pair.bodyA.label === 'coloredBall' && pair.bodyB.label === 'teleporter')) collisionHandler.teleportedColoredBall(pair.bodyA, pair.bodyB);
      if ((pair.bodyA.label === 'teleporter' && pair.bodyB.label === 'redBall') || (pair.bodyA.label === 'redBall' && pair.bodyB.label === 'teleporter')) collisionHandler.teleportedRedBall(pair.bodyA, pair.bodyB);
    }
  })
}

function draw() {
  Engine.update(engine);
  background(0,100,200);

  // Draw table.
  table.drawTableBody();
  table.drawTableMarkings();
  table.drawTableWalls();
  table.drawTableCorners();
  table.drawTablePockets();
  table.drawTableCushions();

  // Draw teleporters
  teleporters.drawTeleporters();
  teleporters.updateTeleporters();

  // Draw the red balls and colored balls.
  redBalls.forEach(redBall => {
    redBall.drawBall();
    redBall.updateBall();
    redBall.preventTeleport();
    redBall.teleportCooldownCounter();
  });
  coloredBalls.forEach(coloredBall => {
    coloredBall.drawBall();
    coloredBall.updateBall();
    coloredBall.preventTeleport();
    coloredBall.teleportCooldownCounter()
  });

  // Update gamePhase. Show mistakes and score.
  gameHandler.gamePhaseUpdate();
  gameHandler.mistakeHandler();
  gameHandler.scoreUi();

  // If cue ball exists, draw cue ball.
  if (cueBall) {
    cueBall.drawBall();
    cueBall.updateBall();
    cueBall.preventTeleport();
    cueBall.teleportCooldownCounter();
    cueBall.checkClick();
    // Create sling shot.
    gameHandler.setupSlingShot();
    if (slingShot) {
      gameHandler.drawSlingShot();
    }
  }
}

function mouseReleased(){
  if (cueBall && slingShot) {
    // Calculate the force of the slingshot.
    gameHandler.calculateForce();
    // Set cueball is not clicked on and remove slingshot.
    cueBall.isCueBallClicked = false;
    gameHandler.removeSlingShot();
  }
}

class GameHandler {
  constructor() {
    this.score = 0;
    this.coloredBallPocketCount = 0;
    // Initial game phase is 'placing' (placing the cueball).
    this.gamePhase = 'placing';
  }

  buttonUi() {
    this.button('Starting Position', 10, 'placing', 'starting');
    this.button('Randomize red balls', 35, 'placing', 'randomRed');
    this.button('Randomize all balls', 60, 'placing', 'randomAll');
  }

  button(label, positionY, gamePhase, placeBalls) {
    let btn = createButton(label);
    btn.position(10, positionY);
    btn.mousePressed(() => {
      table.placeBalls(placeBalls);
      this.gamePhase = gamePhase;
      this.score = 0;
    })
  }

  /** Display score. */
  scoreUi() {
    textSize(40);
    fill(255);
    text(`Score: ${this.score}`, 10, height - 20);
  }

  /** Update game phase. */
  gamePhaseUpdate() {
    switch (this.gamePhase) {
      case 'placing':
        this.placeCueBall();
        cursor(HAND);
        break;
      case 'gaming':
        this.gameStart();
        cursor(ARROW);
        break;
      case 'gameOver':
        break;
    }
  }

  /** Placing phase. Allow player to place cue ball within the table. */
  placeCueBall() {
    if (this.gamePhase === 'placing') {
      // Display instructions.
      textSize(40);
      fill(255);
      text("Please place cue ball.", width/2 - 200, 60);

      // Check if mouse is inside table and does not overlap red and colored balls.
      let isValidWithRed = redBalls.every(ball => dist(mouseX, mouseY, ball.position.x, ball.position.y) > ball.ballDiameter);
      let isValidWithColor = coloredBalls.every(ball => dist(mouseX, mouseY, ball.position.x, ball.position.y) > ball.ballDiameter);
      if ((mouseX > 240 && mouseX < 1160 && mouseY > 190 && mouseY < 610) && (isValidWithRed && isValidWithColor)) {
        push();
        fill(255,255,255,150);
        stroke(0,0,0,150);
        ellipse(mouseX, mouseY, 27);
        pop();
        // Place cue ball if the mouse is pressed. Change to gaming phase.
        if (mouseIsPressed) {
          cueBall = new Ball(mouseX, mouseY, [255,255,255], 'white', 'cueBall');
          this.gamePhase = 'gaming';
        } 
      } else {
        push();
        fill(255,0,0,100);
        stroke(0,0,0,100);
        ellipse(mouseX, mouseY, 27);
        pop();
      }
    }
  }

  /** Game phase. Player can start to drag cue ball. */
  gameStart() {
    if (this.gamePhase === 'gaming') {
      fill(255,255,255);
      text("Drag the cueball backwards and release!", width/2 - 350, 60);
    }
  }

  /** Create slingshot when player clicks on cue ball. */
  setupSlingShot() {
    // Make sure ball is not moving. (technically still moving but it takes very long for speed to reach 0)
    if (cueBall.speed < 0.005 && cueBall.isCueBallClicked && mouseIsPressed) {
      // Make sure constraint does not get too long.
      let mapValueX = map(mouseX, cueBall.position.x - 100, cueBall.position.x + 100, cueBall.position.x - 50, cueBall.position.x + 50);
      let mapValueY = map(mouseY, cueBall.position.y - 100, cueBall.position.y + 100, cueBall.position.y - 50, cueBall.position.y + 50);
      
      // Create a constraint from the cue ball to the cursor.
      slingShot = Constraint.create({
        pointA: {x: cueBall.position.x, y: cueBall.position.y},
        pointB: {x: mapValueX, y: mapValueY},
        stiffness: 0.01, 
        damping: 0.0001
      });
      World.add(world, slingShot);
    }
  }

  drawSlingShot(){
    push();
    fill(255,165,0);
    drawConstraint(slingShot);
    pop();
  }

  removeSlingShot() {
    slingShot = null;
  }

  calculateForce() {
    // Calculate the force magnitude.
    let forceMagnitude = dist(slingShot.pointA.x, slingShot.pointA.y, slingShot.pointB.x, slingShot.pointB.y) * 0.0001;
    // Calculate the force components. Limit the force so the ball will not 'teleport' out of bounds.
    let forceX = constrain((slingShot.pointA.x - slingShot.pointB.x) * forceMagnitude * 0.01, -0.06, 0.06);
    let forceY = constrain((slingShot.pointA.y - slingShot.pointB.y) * forceMagnitude * 0.01, -0.06, 0.06);
    Body.applyForce(cueBall.ball, cueBall.ball.position, { x: forceX, y: forceY });
  }

  mistakeHandler() {
    if (this.coloredBallPocketCount === 2) {
      console.log('2 COLORED BALLS POCKETED CONSECUTIVELY!');
      this.coloredBallPocketCount = 0;
    }
  }
}

class Table {
  constructor(tableX, tableY, tableWidth, tableHeight) {
    this.tableWidth = tableWidth;
    this.tableHeight = tableHeight;
    this.tableX = tableX;
    this.tableY = tableY;
    this.tableWalls = [];
    this.tableEdges = [];
    this.tableCorners = [];
    this.tableCushions = [];
    this.tablePockets = [];

    // Ball reference dimensions
    this.ballRadius = 13.5;
    this.ballDiameter = 27;
  }

  setupTableBody() {
    this.tableBody = Bodies.rectangle(this.tableX, this.tableY, this.tableWidth, this.tableHeight, {isStatic: true});
  }

  setupTableWalls() {
    const wallWidth = 20;
    const edgeLength = 40;
    const options = {isStatic: true, restitution: 1, friction: 0};
    this.tableWallTop = Bodies.rectangle(this.tableX, this.tableY - this.tableHeight/2 - wallWidth/2, this.tableWidth - 60, wallWidth, {...options});
    this.tableWallBottom = Bodies.rectangle(this.tableX, this.tableY + this.tableHeight/2 + wallWidth/2, this.tableWidth - 60, wallWidth, {...options});
    this.tableWallLeft = Bodies.rectangle(this.tableX - this.tableWidth/2 - wallWidth/2, this.tableY, wallWidth, this.tableHeight - 60, {...options});
    this.tableWallRight = Bodies.rectangle(this.tableX + this.tableWidth/2 + wallWidth/2, this.tableY, wallWidth, this.tableHeight - 60, {...options});
    this.tableWalls.push(this.tableWallTop, this.tableWallBottom, this.tableWallLeft, this.tableWallRight);
    World.add(world, [this.tableWallTop, this.tableWallBottom, this.tableWallLeft, this.tableWallRight]);

    this.tableWallTopEdge1 = Bodies.rectangle(this.tableX - this.tableWidth/2 + 30, this.tableY - this.tableHeight/2 - wallWidth/2, edgeLength, wallWidth, {...options});
    this.tableWallTopEdge2 = Bodies.rectangle(this.tableX + this.tableWidth/2 - 30, this.tableY - this.tableHeight/2 - wallWidth/2, edgeLength, wallWidth, {...options});
    this.tableWallBottomEdge1 = Bodies.rectangle(this.tableX - this.tableWidth/2 + 30, this.tableY + this.tableHeight/2 + wallWidth/2, edgeLength, wallWidth, {...options});
    this.tableWallBottomEdge2 = Bodies.rectangle(this.tableX + this.tableWidth/2 - 30, this.tableY + this.tableHeight/2 + wallWidth/2, edgeLength, wallWidth, {...options});
    this.tableWallLeftEdge1 = Bodies.rectangle(this.tableX - this.tableWidth/2 - wallWidth/2, this.tableY - this.tableHeight/2 + 30, wallWidth, edgeLength, {...options});
    this.tableWallLeftEdge2 = Bodies.rectangle(this.tableX - this.tableWidth/2 - wallWidth/2, this.tableY + this.tableHeight/2 - 30, wallWidth, edgeLength, {...options});
    this.tableWallRightEdge1 = Bodies.rectangle(this.tableX + this.tableWidth/2 + wallWidth/2, this.tableY - this.tableHeight/2 + 30, wallWidth, edgeLength, {...options});
    this.tableWallRightEdge2 = Bodies.rectangle(this.tableX + this.tableWidth/2 + wallWidth/2, this.tableY + this.tableHeight/2 - 30, wallWidth, edgeLength, {...options});
    this.tableEdges.push(this.tableWallTopEdge1, this.tableWallTopEdge2, this.tableWallBottomEdge1, this.tableWallBottomEdge2, this.tableWallLeftEdge1, this.tableWallLeftEdge2, this.tableWallRightEdge1, this.tableWallRightEdge2);
    World.add(world, [this.tableWallTopEdge1, this.tableWallTopEdge2, this.tableWallBottomEdge1, this.tableWallBottomEdge2, this.tableWallLeftEdge1, this.tableWallLeftEdge2, this.tableWallRightEdge1, this.tableWallRightEdge2]);
  }

  setupTableCorners() {
    this.tableCorner1 = Bodies.circle(this.tableX - this.tableWidth/2 + 9, height/2 - this.tableHeight/2 + 9 , 28.5, {isStatic: true});
    this.tableCorner2 = Bodies.circle(this.tableX + this.tableWidth/2 - 9, height/2 - this.tableHeight/2 + 9, 28.5, {isStatic: true});
    this.tableCorner3 = Bodies.circle(this.tableX - this.tableWidth/2 + 9, height/2 + this.tableHeight/2 - 9, 28.5, {isStatic: true});
    this.tableCorner4 = Bodies.circle(width/2 + this.tableWidth/2 - 9, height/2 + this.tableHeight/2 - 9, 28.5, {isStatic: true});
    this.tableCorners.push(this.tableCorner1, this.tableCorner2, this.tableCorner3, this.tableCorner4);
  }

  setupTablemarkings() {
    const markingX = this.tableWidth/2.5;
    this.marking1 = Bodies.circle(markingX, this.tableY, 100);
    this.marking2 = Bodies.circle(markingX, this.tableY, 95);
    this.marking3 = Bodies.rectangle(markingX, this.tableY, 5, this.tableHeight);
    this.marking4 = Bodies.rectangle(markingX + 72.6, this.tableY, width/10, height/2);
  }

  setupPockets() {
    const options = {isStatic: true, isSensor: true, label: 'tablePocket'};
    this.tablePocket1 = Bodies.circle(this.tableX - this.tableWidth/2 + 20, height/2 - this.tableHeight/2 + 20, 5, {...options});
    this.tablePocket2 = Bodies.circle(this.tableX, height/2 - this.tableHeight/2 + 10, 5, {...options});
    this.tablePocket3 = Bodies.circle(this.tableX + this.tableWidth/2 - 20, height/2 - this.tableHeight/2 + 20, 5, {...options});
    this.tablePocket4 = Bodies.circle(this.tableX - this.tableWidth/2 + 20, height/2 + this.tableHeight/2 - 20, 5, {...options});
    this.tablePocket5 = Bodies.circle(width/2, height/2 + this.tableHeight/2 - 10, 5, {...options});
    this.tablePocket6 = Bodies.circle(width/2 + this.tableWidth/2 - 20, height/2 + this.tableHeight/2 - 20, 5, {...options});
    this.tablePocketAppearance1 = Bodies.circle(this.tablePocket1.position.x, this.tablePocket1.position.y, this.ballRadius * 1.4, {isStatic: true});
    this.tablePocketAppearance2 = Bodies.circle(this.tablePocket2.position.x, this.tablePocket2.position.y, this.ballRadius * 1.4, {isStatic: true});
    this.tablePocketAppearance3 = Bodies.circle(this.tablePocket3.position.x, this.tablePocket3.position.y, this.ballRadius * 1.4, {isStatic: true});
    this.tablePocketAppearance4 = Bodies.circle(this.tablePocket4.position.x, this.tablePocket4.position.y, this.ballRadius * 1.4, {isStatic: true});
    this.tablePocketAppearance5 = Bodies.circle(this.tablePocket5.position.x, this.tablePocket5.position.y, this.ballRadius * 1.4, {isStatic: true});
    this.tablePocketAppearance6 = Bodies.circle(this.tablePocket6.position.x, this.tablePocket6.position.y, this.ballRadius * 1.4, {isStatic: true});

    this.tablePockets.push(this.tablePocketAppearance1, this.tablePocketAppearance2, this.tablePocketAppearance3, this.tablePocketAppearance4, this.tablePocketAppearance5, this.tablePocketAppearance6);
    World.add(world, [this.tablePocket1, this.tablePocket2, this.tablePocket3, this.tablePocket4, this.tablePocket5, this.tablePocket6]);
  }

  setupTableCushions() {
    const cushionWidth = 20;
    const cushionLength = this.tableWidth/2 - 90;
    const halfTableWidth = this.tableWidth / 2;
    const halfTableHeight = this.tableHeight / 2;
    const offset = 5;
    const options = {isStatic: true, restitution: 1, friction: 0};

    this.tableCushionLeft = Bodies.trapezoid(this.tableX - halfTableWidth + cushionWidth/2, this.tableY, cushionLength + 38, cushionWidth, 0.1, {...options, angle: radians(90)});
    this.tableCushionRight = Bodies.trapezoid(this.tableX + halfTableWidth - cushionWidth/2, this.tableY, cushionLength + 38, cushionWidth, 0.1, {...options, angle: radians(-90)});
    this.tableCushionTop1 = Bodies.trapezoid(this.tableX - halfTableWidth/2 + offset, this.tableY - halfTableHeight + cushionWidth/2, cushionLength + 5, cushionWidth, -0.1, {...options});
    this.tableCushionTop2 = Bodies.trapezoid(this.tableX + halfTableWidth/2 - offset, this.tableY - halfTableHeight + cushionWidth/2, cushionLength + 5, cushionWidth, -0.1, {...options});
    this.tableCushionBottom1 = Bodies.trapezoid(this.tableX - halfTableWidth/2 + offset, this.tableY + halfTableHeight - cushionWidth/2, cushionLength + 5, cushionWidth, -0.1, {...options, angle: radians(180)});
    this.tableCushionBottom2 = Bodies.trapezoid(this.tableX + halfTableWidth/2 - offset, this.tableY + halfTableHeight - cushionWidth/2, cushionLength + 5, cushionWidth, -0.1, {...options, angle: radians(180)});
    this.tableCushions.push(this.tableCushionTop1, this.tableCushionTop2, this.tableCushionLeft, this.tableCushionRight, this.tableCushionBottom1, this.tableCushionBottom2);
    World.add(world, [this.tableCushionLeft, this.tableCushionRight, this.tableCushionTop1, this.tableCushionTop2, this.tableCushionBottom1, this.tableCushionBottom2]);
  }

  drawTableBody() {
    fill(114, 184, 54);
    drawVertices(this.tableBody.vertices);
  }

  drawTableMarkings() {
    push();
      noStroke();
      fill(255);
      drawVertices(this.marking1.vertices);
      fill(114, 184, 54);
      drawVertices(this.marking2.vertices);
      fill(255);
      drawVertices(this.marking3.vertices);
      fill(114, 184, 54);
      drawVertices(this.marking4.vertices);
    pop();
  }

  drawTableWalls() {
    fill(150, 75, 0);
    this.tableWalls.forEach(wall => drawVertices(wall.vertices));
    fill(255, 215, 0);
    this.tableEdges.forEach(edge => drawVertices(edge.vertices));
  }

  drawTableCorners() {
    push();
    noStroke();
    fill(255, 215, 0);
    this.tableCorners.forEach(corner => drawVertices(corner.vertices));
    pop();
  }

  drawTablePockets() {
    fill(0);
    this.tablePockets.forEach(pocket => drawVertices(pocket.vertices));
  }

  drawTableCushions() {
    fill(70, 124, 54);
    this.tableCushions.forEach(cushion => drawVertices(cushion.vertices));
  }

  /**
   * Player can select 3 modes to place balls.
   * 1. Place all balls in starting position.
   * 2. Place red balls in random positions.
   * 3. Place red and colored balls in random positions.
   */
  placeBalls(mode) {
    // Remove existing balls from world then clear the ball arrays
    redBalls.forEach(ball => World.remove(world, ball.ball));
    redBalls = [];
    coloredBalls.forEach(ball => World.remove(world, ball.ball));
    coloredBalls = [];
    if (cueBall) {
      World.remove(world, cueBall.ball);
      cueBall = null;
    }

    // Depending on user's choice, place the red and colored balls
    switch (mode) {
      case 'starting':
        this.placeStarting();
        break;
      case 'randomRed':
        this.placeRandomRed();
        break;
      case 'randomAll':
        this.placeRandomAll();
        break;
    }
  }

  placeStarting() {
    // Populate the redBalls array. Using a nested for loop to create a triangle formation
    for (let i = 1; i <= 5; i++) {
      for (let j = 1; j <= i; j++) {
        // Offset the balls XY's value by amount of columns, offset entire balls columns Y value by ball radius * column.
        redBalls.push(new Ball(width/1.5 + i*this.ballDiameter*0.9, height/2 + j*this.ballDiameter - (this.ballRadius*i) - this.ballRadius, [255,0,0], 'red', 'redBall'));
      }
    }

    // Place colored balls in starting position.
    for (let i = 0; i < coloredBallsAttributes.length; i++) {
      coloredBalls.push(new Ball(coloredBallsAttributes[i].position.x, coloredBallsAttributes[i].position.y, coloredBallsAttributes[i].values, coloredBallsAttributes[i].name, 'coloredBall'));
    }
  }

  // Place colored balls in starting position and place red balls randomly.
  placeRandomRed() {
    for (let i = 0; i < coloredBallsAttributes.length; i++) {
      coloredBalls.push(new Ball(coloredBallsAttributes[i].position.x, coloredBallsAttributes[i].position.y, coloredBallsAttributes[i].values, coloredBallsAttributes[i].name, 'coloredBall'));
    }
    this.placeBallsRandomly(redBalls, [255, 0, 0], 15, coloredBalls, 'redBall');
  }

  // Place both set of balls randomly.
  placeRandomAll() {
    this.placeBallsRandomly(redBalls, [255, 0, 0], 15, coloredBalls, 'redBall');
    this.placeBallsRandomly(coloredBalls, coloredBallsAttributes, coloredBallsAttributes.length, redBalls, 'coloredBall');
  }

  /**
   * Accepts 2 ball arrays for comparison.
   * Check against each ball array and pockets then randomly place balls.
   */
  placeBallsRandomly(ballArray, color, quantity, ballArray2, labelType) {
    let index;
    for (let i = 0; i < quantity; i ++) {
      index = i;
      // Generate random X and Y values within the table width and height
      let randomX, randomY;
      let isValidWithOwnColor = false;
      let isValidWithOtherColor = false;
      let isValidWithPockets = false;

      // While there are no valid positions, continue to make new randomX and randomY values.
      while (!isValidWithOwnColor || !isValidWithPockets || !isValidWithOtherColor) {
        randomX = random((width - this.tableWidth)/2 + this.ballRadius + 35, width/2 + this.tableWidth/2 - this.ballRadius - 35);
        randomY = random((height - this.tableHeight)/2 + this.ballRadius + 35, height/2 + this.tableHeight/2 - this.ballRadius - 35);
        /**
         * Check the distance between the current ball and every ball in the redBalls array and coloredBalls array.
         * If distance more than ball diameter, continue with the code, else loop
         **/
        isValidWithOwnColor = ballArray.every(ball => dist(randomX, randomY, ball.position.x, ball.position.y) > ball.ballDiameter);
        isValidWithOtherColor = ballArray2.every(ball => dist(randomX, randomY, ball.position.x, ball.position.y) > ball.ballDiameter);
        isValidWithPockets = this.tablePockets.every(pocket => dist(randomX, randomY, pocket.position.x, pocket.position.y) > 27 * 1.4);
      }
      // Push balls into array. Depending on which array, push the correct colors
      if (ballArray === redBalls) ballArray.push(new Ball(randomX, randomY, color, 'Red', labelType));
      if (ballArray === coloredBalls) ballArray.push(new Ball(randomX, randomY, coloredBallsAttributes[index].values, coloredBallsAttributes[index].name, labelType));
    }
  }
}

class Ball {
  constructor(x, y, color, colorName, labelType) {
    this.ballRadius = 13.5;
    this.ballDiameter = 27;
    this.color = color;
    this.colorName = colorName
    this.speed = 0;
    this.position = createVector(x, y);
    this.prevPosition = createVector(x, y);
    this.teleportCooldown = 0;
    this.isCueBallClicked = false;

    // Ball setup
    const options = {frictionAir: 0.005, friction: 0, restitution: 1, label: labelType}
    this.ball = Bodies.circle(this.position.x, this.position.y, this.ballRadius, {...options});
    World.add(world, this.ball);

    // Set the game object property on the Matter.js body
    this.ball.object = this;
  }

  drawBall() {
    fill(this.color);
    drawVertices(this.ball.vertices);
  }

  updateBall() {
    // Update the prevPosition first
    this.prevPosition.set(this.position);
    // Get current position of ball and set it to position
    this.position.x = this.ball.position.x;
    this.position.y = this.ball.position.y;

    // Calculate the speed
    this.speed = p5.Vector.dist(this.position, this.prevPosition) / deltaTime;
  }

  checkClick() {
    // Check if the player clicks inside the cueball
    if (dist(mouseX, mouseY, cueBall.position.x, cueBall.position.y) < cueBall.ballRadius) cueBall.isCueBallClicked = true;
  }

  teleportCooldownCounter() {
    if (this.teleportCooldown > 0) this.teleportCooldown--;
  }
  
  /** Set ball's position be within table if it happens to glitch outside */
  preventTeleport() {
    // Min and max coordinates ball is within table
    const min = {x: 185, y: 133};
    const minInner = {x: 239, y: 189};
    const max = {x: 1214, y: 666};
    const maxInner = {x: 1161, y: 612};

    // Check if the ball is outside the table
    if (this.position.x < min.x) {
      Body.setPosition(this.ball, { x: minInner.x, y: this.position.y});
      console.log('Out of bounds X!');
    } else if (this.position.x > max.x) {
      Body.setPosition(this.ball, { x: maxInner.x, y: this.position.y});
      console.log('Out of bounds X!');
    }

    if (this.position.y < min.y) {
      Body.setPosition(this.ball, { x: this.position.x, y: minInner.y});
      console.log('Out of bounds Y!');
    } else if (this.position.y > max.y) {
      Body.setPosition(this.ball, { x: this.position.x, y: maxInner.y});
      console.log('Out of bounds Y!');
    }
  }
}

class Teleporters {
  setupTeleporters() {
    this.teleporter1 = Bodies.circle(0, 0, 15, {isStatic: true, isSensor: true, label: 'teleporter'});
    this.teleporter2 = Bodies.circle(0, 0, 15, {isStatic: true, isSensor: true, label: 'teleporter'});
    this.teleporterAppearance1 = Bodies.circle(0, 0, 20, {isStatic: true});
    this.teleporterAppearance2 = Bodies.circle(0, 0, 20, {isStatic: true});
    World.add(world, [this.teleporter1, this.teleporter2]);
  }

  drawTeleporters() {
    push();
    strokeWeight(5);
    stroke(255, 93, 0);
    fill(255, 154, 0);
    drawVertices(this.teleporterAppearance1.vertices);
    stroke(0, 101, 255);
    fill(0, 162, 255);
    drawVertices(this.teleporterAppearance2.vertices);
    pop();
  }

  // Use sin and cos to make teleporters rotate.
  updateTeleporters() {
    let pos1 = {x: cos(frameCount) * 100 + width/2, y: sin(frameCount) * 100 + height/2};
    let pos2 = {x: cos(frameCount + 180) * 100 + width/2, y: sin(frameCount + 180) * 100 + height/2};
    Body.setPosition(this.teleporter1, {x: pos1.x, y: pos1.y});
    Body.setPosition(this.teleporter2, {x: pos2.x, y: pos2.y});
    Body.setPosition(this.teleporterAppearance1, {x: pos1.x, y: pos1.y});
    Body.setPosition(this.teleporterAppearance2, {x: pos2.x, y: pos2.y});
  }
}

class CollisionHandler {
  /** HANDLE CUEBALL COLLISION. Remove cueBall and go into 'placing' mode when cueball is pocketed. */
  pocketedCueBall() {
    console.log('CUE BALL POCKETED!');
    World.remove(world, cueBall.ball);
    cueBall = null;
    gameHandler.gamePhase = 'placing';
  }

  /** HANDLE COLOREDBALLS COLLISION. Place coloredBall back to original position when pocketed. */
  pocketedColoredBall(pairA, pairB) {
    for (let i = 0; i < coloredBalls.length; i++) {
      // Find which body the colored ball is and the color of the ball.
      let collidedColoredBall = pairA.label === 'coloredBall' ? pairA.object : pairB.object;
      let colorName = collidedColoredBall.colorName;

      // Compare the colors. Remove collided ball from world and array, then create and push a new colored ball.
      if (colorName === coloredBalls[i].colorName) {
        World.remove(world, collidedColoredBall.ball);
        coloredBalls[i] = null;
        coloredBalls[i] = new Ball(coloredBallsAttributes[i].position.x, coloredBallsAttributes[i].position.y, coloredBallsAttributes[i].values, coloredBallsAttributes[i].name, 'coloredBall')
        console.log(`${colorName} ball pocketed! You gained ${coloredBallsAttributes[i].points} points`);
        gameHandler.coloredBallPocketCount++;
        gameHandler.score += coloredBallsAttributes[i].points;
      }
    }
  }

  /** HANDLE REDBALLS COLLISION. Place coloredBall back to original position when pocketed. */
  pocketedRedBall(pairA, pairB) {
    for (let i = 0; i < redBalls.length; i++) {
      // Find which body the red ball is.
      let collidedRedBall = pairA.label === 'redBall' ? pairA.object : pairB.object;
      let index = redBalls.indexOf(collidedRedBall);

      if (index === i) {
        // Remove collided ball from world and array.
        World.remove(world, collidedRedBall.ball);
        redBalls.splice(i, 1);
        console.log(`Red ball pocketed! You gained 1 point!`);
        gameHandler.coloredBallPocketCount = 0;
        gameHandler.score++;
      }
    }
  }

  /** HANDLE TELEPORTER COLLISION WITH CUEBALL. Move ball position from teleporter1 to teleporter2 and vice versa. */
  teleportedCueBall(pairA, pairB) {
    let collidedCueBall = pairA.label === 'cueBall' ? pairA.object : pairB.object;
    if (collidedCueBall.teleportCooldown <= 0) {
      let teleporter = pairA.label === 'teleporter' ? pairA : pairB;
      let targetTeleporter = teleporter === teleporters.teleporter1 ? teleporters.teleporter2 : teleporters.teleporter1;
      Body.setPosition(collidedCueBall.ball, { x: targetTeleporter.position.x, y: targetTeleporter.position.y});
      collidedCueBall.teleportCooldown = 10;
    }
  }

  /** HANDLE TELEPORTER COLLISION WITH COLOREDBALLS. Move ball position from teleporter1 to teleporter2 and vice versa. */
  teleportedColoredBall(pairA, pairB) {
    for (let i = 0; i < coloredBalls.length; i++) {
      let collidedColoredBall = pairA.label === 'coloredBall' ? pairA.object : pairB.object;

      if (collidedColoredBall.teleportCooldown <= 0) {
        let teleporter = pairA.label === 'teleporter' ? pairA : pairB;
        let targetTeleporter = teleporter === teleporters.teleporter1 ? teleporters.teleporter2 : teleporters.teleporter1;
        Body.setPosition(collidedColoredBall.ball, { x: targetTeleporter.position.x, y: targetTeleporter.position.y});
        collidedColoredBall.teleportCooldown = 10;
      }
    }
  }

  /** HANDLE TELEPORTER COLLISION WITH REDBALLS. Move ball position from teleporter1 to teleporter2 and vice versa. */
  teleportedRedBall(pairA, pairB) {
    for (let i = 0; i < redBalls.length; i++) {
      let collidedRedBall = pairA.label === 'redBall' ? pairA.object : pairB.object;

      if (collidedRedBall.teleportCooldown <= 0) {
        let teleporter = pairA.label === 'teleporter' ? pairA : pairB;
        let targetTeleporter = teleporter === teleporters.teleporter1 ? teleporters.teleporter2 : teleporters.teleporter1;
        Body.setPosition(collidedRedBall.ball, { x: targetTeleporter.position.x, y: targetTeleporter.position.y});
        collidedRedBall.teleportCooldown = 10;
      }
    }
  }
}

/** Draws the matter.js bodies on the canvas */
function drawVertices(vertices) {
  beginShape();
  for (let i = 0; i < vertices.length; i++) {
    vertex(vertices[i].x, vertices[i].y);
  }
  endShape(CLOSE);
}

/** Draws the matter.js constraints on the canvas */
function drawConstraint(constraint) {
  push();
  let offsetA = constraint.pointA;
  let posA = {x:0, y:0};
  if (constraint.bodyA) {
    posA = constraint.bodyA.position;
  }
  let offsetB = constraint.pointB;
  let posB = {x:0, y:0};
  if (constraint.bodyB) {
    posB = constraint.bodyB.position;
  }
  strokeWeight(5);
  stroke(255);
  line(
    posA.x + offsetA.x,
    posA.y + offsetA.y,
    posB.x + offsetB.x,
    posB.y + offsetB.y
  );
  pop();
}

/**
 * COMMENTARY
 * 
 * For this snooker project, I opted for a mouse-based cue function. This desgin choice is made to enhance
 * the player's experience. I wanted to provide an intuitive control by mimicking the pulling back action of
 * a cue stick. Also, I did not want to include the use of keyboard inputs alongside mouse inputs 
 * to make it easier for the player to just rely on using a single type of input.
 * The function works by allowing the player to drag and hold to create a constraint. When the mouse is
 * released, the constraint disappears and a force will act upon the ball depending on the length of the
 * constraint. This simulates a 'striking' action.
 * 
 * For the extension, I decided to incorporate teleporters. I added 2 teleporters that rotate around the
 * middle of the table. One of them is orange and the other is blue. It is referenced from a popular puzzle
 * game called Portal. The teleporters act as a transport system that teleports balls between different locations.
 * Specifically between the location of the two portals. When a ball enters either one of the teleporters, it will be
 * instantly transported to the other teleporter. This adds some complexity to the snooker game which
 * encourages the player to think and strategise. The decision to place the teleporters in the middle of the 
 * table was to ensure that it has a big impact. Adding rotation also prevents the teleporters from becoming stale.
 * 
 * In summary, the addition of the portals and the decision to use mouse-based cue function helps to enchance the 
 * overall gaming experience. The mouse-based cue function makes the controls more intuitive and simple. While
 * the portal system makes the game more complex. This design enables players to play the game with ease, focusing
 * more on the challenging gameplay rather than intricate controls.
 * 
 */