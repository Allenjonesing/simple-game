const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#2d2d2d',
    parent: 'game-container',
    scene: {
        preload: preload,
        create: create,
        update: update
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

const game = new Phaser.Game(config);
let player;
let otherPlayers = {};
let enemies;
let projectiles;
let cursors;
let client;
let scoreText;
let timeText;
let score = 0;
let timeSurvived = 0;
const disconnectionTimeout = 5000;
let disconnectTimeouts = {};

function preload() {
    this.load.image('player', 'assets/playerShip.png');
    this.load.image('enemy1', 'assets/enemy1.png');
    this.load.image('enemy2', 'assets/enemy2.png');
    this.load.image('enemy3', 'assets/enemy3.png');
    this.load.image('projectile', 'assets/projectile.png');
}

function create() {
    const scene = this;

    client = new Photon.LoadBalancing.LoadBalancingClient(Photon.ConnectionProtocol.Wss, "your_app_id", "1.0");

    client.onStateChange = function(state) {
        console.log("State:", state);
    };

    client.onEvent = function(code, content, actorNr) {
        if (code === 1) {
            if (content.playerId !== player.id) {
                if (!otherPlayers[content.playerId]) {
                    otherPlayers[content.playerId] = createOtherPlayer(content.x, content.y, scene);
                } else {
                    otherPlayers[content.playerId].setPosition(content.x, content.y);
                }
            }
        }
    };

    client.onJoinRoom = function() {
        player = createPlayer(scene);
        client.raiseEvent(1, { playerId: player.id, x: player.x, y: player.y });
    };

    client.onLeaveRoom = function() {
        removePlayer(client.myActor().actorNr);
    };

    client.onPlayerLeftRoom = function(player) {
        schedulePlayerRemoval(player.actorNr);
    };

    client.onPlayerDisconnected = function(player) {
        schedulePlayerRemoval(player.actorNr);
    };

    client.onError = function(errorCode, errorMsg) {
        console.log(`Error: ${errorCode} - ${errorMsg}`);
    };

    client.onRoomListUpdate = function(rooms) {
        if (rooms.length === 0) {
            createRoom();
        } else {
            client.joinRandomRoom();
        }
    };

    client.onRoomList = function(rooms) {
        if (rooms.length === 0) {
            createRoom();
        } else {
            client.joinRandomRoom();
        }
    };

    client.onJoinRoomFailed = function(errorCode, errorMsg) {
        createRoom();
    };

    client.onConnectedToMaster = function() {
        client.joinLobby();
    };

    function createRoom() {
        const roomOptions = {
            isVisible: true,
            isOpen: true,
            maxPlayers: 10,
            playerTtl: 60000
        };
        client.createRoom(`room_${Math.floor(Math.random() * 10000)}`, roomOptions);
    }

    client.connectToRegionMaster("us");

    cursors = this.input.keyboard.createCursorKeys();

    scoreText = this.add.text(10, 10, 'Score: 0', { font: '16px Arial', fill: '#ffffff' });
    timeText = this.add.text(10, 30, 'Time: 0', { font: '16px Arial', fill: '#ffffff' });
    this.time.addEvent({
        delay: 1000,
        callback: updateTime,
        callbackScope: this,
        loop: true
    });

    enemies = this.physics.add.group();
    this.time.addEvent({
        delay: 1000,
        callback: spawnEnemy,
        callbackScope: this,
        loop: true
    });

    projectiles = this.physics.add.group();
    this.physics.add.collider(enemies, projectiles, hitEnemy, null, this);

    this.time.addEvent({
        delay: 300,
        callback: autoFire,
        callbackScope: this,
        loop: true
    });
}

function update() {
    if (player) {
        if (cursors.left.isDown) {
            player.x -= 5;
        } else if (cursors.right.isDown) {
            player.x += 5;
        }

        if (cursors.up.isDown) {
            player.y -= 5;
        } else if (cursors.down.isDown) {
            player.y += 5;
        }

        client.raiseEvent(1, { playerId: player.id, x: player.x, y: player.y });
    }
}

function autoFire() {
    if (player) {
        fireProjectile(player.x, player.y - 20);
    }
}

function fireProjectile(x, y) {
    const projectile = this.physics.add.image(x, y, 'projectile').setScale(0.05);
    projectile.setVelocityY(-300);
    projectiles.add(projectile);
}

function spawnEnemy() {
    const x = Phaser.Math.Between(0, game.config.width);
    const y = 0;
    const enemy = this.physics.add.image(x, y, `enemy${Phaser.Math.Between(1, 3)}`).setScale(0.1);
    enemy.setVelocityY(100);
    enemies.add(enemy);
}

function hitEnemy(enemy, projectile) {
    enemy.destroy();
    projectile.destroy();
    score += 10;
    scoreText.setText('Score: ' + score);
}

function updateTime() {
    timeSurvived += 1;
    timeText.setText('Time: ' + timeSurvived);
}

function createPlayer(scene) {
    const playerSprite = scene.add.image(game.config.width / 2, game.config.height - 50, 'player').setScale(0.1);
    playerSprite.id = client.myActor().actorNr;
    return playerSprite;
}

function createOtherPlayer(x, y, scene) {
    const otherPlayerSprite = scene.add.image(x, y, 'player').setScale(0.1);
    return otherPlayerSprite;
}

function schedulePlayerRemoval(actorNr) {
    if (disconnectTimeouts[actorNr]) {
        clearTimeout(disconnectTimeouts[actorNr]);
    }
    disconnectTimeouts[actorNr] = setTimeout(() => {
        removePlayer(actorNr);
        delete disconnectTimeouts[actorNr];
    }, disconnectionTimeout);
}

function removePlayer(actorNr) {
    if (otherPlayers[actorNr]) {
        otherPlayers[actorNr].destroy();
        delete otherPlayers[actorNr];
    } else if (player && player.id === actorNr) {
        player.destroy();
        player = null;
    }
}
