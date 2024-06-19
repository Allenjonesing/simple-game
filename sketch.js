let player;
let enemy;
let playerImg;
let enemyImg;

function preload() {
    playerImg = loadImage('assets/player.png');
    enemyImg = loadImage('assets/enemy.png');
}

function setup() {
    createCanvas(800, 600);
    player = new Player(100, 100);
    enemy = new Enemy(400, 300);
}

function draw() {
    background(0);
    player.display();
    enemy.display();
}

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    display() {
        image(playerImg, this.x, this.y);
    }
}

class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    display() {
        image(enemyImg, this.x, this.y);
    }
}
